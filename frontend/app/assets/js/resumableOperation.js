import { log } from './log.js';
import { storageHandler } from './storageHandler.js';
import * as enums from './enums.js';
import { notificationHandler } from './notificationHandler.js';
import { processQueue } from './queue.js';

/**
 * OperationState - Enum for resumable operation states
 */
export const OperationState = {
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  PAUSING: "PAUSING",
  PAUSED: "PAUSED",
  STOPPING: "STOPPING",
  STOPPED: "STOPPED",
  COMPLETED: "COMPLETED"
};

/**
 * ResumableOperationRegistry - Manages resumable operations with checkpoint-based pause/resume
 */
export class ResumableOperationRegistry {
  constructor() {
    this._activeOperations = new Map();
    this._currentOperationId = null;
    this._pausePromise = null;
    this._pauseResolve = null;
    this._clearStateOnStop = false;
  }

  /**
   * Register a new operation
   * @param {string} operationId - Unique operation ID
   * @param {string} operationType - Type of operation (DATE_BASED_BULK, MIGRATE, etc.)
   * @param {Object} params - Operation parameters
   * @param {string[]} checkpoints - Array of checkpoint names
   */
  registerOperation(operationId, operationType, params, checkpoints) {
    this._currentOperationId = operationId;
    this._activeOperations.set(operationId, {
      id: operationId,
      type: operationType,
      params: params,
      checkpoints: checkpoints,
      currentCheckpointIndex: 0,
      state: OperationState.RUNNING,
      stats: { processed: 0, total: 0, success: 0, failed: 0 },
      timestamp: Date.now(),
      checkpointData: null
    });
    
    log.info('resumableOp', `Registered operation ${operationId} of type ${operationType}`);
    this._notifyUIStateChanged();
    return operationId;
  }

  /**
   * Unregister an operation
   * @param {string} operationId 
   */
  unregisterOperation(operationId) {
    this._activeOperations.delete(operationId);
    if (this._currentOperationId === operationId) {
      this._currentOperationId = null;
      this._clearStateOnStop = false;
    }
    log.info('resumableOp', `Unregistered operation ${operationId}`);
    this._notifyUIStateChanged();
  }

  /**
   * Request pause - operation will pause at next checkpoint
   * @returns {Promise<boolean>}
   */
  async requestPause() {
    if (!this._currentOperationId) {
      log.warn('resumableOp', 'No current operation to pause');
      return { success: false, error: 'No operation running' };
    }

    const op = this._activeOperations.get(this._currentOperationId);
    if (!op || op.state !== OperationState.RUNNING) {
      log.warn('resumableOp', `Cannot pause operation in state: ${op?.state}`);
      return { success: false, error: 'Operation not running' };
    }

    // Create promise FIRST, then change state (fixes race condition)
    this._pausePromise = new Promise((resolve) => {
      this._pauseResolve = resolve;
    });
    
    op.state = OperationState.PAUSING;
    log.info('resumableOp', `Pause requested for operation ${this._currentOperationId}`);

    this._notifyUIStateChanged();
    return { success: true };
  }

  /**
   * Called by operation when it reaches a safe checkpoint
   * @param {Object} checkpointData - Data to save at checkpoint
   * @returns {Promise<Object>} - { shouldContinue: boolean, paused: boolean, stopped: boolean }
   */
  async checkpointReached(checkpointData) {
    if (!this._currentOperationId) {
      return { shouldContinue: true };
    }

    const op = this._activeOperations.get(this._currentOperationId);
    if (!op) {
      return { shouldContinue: true };
    }

    // Update checkpoint data
    op.checkpointData = checkpointData;
    op.currentCheckpointIndex = op.checkpoints.indexOf(checkpointData.stage);

    // Save state at checkpoint
    await this._saveCheckpointState(op, checkpointData);

    log.info('resumableOp', `Checkpoint reached: ${checkpointData.stage} for operation ${this._currentOperationId}`);

    if (op.state === OperationState.PAUSING) {
      op.state = OperationState.PAUSED;
      await this._persistPausedState(op, checkpointData);

      // Resolve the pause promise with proper error handling and cleanup
      if (this._pauseResolve) {
        try {
          this._pauseResolve();
        } catch (e) {
          log.err('resumableOp', `Error resolving pause promise: ${e}`);
        }
        this._pauseResolve = null;
      } else {
        log.warn('resumableOp', 'checkpointReached in PAUSING state but no _pauseResolve available');
      }
      
      // Always clear the pause promise to prevent memory leaks
      this._pausePromise = null;

      log.info('resumableOp', `Operation ${this._currentOperationId} paused at checkpoint ${checkpointData.stage}`);
      this._notifyUIStateChanged();
      return { shouldContinue: false, paused: true };
    }

    if (op.state === OperationState.STOPPING) {
      op.state = OperationState.STOPPED;
      // Only persist stopped state if clearState was NOT requested
      if (!this._clearStateOnStop) {
        await this._persistStoppedState(op, checkpointData);
      }
      this._clearStateOnStop = false; // Reset the flag
      log.info('resumableOp', `Operation ${this._currentOperationId} stopped at checkpoint ${checkpointData.stage}`);
      this._notifyUIStateChanged();
      return { shouldContinue: false, stopped: true };
    }

    return { shouldContinue: true };
  }

  /**
   * Request stop
   * @param {boolean} clearState - Whether to clear saved state
   * @returns {Object}
   */
  async requestStop(clearState = false) {
    if (!this._currentOperationId) {
      return { success: false, error: 'No operation running' };
    }

    const op = this._activeOperations.get(this._currentOperationId);
    if (!op) {
      return { success: false, error: 'Operation not found' };
    }

    // If operation is already paused, immediately stop and unregister
    if (op.state === OperationState.PAUSED) {
      log.info('resumableOp', `Operation ${this._currentOperationId} was paused, stopping immediately`);
      
      // Map operation type to BanSource for proper finish notification
      const banSourceMap = {
        'DATE_BASED_BULK': enums.BanSource.DATE_BASED_BULK,
        'MIGRATE_BLOCKED_TO_MUTED': enums.BanSource.MIGRATE_BLOCKED_TO_MUTED,
        'BLOCK_MUTED_USERS': enums.BanSource.BLOCK_MUTED_USERS,
        'BLOCK_TITLES': enums.BanSource.BLOCKED_MUTED_TITLES,
        'REFRESH_MUTED_LIST': enums.BanSource.REFRESH_MUTED_LIST,
        'REFRESH_BLOCKED_LIST': enums.BanSource.REFRESH_BLOCKED_LIST
      };
      const banSource = banSourceMap[op.type] || enums.BanSource.DATE_BASED_BULK;
      
      // Send FINISH notification to properly complete the task in queue
      notificationHandler.finishErrorEarlyStop(banSource, null, processQueue.currentItemMetadata);
      
      // First, set state to STOPPED and notify UI
      op.state = OperationState.STOPPED;
      this._notifyUIStateChanged();
      
      // Clear state if requested
      if (clearState) {
        await storageHandler.clearOperationState(this._currentOperationId);
      }
      
      // Now unregister without sending another notification (we already sent STOPPED)
      this._activeOperations.delete(this._currentOperationId);
      const stoppedId = this._currentOperationId;
      this._currentOperationId = null;
      this._clearStateOnStop = false;
      
      log.info('resumableOp', `Unregistered operation ${stoppedId} after stop`);
      return { success: true, wasPaused: true };
    }

    op.state = OperationState.STOPPING;
    this._clearStateOnStop = clearState;
    log.info('resumableOp', `Stop requested for operation ${this._currentOperationId} (clearState: ${clearState})`);

    if (clearState) {
      await storageHandler.clearOperationState(this._currentOperationId);
    }

    this._notifyUIStateChanged();
    return { success: true };
  }

  /**
   * Mark operation as completed
   * FIX: Don't clear storage when operation was paused (to allow resume)
   */
  async completeOperation() {
    if (!this._currentOperationId) return;

    const op = this._activeOperations.get(this._currentOperationId);
    if (op) {
      const wasPaused = op.state === OperationState.PAUSED;
      op.state = OperationState.COMPLETED;
      this._clearStateOnStop = false;
      log.info('resumableOp', `Operation ${this._currentOperationId} completed (wasPaused: ${wasPaused})`);
      
      if (!wasPaused) {
        await storageHandler.clearOperationState(this._currentOperationId);
      }
      
      this._notifyUIStateChanged();
    }
  }

  /**
   * Get current operation
   * @returns {Object|null}
   */
  getCurrentOperation() {
    if (!this._currentOperationId) return null;
    return this._activeOperations.get(this._currentOperationId);
  }

  /**
   * Get current operation ID
   * @returns {string|null}
   */
  getCurrentOperationId() {
    return this._currentOperationId;
  }

  /**
   * Check if an operation is currently running
   * @returns {boolean}
   */
  isOperationRunning() {
    const op = this.getCurrentOperation();
    return op && op.state === OperationState.RUNNING;
  }

  /**
   * Check if there's a paused operation
   * @returns {boolean}
   */
  hasPausedOperation() {
    const op = this.getCurrentOperation();
    return op && op.state === OperationState.PAUSED;
  }

  /**
   * Check if pause is requested
   * @returns {boolean}
   */
  isPauseRequested() {
    const op = this.getCurrentOperation();
    return op && op.state === OperationState.PAUSING;
  }

  /**
   * Wait for pause to complete
   * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
   * @returns {Promise<{paused: boolean, timeout: boolean}>} - Result indicating if pause completed or timed out
   */
  async waitForPause(timeoutMs = 30000) {
    if (!this._pausePromise) {
      log.warn('resumableOp', 'waitForPause called but no pause promise exists');
      return { paused: false, timeout: false };
    }
    
    // Set up timeout with proper cleanup
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        timeoutId = null; // Clear the timeout ID
        reject(new Error('Pause timeout'));
      }, timeoutMs);
    });
    
    try {
      await Promise.race([
        this._pausePromise,
        timeoutPromise
      ]);
      
      log.info('resumableOp', 'Pause completed successfully at checkpoint');
      return { paused: true, timeout: false };
    } catch (error) {
      // Always clear the timeout if it was set
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (error.message === 'Pause timeout') {
        log.warn('resumableOp', `Pause timed out after ${timeoutMs}ms - operation will continue`);
        // Reset state to avoid getting stuck
        const op = this.getCurrentOperation();
        if (op && op.state === OperationState.PAUSING) {
          op.state = OperationState.RUNNING;
          log.info('resumableOp', 'Reset operation state from PAUSING to RUNNING after timeout');
          this._notifyUIStateChanged();
        }
        // Clear the pause promise since we're giving up on this pause request
        this._pausePromise = null;
        this._pauseResolve = null;
        return { paused: false, timeout: true };
      } else {
        log.err('resumableOp', `waitForPause error: ${error.message}`);
        // For other errors, also reset state and cleanup
        const op = this.getCurrentOperation();
        if (op && op.state === OperationState.PAUSING) {
          op.state = OperationState.RUNNING;
          this._notifyUIStateChanged();
        }
        this._pausePromise = null;
        this._pauseResolve = null;
        return { paused: false, timeout: false };
      }
    } finally {
      // Always clear timeout if it exists
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Ensure cleanup happens in all cases to prevent memory leaks
      if (this._pausePromise) {
        // If we reach here, it means the promise wasn't resolved/rejected properly
        // This should not happen with proper checkpoint handling, but we clean up just in case
        this._pausePromise = null;
        this._pauseResolve = null;
      }
    }
  }

  /**
   * Save checkpoint state to storage
   * @private
   */
  async _saveCheckpointState(op, checkpointData) {
    const stateData = {
      operationId: op.id,
      operationType: op.type,
      params: op.params,
      currentCheckpoint: checkpointData.stage,
      currentCheckpointIndex: op.currentCheckpointIndex,
      checkpointData: checkpointData,
      stats: op.stats,
      timestamp: Date.now(),
      state: op.state
    };

    await storageHandler.saveOperationState(op.id, stateData);
  }

  /**
   * Persist paused state
   * @private
   */
  async _persistPausedState(op, checkpointData) {
    const stateData = {
      operationId: op.id,
      operationType: op.type,
      params: op.params,
      currentCheckpoint: checkpointData.stage,
      currentCheckpointIndex: op.currentCheckpointIndex,
      checkpointData: checkpointData,
      stats: op.stats,
      timestamp: Date.now(),
      state: OperationState.PAUSED
    };

    await storageHandler.saveOperationState(op.id, stateData);
  }

  /**
   * Persist stopped state
   * @private
   */
  async _persistStoppedState(op, checkpointData) {
    const stateData = {
      operationId: op.id,
      operationType: op.type,
      params: op.params,
      currentCheckpoint: checkpointData.stage,
      currentCheckpointIndex: op.currentCheckpointIndex,
      checkpointData: checkpointData,
      stats: op.stats,
      timestamp: Date.now(),
      state: OperationState.STOPPED
    };

    await storageHandler.saveOperationState(op.id, stateData);
  }

  /**
   * Notify UI of state change
   * @private
   */
  _notifyUIStateChanged() {
    const op = this.getCurrentOperation();
    
    // Map operation state to UI state for buttonStateManager
    let newState = 'INACTIVE';
    if (op) {
      switch (op.state) {
        case OperationState.RUNNING:
          newState = 'ACTIVE';
          break;
        case OperationState.PAUSING:
          newState = 'PAUSING';
          break;
        case OperationState.PAUSED:
          newState = 'PAUSED';
          break;
        case OperationState.STOPPING:
          newState = 'STOPPING';
          break;
        case OperationState.STOPPED:
          newState = 'STOPPED';
          break;
        case OperationState.COMPLETED:
          newState = 'INACTIVE';
          break;
        default:
          newState = 'INACTIVE';
      }
    }
    
    // Send message to notification page with both formats for compatibility
    // - newState/operationData for buttonStateManager.js
    // - operation for notification.js
    // Include stats for displaying progress when paused
    try {
      chrome.runtime.sendMessage({
        action: "operationStateChanged",
        newState: newState,
        operationData: op,
        operation: op,
        stats: op?.stats || op?.checkpointData || null
      }).catch(() => {
        // Ignore errors if notification page is not open
      });
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Singleton instance
 */
export const resumableOperationRegistry = new ResumableOperationRegistry();

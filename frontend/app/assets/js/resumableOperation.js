import { log } from './log.js';
import { storageHandler } from './storageHandler.js';
import * as enums from './enums.js';

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

    op.state = OperationState.PAUSING;
    log.info('resumableOp', `Pause requested for operation ${this._currentOperationId}`);

    // Create a promise that will be resolved when operation reaches checkpoint
    this._pausePromise = new Promise((resolve) => {
      this._pauseResolve = resolve;
    });

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

      // Resolve the pause promise
      if (this._pauseResolve) {
        this._pauseResolve();
        this._pauseResolve = null;
      }

      log.info('resumableOp', `Operation ${this._currentOperationId} paused at checkpoint ${checkpointData.stage}`);
      this._notifyUIStateChanged();
      return { shouldContinue: false, paused: true };
    }

    if (op.state === OperationState.STOPPING) {
      op.state = OperationState.STOPPED;
      await this._persistStoppedState(op, checkpointData);
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

    op.state = OperationState.STOPPING;
    log.info('resumableOp', `Stop requested for operation ${this._currentOperationId}`);

    if (clearState) {
      await storageHandler.clearOperationState(this._currentOperationId);
    }

    this._notifyUIStateChanged();
    return { success: true };
  }

  /**
   * Mark operation as completed
   */
  async completeOperation() {
    if (!this._currentOperationId) return;

    const op = this._activeOperations.get(this._currentOperationId);
    if (op) {
      op.state = OperationState.COMPLETED;
      log.info('resumableOp', `Operation ${this._currentOperationId} completed`);
      
      // Clear saved state on successful completion
      await storageHandler.clearOperationState(this._currentOperationId);
      
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
   * Check if pause is requested
   * @returns {boolean}
   */
  isPauseRequested() {
    const op = this.getCurrentOperation();
    return op && op.state === OperationState.PAUSING;
  }

  /**
   * Wait for pause to complete
   * @returns {Promise<void>}
   */
  async waitForPause() {
    if (this._pausePromise) {
      await this._pausePromise;
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
    
    // Send message to notification page
    try {
      chrome.runtime.sendMessage({
        action: "operationStateChanged",
        operation: op
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

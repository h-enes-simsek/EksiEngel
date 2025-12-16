/**
 * Button State Manager for EksiEngel Plus Extension
 * Manages button states across the extension to prevent race conditions
 * and ensure consistent user experience during operation state transitions.
 */

import { storageHandler } from './storageHandler.js';
import { processQueue } from './queue.js';

class ButtonStateManager {
  constructor() {
    this.buttonStates = new Map();
    this.operationState = 'INACTIVE'; // INACTIVE, ACTIVE, STOPPED, COOLDOWN
    this.isProcessing = false;
    this.initialized = false;
    this.listCounts = { muted: 0, blocked: 0, mutedTotal: 0, blockedTotal: 0 }; // Cache for list counts
  }

  /**
   * Get current queue size for validation
   */
  async getQueueSize() {
    try {
      return processQueue.size;
    } catch (error) {
      console.warn('Failed to get queue size:', error);
      return 0;
    }
  }

  /**
   * Check if operation can be continued based on both state and queue
   */
  async canContinueOperation(operationState, activeOperation) {
    // First check if state allows continuation
    if (!(operationState === 'STOPPED' || operationState === 'COOLDOWN')) {
      return false;
    }

    // For COOLDOWN state, allow continuation if marked as canContinue
    if (operationState === 'COOLDOWN' && activeOperation?.canContinueAfterCooldown) {
      return true;
    }

    // For STOPPED state, check if operation was marked as canContinue
    if (operationState === 'STOPPED' && activeOperation?.canContinue) {
      // Validate that there are actually items in the queue to continue
      const queueSize = await this.getQueueSize();
      return queueSize > 0;
    }

    return false;
  }

  /**
   * Enhanced operation state check with queue validation
   */
  async checkEnhancedOperationState() {
    try {
      const activeOperation = await storageHandler.getActiveOperation();
      if (activeOperation) {
        const canContinue = await this.canContinueOperation(activeOperation.state, activeOperation);
        this.operationState = canContinue ? activeOperation.state : 'INACTIVE';
      } else {
        this.operationState = 'INACTIVE';
      }
    } catch (error) {
      console.warn('Failed to check enhanced operation state:', error);
      this.operationState = 'INACTIVE';
    }
  }

  /**
   * Initialize button state manager and set up event listeners
   */
  async initialize() {
    if (this.initialized) {
      console.log('ButtonStateManager already initialized');
      return;
    }
    
    await this.checkCurrentOperationState();
    await this.updateListCounts();
    this.setupMessageListeners();
    this.initialized = true;
    console.log('ButtonStateManager initialized with state:', this.operationState);
  }

  /**
   * Update cached list counts
   */
  async updateListCounts() {
    try {
      this.listCounts.muted = await storageHandler.getMutedUserCount();
      this.listCounts.blocked = await storageHandler.getBlockedUserCount();
      
      // Also check temporary storage for early stop scenarios
      const partialMutedData = await storageHandler.getPartialMutedUsers();
      const partialBlockedData = await storageHandler.getPartialBlockedUsers();
      
      // Add temporary data to counts for export button state management
      this.listCounts.mutedTotal = this.listCounts.muted + (partialMutedData?.usernames?.length || 0);
      this.listCounts.blockedTotal = this.listCounts.blocked + (partialBlockedData?.usernames?.length || 0);
      
      console.log('Updated list counts:', this.listCounts);
    } catch (error) {
      console.warn('Failed to update list counts:', error);
      this.listCounts.muted = 0;
      this.listCounts.blocked = 0;
      this.listCounts.mutedTotal = 0;
      this.listCounts.blockedTotal = 0;
    }
  }

  /**
   * Check current operation state from storage
   */
  async checkCurrentOperationState() {
    try {
      const activeOperation = await storageHandler.getActiveOperation();
      if (activeOperation) {
        this.operationState = activeOperation.state || 'ACTIVE';
      } else {
        this.operationState = 'INACTIVE';
      }
    } catch (error) {
      console.warn('Failed to check operation state:', error);
      this.operationState = 'INACTIVE';
    }
  }

  /**
   * Set up message listeners for operation state changes
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === 'operationStateChanged') {
        this.handleOperationStateChange(message.newState, message.operationData);
        sendResponse({ status: 'ok' });
      }
      return true; // Keep message channel open for async responses
    });
  }

  /**
   * Handle operation state changes
   */
  async handleOperationStateChange(newState, operationData) {
    console.log('ButtonStateManager: Operation state changed from', this.operationState, 'to', newState);
    
    const previousState = this.operationState;
    this.operationState = newState;
    
    // Update button states based on new operation state
    await this.updateAllButtonStates();
    
    // Trigger UI updates if needed
    this.notifyUIOfStateChange(previousState, newState);
  }

  /**
   * Update all button states based on current operation state
   */
  async updateAllButtonStates() {
    // Update list counts before updating button states
    await this.updateListCounts();
    
    const buttons = this.getAllManagedButtons();
    
    for (const button of buttons) {
      await this.updateButtonState(button.id, button.element);
    }
  }

  /**
   * Get all buttons that should be managed by this manager
   */
  getAllManagedButtons() {
    return [
      // Early stop button
      { id: 'earlyStop', element: document.getElementById('earlyStop') },
      
      // Continue/Discard operation buttons
      { id: 'continueOperationButton', element: document.getElementById('continueOperationButton') },
      { id: 'discardOperationButton', element: document.getElementById('discardOperationButton') },
      
      // Action buttons that should be disabled during operations
      { id: 'startMigration', element: document.getElementById('startMigration') },
      { id: 'startTitleMigration', element: document.getElementById('startTitleMigration') },
      { id: 'migrateBlockedToMuted', element: document.getElementById('migrateBlockedToMuted') },
      { id: 'btnBlockMutedUsers', element: document.getElementById('btnBlockMutedUsers') },
      { id: 'btnBlockTitlesOfBlockedMuted', element: document.getElementById('btnBlockTitlesOfBlockedMuted') },
      { id: 'migrateBlockedTitlesToUnblocked', element: document.getElementById('migrateBlockedTitlesToUnblocked') },
      { id: 'startUndobanAll', element: document.getElementById('startUndobanAll') },
      
      // List management buttons
      { id: 'refreshMutedList', element: document.getElementById('refreshMutedList') },
      { id: 'refreshBlockedList', element: document.getElementById('refreshBlockedList') },
      { id: 'exportMutedListCSV', element: document.getElementById('exportMutedListCSV') },
      { id: 'exportBlockedListCSV', element: document.getElementById('exportBlockedListCSV') },
      
      // Utility buttons
      { id: 'clearStoredData', element: document.getElementById('clearStoredData') },
      { id: 'openauthorListPage', element: document.getElementById('openauthorListPage') },
      { id: 'openFaq', element: document.getElementById('openFaq') }
    ].filter(button => button.element !== null);
  }

  /**
   * Update state for a specific button
   */
  async updateButtonState(buttonId, buttonElement) {
    if (!buttonElement) return;

    const currentState = this.buttonStates.get(buttonId) || {};
    const newState = await this.calculateButtonState(buttonId, buttonElement);

    // Only update if state has changed
    if (JSON.stringify(currentState) !== JSON.stringify(newState)) {
      this.applyButtonState(buttonElement, newState);
      this.buttonStates.set(buttonId, newState);
      
      console.log(`Button ${buttonId} state updated:`, newState);
    }
  }

  /**
   * Calculate the appropriate state for a button based on operation state
   * Enhanced version with queue validation
   */
  async calculateButtonState(buttonId, buttonElement) {
    const isOperationActive = this.operationState === 'ACTIVE';
    const isOperationStopped = this.operationState === 'STOPPED';
    const isOperationCooldown = this.operationState === 'COOLDOWN';
    const isProcessing = this.isProcessing;
    const originalInnerHTML = buttonElement ? buttonElement.innerHTML : '';

    switch (buttonId) {
      case 'earlyStop':
        return {
          disabled: !isOperationActive || isProcessing,
          title: !isOperationActive ? 'No active operation to stop' : 
                 isProcessing ? 'Stopping operation...' : 'Stop the current operation',
          innerHTML: isProcessing ? 
            '<span class="btn-icon">⏳</span><span class="btn-text">Durduruluyor...</span>' :
            '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>'
        };

      case 'continueOperationButton':
        // Enhanced logic: Only show if operation can actually be continued
        const activeOperation = await storageHandler.getActiveOperation();
        const canContinue = await this.canContinueOperation(this.operationState, activeOperation);
        return {
          disabled: !canContinue || isProcessing,
          title: !canContinue ? 
            (this.operationState === 'INACTIVE' ? 'No operation to continue' : 'Operation cannot be continued') :
            isProcessing ? 'Continuing operation...' : 'Continue the stopped operation',
          innerHTML: isProcessing ?
            '<span class="btn-icon">⏳</span><span class="btn-text">İşlem devam ettiriliyor...</span>' :
            '<span class="btn-icon">▶️</span><span class="btn-text">İşlemi Devam Ettir</span>'
        };

      case 'discardOperationButton':
        // Enhanced logic: Show if there's an operation that can be discarded
        const activeOp = await storageHandler.getActiveOperation();
        const canDiscard = activeOp && (this.operationState === 'STOPPED' || this.operationState === 'COOLDOWN');
        return {
          disabled: !canDiscard || isProcessing,
          title: !canDiscard ? 'No operation to discard' :
                 isProcessing ? 'Discarding operation...' : 'Discard the operation',
          innerHTML: isProcessing ?
            '<span class="btn-icon">⏳</span><span class="btn-text">İptal ediliyor...</span>' :
            '<span class="btn-icon">🗑️</span><span class="btn-text">İşlemi İptal Et</span>'
        };

      // Action buttons - should be disabled during any active operation
      case 'startMigration':
      case 'startTitleMigration':
      case 'migrateBlockedToMuted':
      case 'btnBlockMutedUsers':
      case 'btnBlockTitlesOfBlockedMuted':
      case 'migrateBlockedTitlesToUnblocked':
      case 'startUndobanAll':
        return {
          disabled: isOperationActive || isOperationCooldown || isProcessing,
          title: isOperationActive || isOperationCooldown ? 
            'Action blocked: Another operation is currently running' :
            isProcessing ? 'Processing...' : 'Start this action',
          innerHTML: originalInnerHTML // Keep original content
        };

      // List management buttons
      case 'refreshMutedList':
      case 'refreshBlockedList':
        return {
          disabled: isOperationActive || isOperationCooldown || isProcessing,
          title: isOperationActive || isOperationCooldown ? 
            'Refresh blocked: Another operation is currently running' :
            isProcessing ? 'Refreshing...' : 'Refresh the list',
          innerHTML: originalInnerHTML // Keep original content
        };

      case 'exportMutedListCSV':
        const mutedTotal = this.listCounts.mutedTotal || this.listCounts.muted;
        return {
          disabled: isOperationActive || isOperationCooldown || mutedTotal === 0,
          title: isOperationActive || isOperationCooldown ?
            'Export blocked: Another operation is currently running' :
            mutedTotal === 0 ? 'No muted users to export' : 'Export muted users list to CSV',
          innerHTML: originalInnerHTML // Keep original content
        };

      case 'exportBlockedListCSV':
        const blockedTotal = this.listCounts.blockedTotal || this.listCounts.blocked;
        return {
          disabled: isOperationActive || isOperationCooldown || blockedTotal === 0,
          title: isOperationActive || isOperationCooldown ?
            'Export blocked: Another operation is currently running' :
            blockedTotal === 0 ? 'No blocked users to export' : 'Export blocked users list to CSV',
          innerHTML: originalInnerHTML // Keep original content
        };

      // Utility buttons - generally available but may be restricted during operations
      case 'clearStoredData':
        return {
          disabled: isOperationActive || isOperationCooldown || isProcessing,
          title: isOperationActive || isOperationCooldown ? 
            'Clear blocked: Another operation is currently running' :
            isProcessing ? 'Clearing data...' : 'Clear all stored data',
          innerHTML: isProcessing ?
            '<span class="btn-icon">⏳</span><span class="btn-text">Temizleniyor...</span>' :
            '<span class="btn-icon">🗑️</span><span class="btn-text">Saklanan Verileri Temizle</span>'
        };

      case 'openauthorListPage':
      case 'openFaq':
        return {
          disabled: isProcessing,
          title: isProcessing ? 'Please wait for current operation to complete' : 
            'Open this page',
          innerHTML: originalInnerHTML // Keep original content
        };

      default:
        return {
          disabled: false,
          title: 'Button',
          innerHTML: originalInnerHTML
        };
    }
  }

  /**
   * Apply calculated state to a button element
   * Only update visual properties, never interfere with event handlers
   */
  applyButtonState(buttonElement, state) {
    if (!buttonElement) return;

    // Only update visual properties, don't interfere with event handlers
    buttonElement.disabled = state.disabled;
    buttonElement.title = state.title;
    
    // Only update innerHTML if it's different and not during processing to avoid interfering with user clicks
    if (state.innerHTML && buttonElement.innerHTML !== state.innerHTML && !this.isProcessing) {
      buttonElement.innerHTML = state.innerHTML;
    }
  }

  /**
   * Set processing state for a specific operation
   * Only updates visual feedback, doesn't interfere with event handling
   */
  setProcessingState(isProcessing, operationType = '') {
    this.isProcessing = isProcessing;
    console.log(`ButtonStateManager: Processing state set to ${isProcessing} for ${operationType}`);
    
    // Only update visual states, don't force refresh all buttons to avoid interfering with current events
    if (isProcessing) {
      // During processing, just update the specific operation buttons with visual feedback
      this.updateProcessingVisualStates(operationType);
    } else {
      // After processing, do a full update
      setTimeout(() => {
        this.updateAllButtonStates();
      }, 100); // Small delay to allow current events to complete
    }
  }

  /**
   * Update only visual states for processing feedback without interfering with events
   */
  updateProcessingVisualStates(operationType) {
    const earlyStopBtn = document.getElementById('earlyStop');
    const clearDataBtn = document.getElementById('clearStoredData');
    
    if (operationType === 'earlyStop' && earlyStopBtn) {
      earlyStopBtn.disabled = true;
      earlyStopBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Durduruluyor...</span>';
      earlyStopBtn.title = 'Stopping operation...';
    }
    
    if (operationType === 'clearStoredData' && clearDataBtn) {
      clearDataBtn.disabled = true;
      clearDataBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Temizleniyor...</span>';
      clearDataBtn.title = 'Clearing data...';
    }
  }

  /**
   * Notify UI components of state changes
   */
  notifyUIOfStateChange(previousState, newState) {
    // Dispatch custom event for UI components to listen to
    const event = new CustomEvent('operationStateChanged', {
      detail: {
        previousState,
        newState,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Get current operation state
   */
  getOperationState() {
    return this.operationState;
  }

  /**
   * Get current processing state
   */
  getProcessingState() {
    return this.isProcessing;
  }

  /**
   * Force refresh all button states (useful after page load or state changes)
   */
  async refreshAllButtonStates() {
    await this.checkCurrentOperationState();
    await this.updateListCounts();
    await this.updateAllButtonStates();
    console.log('ButtonStateManager: All button states refreshed');
  }

  /**
   * Reset button state manager (useful for testing or complete state reset)
   */
  reset() {
    this.buttonStates.clear();
    this.operationState = 'INACTIVE';
    this.isProcessing = false;
    this.initialized = false;
    this.listCounts = { muted: 0, blocked: 0, mutedTotal: 0, blockedTotal: 0 };
    console.log('ButtonStateManager: Reset to initial state');
  }
}

// Create and export singleton instance
export let buttonStateManager = new ButtonStateManager();
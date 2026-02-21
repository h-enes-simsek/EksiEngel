import { storageHandler } from './storageHandler.js';
import { processQueue } from './queue.js';
class ButtonStateManager {
  constructor() {
    this.buttonStates = new Map();
    this.operationState = 'INACTIVE';
    this.hasRunningTasks = false;
    this.isProcessing = false;
    this.initialized = false;
    this.listCounts = { muted: 0, blocked: 0, mutedTotal: 0, blockedTotal: 0 };
  }
  async getQueueSize() {
    try {
      return processQueue.size;
    } catch (error) {
      console.warn('Failed to get queue size:', error);
      return 0;
    }
  }
  async canContinueOperation(operationState, activeOperation) {
    if (!(operationState === 'STOPPED' || operationState === 'COOLDOWN')) return false;
    if (operationState === 'COOLDOWN' && activeOperation?.canContinueAfterCooldown) return true;
    if (operationState === 'STOPPED' && activeOperation?.canContinue) {
      const queueSize = await this.getQueueSize();
      return queueSize > 0;
    }
    return false;
  }
  async checkEnhancedOperationState() {
    try {
      const activeOperation = await storageHandler.getActiveOperation();
      if (activeOperation) {
        const canContinue = await this.canContinueOperation(activeOperation.state, activeOperation);
        this.operationState = canContinue ? activeOperation.state : 'INACTIVE';
      } else this.operationState = 'INACTIVE';
    } catch (error) {
      console.warn('Failed to check enhanced operation state:', error);
      this.operationState = 'INACTIVE';
    }
  }
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
  async updateListCounts() {
    try {
      this.listCounts.muted = await storageHandler.getMutedUserCount();
      this.listCounts.blocked = await storageHandler.getBlockedUserCount();
      const partialMutedData = await storageHandler.getPartialMutedUsers();
      const partialBlockedData = await storageHandler.getPartialBlockedUsers();
      this.listCounts.mutedTotal = this.listCounts.muted + (partialMutedData?.usernames?.length || 0);
      this.listCounts.blockedTotal = this.listCounts.blocked + (partialBlockedData?.usernames?.length || 0);
      console.log('Updated list counts:', this.listCounts);
    } catch (error) {
      console.warn('Failed to update list counts:', error);
      this.listCounts = { muted: 0, blocked: 0, mutedTotal: 0, blockedTotal: 0 };
    }
  }
  async checkCurrentOperationState() {
    try {
      // First check resumable operation registry for current operations
      const resumableOp = await this.getResumableOperationState();
      if (resumableOp) {
        this.operationState = resumableOp.state;
        this.hasRunningTasks = resumableOp.hasRunningTasks || false;
        return;
      }
      
      // Check for running tasks (like refresh operations) from background
      const runningTasksResponse = await this.getRunningTasksState();
      if (runningTasksResponse && runningTasksResponse.hasRunningTasks) {
        this.operationState = 'ACTIVE';
        this.hasRunningTasks = true;
        return;
      }
      
      // Fall back to legacy storage-based operations
      const activeOperation = await storageHandler.getActiveOperation();
      this.operationState = activeOperation ? (activeOperation.state || 'ACTIVE') : 'INACTIVE';
      this.hasRunningTasks = false;
    } catch (error) {
      console.warn('Failed to check operation state:', error);
      this.operationState = 'INACTIVE';
      this.hasRunningTasks = false;
    }
  }
  async getRunningTasksState() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "getRunningTasksState" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      return response;
    } catch (error) {
      console.warn('Failed to get running tasks state:', error);
      return null;
    }
  }

  async getResumableOperationState() {
    try {
      // Get current operation from background script
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "getCurrentOperation" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      
      if (response && response.operation) {
        const op = response.operation;
        // Map resumable operation states to UI states
        switch (op.state) {
          case 'RUNNING':
            return { state: 'ACTIVE', hasRunningTasks: true };
          case 'PAUSING':
            return { state: 'PAUSING', hasRunningTasks: true };
          case 'PAUSED':
            return { state: 'PAUSED', hasRunningTasks: true };
          case 'STOPPING':
            return { state: 'STOPPING', hasRunningTasks: true };
          case 'STOPPED':
            return { state: 'STOPPED', hasRunningTasks: false };
          case 'COMPLETED':
            return { state: 'INACTIVE', hasRunningTasks: false };
          default:
            return { state: 'INACTIVE', hasRunningTasks: false };
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get resumable operation state:', error);
      return null;
    }
  }
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === 'operationStateChanged') {
        // Handle both new format (newState/operationData) and legacy format (operation)
        const newState = message.newState || this._mapOperationStateToUIState(message.operation?.state);
        const operationData = message.operationData || message.operation;
        this.handleOperationStateChange(newState, operationData);
        sendResponse({ status: 'ok' });
      }
      return true;
    });
  }
  /**
   * Map operation state from resumableOperation to UI state
   * @param {string} operationState - State from resumableOperation (RUNNING, PAUSED, etc.)
   * @returns {string} - UI state (ACTIVE, PAUSED, etc.)
   */
  _mapOperationStateToUIState(operationState) {
    if (!operationState) return 'INACTIVE';
    
    switch (operationState) {
      case 'RUNNING':
        return 'ACTIVE';
      case 'PAUSING':
        return 'PAUSING';
      case 'PAUSED':
        return 'PAUSED';
      case 'STOPPING':
        return 'STOPPING';
      case 'STOPPED':
        return 'STOPPED';
      case 'COMPLETED':
        return 'INACTIVE';
      default:
        return 'INACTIVE';
    }
  }
  async handleOperationStateChange(newState, operationData) {
    console.log('ButtonStateManager: Operation state changed from', this.operationState, 'to', newState);
    const previousState = this.operationState;
    this.operationState = newState;
    await this.updateAllButtonStates();
    this.notifyUIOfStateChange(previousState, newState);
  }
  async updateAllButtonStates() {
    await this.updateListCounts();
    const buttons = this.getAllManagedButtons();
    for (const button of buttons) await this.updateButtonState(button.id, button.element);
  }
  getAllManagedButtons() {
    return [
      { id: 'earlyStop', element: document.getElementById('earlyStop') },
      { id: 'continueOperationButton', element: document.getElementById('continueOperationButton') },
      { id: 'discardOperationButton', element: document.getElementById('discardOperationButton') },
      { id: 'startMigration', element: document.getElementById('startMigration') },
      { id: 'startTitleMigration', element: document.getElementById('startTitleMigration') },
      { id: 'migrateBlockedToMuted', element: document.getElementById('migrateBlockedToMuted') },
      { id: 'btnBlockMutedUsers', element: document.getElementById('btnBlockMutedUsers') },
      { id: 'btnBlockTitlesOfBlockedMuted', element: document.getElementById('btnBlockTitlesOfBlockedMuted') },
      { id: 'migrateBlockedTitlesToUnblocked', element: document.getElementById('migrateBlockedTitlesToUnblocked') },
      { id: 'startUndobanAll', element: document.getElementById('startUndobanAll') },
      { id: 'refreshMutedList', element: document.getElementById('refreshMutedList') },
      { id: 'refreshBlockedList', element: document.getElementById('refreshBlockedList') },
      { id: 'refreshFollowedList', element: document.getElementById('refreshFollowedList') },
      { id: 'exportMutedListCSV', element: document.getElementById('exportMutedListCSV') },
      { id: 'exportBlockedListCSV', element: document.getElementById('exportBlockedListCSV') },
      { id: 'openauthorListPage', element: document.getElementById('openauthorListPage') },
      { id: 'openFaq', element: document.getElementById('openFaq') }
    ].filter(button => button.element !== null);
  }
  async updateButtonState(buttonId, buttonElement) {
    if (!buttonElement) return;
    const currentState = this.buttonStates.get(buttonId) || {};
    const newState = await this.calculateButtonState(buttonId, buttonElement);
    if (JSON.stringify(currentState) !== JSON.stringify(newState)) {
      this.applyButtonState(buttonElement, newState);
      this.buttonStates.set(buttonId, newState);
      console.log(`Button ${buttonId} state updated:`, newState);
    }
  }
  async calculateButtonState(buttonId, buttonElement) {
    const isOperationActive = this.operationState === 'ACTIVE';
    const isOperationPaused = this.operationState === 'PAUSED';
    const isOperationPausinng = this.operationState === 'PAUSING';
    const isOperationStopped = this.operationState === 'STOPPED';
    const isOperationCooldown = this.operationState === 'COOLDOWN';
    const isProcessing = this.isProcessing;
    const originalInnerHTML = buttonElement ? buttonElement.innerHTML : '';
    switch (buttonId) {
      case 'earlyStop':
        // Early stop should be enabled when any operation is running, paused, in cooldown, or has running tasks
        const canStopOperation = isOperationActive || isOperationPaused || isOperationPausinng || isOperationCooldown || this.hasRunningTasks;
        return {
          disabled: !canStopOperation || isProcessing,
          title: !canStopOperation ? 'No active operation to stop' : isProcessing ? 'Stopping operation...' : 'Stop the current operation',
          innerHTML: isProcessing ? '<span class="btn-icon">⏳</span><span class="btn-text">Durduruluyor...</span>' : '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>'
        };
      case 'continueOperationButton':
        const activeOperation = await storageHandler.getActiveOperation();
        const canContinue = await this.canContinueOperation(this.operationState, activeOperation);
        return {
          disabled: !canContinue || isProcessing,
          title: !canContinue ? (this.operationState === 'INACTIVE' ? 'No operation to continue' : 'Operation cannot be continued') : isProcessing ? 'Continuing operation...' : 'Continue the stopped operation',
          innerHTML: isProcessing ? '<span class="btn-icon">⏳</span><span class="btn-text">İşlem devam ettiriliyor...</span>' : '<span class="btn-icon">▶️</span><span class="btn-text">İşlemi Devam Ettir</span>'
        };
      case 'discardOperationButton':
        const activeOp = await storageHandler.getActiveOperation();
        const canDiscard = activeOp && (this.operationState === 'STOPPED' || this.operationState === 'COOLDOWN');
        return {
          disabled: !canDiscard || isProcessing,
          title: !canDiscard ? 'No operation to discard' : isProcessing ? 'Discarding operation...' : 'Discard the operation',
          innerHTML: isProcessing ? '<span class="btn-icon">⏳</span><span class="btn-text">İptal ediliyor...</span>' : '<span class="btn-icon">🗑️</span><span class="btn-text">İşlemi İptal Et</span>'
        };
      case 'startMigration':
      case 'startTitleMigration':
      case 'migrateBlockedToMuted':
      case 'btnBlockMutedUsers':
      case 'btnBlockTitlesOfBlockedMuted':
      case 'migrateBlockedTitlesToUnblocked':
      case 'startUndobanAll':
        // Buttons remain enabled to allow queueing tasks when another operation is running
        return {
          disabled: isProcessing,
          title: isProcessing ? 'İşleniyor...' : 'Bu işlemi başlat (başka bir işlem devam ediyorsa sıraya eklenir)',
          innerHTML: originalInnerHTML
        };
      case 'refreshMutedList':
      case 'refreshBlockedList':
      case 'refreshFollowedList':
        // Refresh buttons are ALWAYS enabled - user can refresh lists at any time
        return {
          disabled: false,
          title: 'Listeyi yenile',
          innerHTML: originalInnerHTML
        };
      case 'exportMutedListCSV':
        const mutedTotal = this.listCounts.mutedTotal || this.listCounts.muted;
        return {
          disabled: isOperationActive || isOperationCooldown || mutedTotal === 0,
          title: isOperationActive || isOperationCooldown ? 'Export blocked: Another operation is currently running' : mutedTotal === 0 ? 'No muted users to export' : 'Export muted users list to CSV',
          innerHTML: originalInnerHTML
        };
      case 'exportBlockedListCSV':
        const blockedTotal = this.listCounts.blockedTotal || this.listCounts.blocked;
        return {
          disabled: isOperationActive || isOperationCooldown || blockedTotal === 0,
          title: isOperationActive || isOperationCooldown ? 'Export blocked: Another operation is currently running' : blockedTotal === 0 ? 'No blocked users to export' : 'Export blocked users list to CSV',
          innerHTML: originalInnerHTML
        };
        return {
          disabled: isOperationActive || isOperationCooldown || isProcessing,
          title: isOperationActive || isOperationCooldown ? 'Clear blocked: Another operation is currently running' : isProcessing ? 'Clearing data...' : 'Clear all stored data',
          innerHTML: isProcessing ? '<span class="btn-icon">⏳</span><span class="btn-text">Temizleniyor...</span>' : '<span class="btn-icon">🗑️</span><span class="btn-text">Saklanan Verileri Temizle</span>'
        };
      case 'openauthorListPage':
      case 'openFaq':
        return {
          disabled: isProcessing,
          title: isProcessing ? 'Please wait for current operation to complete' : 'Open this page',
          innerHTML: originalInnerHTML
        };
      default:
        return { disabled: false, title: 'Button', innerHTML: originalInnerHTML };
    }
  }
  applyButtonState(buttonElement, state) {
    if (!buttonElement) return;
    buttonElement.disabled = state.disabled;
    buttonElement.title = state.title;
    if (state.innerHTML && buttonElement.innerHTML !== state.innerHTML && !this.isProcessing) {
      buttonElement.innerHTML = state.innerHTML;
    }
  }
  setProcessingState(isProcessing, operationType = '') {
    this.isProcessing = isProcessing;
    console.log(`ButtonStateManager: Processing state set to ${isProcessing} for ${operationType}`);
    if (isProcessing) this.updateProcessingVisualStates(operationType);
    else setTimeout(() => this.updateAllButtonStates(), 100);
  }
  updateProcessingVisualStates(operationType) {
    const earlyStopBtn = document.getElementById('earlyStop');
    if (operationType === 'earlyStop' && earlyStopBtn) {
      earlyStopBtn.disabled = true;
      earlyStopBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Durduruluyor...</span>';
      earlyStopBtn.title = 'Stopping operation...';
    }
  }
  notifyUIOfStateChange(previousState, newState) {
    const event = new CustomEvent('operationStateChanged', { detail: { previousState, newState, timestamp: Date.now() } });
    document.dispatchEvent(event);
  }
  getOperationState() { return this.operationState; }
  getProcessingState() { return this.isProcessing; }
  async refreshAllButtonStates() {
    await this.checkCurrentOperationState();
    await this.updateListCounts();
    await this.updateAllButtonStates();
    console.log('ButtonStateManager: All button states refreshed');
  }
  reset() {
    this.buttonStates.clear();
    this.operationState = 'INACTIVE';
    this.hasRunningTasks = false;
    this.isProcessing = false;
    this.initialized = false;
    this.listCounts = { muted: 0, blocked: 0, mutedTotal: 0, blockedTotal: 0 };
    console.log('ButtonStateManager: Reset to initial state');
  }
}
export let buttonStateManager = new ButtonStateManager();
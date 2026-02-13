import * as enums from './enums.js';
import * as utils from './utils.js';
import { commHandler } from './commHandler.js';
import { storageHandler } from './storageHandler.js';
import { notificationHandler } from './notificationHandler.js';
import { generateUnifiedDescription, processQueue } from './queue.js';
import { buttonStateManager } from './buttonStateManager.js';

let mutedUserCountSpan;
let blockedUserCountSpan;
let refreshMutedListButton;
let exportMutedListCSVButton;
let refreshBlockedListButton;
let exportBlockedListCSVButton;
let buttonStatusDiv;

document.addEventListener('DOMContentLoaded', async function () {
  await initializeNotificationPage();
  setupEarlyStopButton();
  setupActionButtons();
  await initializeRealTimeFeatures();
});

async function initializeNotificationPage() {
  console.log("🚀 Initializing EksiEngel Plus Notification Page");
  
  await buttonStateManager.initialize();
  
  notificationHandler.updateStatusIndicator('inactive');
  notificationHandler.updateTableCounts();
  setupSmoothScrolling();
  setupKeyboardShortcuts();
  
  buttonStatusDiv = document.getElementById('buttonStatus');
  mutedUserCountSpan = document.getElementById('mutedUserCount');
  blockedUserCountSpan = document.getElementById('blockedUserCount');
  refreshMutedListButton = document.getElementById('refreshMutedList');
  exportMutedListCSVButton = document.getElementById('exportMutedList');
  refreshBlockedListButton = document.getElementById('refreshBlockedList');
  exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
  
  await restorePersistedData();
  await updateStorageUsageDisplay();
}

async function restorePersistedData() {
  try {
    notificationHandler.updateButtonStatus("Restoring queue and completed items...", false, 0);
    
    await processQueue.restoreFromStorage();
    
    const completedItems = await storageHandler.getCompletedItems();
    if (completedItems && completedItems.length > 0) {
      for (const item of completedItems) {
        insertCompletedProcessesTable(
          item.banSource,
          item.successfulAction,
          item.performedAction,
          item.plannedAction,
          item.errorStatus,
          item.operationMetadata || null
        );
      }
    }
    
    notificationHandler.updateTableCounts();
    notificationHandler.updateButtonStatus("Queue and completed items restored successfully", false, 3000);
  } catch (error) {
    console.warn('Failed to restore persisted data:', error);
    notificationHandler.updateButtonStatus("Failed to restore some data", false, 3000);
  }
}

async function updateStorageUsageDisplay() {
  try {
    const bytesInUse = await storageHandler.getStorageUsage();
    const kbInUse = Math.round(bytesInUse / 1024);
    const mbInUse = (bytesInUse / (1024 * 1024)).toFixed(2);
    
    const storageUsageSpan = document.getElementById('storageUsage');
    if (storageUsageSpan) {
      storageUsageSpan.textContent = `${mbInUse} MB (${kbInUse} KB)`;
    }
  } catch (error) {
    console.warn('Failed to get storage usage:', error);
    const storageUsageSpan = document.getElementById('storageUsage');
    if (storageUsageSpan) {
      storageUsageSpan.textContent = "Hata";
    }
  }
}

function setupEarlyStopButton() {
  const earlyStopButton = document.getElementById("earlyStop");
  if (earlyStopButton) {
    earlyStopButton.addEventListener("click", handleEarlyStop);
  }
  
// Setup new pause/resume/continue buttons
  setupUniversalControlButtons();
  
  // Start polling for operation state to keep UI in sync
  startOperationStatePolling();
}

// Polling interval for operation state sync
let _operationStatePollInterval = null;
const OPERATION_STATE_POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

// Cleanup functions for pause operations
let _cleanupFunctions = new Map();

/**
 * Start polling for operation state to keep UI synchronized
 * This handles cases where messages are missed or page is reloaded
 */
function startOperationStatePolling() {
  // Clear any existing interval first
  if (_operationStatePollInterval) {
    clearInterval(_operationStatePollInterval);
  }
  
  // Initial check
  syncOperationState();
  
  // Set up periodic polling
  _operationStatePollInterval = setInterval(async () => {
    await syncOperationState();
  }, OPERATION_STATE_POLL_INTERVAL_MS);
  
  // Stop polling when page is hidden to save resources
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (_operationStatePollInterval) {
        clearInterval(_operationStatePollInterval);
        _operationStatePollInterval = null;
      }
    } else {
      // Resume polling when page becomes visible
      if (!_operationStatePollInterval) {
        syncOperationState();
        _operationStatePollInterval = setInterval(syncOperationState, OPERATION_STATE_POLL_INTERVAL_MS);
      }
    }
  });
}

/**
 * Synchronize UI with actual operation state from background script
 */
async function syncOperationState() {
  try {
    const response = await sendMessageWithPromise({ action: "getCurrentOperation" });
    const operation = response?.operation || response;
    
    if (operation) {
      // Update UI to match actual state
      updateUniversalControls(operation);
      
      // Handle specific state cases
      if (operation.state === 'PAUSING') {
        // If we've been in PAUSING state for too long, it might have timed out
        // The background will handle the timeout, but we should show appropriate UI
        const pauseBtn = document.getElementById('btnPauseOperation');
        if (pauseBtn && !pauseBtn.disabled) {
          pauseBtn.disabled = true;
          pauseBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Duraklatılıyor...</span>';
        }
      }
    } else {
      // No operation running - ensure UI shows idle state
      updateUniversalControls(null);
    }
  } catch (error) {
    // If we can't get operation state, assume no operation is running
    // This prevents UI from being stuck in a non-idle state
    console.warn('Failed to sync operation state:', error);
    updateUniversalControls(null);
  }
}

async function setupUniversalControlButtons() {
  const pauseBtn = document.getElementById('btnPauseOperation');
  const resumeBtn = document.getElementById('btnResumeOperation');
  
  if (pauseBtn) {
    pauseBtn.addEventListener('click', handlePauseOperation);
  }
  
  if (resumeBtn) {
    resumeBtn.addEventListener('click', handleResumeOperation);
  }
  
  // Check for saved paused operations on startup
  checkForPausedOperations();
}

async function handlePauseOperation() {
  const pauseBtn = document.getElementById('btnPauseOperation');
  
  // Clean up any existing pause state first
  cleanupPauseOperation();
  
  let currentOp = null;
  
  try {
    // Check if there's actually an operation running first
    const currentOpResponse = await sendMessageWithPromise({ action: "getCurrentOperation" });
    currentOp = currentOpResponse?.operation || currentOpResponse;
    
    // If no operation is running, reset UI immediately
    if (!currentOp || currentOp.state !== 'RUNNING') {
      notificationHandler.showStatusMessage('Duraklatılacak aktif bir işlem bulunamadı.', 'info');
      updateUniversalControls(currentOp);
      return;
    }
    
    // Check if this operation type supports pausing BEFORE disabling the button
    if (currentOp.canPause === false) {
      notificationHandler.showStatusMessage(currentOp.message || 'Bu işlem türü duraklatmayı desteklemiyor. Erken durdurmayı kullanın.', 'warning');
      // Reset button state since we haven't started pausing
      pauseBtn.disabled = false;
      pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Duraklat</span>';
      // Also clear the status message and ensure UI is in running state
      setTimeout(() => {
        notificationHandler.showStatusMessage('', 'info');
        updateUniversalControls({ state: 'RUNNING', type: currentOp.type });
      }, 3000);
      return;
    }
    
    // Now disable the button and update UI
    pauseBtn.disabled = true;
    pauseBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Duraklatılıyor...</span>';
    
    const response = await sendMessageWithPromise({ action: "pauseOperation" });
    if (response && response.success) {
      notificationHandler.showStatusMessage('İşlem duraklatılıyor... Son kontrol noktasında duracak.', 'info');
      updateUniversalControls({ state: 'PAUSING', type: currentOp.type });
      
      // Set up timeout to handle cases where pause never reaches checkpoint
      const timeoutId = setTimeout(async () => {
        try {
          const finalOpResponse = await sendMessageWithPromise({ action: "getCurrentOperation" });
          const finalOp = finalOpResponse?.operation || finalOpResponse;
          
          // If operation is still in PAUSING state after timeout, reset button state
          if (finalOp && finalOp.state === 'PAUSING') {
            notificationHandler.showStatusMessage('Duraklatma zaman aşımına uğradı. İşlem devam ediyor.', 'warning');
            pauseBtn.disabled = false;
            pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Duraklat</span>';
            updateUniversalControls({ state: 'RUNNING', type: finalOp.type });
          }
        } catch (e) {
          console.warn('Error checking operation state after pause timeout:', e);
        } finally {
          // Always clean up timeout
          if (pauseBtn._pauseTimeoutId) {
            clearTimeout(pauseBtn._pauseTimeoutId);
            pauseBtn._pauseTimeoutId = null;
          }
        }
      }, 30000); // 30 second timeout
      
      // Also listen for operation state changes to clear timeout if pause completes
      const messageListener = (message) => {
        if (message && message.action === "operationStateChanged" && message.operation) {
          const op = message.operation;
          if (op.state === 'PAUSED' || op.state === 'RUNNING' || op.state === 'STOPPED') {
            // Pause completed or operation stopped, clear timeout
            if (pauseBtn._pauseTimeoutId) {
              clearTimeout(pauseBtn._pauseTimeoutId);
              pauseBtn._pauseTimeoutId = null;
            }
            // Clean up the listener
            chrome.runtime.onMessage.removeListener(messageListener);
            pauseBtn._pauseMessageListener = null;
            
            // Update UI based on final state
            if (op.state === 'PAUSED') {
              notificationHandler.showStatusMessage('İşlem duraklatıldı.', 'success');
              updateUniversalControls({ state: 'PAUSED', type: op.type });
            } else {
              // Operation resumed or stopped, reset button
              pauseBtn.disabled = false;
              pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Duraklat</span>';
              updateUniversalControls(op);
            }
          }
        }
      };
      
      chrome.runtime.onMessage.addListener(messageListener);
      
      // Store the timeout ID and listener for cleanup
      pauseBtn._pauseTimeoutId = timeoutId;
      pauseBtn._pauseMessageListener = messageListener;
      
    } else {
      notificationHandler.showStatusMessage('Duraklatma başarısız: ' + (response?.error || 'Bilinmeyen hata'), 'error');
      // Re-sync UI with actual operation state
      const freshOpResponse = await sendMessageWithPromise({ action: "getCurrentOperation" });
      updateUniversalControls(freshOpResponse?.operation || freshOpResponse);
      
      // Reset button state on failure
      pauseBtn.disabled = false;
      pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Duraklat</span>';
    }
  } catch (error) {
    console.error('Error pausing operation:', error);
    notificationHandler.showStatusMessage('Duraklatma hatası: ' + error.message, 'error');
    
    // Reset button state on error
    pauseBtn.disabled = false;
    pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Duraklat</span>';
    
    // Re-sync UI with actual operation state after error
    try {
      const freshOpResponse = await sendMessageWithPromise({ action: "getCurrentOperation" });
      updateUniversalControls(freshOpResponse?.operation || freshOpResponse);
    } catch (e) {
      // If we can't get operation state, reset to idle
      updateUniversalControls(null);
    }
  }
}

async function handleResumeOperation() {
  const resumeBtn = document.getElementById('btnResumeOperation');
  resumeBtn.disabled = true;
  resumeBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Devam Ediliyor...</span>';
  
  try {
    // First check if there's a currently paused operation in memory
    const currentOp = await sendMessageWithPromise({ action: "getCurrentOperation" });
    if (currentOp && currentOp.operation && currentOp.operation.id) {
      const response = await sendMessageWithPromise({ 
        action: "resumeOperation", 
        operationId: currentOp.operation.id 
      });
      if (response && response.success) {
        notificationHandler.showStatusMessage('İşlem devam ediyor...', 'success');
        updateUniversalControls({ state: 'RUNNING' });
      } else {
        notificationHandler.showStatusMessage('Devam ettirme başarısız: ' + (response?.error || 'Bilinmeyen hata'), 'error');
        resumeBtn.disabled = false;
        resumeBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Devam Et</span>';
      }
      return;
    }
    
    // If no current operation, check for saved paused operations in storage
    const savedOpsResponse = await sendMessageWithPromise({ action: "getPausedOperations" });
    if (savedOpsResponse && savedOpsResponse.operations && savedOpsResponse.operations.length > 0) {
      // Resume the most recent paused operation
      const operation = savedOpsResponse.operations[0];
      const response = await sendMessageWithPromise({ 
        action: "resumeOperation", 
        operationId: operation.operationId 
      });
      if (response && response.success) {
        notificationHandler.showStatusMessage('İşlem kaldığı yerden devam ediyor...', 'success');
        updateUniversalControls({ state: 'RUNNING' });
      } else {
        notificationHandler.showStatusMessage('Devam ettirme başarısız: ' + (response?.error || 'Bilinmeyen hata'), 'error');
        resumeBtn.disabled = false;
        resumeBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Devam Et</span>';
      }
    } else {
      notificationHandler.showStatusMessage('Devam ettirilecek işlem bulunamadı', 'info');
      resumeBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Error resuming operation:', error);
    notificationHandler.showStatusMessage('Devam ettirme hatası: ' + error.message, 'error');
    resumeBtn.disabled = false;
    resumeBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Devam Et</span>';
  }
}

async function checkForPausedOperations() {
  try {
    // Check if there's a currently paused operation
    const currentOp = await sendMessageWithPromise({ action: "getCurrentOperation" });
    if (currentOp && currentOp.operation && currentOp.operation.state === 'PAUSED') {
      // Show resume button
      const resumeBtn = document.getElementById('btnResumeOperation');
      if (resumeBtn) {
        resumeBtn.style.display = 'inline-block';
        resumeBtn.disabled = false;
      }
      
      // Show prominent notification banner
      showPausedOperationBanner(currentOp.operation);
      return;
    }
    
    // Check for saved paused operations in storage
    const savedOpsResponse = await sendMessageWithPromise({ action: "getPausedOperations" });
    if (savedOpsResponse && savedOpsResponse.operations && savedOpsResponse.operations.length > 0) {
      // Show resume button for saved operations
      const resumeBtn = document.getElementById('btnResumeOperation');
      if (resumeBtn) {
        resumeBtn.style.display = 'inline-block';
        resumeBtn.disabled = false;
      }
      
      // Show prominent notification banner for the first saved operation
      showPausedOperationBanner(savedOpsResponse.operations[0]);
    }
  } catch (error) {
    console.warn('Failed to check for paused operations:', error);
  }
}

/**
 * Show a prominent banner notification for a paused operation
 * @param {Object} operation - The paused operation details
 */
function showPausedOperationBanner(operation) {
  if (!operation) return;
  
  // Remove any existing banner first
  hidePausedOperationBanner();
  
  // Create banner element
  const banner = document.createElement('div');
  banner.id = 'pausedOperationBanner';
  banner.className = 'paused-operation-banner';
  
  const operationType = getOperationTypeDisplay(operation.type || operation.operationType);
  const timestamp = operation.timestamp ? new Date(operation.timestamp).toLocaleString('tr-TR') : '';
  
  banner.innerHTML = `
    <div class="banner-content">
      <div class="banner-icon">⏸️</div>
      <div class="banner-text">
        <div class="banner-title">Duraklatılmış İşlem Bulundu</div>
        <div class="banner-details">
          <strong>${operationType}</strong> işlemi duraklatılmış durumda.
          ${timestamp ? `<br><small>Duraklatılma zamanı: ${timestamp}</small>` : ''}
        </div>
      </div>
      <div class="banner-actions">
        <button id="bannerResumeBtn" class="banner-btn banner-btn-resume">
          ▶️ Devam Et
        </button>
        <button id="bannerDismissBtn" class="banner-btn banner-btn-dismiss">
          ✕ Kapat
        </button>
      </div>
    </div>
  `;
  
  // Insert banner at the top of the main content
  const mainContent = document.querySelector('.main-content') || document.body;
  mainContent.insertBefore(banner, mainContent.firstChild);
  
  // Add event listeners
  const resumeBtn = banner.querySelector('#bannerResumeBtn');
  const dismissBtn = banner.querySelector('#bannerDismissBtn');
  
  if (resumeBtn) {
    resumeBtn.addEventListener('click', async () => {
      resumeBtn.disabled = true;
      resumeBtn.innerHTML = '⏳ Devam ediliyor...';
      await handleResumeOperation();
      hidePausedOperationBanner();
    });
  }
  
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      hidePausedOperationBanner();
    });
  }
  
  // Auto-show the resume button in the controls as well
  updateUniversalControls({ state: 'PAUSED', type: operation.type || operation.operationType });
}

/**
 * Hide the paused operation banner
 */
function hidePausedOperationBanner() {
  const existingBanner = document.getElementById('pausedOperationBanner');
  if (existingBanner) {
    existingBanner.remove();
  }
}

function updateUniversalControls(operation) {
  const pauseBtn = document.getElementById('btnPauseOperation');
  const resumeBtn = document.getElementById('btnResumeOperation');
  const earlyStopBtn = document.getElementById('earlyStop');
  const statusDisplay = document.getElementById('operationStatusDisplay');
  const opTypeSpan = document.getElementById('currentOperationType');
  const opStateSpan = document.getElementById('currentOperationState');
  
  // Always show both buttons
  if (pauseBtn) pauseBtn.style.display = 'inline-block';
  if (resumeBtn) resumeBtn.style.display = 'inline-block';
  
  if (!operation || !operation.state || operation.state === 'COMPLETED' || operation.state === 'IDLE') {
    // No active operation - both buttons disabled
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Duraklat</span>';
    }
    if (resumeBtn) {
      resumeBtn.disabled = true;
      resumeBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Devam Et</span>';
    }
    if (earlyStopBtn) {
      earlyStopBtn.disabled = true;
      earlyStopBtn.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
    }
    if (statusDisplay) statusDisplay.style.display = 'none';
  } else if (operation.state === 'RUNNING') {
    if (pauseBtn) {
      pauseBtn.disabled = false;
      pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Duraklat</span>';
    }
    if (resumeBtn) {
      resumeBtn.disabled = true;
      resumeBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Devam Et</span>';
    }
    if (earlyStopBtn) earlyStopBtn.disabled = false;
    if (statusDisplay) {
      statusDisplay.style.display = 'block';
      if (opTypeSpan) opTypeSpan.textContent = getOperationTypeDisplay(operation.type);
      if (opStateSpan) opStateSpan.textContent = '(Çalışıyor)';
    }
  } else if (operation.state === 'PAUSING') {
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Duraklatılıyor...</span>';
    }
    if (resumeBtn) {
      resumeBtn.disabled = true;
      resumeBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Devam Et</span>';
    }
    if (earlyStopBtn) earlyStopBtn.disabled = false;
    if (statusDisplay) {
      statusDisplay.style.display = 'block';
      if (opTypeSpan) opTypeSpan.textContent = getOperationTypeDisplay(operation.type);
      if (opStateSpan) opStateSpan.textContent = '(Duraklatılıyor...)';
    }
  } else if (operation.state === 'PAUSED') {
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Duraklat</span>';
    }
    if (resumeBtn) {
      resumeBtn.disabled = false;
      resumeBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Devam Et</span>';
    }
    if (earlyStopBtn) earlyStopBtn.disabled = false;
    if (statusDisplay) {
      statusDisplay.style.display = 'block';
      if (opTypeSpan) opTypeSpan.textContent = getOperationTypeDisplay(operation.type);
      if (opStateSpan) opStateSpan.textContent = '(Duraklatıldı)';
    }
  }
}

function getOperationTypeDisplay(type) {
  const typeMap = {
    'DATE_BASED_BULK': 'Tarih Bazlı Toplu İşlem',
    'MIGRATE_BLOCKED_TO_MUTED': 'Engelli → Sessiz Taşıma',
    'BLOCK_MUTED_USERS': 'Sessizleri Engelleme',
    'BLOCK_TITLES': 'Başlık Engelleme',
    'REFRESH_MUTED_LIST': 'Sessiz Liste Yenileme',
    'REFRESH_BLOCKED_LIST': 'Engelli Liste Yenileme'
  };
  return typeMap[type] || type || 'Bilinmeyen İşlem';
}

function sendMessageWithPromise(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(null, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function handleEarlyStop() {
  const earlyStopButton = document.getElementById("earlyStop");
  
  if (!confirm("İşlemi durdurmak istediğinizden emin misiniz?")) {
    return;
  }
  
  earlyStopButton.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Durduruluyor...</span>';
  earlyStopButton.disabled = true;
  
  try {
    const response = await sendEarlyStopWithRetry();
    
    if (response && response.status === 'ok') {
      console.log("notification.js: earlyStop message sent successfully");
      notificationHandler.updateStatusIndicator('warning');
      
      const statusText = document.getElementById("statusText");
      if (statusText) {
        statusText.innerHTML = "İşlem kullanıcı tarafından durduruluyor...";
      }
      
      notificationHandler.showStatusMessage("İşlem durduruluyor...", "info");
      
      setTimeout(() => {
        const btn = document.getElementById("earlyStop");
        if (btn) {
          btn.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
          btn.disabled = false;
        }
      }, 3000);
      
    } else {
      throw new Error("Invalid response from background script");
    }
  } catch (err) {
    console.warn("notification.js: Error sending earlyStop message:", err.message);
    
    let errorMessage = "Durdurma işleminde hata oluştu: ";
    if (err.message.includes("Timeout")) {
      errorMessage += "İşlem zaman aşımına uğradı. Arka plan betiği yanıt vermiyor.";
    } else if (err.message.includes("No active operations")) {
      errorMessage += "Aktif işlem bulunamadı.";
    } else {
      errorMessage += err.message;
    }
    
    notificationHandler.showStatusMessage(errorMessage, "error");
    
    earlyStopButton.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
    earlyStopButton.disabled = false;
    notificationHandler.updateStatusIndicator('inactive');
  }
}

async function sendEarlyStopWithRetry(maxRetries = 3, timeoutMs = 5000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await Promise.race([
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(null, {"earlyStop": 0}, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), timeoutMs)
        )
      ]);
      
      return response;
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw lastError;
}

function setupActionButtons() {
  document.getElementById('openauthorListPage')?.addEventListener('click', handleOpenAuthorListPage);
  document.getElementById('startUndobanAll')?.addEventListener('click', handleStartUndobanAll);
  
  document.getElementById('migrateBlockedToMuted')?.addEventListener('click', handleMigrateBlockedToMuted);
  document.getElementById('btnBlockMutedUsers')?.addEventListener('click', handleBlockMutedUsers);
  document.getElementById('btnBlockTitlesOfBlockedMuted')?.addEventListener('click', handleBlockTitlesOfBlockedMuted);
  document.getElementById('migrateBlockedTitlesToUnblocked')?.addEventListener('click', handleMigrateBlockedTitlesToUnblocked);
  
  document.getElementById('refreshMutedList')?.addEventListener('click', () => notificationHandler.handleRefreshMutedList());
  document.getElementById('exportMutedListCSV')?.addEventListener('click', () => notificationHandler.handleExportMutedList());
  document.getElementById('refreshBlockedList')?.addEventListener('click', () => notificationHandler.handleRefreshBlockedList());
  document.getElementById('exportBlockedListCSV')?.addEventListener('click', () => notificationHandler.handleExportBlockedList());
  
  document.getElementById('openFaq')?.addEventListener('click', handleOpenFaq);
  document.getElementById('clearStoredData')?.addEventListener('click', handleClearStoredData);
}

function initializeRealTimeFeatures() {
  notificationHandler.loadMutedUserCount();
  notificationHandler.refreshBlockedUserCountDisplay();
  
  chrome.runtime.sendMessage(null, { action: "notificationPageReady" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("notification.js: Error sending notificationPageReady message:", chrome.runtime.lastError.message);
    } else {
      console.log("✅ Notification page ready message sent");
    }
  });
  
  notificationHandler.updateRemainingAction();
}

async function handleClearStoredData() {
  if (!confirm("Saklanan kuyruk ve tamamlanan işlem verilerini temizlemek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
    return;
  }
  
  const clearButton = document.getElementById('clearStoredData');
  if (clearButton) {
    clearButton.disabled = true;
    clearButton.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Temizleniyor...</span>';
  }
  
  try {
    await storageHandler.clearPersistedData();
    
    await processQueue.restoreFromStorage();
    
    const completedTable = document.getElementById("completedProcesses").getElementsByTagName('tbody')[0];
    while (completedTable.firstChild) {
      completedTable.removeChild(completedTable.firstChild);
    }
    
    notificationHandler.updateTableCounts();
    await updateStorageUsageDisplay();
    
    notificationHandler.updateButtonStatus("Saklanan veriler temizlendi", false, 3000);
  } catch (error) {
    console.error('Failed to clear stored data:', error);
    notificationHandler.updateButtonStatus("Veriler temizlenirken hata oluştu: " + error.message, true, 5000);
  } finally {
    if (clearButton) {
      clearButton.disabled = false;
      clearButton.innerHTML = '<span class="btn-icon">🗑️</span><span class="btn-text">Saklanan Verileri Temizle</span>';
    }
  }
}

function setupSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const exportMutedBtn = document.getElementById('exportMutedListCSV');
      const exportBlockedBtn = document.getElementById('exportBlockedListCSV');
      
      if (exportMutedBtn && !exportMutedBtn.disabled) {
        exportMutedBtn.click();
      } else if (exportBlockedBtn && !exportBlockedBtn.disabled) {
        exportBlockedBtn.click();
      }
    }
    
    if (e.key === 'Escape') {
      const earlyStopBtn = document.getElementById("earlyStop");
      if (earlyStopBtn && !earlyStopBtn.disabled) {
        earlyStopBtn.click();
      }
    }
  });
}

function handleOpenAuthorListPage() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_BAN_LIST });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") });
  notificationHandler.updateButtonStatus("Opening Author List Page...", false, 2000);
}

function handleStartUndobanAll() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_UNDOBANALL });
  chrome.runtime.sendMessage(null, { "banSource": enums.BanSource.UNDOBANALL, "banMode": enums.BanMode.UNDOBAN }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending startUndobanAll message:", chrome.runtime.lastError.message);
      notificationHandler.updateButtonStatus("Error starting 'Undo All Bans': " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: startUndobanAll message sent.");
    }
  });
  notificationHandler.updateButtonStatus("Starting 'Undo All Bans'...", false, 2000);
}

function handleOpenFaq() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_FAQ });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
  notificationHandler.updateButtonStatus("Opening Settings and Help...", false, 2000);
}

function handleMigrateBlockedToMuted() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_MIGRATE });
  notificationHandler.updateButtonStatus("Starting migration (Blocked -> Muted)...", false, 0);
  chrome.runtime.sendMessage(null, { action: "startMigration" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending startMigration message:", chrome.runtime.lastError.message);
      notificationHandler.updateButtonStatus("Error starting migration: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: Migration start message sent.");
    }
  });
}

function handleMigrateBlockedTitlesToUnblocked() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_MIGRATE_TITLES });
  notificationHandler.updateButtonStatus("Starting title unblock...", false, 0);
  chrome.runtime.sendMessage(null, { action: "startTitleMigration" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending startTitleMigration message:", chrome.runtime.lastError.message);
      notificationHandler.updateButtonStatus("Error starting title unblock: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: Title migration start message sent.");
    }
  });
}

function handleBlockMutedUsers() {
  notificationHandler.updateButtonStatus("Starting 'Block Muted Users' process...", false, 0);
  chrome.runtime.sendMessage({ action: "blockMutedUsers" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending blockMutedUsers message:", chrome.runtime.lastError.message);
      notificationHandler.updateButtonStatus("Error starting process: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: blockMutedUsers message sent.");
    }
  });
}

function handleBlockTitlesOfBlockedMuted() {
  notificationHandler.updateButtonStatus("Starting 'Block Titles of Blocked/Muted' process...", false, 0);
  chrome.runtime.sendMessage({ action: "blockTitlesOfBlockedMuted" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending blockTitlesOfBlockedMuted message:", chrome.runtime.lastError.message);
      notificationHandler.updateButtonStatus("Error starting process: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: blockTitlesOfBlockedMuted message sent.");
    }
  });
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message && message.action === "ping") {
    console.log("Received ping from background script");
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === enums.NotificationType.UPDATE_COUNTS) {
    console.log("Received message to update user counts.");
    notificationHandler.loadMutedUserCount();
    notificationHandler.refreshBlockedUserCountDisplay();
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "updateMutedListProgress") {
    console.log(`Updating muted list progress: Page ${message.currentPage}, Total ${message.currentCount}`);

    const migrationBar = document.getElementById("migrationBar");
    const migrationBarText = document.getElementById("migrationBarText");
    const migrationProgressText = document.getElementById("migrationProgressText");
    const migrationStatusText = document.getElementById("migrationStatusText");

    if (migrationBar && migrationBarText && migrationProgressText) {
      const percentage = message.currentPage * 5;
      migrationBar.style.width = `${percentage}%`;
      migrationBarText.innerHTML = `%${percentage}`;
      migrationProgressText.innerHTML = `Sayfa: ${message.currentPage}, Toplam: ${message.currentCount}`;

      if (mutedUserCountSpan) {
        mutedUserCountSpan.textContent = message.currentCount;
      }

      if (migrationStatusText) {
        migrationStatusText.innerHTML = "Sessize alınan kullanıcılar alınıyor...";
      }
    }

    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "mutedListRefreshComplete") {
    console.log(`Muted list refresh complete: Success=${message.success}, StoppedEarly=${message.stoppedEarly}, Count=${message.count}, Error=${message.error}`);

    const migrationBar = document.getElementById("migrationBar");
    const migrationBarText = document.getElementById("migrationBarText");
    const migrationProgressText = document.getElementById("migrationProgressText");
    const migrationStatusText = document.getElementById("migrationStatusText");
    const migrationResultText = document.getElementById("migrationResultText");

    const mutedUserCountSpan = document.getElementById("mutedUserCount");

    if (migrationBar && migrationBarText) {
      migrationBar.style.width = message.success ? "100%" : (message.stoppedEarly ? `${(message.count / (message.total || 1)) * 100}%` : "0%");
      migrationBarText.innerHTML = message.success ? "%100" : (message.stoppedEarly ? `%${Math.round((message.count / (message.total || 1)) * 100)}` : "%0");
    }

    if (mutedUserCountSpan) {
      mutedUserCountSpan.textContent = message.count;
    }

    if (migrationStatusText) {
      if (message.success) {
        migrationStatusText.innerHTML = "İşlem tamamlandı!";
      } else if (message.stoppedEarly) {
        migrationStatusText.innerHTML = "İşlem kullanıcı tarafından durduruldu.";
      } else {
        migrationStatusText.innerHTML = "İşlem başarısız!";
      }
    }

    if (migrationProgressText) {
      migrationProgressText.innerHTML = message.success ? `Toplam: ${message.count}` : (message.stoppedEarly ? `İşlenen: ${message.count}` : "");
    }

    if (migrationResultText) {
      if (message.success) {
        migrationResultText.innerHTML = `Başarıyla alındı: ${message.count}`;
      } else if (message.stoppedEarly) {
         migrationResultText.innerHTML = `Durduruldu. İşlenen: ${message.count}`;
      }
      else {
        migrationResultText.innerHTML = `Hata: ${message.error || "Bilinmeyen hata"}`;
      }
    }

    const earlyStopButton = document.getElementById("earlyStop");
    const refreshButton = document.getElementById('refreshMutedList');
    if (earlyStopButton) {
      earlyStopButton.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
      earlyStopButton.disabled = false;
    }
    if (refreshButton) {
      refreshButton.disabled = false;
    }
    
    buttonStateManager.refreshAllButtonStates();

     sendResponse({ status: "ok" });
     return true;
   }
 
   if (message && typeof message === 'string' && message.includes("Total ")) {
     console.log(`Received progress message: ${message}`);
     const totalMatch = message.match(/Total (\d+)/);
     if (totalMatch && totalMatch[1]) {
       const totalCount = totalMatch[1];
       const mutedUserCountSpan = document.getElementById("mutedUserCount");
       if (mutedUserCountSpan) {
         mutedUserCountSpan.textContent = totalCount;
       }
     }
     sendResponse({ status: "ok" });
     return true;
   }

  if (message && message.action === "mutedListRefreshProgress") {
    console.log(`Received muted list refresh progress: Count ${message.count}`);
    const mutedUserCountSpan = document.getElementById("mutedUserCount");
    if (mutedUserCountSpan) {
      mutedUserCountSpan.textContent = message.count;
    }
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "blockedListRefreshComplete") {
    console.log(`Blocked list refresh complete: Success=${message.success}, StoppedEarly=${message.stoppedEarly}, Count=${message.count}, Error=${message.error}`);

    if (refreshBlockedListButton) refreshBlockedListButton.disabled = false;
    
    notificationHandler.refreshBlockedUserCountDisplay().catch(error => {
      console.error("notification.js: Error updating blocked user count display:", error);
    });

    if (message.success) {
      notificationHandler.updateButtonStatus(`Blocked list refreshed. Found ${message.count} users.`, false, 5000);
    } else {
      const errorMessage = message.stoppedEarly ? "Blocked list refresh stopped by user." : `Blocked list refresh failed: ${message.error}`;
      notificationHandler.updateButtonStatus(errorMessage, true, 5000);
    }
    
    buttonStateManager.refreshAllButtonStates();

    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "blockedListRefreshProgress") {
    console.log(`Received blocked list refresh progress: Count ${message.count}`);
    if (blockedUserCountSpan) {
      blockedUserCountSpan.textContent = message.count;
    }
    if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true;
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.notification) {
    const notification = message.notification;
    if (notification.status !== enums.NotificationType.COOLDOWN) {
        console.log("Received general notification:", notification);
    }

    const statusTextDiv = document.getElementById("statusText");
    const errorTextDiv = document.getElementById("errorText");
    const progressBar = document.getElementById("progressBar");
    const progressBarText = document.getElementById("progressBarText");
    const progressText = document.getElementById("progressText");
    const remainingTimeDiv = document.getElementById("remainingTimeInSec");

    if (errorTextDiv && notification.status !== enums.NotificationType.FINISH) {
      errorTextDiv.innerHTML = "";
      errorTextDiv.style.display = "none";
    }

    if (notification.status === enums.NotificationType.COOLDOWN) {
      if (typeof this.lastCooldownMessage === 'undefined' || this.lastCooldownMessage !== notification.statusText + notification.remainingTimeInSec) {
        this.lastCooldownMessage = notification.statusText + notification.remainingTimeInSec;
        if (statusTextDiv) {
          statusTextDiv.innerHTML = notification.statusText;
        }

        const cooldownTimerDiv = document.getElementById("cooldownTimer");
        if (remainingTimeDiv) {
          remainingTimeDiv.innerHTML = `${notification.remainingTimeInSec} saniye`;
          remainingTimeDiv.style.display = "inline";
        }
        if (cooldownTimerDiv) {
          cooldownTimerDiv.style.display = "inline";
        }
      }
    } else {
      const cooldownTimerDiv = document.getElementById("cooldownTimer");
      if (cooldownTimerDiv) {
        cooldownTimerDiv.style.display = "none";
      }
      if (remainingTimeDiv) {
        remainingTimeDiv.style.display = "none";
      }

      if (statusTextDiv) {
        statusTextDiv.innerHTML = notification.statusText || "Durum güncellendi.";
      }

      if (notification.status === enums.NotificationType.ONGOING && notification.plannedAction > 0) {
        const percentage = Math.round((notification.performedAction / notification.plannedAction) * 100);
        const earlyStopButton = document.getElementById("earlyStop");
        if (earlyStopButton) {
            earlyStopButton.disabled = false;
        }
        if (progressBar) progressBar.style.width = percentage + "%";
        if (progressBarText) progressBarText.innerHTML = "%" + percentage;
        if (progressText) progressText.innerHTML = "İşlenen: " + notification.performedAction + "/" + notification.plannedAction + " Başarılı: " + notification.successfulAction;
        
        const successfulActionElement = document.getElementById("successfulAction");
        const performedActionElement = document.getElementById("performedAction");
        const plannedActionElement = document.getElementById("plannedAction");
        const remainingActionElement = document.getElementById("remainingAction");
        const currentOperationDescriptionElement = document.getElementById("currentOperationDescription");
        
        if (successfulActionElement) {
          successfulActionElement.textContent = notification.successfulAction || 0;
        }
        if (performedActionElement) {
          performedActionElement.textContent = notification.performedAction || 0;
        }
        if (plannedActionElement) {
          plannedActionElement.textContent = notification.plannedAction || 0;
        }
        if (remainingActionElement) {
          const remaining = Math.max(0, (notification.plannedAction || 0) - (notification.performedAction || 0));
          remainingActionElement.textContent = remaining;
        }
        
        if (currentOperationDescriptionElement) {
          const description = notification.statusText && notification.statusText !== "İşlem devam ediyor."
            ? notification.statusText
            : "İşlem devam ediyor";
          currentOperationDescriptionElement.textContent = description;
        }
        
      } else if (notification.status === enums.NotificationType.FINISH) {
         if (progressBar) progressBar.style.width = "100%";
         if (progressBarText) progressBarText.innerHTML = "%100";
         if (progressText) progressText.innerHTML = "Tamamlandı. Başarılı: " + notification.successfulAction + "/" + notification.performedAction;
         
         const successfulActionElement = document.getElementById("successfulAction");
         const performedActionElement = document.getElementById("performedAction");
         const plannedActionElement = document.getElementById("plannedAction");
         const remainingActionElement = document.getElementById("remainingAction");
         const currentOperationDescriptionElement = document.getElementById("currentOperationDescription");
         
         if (successfulActionElement) {
           successfulActionElement.textContent = notification.successfulAction || 0;
         }
         if (performedActionElement) {
           performedActionElement.textContent = notification.performedAction || 0;
         }
         if (plannedActionElement) {
           plannedActionElement.textContent = notification.plannedAction || 0;
         }
         if (remainingActionElement) {
           remainingActionElement.textContent = 0;
         }
         
         if (currentOperationDescriptionElement) {
           currentOperationDescriptionElement.textContent = "İşlem tamamlandı";
         }
         
      } else {
         if (progressBar) progressBar.style.width = "0%";
         if (progressBarText) progressBarText.innerHTML = "";
         if (progressText) progressText.innerHTML = "";
         
         const successfulActionElement = document.getElementById("successfulAction");
         const performedActionElement = document.getElementById("performedAction");
         const plannedActionElement = document.getElementById("plannedAction");
         const remainingActionElement = document.getElementById("remainingAction");
         const currentOperationDescriptionElement = document.getElementById("currentOperationDescription");
         
         if (successfulActionElement) successfulActionElement.textContent = "0";
         if (performedActionElement) performedActionElement.textContent = "0";
         if (plannedActionElement) plannedActionElement.textContent = "0";
         if (remainingActionElement) remainingActionElement.textContent = "0";
         if (currentOperationDescriptionElement) currentOperationDescriptionElement.textContent = "-";
      }

      if (notification.status === enums.NotificationType.FINISH && notification.completedProcess) {
        insertCompletedProcessesTable(
          notification.completedProcess.banSource,
          notification.successfulAction,
          notification.performedAction,
          notification.plannedAction,
          notification.errorText || "Başarılı",
          notification.completedProcess.operationMetadata || null
        );
        if (notification.errorText && notification.errorText !== "Tamamlandı" && errorTextDiv) {
           errorTextDiv.innerHTML = `Hata: ${notification.errorText}`;
           errorTextDiv.style.display = "block";
        }
         const earlyStopButton = document.getElementById("earlyStop");
         if (earlyStopButton) {
             earlyStopButton.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
             earlyStopButton.disabled = false;
         }
      }

      if (notification.status === enums.NotificationType.UPDATE_PLANNED_PROCESSES && notification.plannedProcesses) {
        console.log("Updating planned processes table with", notification.plannedProcesses.length, "items");
        notificationHandler.updateTableCounts();
        updatePlannedProcessesTable(notification.plannedProcesses);
      }
      else if (notification.plannedProcesses && Array.isArray(notification.plannedProcesses) && notification.plannedProcesses.length > 0) {
        console.log("Updating planned processes table via fallback with", notification.plannedProcesses.length, "items");
        notificationHandler.updateTableCounts();
        updatePlannedProcessesTable(notification.plannedProcesses);
      }
    }

    sendResponse({status: 'ok'});
    return true;
  }

  if (message && message.action === "updateMigrationProgress") {
    notificationHandler.handleMigrationProgressUpdate(message);
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "updateMigrationStatus") {
    notificationHandler.handleMigrationStatusUpdate(message);
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "migrationBatchComplete") {
    notificationHandler.handleMigrationBatchComplete(message);
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "migrationComplete") {
    notificationHandler.handleMigrationComplete(message);
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "migrationStopped") {
    notificationHandler.handleMigrationStopped(message);
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "operationStateChanged") {
    updateUniversalControls(message.operation);
    sendResponse({ status: "ok" });
    return true;
  }
});

async function insertCompletedProcessesTable(banSource, successfulAction, performedAction, plannedAction, errorStatus, operationMetadata = null) {
  let table = document.getElementById("completedProcesses").getElementsByTagName('tbody')[0];
  let row = table.insertRow(0);
  let cell1 = row.insertCell(0);
  let cell2 = row.insertCell(1);
  let cell3 = row.insertCell(2);
  let cell4 = row.insertCell(3);
  let cell5 = row.insertCell(4);
  let cell6 = row.insertCell(5);
  let d = new Date();
  cell1.innerHTML = d.getHours() + ":" + d.getMinutes();
  cell2.innerHTML = banSource;
  
  let description = generateDescriptionFromMetadataForCompleted(banSource, operationMetadata || {});
  
  cell3.innerHTML = description;
  cell3.title = `İşlem detayları: ${banSource}`;
  
  cell4.innerHTML = performedAction;
  cell5.innerHTML = successfulAction;
  cell6.innerHTML = errorStatus;
  
  const completedItem = {
    banSource,
    successfulAction,
    performedAction,
    plannedAction,
    errorStatus,
    operationMetadata,
    timestamp: d.getTime()
  };
  
  try {
    await storageHandler.addCompletedItem(completedItem);
  } catch (error) {
    console.warn('Failed to save completed item to storage:', error);
  }
}

function generateDescriptionFromMetadataForCompleted(banSource, metadata = {}) {
  const updatedMetadata = { ...metadata };
  if (!updatedMetadata.banMode) {
    updatedMetadata.banMode = banSource.includes('UN') ? enums.BanMode.UNDOBAN : enums.BanMode.BAN;
  }
  return generateUnifiedDescription(banSource, updatedMetadata);
}

function updatePlannedProcessesTable(plannedProcesses) {
  let rowNumber = document.getElementById("plannedProcesses").tBodies[0].rows.length;
  let table = document.getElementById("plannedProcesses").getElementsByTagName('tbody')[0];
  
  for(let i = 0; i < rowNumber; i++)
    table.deleteRow(0);
  
  for(let i = plannedProcesses.length - 1; i >= 0; i--) {
    const process = plannedProcesses[i];
    let row = table.insertRow(-1);
    
    let cell1 = row.insertCell(0);
    cell1.innerHTML = process.creationDateInStr;
    cell1.title = `Sıra: ${process.queuePosition}/${process.totalQueueSize}`;
    
    let cell2 = row.insertCell(1);
    cell2.innerHTML = process.banSource;
    cell2.title = `Kategori: ${process.taskCategory}\nKarmaşıklık: ${process.taskComplexity}\nÖncelik: ${process.taskPriority}`;
    
    let cell3 = row.insertCell(2);
    cell3.innerHTML = process.actionDescription || process.banMode;
    cell3.title = process.operationNotes || 'Açıklama yok';
    
    let cell4 = row.insertCell(3);
    if (process.targetTypes && process.targetTypes.length > 0) {
      const targetNames = process.targetTypes.map(type => {
        switch (type) {
          case enums.TargetType.USER: return 'Engelli';
          case enums.TargetType.TITLE: return 'Başlık';
          case enums.TargetType.MUTE: return 'Sessiz';
          default: return type;
        }
      });
      cell4.innerHTML = targetNames.join(', ');
      cell4.title = `Hedef türü: ${targetNames.join(', ')}`;
    } else {
      cell4.innerHTML = '-';
      cell4.title = 'Hedef türü belirtilmemiş';
    }
    
    let cell5 = row.insertCell(4);
    let statusDisplay = process.taskStatus === 'QUEUED' ? 'Sırada' : (process.taskStatus || 'Sırada');
    cell5.innerHTML = statusDisplay;
    cell5.title = `İşlem durumu: ${process.taskStatus}`;
    
    let categoryIndicator = '';
    switch (process.taskCategory) {
      case enums.TaskCategory.BLOCKING:
        categoryIndicator = '🔒';
        break;
      case enums.TaskCategory.MIGRATION:
        categoryIndicator = '🔄';
        break;
      case enums.TaskCategory.REFRESH:
        categoryIndicator = '🔃';
        break;
      case enums.TaskCategory.UNBLOCKING:
        categoryIndicator = '🔓';
        break;
      default:
        categoryIndicator = '⚙️';
    }
    
    let priorityIndicator = '';
    switch (process.taskPriority) {
      case enums.TaskPriority.URGENT:
        priorityIndicator = '🔴';
        break;
      case enums.TaskPriority.HIGH:
        priorityIndicator = '🟠';
        break;
      case enums.TaskPriority.NORMAL:
        priorityIndicator = '🟡';
        break;
      case enums.TaskPriority.LOW:
        priorityIndicator = '🟢';
        break;
    }
    
    cell2.innerHTML = `${categoryIndicator} ${priorityIndicator} ${process.banSource}`;
  }
}

// ============================================
// TAB NAVIGATION
// ============================================

function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;
      
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and target content
      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
      
      // If switching to date filter tab, refresh the cache stats
      if (targetTab === 'datefilter-tab') {
        loadDateFilterCacheStats();
      }
    });
  });
}

// ============================================
// DATE FILTER MANAGEMENT
// ============================================

let currentRules = [];
let editingRuleId = null;

function setupDateFilterUI() {
  // Master toggle
  const masterToggle = document.getElementById('dateFilterMasterToggle');
  if (masterToggle) {
    masterToggle.addEventListener('change', handleMasterToggleChange);
  }
  
  // Add new rule button
  const addRuleBtn = document.getElementById('addNewRuleBtn');
  if (addRuleBtn) {
    addRuleBtn.addEventListener('click', showRuleForm);
  }
  
  // Save rule button
  const saveRuleBtn = document.getElementById('saveRuleBtn');
  if (saveRuleBtn) {
    saveRuleBtn.addEventListener('click', saveRule);
  }
  
  // Cancel rule button
  const cancelRuleBtn = document.getElementById('cancelRuleBtn');
  if (cancelRuleBtn) {
    cancelRuleBtn.addEventListener('click', hideRuleForm);
  }
  
  // Criteria change handler
  const criteriaSelect = document.getElementById('ruleCriteria');
  if (criteriaSelect) {
    criteriaSelect.addEventListener('change', handleCriteriaChange);
  }
  
  // Clear cache button
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', clearDateFilterCache);
  }
  
  // Load initial state
  loadDateFilterState();
}

async function loadDateFilterState() {
  try {
    const { config } = await import('./config.js');
    await config.handleConfig();
    
    // Update master toggle
    const masterToggle = document.getElementById('dateFilterMasterToggle');
    const masterStatus = document.getElementById('dateFilterMasterStatus');
    
    if (masterToggle) {
      masterToggle.checked = config.enableDateFilter || false;
    }
    
    if (masterStatus) {
      if (config.enableDateFilter) {
        masterStatus.textContent = 'Etkin';
        masterStatus.classList.add('enabled');
      } else {
        masterStatus.textContent = 'Devre dışı';
        masterStatus.classList.remove('enabled');
      }
    }
    
    // Show/hide rule sections based on toggle
    toggleDateFilterSections(config.enableDateFilter);
    
    // Load and display rules
    currentRules = config.dateFilterRules || [];
    renderRulesList();
    
    // Load cache stats
    await loadDateFilterCacheStats();
    
  } catch (error) {
    console.error('Error loading date filter state:', error);
  }
}

async function handleMasterToggleChange() {
  const masterToggle = document.getElementById('dateFilterMasterToggle');
  const masterStatus = document.getElementById('dateFilterMasterStatus');
  const enabled = masterToggle.checked;
  
  try {
    const { config, saveConfig } = await import('./config.js');
    
    // If enabling and no rules exist, add default rule
    if (enabled && (!currentRules || currentRules.length === 0)) {
      currentRules = [createDefaultRule()];
    }
    
    config.enableDateFilter = enabled;
    config.dateFilterRules = currentRules;
    await saveConfig(config);
    
    // Update UI
    if (enabled) {
      masterStatus.textContent = 'Etkin';
      masterStatus.classList.add('enabled');
    } else {
      masterStatus.textContent = 'Devre dışı';
      masterStatus.classList.remove('enabled');
    }
    
    toggleDateFilterSections(enabled);
    renderRulesList();
    
    notificationHandler.showStatusMessage(
      enabled ? 'Tarih filtresi etkinleştirildi' : 'Tarih filtresi devre dışı bırakıldı',
      'success'
    );
    
  } catch (error) {
    console.error('Error saving date filter state:', error);
    notificationHandler.showStatusMessage('Ayar kaydedilirken hata oluştu', 'error');
    masterToggle.checked = !enabled; // Revert toggle
  }
}

function toggleDateFilterSections(enabled) {
  const rulesSection = document.getElementById('dateFilterRulesSection');
  const cacheSection = document.getElementById('dateFilterCacheSection');
  
  if (rulesSection) {
    rulesSection.style.display = enabled ? 'block' : 'none';
  }
  if (cacheSection) {
    cacheSection.style.display = enabled ? 'block' : 'none';
  }
}

function createDefaultRule() {
  return {
    id: 'protect-legacy-users',
    criteria: 'OLDER_THAN',
    value: 1825,
    valueType: 'days',
    action: 'KORU',
    description: '5 yıldan eski hesapları koru',
    isDefault: true
  };
}

function renderRulesList() {
  const rulesList = document.getElementById('rulesList');
  const rulesCount = document.getElementById('rulesCount');
  
  if (!rulesList) return;
  
  // Update count
  if (rulesCount) {
    const count = currentRules.length;
    rulesCount.textContent = `${count} kural`;
  }
  
  // Clear existing rules
  rulesList.innerHTML = '';
  
  // Render each rule
  currentRules.forEach((rule, index) => {
    const ruleElement = createRuleElement(rule, index);
    rulesList.appendChild(ruleElement);
  });
}

function createRuleElement(rule, index) {
  const div = document.createElement('div');
  div.className = 'rule-item';
  div.dataset.ruleId = rule.id;
  
  // Determine icon based on action (convert old BLOCK/PROTECT/SKIP to new values)
  let icon = '🛡️';
  const action = rule.action === 'BLOCK' || rule.action === 'ENGELLE' ? 'ENGELLE' : 
                 (rule.action === 'SKIP' || rule.action === 'PROTECT' || rule.action === 'KORU') ? 'KORU' : rule.action;
  if (action === 'ENGELLE') icon = '🚫';
  
  // Format criteria text
  let criteriaText = formatCriteriaText(rule);
  
  div.innerHTML = `
    <div class="rule-icon">${icon}</div>
    <div class="rule-content">
      <div class="rule-title">${getActionText(action)} - ${criteriaText}</div>
      <div class="rule-description">${rule.description || criteriaText}</div>
    </div>
    ${rule.isDefault ? '<span class="rule-badge">Varsayılan</span>' : ''}
    <div class="rule-actions">
      <button class="rule-btn rule-btn-edit" title="Düzenle">✏️</button>
      <button class="rule-btn rule-btn-delete" title="Sil">🗑️</button>
    </div>
  `;
  
  // Add event listeners
  const editBtn = div.querySelector('.rule-btn-edit');
  const deleteBtn = div.querySelector('.rule-btn-delete');
  
  editBtn.addEventListener('click', () => editRule(rule.id));
  deleteBtn.addEventListener('click', () => deleteRule(rule.id));
  
  return div;
}

function formatCriteriaText(rule) {
  const criteriaMap = {
    'NEWER_THAN': 'Hesap yaşı <',
    'OLDER_THAN': 'Hesap yaşı >',
    'BEFORE_DATE': 'Kayıt tarihi <',
    'AFTER_DATE': 'Kayıt tarihi >'
  };
  
  if (rule.criteria === 'BEFORE_DATE' || rule.criteria === 'AFTER_DATE') {
    const date = new Date(rule.value);
    return `${criteriaMap[rule.criteria]} ${date.toLocaleDateString('tr-TR')}`;
  } else {
    let value = rule.value;
    let unit = rule.valueType === 'days' ? 'gün' : (rule.valueType === 'months' ? 'ay' : 'yıl');
    return `${criteriaMap[rule.criteria]} ${value} ${unit}`;
  }
}

function getActionText(action) {
  const actionMap = {
    'ENGELLE': 'Engelle',
    'KORU': 'Koru',
    // Legacy mappings for backward compatibility
    'BLOCK': 'Engelle',
    'SKIP': 'Koru',
    'PROTECT': 'Koru'
  };
  return actionMap[action] || action;
}

function showRuleForm() {
  editingRuleId = null;
  document.getElementById('ruleFormTitle').textContent = '📝 Yeni Kural Ekle';
  document.getElementById('ruleId').value = '';
  document.getElementById('ruleIsDefault').value = 'false';
  
  // Reset form fields
  document.getElementById('ruleCriteria').value = 'NEWER_THAN';
  document.getElementById('ruleValueDays').value = '30';
  document.getElementById('ruleUnit').value = 'days';
  document.getElementById('ruleAction').value = 'ENGELLE';
  document.getElementById('ruleDescription').value = '';
  
  handleCriteriaChange();
  
  document.getElementById('ruleFormSection').style.display = 'block';
  document.getElementById('addNewRuleBtn').style.display = 'none';
}

function hideRuleForm() {
  document.getElementById('ruleFormSection').style.display = 'none';
  document.getElementById('addNewRuleBtn').style.display = 'block';
  editingRuleId = null;
}

function editRule(ruleId) {
  const rule = currentRules.find(r => r.id === ruleId);
  if (!rule) return;
  
  editingRuleId = ruleId;
  document.getElementById('ruleFormTitle').textContent = '✏️ Kuralı Düzenle';
  document.getElementById('ruleId').value = rule.id;
  document.getElementById('ruleIsDefault').value = rule.isDefault ? 'true' : 'false';
  
  // Set form values
  document.getElementById('ruleCriteria').value = rule.criteria;
  document.getElementById('ruleAction').value = rule.action;
  document.getElementById('ruleDescription').value = rule.description || '';
  
  if (rule.criteria === 'BEFORE_DATE' || rule.criteria === 'AFTER_DATE') {
    document.getElementById('ruleValueDate').value = rule.value;
  } else {
    document.getElementById('ruleValueDays').value = rule.value;
    document.getElementById('ruleUnit').value = rule.valueType || 'days';
  }
  
  handleCriteriaChange();
  
  document.getElementById('ruleFormSection').style.display = 'block';
  document.getElementById('addNewRuleBtn').style.display = 'none';
}

async function deleteRule(ruleId) {
  const rule = currentRules.find(r => r.id === ruleId);
  if (rule && rule.isDefault) {
    notificationHandler.showStatusMessage('Varsayılan kural silinemez', 'error');
    return;
  }
  
  if (!confirm('Bu kuralı silmek istediğinizden emin misiniz?')) {
    return;
  }
  
  currentRules = currentRules.filter(r => r.id !== ruleId);
  
  try {
    const { config, saveConfig } = await import('./config.js');
    config.dateFilterRules = currentRules;
    await saveConfig(config);
    
    renderRulesList();
    notificationHandler.showStatusMessage('Kural silindi', 'success');
    
  } catch (error) {
    console.error('Error deleting rule:', error);
    notificationHandler.showStatusMessage('Kural silinirken hata oluştu', 'error');
  }
}

async function saveRule() {
  const criteria = document.getElementById('ruleCriteria').value;
  const action = document.getElementById('ruleAction').value;
  const description = document.getElementById('ruleDescription').value.trim();
  
  let value;
  let valueType = 'days';
  
  if (criteria === 'BEFORE_DATE' || criteria === 'AFTER_DATE') {
    value = document.getElementById('ruleValueDate').value;
    if (!value) {
      notificationHandler.showStatusMessage('Lütfen bir tarih seçin', 'error');
      return;
    }
  } else {
    value = parseInt(document.getElementById('ruleValueDays').value);
    valueType = document.getElementById('ruleUnit').value;
    
    if (isNaN(value) || value < 1) {
      notificationHandler.showStatusMessage('Lütfen geçerli bir değer girin', 'error');
      return;
    }
    
    // Convert to days for storage
    if (valueType === 'months') value = value * 30;
    else if (valueType === 'years') value = value * 365;
  }
  
  const rule = {
    id: editingRuleId || 'rule-' + Date.now(),
    criteria,
    value,
    valueType,
    action,
    description: description || formatCriteriaText({ criteria, value, valueType }),
    isDefault: false
  };
  
  if (editingRuleId) {
    // Update existing rule
    const index = currentRules.findIndex(r => r.id === editingRuleId);
    if (index !== -1) {
      currentRules[index] = rule;
    }
  } else {
    // Add new rule
    currentRules.push(rule);
  }
  
  try {
    const { config, saveConfig } = await import('./config.js');
    config.dateFilterRules = currentRules;
    await saveConfig(config);
    
    renderRulesList();
    hideRuleForm();
    notificationHandler.showStatusMessage(
      editingRuleId ? 'Kural güncellendi' : 'Kural eklendi',
      'success'
    );
    
  } catch (error) {
    console.error('Error saving rule:', error);
    notificationHandler.showStatusMessage('Kural kaydedilirken hata oluştu', 'error');
  }
}

function handleCriteriaChange() {
  const criteria = document.getElementById('ruleCriteria').value;
  const daysGroup = document.getElementById('daysValueGroup');
  const dateGroup = document.getElementById('dateValueGroup');
  
  if (criteria === 'BEFORE_DATE' || criteria === 'AFTER_DATE') {
    daysGroup.style.display = 'none';
    dateGroup.style.display = 'block';
  } else {
    daysGroup.style.display = 'block';
    dateGroup.style.display = 'none';
  }
}

async function loadDateFilterCacheStats() {
  try {
    const stats = await storageHandler.getRegistrationDateCacheStats();
    
    document.getElementById('cacheTotalCount').textContent = stats.total;
    document.getElementById('cacheValidCount').textContent = stats.valid;
    document.getElementById('cacheExpiredCount').textContent = stats.expired;
    
  } catch (error) {
    console.error('Error loading cache stats:', error);
  }
}

async function clearDateFilterCache() {
  if (!confirm('Tüm kayıt tarihi önbelleğini temizlemek istediğinizden emin misiniz?')) {
    return;
  }
  
  try {
    await storageHandler.clearRegistrationDateCache();
    await loadDateFilterCacheStats();
    notificationHandler.showStatusMessage('Önbellek temizlendi', 'success');
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    notificationHandler.showStatusMessage('Önbellek temizlenirken hata oluştu', 'error');
  }
}

// ============================================
// DATE-BASED BULK ACTION MANAGEMENT
// ============================================

function setupDateBulkActionUI() {
  // Source selection
  const sourceSelect = document.getElementById('bulkSource');
  if (sourceSelect) {
    sourceSelect.addEventListener('change', updateBulkPreviewVisibility);
  }
  
  // Criteria change handler
  const criteriaSelect = document.getElementById('bulkCriteria');
  if (criteriaSelect) {
    criteriaSelect.addEventListener('change', handleBulkCriteriaChange);
  }
  
  // Preview button
  const previewBtn = document.getElementById('previewBulkActionBtn');
  if (previewBtn) {
    previewBtn.addEventListener('click', handleBulkPreview);
  }
  
  // Start button
  const startBtn = document.getElementById('startBulkActionBtn');
  if (startBtn) {
    startBtn.addEventListener('click', handleStartBulkAction);
  }
  
  // Load saved preferences
  loadDateBulkPreferences();
}

function handleBulkCriteriaChange() {
  const criteria = document.getElementById('bulkCriteria').value;
  const daysGroup = document.getElementById('bulkDaysValueGroup');
  const dateGroup = document.getElementById('bulkDateValueGroup');
  
  if (criteria === 'BEFORE_DATE' || criteria === 'AFTER_DATE') {
    daysGroup.style.display = 'none';
    dateGroup.style.display = 'block';
  } else {
    daysGroup.style.display = 'block';
    dateGroup.style.display = 'none';
  }
  
  // Hide preview when criteria changes
  document.getElementById('bulkPreview').style.display = 'none';
}

function updateBulkPreviewVisibility() {
  document.getElementById('bulkPreview').style.display = 'none';
}

async function loadDateBulkPreferences() {
  try {
    const { config } = await import('./config.js');
    await config.handleConfig();
    
    if (config.dateBulkConfig) {
      const cfg = config.dateBulkConfig;
      if (cfg.lastSource) document.getElementById('bulkSource').value = cfg.lastSource;
      if (cfg.lastCriteria) document.getElementById('bulkCriteria').value = cfg.lastCriteria;
      if (cfg.lastValue) document.getElementById('bulkValueDays').value = cfg.lastValue;
      if (cfg.lastValueType) document.getElementById('bulkUnit').value = cfg.lastValueType;
      if (cfg.lastAction) document.getElementById('bulkAction').value = cfg.lastAction;
      
      // Trigger criteria change to show correct input
      handleBulkCriteriaChange();
    }
  } catch (error) {
    console.error('Error loading date bulk preferences:', error);
  }
}

async function saveDateBulkPreferences() {
  try {
    const { config, saveConfig } = await import('./config.js');
    
    config.dateBulkConfig = {
      lastSource: document.getElementById('bulkSource').value,
      lastCriteria: document.getElementById('bulkCriteria').value,
      lastValue: parseInt(document.getElementById('bulkValueDays').value) || 30,
      lastValueType: document.getElementById('bulkUnit').value,
      lastAction: document.getElementById('bulkAction').value
    };
    
    await saveConfig(config);
  } catch (error) {
    console.error('Error saving date bulk preferences:', error);
  }
}

async function handleBulkPreview() {
  const previewDiv = document.getElementById('bulkPreview');
  const previewText = document.getElementById('previewText');
  
  previewDiv.style.display = 'block';
  previewText.textContent = 'Hesaplanıyor...';
  
  const source = document.getElementById('bulkSource').value;
  const criteria = document.getElementById('bulkCriteria').value;
  
  // For BLOCKED_USERS and MUTED_USERS, we fetch from server during the actual operation
  // Preview just shows a message about what will happen
  if (source === 'BLOCKED_USERS' || source === 'MUTED_USERS') {
    const sourceName = source === 'BLOCKED_USERS' ? 'engellenen' : 'sessize alınan';
    previewText.textContent = `İşlem başlatıldığında ${sourceName} kullanıcılar sunucudan getirilecek ve tarih kriterine göre filtrelenerek işlem yapılacak.`;
    await saveDateBulkPreferences();
    return;
  }
  
  // For AUTHOR_LIST, we can show the actual count from the list
  let userList = [];
  try {
    if (source === 'AUTHOR_LIST') {
      userList = await utils.getUserList();
      utils.cleanUserList(userList);
    }
  } catch (error) {
    previewText.textContent = `Hata: ${error.message}`;
    return;
  }
  
  if (userList.length === 0) {
    previewText.textContent = 'Seçilen kaynakta kullanıcı bulunamadı.';
    return;
  }
  
  previewText.textContent = `${userList.length} kullanıcı incelenecek. İşlem başlatıldığında kayıt tarihlerine göre filtreleme yapılacak.`;
  
  // Save preferences
  await saveDateBulkPreferences();
}

async function handleStartBulkAction() {
  const source = document.getElementById('bulkSource').value;
  const criteria = document.getElementById('bulkCriteria').value;
  const action = document.getElementById('bulkAction').value;
  
  let value;
  let valueType = 'days';
  
  if (criteria === 'BEFORE_DATE' || criteria === 'AFTER_DATE') {
    value = document.getElementById('bulkValueDate').value;
    if (!value) {
      notificationHandler.showStatusMessage('Lütfen bir tarih seçin', 'error');
      return;
    }
  } else {
    value = parseInt(document.getElementById('bulkValueDays').value);
    valueType = document.getElementById('bulkUnit').value;
    
    if (isNaN(value) || value < 1) {
      notificationHandler.showStatusMessage('Lütfen geçerli bir değer girin', 'error');
      return;
    }
    
    // Convert to days for storage
    if (valueType === 'months') value = value * 30;
    else if (valueType === 'years') value = value * 365;
  }
  
  // Save preferences before starting
  await saveDateBulkPreferences();
  
  // Send message to background script to start the bulk action
  chrome.runtime.sendMessage({
    action: "startDateBasedBulkAction",
    source: source,
    criteria: criteria,
    value: value,
    valueType: valueType,
    bulkAction: action
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error starting date-based bulk action:", chrome.runtime.lastError.message);
      notificationHandler.showStatusMessage("İşlem başlatılırken hata oluştu: " + chrome.runtime.lastError.message, "error");
    } else {
      console.log("notification.js: Date-based bulk action started.", response);
      notificationHandler.showStatusMessage("İşlem başlatıldı!", "success");
    }
  });
}

// Initialize tab navigation and date filter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupTabNavigation();
  setupDateFilterUI();
  setupDateBulkActionUI();
});

// Cleanup functions for page unload
window.addEventListener('beforeunload', () => {
  // Clear any pending timeouts
  if (_operationStatePollInterval) {
    clearInterval(_operationStatePollInterval);
  }
  
  // Clean up pause operation timeouts and listeners
  const pauseBtn = document.getElementById('btnPauseOperation');
  if (pauseBtn && pauseBtn._pauseTimeoutId) {
    clearTimeout(pauseBtn._pauseTimeoutId);
  }
  if (pauseBtn && pauseBtn._pauseMessageListener) {
    chrome.runtime.onMessage.removeListener(pauseBtn._pauseMessageListener);
  }
});

// Add a cleanup function for operations
function cleanupPauseOperation() {
  const pauseBtn = document.getElementById('btnPauseOperation');
  if (pauseBtn) {
    if (pauseBtn._pauseTimeoutId) {
      clearTimeout(pauseBtn._pauseTimeoutId);
      pauseBtn._pauseTimeoutId = null;
    }
    if (pauseBtn._pauseMessageListener) {
      chrome.runtime.onMessage.removeListener(pauseBtn._pauseMessageListener);
      pauseBtn._pauseMessageListener = null;
    }
  }
}

// Listen for operation state changes to trigger cleanup
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.action === "operationStateChanged" && message.operation) {
    const op = message.operation;
    // If operation completed, stopped, or resumed, clean up pause state
    if (op.state === 'COMPLETED' || op.state === 'STOPPED' || op.state === 'RUNNING') {
      cleanupPauseOperation();
    }
  }
});

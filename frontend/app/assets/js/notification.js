import * as enums from './enums.js';
import * as utils from './utils.js';
import { commHandler } from './commHandler.js';
import { storageHandler } from './storageHandler.js';

// Element References
let mutedUserCountSpan;
let blockedUserCountSpan;
let refreshMutedListButton;
let exportMutedListCSVButton;
let refreshBlockedListButton;
let exportBlockedListCSVButton;
let buttonStatusDiv;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function () {
  initializeNotificationPage();
  setupEarlyStopButton();
  setupActionButtons();
  initializeRealTimeFeatures();
});

function initializeNotificationPage() {
  console.log("🚀 Initializing EksiEngel Plus Notification Page");
  
  // Set initial status indicator
  updateStatusIndicator('inactive');
  
  // Initialize table counts
  updateTableCounts();
  
  // Setup smooth scrolling
  setupSmoothScrolling();
  
  // Add keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Get element references
  buttonStatusDiv = document.getElementById('buttonStatus');
  mutedUserCountSpan = document.getElementById('mutedUserCount');
  blockedUserCountSpan = document.getElementById('blockedUserCount');
  refreshMutedListButton = document.getElementById('refreshMutedList');
  exportMutedListCSVButton = document.getElementById('exportMutedList');
  refreshBlockedListButton = document.getElementById('refreshBlockedList');
  exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
}

function setupEarlyStopButton() {
  const earlyStopButton = document.getElementById("earlyStop");
  if (earlyStopButton) {
    earlyStopButton.addEventListener("click", handleEarlyStop);
  }
}

function handleEarlyStop() {
  const earlyStopButton = document.getElementById("earlyStop");
  
  if (!confirm("İşlemi durdurmak istediğinizden emin misiniz?")) {
    return;
  }
  
  earlyStopButton.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Durduruluyor...</span>';
  earlyStopButton.disabled = true;
  
  // Use the same timeout pattern as other message sending functions
  const sendEarlyStopPromise = new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(null, {"earlyStop":0}, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
    
    // Add timeout to prevent hanging during cooldown
    setTimeout(() => {
      reject(new Error("Timeout sending earlyStop message"));
    }, 2000);
  });
  
  sendEarlyStopPromise.then((response) => {
    console.log("notification.js: earlyStop message sent successfully");
    updateStatusIndicator('warning');
    
    const statusText = document.getElementById("statusText");
    if (statusText) {
      statusText.innerHTML = "İşlem kullanıcı tarafından durduruluyor...";
    }
    
    showStatusMessage("İşlem durduruluyor...", "info");
  }).catch((err) => {
    console.warn("notification.js: Error sending earlyStop message:", err.message);
    showStatusMessage("Durdurma işleminde hata oluştu: " + err.message, "error");
    
    // Restore button state on error
    earlyStopButton.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
    earlyStopButton.disabled = false;
    updateStatusIndicator('inactive');
  });
}

function setupActionButtons() {
  // Main operations
  document.getElementById('openauthorListPage')?.addEventListener('click', handleOpenAuthorListPage);
  document.getElementById('startUndobanAll')?.addEventListener('click', handleStartUndobanAll);
  
  // Migration operations
  document.getElementById('migrateBlockedToMuted')?.addEventListener('click', handleMigrateBlockedToMuted);
  document.getElementById('btnBlockMutedUsers')?.addEventListener('click', handleBlockMutedUsers);
  document.getElementById('btnBlockTitlesOfBlockedMuted')?.addEventListener('click', handleBlockTitlesOfBlockedMuted);
  document.getElementById('migrateBlockedTitlesToUnblocked')?.addEventListener('click', handleMigrateBlockedTitlesToUnblocked);
  
  // List management
  document.getElementById('refreshMutedList')?.addEventListener('click', handleRefreshMutedList);
  document.getElementById('exportMutedListCSV')?.addEventListener('click', handleExportMutedList);
  document.getElementById('refreshBlockedList')?.addEventListener('click', handleRefreshBlockedList);
  document.getElementById('exportBlockedListCSV')?.addEventListener('click', handleExportBlockedList);
  
  // Help
  document.getElementById('openFaq')?.addEventListener('click', handleOpenFaq);
}

function initializeRealTimeFeatures() {
  loadMutedUserCount();
  refreshBlockedUserCountDisplay(); // Use the new function to also update export button state
  
  chrome.runtime.sendMessage(null, { action: "notificationPageReady" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("notification.js: Error sending notificationPageReady message:", chrome.runtime.lastError.message);
    } else {
      console.log("✅ Notification page ready message sent");
    }
  });
  
  updateRemainingAction();
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
    // Ctrl/Cmd + S to save/export lists
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
    
    // Escape to stop operations
    if (e.key === 'Escape') {
      const earlyStopBtn = document.getElementById('earlyStop');
      if (earlyStopBtn && !earlyStopBtn.disabled) {
        earlyStopBtn.click();
      }
    }
  });
}

// Utility Functions
function updateRemainingAction() {
  const performedAction = parseInt(document.getElementById("performedAction")?.textContent) || 0;
  const plannedAction = parseInt(document.getElementById("plannedAction")?.textContent) || 0;
  const remainingAction = Math.max(0, plannedAction - performedAction);
  
  const remainingActionElement = document.getElementById("remainingAction");
  if (remainingActionElement) {
    remainingActionElement.textContent = remainingAction;
  }
}

function updateStatusIndicator(status) {
  const statusDot = document.getElementById("statusDot");
  if (!statusDot) return;
  
  statusDot.className = "indicator-dot";
  
  switch (status) {
    case 'active':
      break;
    case 'inactive':
      statusDot.classList.add('inactive');
      break;
    case 'error':
      statusDot.classList.add('error');
      break;
    case 'warning':
      statusDot.classList.add('warning');
      break;
  }
}

function updateTableCounts() {
  const plannedCountElement = document.getElementById("plannedCount");
  if (plannedCountElement) {
    const plannedRows = document.querySelectorAll("#plannedProcesses tbody tr").length;
    plannedCountElement.textContent = plannedRows;
  }
  
  const completedCountElement = document.getElementById("completedCount");
  if (completedCountElement) {
    const completedRows = document.querySelectorAll("#completedProcesses tbody tr").length;
    completedCountElement.textContent = completedRows;
  }
}

function showStatusMessage(message, type = "info") {
  const statusMessage = document.getElementById("buttonStatus");
  if (!statusMessage) return;
  
  if (statusMessage.timeoutId) {
    clearTimeout(statusMessage.timeoutId);
  }
  
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  
  setTimeout(() => {
    statusMessage.classList.add("show");
  }, 100);
  
  statusMessage.timeoutId = setTimeout(() => {
    statusMessage.classList.remove("show");
  }, 3000);
}

// Load functions
async function loadMutedUserCount() {
  const mutedUserCount = await storageHandler.getMutedUserCount();
  const mutedUserCountSpan = document.getElementById("mutedUserCount");
  if (mutedUserCountSpan) {
    mutedUserCountSpan.textContent = mutedUserCount;
  }
}

async function loadBlockedUserCount() {
  const blockedUserCount = await storageHandler.getBlockedUserCount();
  const blockedUserCountSpan = document.getElementById("blockedUserCount");
  if (blockedUserCountSpan) {
    blockedUserCountSpan.textContent = blockedUserCount;
  }
}

// Function to refresh the blocked user count display and update export button state
async function refreshBlockedUserCountDisplay() {
  try {
    const blockedUserCount = await storageHandler.getBlockedUserCount();
    
    // Update the count display
    if (blockedUserCountSpan) {
      blockedUserCountSpan.textContent = blockedUserCount;
    }
    
    // Update export button state based on count
    if (exportBlockedListCSVButton) {
      exportBlockedListCSVButton.disabled = blockedUserCount === 0;
    }
    
    console.log(`notification.js: Updated blocked user count display: ${blockedUserCount}`);
  } catch (error) {
    console.error("notification.js: Error refreshing blocked user count display:", error);
    // Set to 0 on error and disable export
    if (blockedUserCountSpan) {
      blockedUserCountSpan.textContent = "0";
    }
    if (exportBlockedListCSVButton) {
      exportBlockedListCSVButton.disabled = true;
    }
  }
}

// Helper Functions
function updateButtonStatus(message, isError = false, clearAfterMs = 3000) {
  if (!buttonStatusDiv) return;
  buttonStatusDiv.textContent = message;
  buttonStatusDiv.style.color = isError ? '#dc3545' : '#333';

  if (clearAfterMs > 0) {
    setTimeout(() => {
      if (buttonStatusDiv.textContent === message) {
        buttonStatusDiv.textContent = '';
      }
    }, clearAfterMs);
  }
}

function downloadCSV(usernames, listType) {
  if (!Array.isArray(usernames) || usernames.length === 0) {
    updateButtonStatus("No usernames to export.", true);
    return;
  }

  const csvHeader = "Username\n";
  const csvContent = csvHeader + usernames.join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const timestamp = new Date().toISOString().slice(0, 10);
  const filenamePrefix = listType === 'blocked' ? 'eksiengel_blocked_users' : 'eksiengel_muted_users';
  link.setAttribute("download", `${filenamePrefix}_${timestamp}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  updateButtonStatus(`${listType === 'blocked' ? 'Blocked' : 'Muted'} user list exported.`, false);
}

// Event Handlers
function handleOpenAuthorListPage() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_BAN_LIST });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") });
  updateButtonStatus("Opening Author List Page...", false, 2000);
}

function handleStartUndobanAll() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_UNDOBANALL });
  chrome.runtime.sendMessage(null, { "banSource": enums.BanSource.UNDOBANALL, "banMode": enums.BanMode.UNDOBAN }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending startUndobanAll message:", chrome.runtime.lastError.message);
      updateButtonStatus("Error starting 'Undo All Bans': " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: startUndobanAll message sent.");
    }
  });
  updateButtonStatus("Starting 'Undo All Bans'...", false, 2000);
}

function handleOpenFaq() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_FAQ });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
  updateButtonStatus("Opening Settings and Help...", false, 2000);
}

function handleMigrateBlockedToMuted() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_MIGRATE });
  updateButtonStatus("Starting migration (Blocked -> Muted)...", false, 0);
  chrome.runtime.sendMessage(null, { action: "startMigration" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending startMigration message:", chrome.runtime.lastError.message);
      updateButtonStatus("Error starting migration: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: Migration start message sent.");
    }
  });
}

function handleMigrateBlockedTitlesToUnblocked() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_MIGRATE_TITLES });
  updateButtonStatus("Starting title unblock...", false, 0);
  chrome.runtime.sendMessage(null, { action: "startTitleMigration" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending startTitleMigration message:", chrome.runtime.lastError.message);
      updateButtonStatus("Error starting title unblock: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: Title migration start message sent.");
    }
  });
}

async function handleRefreshMutedList() {
  console.log("notification.js", "Refresh muted list button clicked.");
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_REFRESH_MUTED });

  const refreshButton = document.getElementById('refreshMutedList');
  const earlyStopButton = document.getElementById('earlyStop');
  if (refreshButton) refreshButton.disabled = true;

  updateButtonStatus("Initiating muted list refresh...", false, 0);

  chrome.runtime.sendMessage({ action: "refreshMutedList" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending refreshMutedList message:", chrome.runtime.lastError.message);
      updateButtonStatus("Error initiating refresh: " + chrome.runtime.lastError.message, true, 5000);
      if (refreshButton) refreshButton.disabled = false;
      if (earlyStopButton) earlyStopButton.disabled = false;
    } else {
      console.log("notification.js: refreshMutedList message sent successfully.");
    }
  });
}

async function handleExportMutedList() {
  console.log("notification.js", "Export muted list button clicked.");
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_EXPORT_MUTED });

  const exportButton = document.getElementById('exportMutedListCSV');
  if (exportButton) exportButton.disabled = true;

  updateButtonStatus("Preparing export...", false, 0);

  try {
    const usernames = await storageHandler.getMutedUserList();
    if (usernames && usernames.length > 0) {
      downloadCSV(usernames, 'muted');
    } else {
      updateButtonStatus("No muted user list found in storage to export.", true);
    }
  } catch (error) {
    console.error("notification.js", "Error exporting muted list:", error);
    updateButtonStatus(`Error exporting: ${error.message || 'Unknown error'}`, true);
  } finally {
    const exportButton = document.getElementById('exportMutedListCSV');
    if (exportButton) exportButton.disabled = false;
  }
}

async function handleRefreshBlockedList() {
  console.log("notification.js", "Refresh blocked list button clicked.");
  updateButtonStatus("Initiating blocked list refresh...", false, 0);

  // Disable the refresh button during operation
  if (refreshBlockedListButton) refreshBlockedListButton.disabled = true;
  
  // Disable export button during refresh
  if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true;

  chrome.runtime.sendMessage({ action: "refreshBlockedList" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending refreshBlockedList message:", chrome.runtime.lastError.message);
      updateButtonStatus("Error initiating refresh: " + chrome.runtime.lastError.message, true, 5000);
      
      // Re-enable refresh button on error
      if (refreshBlockedListButton) refreshBlockedListButton.disabled = false;
      
      // Re-enable export button based on current stored count
      refreshBlockedUserCountDisplay();
    } else {
      console.log("notification.js: refreshBlockedList message sent successfully.");
    }
  });
}

async function handleExportBlockedList() {
  console.log("notification.js", "Export blocked list button clicked.");

  if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true;
  updateButtonStatus("Preparing export...", false, 0);

  try {
    const blockedUsernames = await storageHandler.getBlockedUserList();
    if (blockedUsernames && blockedUsernames.length > 0) {
      downloadCSV(blockedUsernames, 'blocked');
    } else {
      updateButtonStatus("No blocked user list found in storage to export.", true);
    }
  } catch (error) {
    console.error("notification.js", "Error exporting blocked list:", error);
    updateButtonStatus(`Error exporting: ${error.message || 'Unknown error'}`, true);
  } finally {
    const currentCount = parseInt(blockedUserCountSpan.textContent) || 0;
    if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = currentCount === 0;
  }
}

function handleBlockMutedUsers() {
  updateButtonStatus("Starting 'Block Muted Users' process...", false, 0);
  chrome.runtime.sendMessage({ action: "blockMutedUsers" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending blockMutedUsers message:", chrome.runtime.lastError.message);
      updateButtonStatus("Error starting process: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: blockMutedUsers message sent.");
    }
  });
}

function handleBlockTitlesOfBlockedMuted() {
  updateButtonStatus("Starting 'Block Titles of Blocked/Muted' process...", false, 0);
  chrome.runtime.sendMessage({ action: "blockTitlesOfBlockedMuted" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("notification.js: Error sending blockTitlesOfBlockedMuted message:", chrome.runtime.lastError.message);
      updateButtonStatus("Error starting process: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      console.log("notification.js: blockTitlesOfBlockedMuted message sent.");
    }
  });
}

// Message Listener
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message && message.action === "ping") {
    console.log("Received ping from background script");
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === enums.NotificationType.UPDATE_COUNTS) {
    console.log("Received message to update user counts.");
    loadMutedUserCount();
    refreshBlockedUserCountDisplay(); // Use the new function to also update export button state
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

    // Re-enable refresh button
    if (refreshBlockedListButton) refreshBlockedListButton.disabled = false;
    
    // Refresh the display to update count and export button state
    refreshBlockedUserCountDisplay().catch(error => {
      console.error("notification.js: Error updating blocked user count display:", error);
    });

    if (message.success) {
      updateButtonStatus(`Blocked list refreshed. Found ${message.count} users.`, false, 5000);
    } else {
      const errorMessage = message.stoppedEarly ? "Blocked list refresh stopped by user." : `Blocked list refresh failed: ${message.error}`;
      updateButtonStatus(errorMessage, true, 5000);
    }

    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "blockedListRefreshProgress") {
    console.log(`Received blocked list refresh progress: Count ${message.count}`);
    if (blockedUserCountSpan) {
      blockedUserCountSpan.textContent = message.count;
    }
    if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true; // Keep disabled during refresh
    sendResponse({ status: "ok" });
    return true;
  }

  // Handle General Notifications from Background
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

        // Show and update the cooldown timer
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
      // Hide the cooldown timer for non-cooldown notifications
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
        
        // UPDATE THE STATISTICS SECTION: Fix for İşlem Durumu statistics
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
        
        // UPDATE CURRENT OPERATION DESCRIPTION: Show the same description as in planned/completed operations
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
         
         // UPDATE THE STATISTICS SECTION: Fix for İşlem Durumu statistics on finish
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
           remainingActionElement.textContent = 0; // All done
         }
         
         // UPDATE CURRENT OPERATION DESCRIPTION: Show completion status
         if (currentOperationDescriptionElement) {
           currentOperationDescriptionElement.textContent = "İşlem tamamlandı";
         }
         
      } else {
         if (progressBar) progressBar.style.width = "0%";
         if (progressBarText) progressBarText.innerHTML = "";
         if (progressText) progressText.innerHTML = "";
         
         // Reset statistics when not ongoing/finished
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
        updatePlannedProcessesTable(notification.plannedProcesses);
      }
      else if (notification.plannedProcesses && Array.isArray(notification.plannedProcesses) && notification.plannedProcesses.length > 0) {
        console.log("Updating planned processes table via fallback with", notification.plannedProcesses.length, "items");
        updatePlannedProcessesTable(notification.plannedProcesses);
      }
    }

    sendResponse({status: 'ok'});
    return true;
  }

  // Handle migration progress updates
  if (message && message.action === "updateMigrationProgress") {
    console.debug(`Updating migration progress: ${message.current}/${message.total} (${message.percentage}%)`);

    const migrationBar = document.getElementById("migrationBar");
    const migrationBarText = document.getElementById("migrationBarText");
    const migrationProgressText = document.getElementById("migrationProgressText");
    const migrationStatusText = document.getElementById("migrationStatusText");
    const statusTextDiv = document.getElementById("statusText");

    if (migrationBar && migrationBarText && migrationProgressText) {
      migrationBar.style.width = `${message.percentage}%`;
      migrationBarText.innerHTML = `%${message.percentage}`;
      migrationProgressText.innerHTML = `İşlenen: ${message.current} / ${message.total}`;

      if (migrationStatusText) {
        migrationStatusText.innerHTML = "İşlem devam ediyor...";
      }

      if (statusTextDiv) {
        const isTitleUnblocking = window.location.href.includes("startTitleMigration");
        if (isTitleUnblocking) {
          statusTextDiv.innerHTML = "Durum: Başlık engelleri kaldırılıyor...";
        } else {
          statusTextDiv.innerHTML = "Durum: Engellenen kullanıcılar sessize alınıyor...";
        }
      }
    }

    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "updateMigrationStatus") {
    console.debug(`Received migration status update: ${message.statusText}`);
    const migrationStatusText = document.getElementById("migrationStatusText");
    if (migrationStatusText) {
      migrationStatusText.innerHTML = message.statusText;
    }
    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "migrationBatchComplete") {
    console.log(`Migration batch complete: ${message.message}`);

    const migrationBar = document.getElementById("migrationBar");
    const migrationBarText = document.getElementById("migrationBarText");
    const migrationProgressText = document.getElementById("migrationProgressText");
    const migrationStatusText = document.getElementById("migrationStatusText");
    const migrationResultText = document.getElementById("migrationResultText");

    if (migrationBar && migrationBarText) {
      migrationBar.style.width = "0%";
      migrationBarText.innerHTML = "%0";
    }

    if (migrationStatusText) {
      migrationStatusText.innerHTML = "Sonraki grup işleniyor...";
    }

    const statusTextDiv = document.getElementById("statusText");
    if (statusTextDiv) {
      const isTitleUnblocking = window.location.href.includes("startTitleMigration");
      if (isTitleUnblocking) {
        statusTextDiv.innerHTML = "Durum: Sonraki başlık grubu işleniyor...";
      } else {
        statusTextDiv.innerHTML = "Durum: Sonraki grup işleniyor...";
      }
    }

    if (migrationResultText) {
      migrationResultText.innerHTML = `Grup tamamlandı: Başarılı: ${message.migrated}, Atlanan: ${message.skipped}, Başarısız: ${message.failed}, Toplam: ${message.total}`;
    }

    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "migrationComplete") {
    console.log(`Migration complete: ${message.message}`);

    const migrationBar = document.getElementById("migrationBar");
    const migrationBarText = document.getElementById("migrationBarText");
    const migrationProgressText = document.getElementById("migrationProgressText");
    const migrationStatusText = document.getElementById("migrationStatusText");
    const migrationResultText = document.getElementById("migrationResultText");

    if (migrationBar && migrationBarText) {
      migrationBar.style.width = "100%";
      migrationBarText.innerHTML = "%100";
    }

    if (migrationStatusText) {
      migrationStatusText.innerHTML = "İşlem tamamlandı!";
    }

    const statusTextDiv = document.getElementById("statusText");
    if (statusTextDiv) {
      const isTitleUnblocking = window.location.href.includes("startTitleMigration");
      if (isTitleUnblocking) {
        statusTextDiv.innerHTML = "Durum: Başlık engelleri kaldırma işlemi tamamlandı!";
      } else {
        statusTextDiv.innerHTML = "Durum: İşlem tamamlandı!";
      }
    }

    if (migrationResultText) {
      migrationResultText.innerHTML = `Sonuç: Başarılı: ${message.migrated}, Atlanan: ${message.skipped}, Başarısız: ${message.failed}, Toplam: ${message.total}`;
    }

    const earlyStopButton = document.getElementById("earlyStop");
    if (earlyStopButton) {
      earlyStopButton.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
      earlyStopButton.disabled = false;
    }

    sendResponse({ status: "ok" });
    return true;
  }

  if (message && message.action === "migrationStopped") {
    console.log(`Migration stopped: ${message.message}`);

    const migrationBar = document.getElementById("migrationBar");
    const migrationBarText = document.getElementById("migrationBarText");
    const migrationProgressText = document.getElementById("migrationProgressText");
    const migrationStatusText = document.getElementById("migrationStatusText");
    const migrationResultText = document.getElementById("migrationResultText");

    if (migrationStatusText) {
      migrationStatusText.innerHTML = "İşlem kullanıcı tarafından durduruldu!";
    }

    const statusTextDiv = document.getElementById("statusText");
    if (statusTextDiv) {
      const isTitleUnblocking = window.location.href.includes("startTitleMigration");
      if (isTitleUnblocking) {
        statusTextDiv.innerHTML = "Durum: Başlık engelleri kaldırma işlemi kullanıcı tarafından durduruldu!";
      } else {
        statusTextDiv.innerHTML = "Durum: İşlem kullanıcı tarafından durduruldu!";
      }
    }

    if (migrationResultText) {
      if (message.cooldown) {
        migrationResultText.innerHTML = "İşlem cooldown sırasında durduruldu.";
      } else if (message.processed !== undefined) {
        migrationResultText.innerHTML = `İşlem durduruldu. İşlenen: ${message.processed} / ${message.total}`;
      } else {
        migrationResultText.innerHTML = "İşlem durduruldu.";
      }
    }

    const earlyStopButton = document.getElementById("earlyStop");
    if (earlyStopButton) {
      earlyStopButton.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
      earlyStopButton.disabled = false;
    }

    const completionCooldownDiv = document.getElementById("remainingTimeInSec");
    if (completionCooldownDiv) {
      completionCooldownDiv.innerHTML = "Tamamlandı";
    }

    const stoppedCooldownDiv = document.getElementById("remainingTimeInSec");
    if (stoppedCooldownDiv) {
      stoppedCooldownDiv.innerHTML = "Durduruldu";
    }

    sendResponse({ status: "ok" });
    return true;
  }
});

// Table Functions
function insertCompletedProcessesTable(banSource, successfulAction, performedAction, plannedAction, errorStatus, operationMetadata = null) {
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
  
  // Use the EXACT same description logic as the planned processes table
  let description = "Toplu işlem";
  
  if (operationMetadata) {
    // First priority: use actionDescription if available (matches planned processes)
    if (operationMetadata.actionDescription) {
      description = operationMetadata.actionDescription;
    }
    // Second priority: use operationNotes if available
    else if (operationMetadata.operationNotes) {
      description = operationMetadata.operationNotes;
    }
    // Third priority: generate from metadata using EXACT same logic as planned processes
    else {
      description = generateDescriptionFromMetadataForCompleted(banSource, operationMetadata);
    }
  } else {
    // Fallback: generate from banSource only using EXACT same logic as planned processes
    description = generateDescriptionFromMetadataForCompleted(banSource, {});
  }
  
  cell3.innerHTML = description;
  cell3.title = `İşlem detayları: ${banSource}`;
  
  cell4.innerHTML = performedAction;
  cell5.innerHTML = successfulAction;
  cell6.innerHTML = errorStatus;
}

// Helper function to generate description using EXACT same logic as planned processes
function generateDescriptionFromMetadataForCompleted(banSource, metadata = {}) {
  // Use EXACT same logic as the planned processes function
  const { targetTypes = [], sourceEntry, sourceAuthor, sourceTitle, sourceList, timeFilter } = metadata;
  
  let baseDescription = "";
  let operationType = banSource.includes('UN') ? "Engel Kaldır" : "Engelle";
  
  switch (banSource) {
    case enums.BanSource.SINGLE:
      baseDescription = `Tek Kullanıcı ${operationType}`;
      if (targetTypes && targetTypes.length > 0) {
        const targets = targetTypes.map(t =>
          t === enums.TargetType.USER ? "Kullanıcı" :
          t === enums.TargetType.TITLE ? "Başlık" : "Sessiz"
        ).join(", ");
        baseDescription += ` (${targets})`;
      }
      break;
    case enums.BanSource.FAV:
      baseDescription = `Favori Edenleri ${operationType}`;
      if (sourceEntry) {
        baseDescription += " (Entry)";
      }
      break;
    case enums.BanSource.FOLLOW:
      baseDescription = `Takipçileri ${operationType}`;
      if (sourceAuthor) {
        baseDescription += ` (${sourceAuthor})`;
      }
      break;
    case enums.BanSource.LIST:
      baseDescription = `Listeden ${operationType}`;
      if (sourceList && sourceList.length > 0) {
        baseDescription += ` (${sourceList.length} kullanıcı)`;
      }
      break;
    case enums.BanSource.TITLE:
      baseDescription = `Başlıktaki Yazarları ${operationType}`;
      if (sourceTitle) {
        baseDescription += ` (${sourceTitle})`;
      }
      if (timeFilter) {
        const timeDesc = timeFilter === enums.TimeSpecifier.LAST_24_H ? "Son 24 saat" : "Tümü";
        baseDescription += ` - ${timeDesc}`;
      }
      break;
    case enums.BanSource.UNDOBANALL:
      baseDescription = "Tüm Engelleri Kaldır";
      break;
    case enums.BanSource.MIGRATE_BLOCKED_TO_MUTED:
      baseDescription = "Engelli Kullanıcıları Sessize al";
      break;
    case enums.BanSource.BLOCK_MUTED_USERS:
      baseDescription = "Sessiz Kullanıcıları Engelle";
      break;
    case enums.BanSource.BLOCKED_MUTED_TITLES:
      baseDescription = "Engelli/Sessiz Başlıkları Engelle";
      break;
    case enums.BanSource.REFRESH_MUTED_LIST:
      baseDescription = "Sessiz Listesi Yenile";
      break;
    case enums.BanSource.REFRESH_BLOCKED_LIST:
      baseDescription = "Engelli Listesi Yenile";
      break;
    default:
      baseDescription = `${operationType} İşlemi`;
  }
  
  return baseDescription;
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

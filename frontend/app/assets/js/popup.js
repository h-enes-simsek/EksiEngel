import * as enums from './enums.js';
import { commHandler } from './commHandler.js';
import { storageHandler } from './storageHandler.js';
import { scrapingHandler } from './scrapingHandler.js';
import { log } from './log.js';

log.info("popup.js: has been started.");

let mutedUserCountSpan;
let refreshMutedListButton;
let exportMutedListCSVButton;
let blockedUserCountSpan;
let refreshBlockedListButton;
let exportBlockedListCSVButton;
let popupStatusDiv;

function updateStatus(message, isError = false, clearAfterMs = 3000) {
  if (!popupStatusDiv) return;
  popupStatusDiv.textContent = message;
  popupStatusDiv.style.color = isError ? '#dc3545' : '#333';

  if (clearAfterMs > 0) {
    setTimeout(() => {
      if (popupStatusDiv.textContent === message) {
        popupStatusDiv.textContent = '';
      }
    }, clearAfterMs);
  }
}

function downloadCSV(usernames, listType) {
  log.info("popup.js", `downloadCSV triggered. Usernames count: ${usernames ? usernames.length : 0}, listType: ${listType}`);
  if (!Array.isArray(usernames) || usernames.length === 0) {
    updateStatus("No usernames to export.", true);
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
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  updateStatus(`${listType === 'blocked' ? 'Blocked' : 'Muted'} user list exported.`, false);
}

async function initializePopup() {
  log.info("popup.js: Initializing...");

  mutedUserCountSpan = document.getElementById('mutedUserCount');
  refreshMutedListButton = document.getElementById('refreshMutedList');
  exportMutedListCSVButton = document.getElementById('exportMutedListCSV');
  popupStatusDiv = document.getElementById('popupStatus');

  if (mutedUserCountSpan) {
    mutedUserCountSpan.textContent = '0';
  }

  try {
    const count = await storageHandler.getMutedUserCount();
    if (mutedUserCountSpan) {
      mutedUserCountSpan.textContent = count;
    }
    if (exportMutedListCSVButton) {
      exportMutedListCSVButton.disabled = count === 0;
    }
  } catch (error) {
    log.err("popup.js", "Error getting initial muted count:", error);
    if (mutedUserCountSpan) {
      mutedUserCountSpan.textContent = 'Error';
    }
    if (exportMutedListCSVButton) {
      exportMutedListCSVButton.disabled = true;
    }
  }

  blockedUserCountSpan = document.getElementById('blockedUserCount');
  refreshBlockedListButton = document.getElementById('refreshBlockedList');
  exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');

  if (blockedUserCountSpan) {
    blockedUserCountSpan.textContent = '0';
  }

  try {
    const count = await storageHandler.getBlockedUserCount();
    if (blockedUserCountSpan) {
      blockedUserCountSpan.textContent = count;
    }
    if (exportBlockedListCSVButton) {
      exportBlockedListCSVButton.disabled = count === 0;
    }
  } catch (error) {
    log.err("popup.js", "Error getting initial blocked count:", error);
    if (blockedUserCountSpan) {
      blockedUserCountSpan.textContent = 'Error';
    }
    if (exportBlockedListCSVButton) {
      exportBlockedListCSVButton.disabled = true;
    }
  }

  refreshMutedListButton.addEventListener('click', handleRefreshMutedList);
  exportMutedListCSVButton.addEventListener('click', handleExportMutedList);

  if (refreshBlockedListButton) {
    refreshBlockedListButton.addEventListener('click', handleRefreshBlockedList);
  }
  if (exportBlockedListCSVButton) {
    exportBlockedListCSVButton.addEventListener('click', handleExportBlockedList);
  }

  document.getElementById('openauthorListPage')?.addEventListener('click', handleOpenAuthorListPage);
  document.getElementById('startUndobanAll')?.addEventListener('click', handleStartUndobanAll);
  document.getElementById('openFaq')?.addEventListener('click', handleOpenFaq);
  document.getElementById('migrateBlockedToMuted')?.addEventListener('click', handleMigrateBlockedToMuted);
  document.getElementById('migrateBlockedTitlesToUnblocked')?.addEventListener('click', handleMigrateBlockedTitlesToUnblocked);
  document.getElementById('btnBlockMutedUsers')?.addEventListener('click', handleBlockMutedUsers);
  document.getElementById('btnBlockTitlesOfBlockedMuted')?.addEventListener('click', handleBlockTitlesOfBlockedMuted);

  log.info("popup.js: Initialization complete.");
}

function handleRefreshMutedList() {
  log.info("popup.js", "Refresh muted list button clicked.");
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_REFRESH_MUTED });

  updateStatus("Initiating muted list refresh...", false, 0);

  chrome.runtime.sendMessage({ action: "refreshMutedList" }, (response) => {
    if (chrome.runtime.lastError) {
      log.error("popup.js: Error sending refreshMutedList message:", chrome.runtime.lastError.message);
      updateStatus("Error initiating refresh: " + chrome.runtime.lastError.message, true, 5000);
      refreshMutedListButton.disabled = false;
      const currentCount = parseInt(mutedUserCountSpan.textContent) || 0;
      exportMutedListCSVButton.disabled = currentCount === 0;
    } else {
      log.info("popup.js: refreshMutedList message sent successfully. Waiting for completion message.");
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "mutedListRefreshComplete") {
    log.info("popup.js: Received mutedListRefreshComplete message.", request);
    refreshMutedListButton.disabled = false;

    if (request.success) {
      updateStatus(`Muted list refreshed. Found ${request.count} users.`, false, 5000);
      if (mutedUserCountSpan) {
        mutedUserCountSpan.textContent = request.count;
      }
      exportMutedListCSVButton.disabled = request.count === 0;
    } else {
      const errorMessage = request.stoppedEarly ? "Muted list refresh stopped by user." : `Muted list refresh failed: ${request.error}`;
      updateStatus(errorMessage, true, 5000);
      const currentCount = parseInt(mutedUserCountSpan.textContent) || 0;
      exportMutedListCSVButton.disabled = currentCount === 0;
    }
    sendResponse({ status: "ok" });
  }
});

async function handleExportMutedList() {
  log.info("popup.js", "handleExportMutedList triggered.");
  log.info("popup.js", "Export muted list button clicked.");
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_EXPORT_MUTED });

  exportMutedListCSVButton.disabled = true;
  updateStatus("Preparing export...", false, 0);

  try {
    const usernames = await storageHandler.getMutedUserList();
    if (usernames && usernames.length > 0) {
      downloadCSV(usernames, 'muted');
    } else {
      updateStatus("No muted user list found in storage to export.", true);
    }
  } catch (error) {
    log.err("popup.js", "Error exporting muted list:", error);
    updateStatus(`Error exporting: ${error.message || 'Unknown error'}`, true);
  } finally {
    const currentCount = parseInt(mutedUserCountSpan.textContent) || 0;
    exportMutedListCSVButton.disabled = currentCount === 0;
  }
}

function handleRefreshBlockedList() {
  log.info("popup.js", "Refresh blocked list button clicked.");

  updateStatus("Initiating blocked list refresh...", false, 0);

  chrome.runtime.sendMessage({ action: "refreshBlockedList" }, (response) => {
    if (chrome.runtime.lastError) {
      log.error("popup.js: Error sending refreshBlockedList message:", chrome.runtime.lastError.message);
      updateStatus("Error initiating refresh: " + chrome.runtime.lastError.message, true, 5000);
      if (refreshBlockedListButton) refreshBlockedListButton.disabled = false;
      const currentCount = parseInt(blockedUserCountSpan.textContent) || 0;
      if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = currentCount === 0;
    } else {
      log.info("popup.js: refreshBlockedList message sent successfully. Waiting for completion message.");
    }
  });
}

async function handleExportBlockedList() {
  console.log("popup.js", "Export blocked list button clicked.");
  const exportButton = document.getElementById('exportBlockedListCSV');
  if (exportButton) exportButton.disabled = true;

  updateStatus("Preparing export...", false, 0);

  try {
    // First try permanent storage
    let usernames = await storageHandler.getBlockedUserList();
    
    // If no data in permanent storage, check temporary storage
    if (!usernames || usernames.length === 0) {
      const partialData = await storageHandler.getPartialBlockedUsers();
      if (partialData && partialData.usernames) {
        usernames = partialData.usernames;
        updateStatus("Exporting partial list from early stop...", false);
      }
    }
    
    if (usernames && usernames.length > 0) {
      downloadCSV(usernames, 'blocked');
    } else {
      updateStatus("No blocked user list found in storage to export.", true);
    }
  } catch (error) {
    console.error("popup.js", "Error exporting blocked list:", error);
    updateStatus(`Error exporting: ${error.message || 'Unknown error'}`, true);
  } finally {
    if (exportButton) exportButton.disabled = false;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "mutedListRefreshComplete") {
    log.info("popup.js: Received mutedListRefreshComplete message.", request);
    if (refreshMutedListButton) refreshMutedListButton.disabled = false;

    if (request.success) {
      updateStatus(`Muted list refreshed. Found ${request.count} users.`, false, 5000);
      if (mutedUserCountSpan) {
        mutedUserCountSpan.textContent = request.count;
      }
      if (exportMutedListCSVButton) exportMutedListCSVButton.disabled = request.count === 0;
    } else {
      const errorMessage = request.stoppedEarly ? "Muted list refresh stopped by user." : `Muted list refresh failed: ${request.error}`;
      updateStatus(errorMessage, true, 5000);
      const currentCount = parseInt(mutedUserCountSpan.textContent) || 0;
      if (exportMutedListCSVButton) exportMutedListCSVButton.disabled = currentCount === 0;
    }
    sendResponse({ status: "ok" });
    return true;
  }

  if (request.action === "blockedListRefreshComplete") {
    log.info("popup.js: Received blockedListRefreshComplete message.", request);
    if (refreshBlockedListButton) refreshBlockedListButton.disabled = false;

    if (request.success) {
      updateStatus(`Blocked list refreshed. Found ${request.count} users.`, false, 5000);
      if (blockedUserCountSpan) {
        blockedUserCountSpan.textContent = request.count;
      }
      if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = request.count === 0;
    } else {
      const errorMessage = request.stoppedEarly ? "Blocked list refresh stopped by user." : `Blocked list refresh failed: ${request.error}`;
      updateStatus(errorMessage, true, 5000);
      const currentCount = parseInt(blockedUserCountSpan.textContent) || 0;
      if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = currentCount === 0;
    }
    sendResponse({ status: "ok" });
    return true;
  }

  if (request.action === "blockedListRefreshProgress") {
    log.info("popup.js: Received blockedListRefreshProgress message.", request);
    if (blockedUserCountSpan) {
      blockedUserCountSpan.textContent = request.count;
    }
    if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true;
    sendResponse({ status: "ok" });
    return true;
  }

  return false;
});

function handleOpenAuthorListPage() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_BAN_LIST });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") }, () => {
    window.close();
  });
}

function handleStartUndobanAll() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_UNDOBANALL });
  chrome.runtime.sendMessage(null, { "banSource": enums.BanSource.UNDOBANALL, "banMode": enums.BanMode.UNDOBAN });
  updateStatus("Starting 'Undo All Bans'...", false, 2000);
}

function handleOpenFaq() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_FAQ });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
}

function handleMigrateBlockedToMuted() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_MIGRATE });
  updateStatus("Starting migration (Blocked -> Muted)...", false, 0);
  chrome.runtime.sendMessage(null, { action: "startMigration" }, (response) => {
    if (chrome.runtime.lastError) {
      log.error("popup.js: Error sending startMigration message:", chrome.runtime.lastError.message);
      updateStatus("Error starting migration: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      log.info("popup.js: Migration start message sent.");
      window.close();
    }
  });
}

function handleMigrateBlockedTitlesToUnblocked() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_MIGRATE_TITLES });
  updateStatus("Starting title unblock...", false, 0);
  chrome.runtime.sendMessage(null, { action: "startTitleMigration" }, (response) => {
    if (chrome.runtime.lastError) {
      log.error("popup.js: Error sending startTitleMigration message:", chrome.runtime.lastError.message);
      updateStatus("Error starting title unblock: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      log.info("popup.js: Title migration start message sent.");
      window.close();
    }
  });
}

function handleBlockMutedUsers() {
  updateStatus("Starting 'Block Muted Users' process...", false, 0);
  chrome.runtime.sendMessage({ action: "blockMutedUsers" }, (response) => {
    if (chrome.runtime.lastError) {
      log.error("popup.js: Error sending blockMutedUsers message:", chrome.runtime.lastError.message);
      updateStatus("Error starting process: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      log.info("popup.js: blockMutedUsers message sent.");
      window.close();
    }
  });
}

function handleBlockTitlesOfBlockedMuted() {
  updateStatus("Starting 'Block Titles of Blocked/Muted' process...", false, 0);
  chrome.runtime.sendMessage({ action: "blockTitlesOfBlockedMuted" }, (response) => {
    if (chrome.runtime.lastError) {
      log.error("popup.js: Error sending blockTitlesOfBlockedMuted message:", chrome.runtime.lastError.message);
      updateStatus("Error starting process: " + chrome.runtime.lastError.message, true, 5000);
    } else {
      log.info("popup.js: blockTitlesOfBlockedMuted message sent.");
      window.close();
    }
  });
}

commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_ICON });

document.addEventListener('DOMContentLoaded', initializePopup);
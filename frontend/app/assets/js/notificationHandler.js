import {config} from './config.js';
import {log} from './log.js';
import * as enums from './enums.js';
import { storageHandler } from './storageHandler.js';
import { generateUnifiedDescription } from './queue.js';

class NotificationHandler {
  constructor() {}

  #sendMessage = async (status, statusText, errorText, plannedProcesses, completedProcess, successfulAction, performedAction, plannedAction, remainingTimeInSec) => {
    const message = { status, statusText, errorText, plannedProcesses, completedProcess, successfulAction, performedAction, plannedAction, remainingTimeInSec };
    try {
      if (chrome.extension && chrome.extension.getViews) {
        const views = chrome.extension.getViews({ type: "tab" });
        if (views.length === 0) {
          log.warn("notification", "No notification tab found to send message to");
          return;
        }
      }
      const sendMessagePromise = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(null, {"notification": message}, response => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(response));
        setTimeout(() => reject(new Error("Timeout sending notification message")), 1000);
      });
      await sendMessagePromise;
    } catch (err) {
      if (message.status !== enums.NotificationType.COOLDOWN) {
        log.warn("notification", "Error sending notification: " + err + " :: " + JSON.stringify(message));
      }
    }
  }

  notify = (statusText) => this.#sendMessage(enums.NotificationType.NOTIFY, statusText, "", [], null, 0, 0, 0, 0);
  updateMutedUserCountDisplay = () => log.info("notification", "updateMutedUserCountDisplay called (placeholder)");
  notifyControlAccess = () => this.notify("Ekşi Sözlük'e erişim kontrol ediliyor.");
  notifyControlLogin = () => this.notify("Ekşi Sözlük'e giriş yapıp yapmadığınız kontrol ediliyor.");
  notifyScrapeFavs = () => this.notify("Hedef entry'i favorileyen yazarlar toplanıyor.");
  notifyScrapeFollowers = () => this.notify("Hedef yazarın takipçileri toplanıyor.");
  notifyScrapeFollowings = () => this.notify("Takip ettiğiniz yazarlar toplanıyor.");
  notifyScrapeBanned = () => this.notify("Engellediğiniz yazarlar toplanıyor.");
  notifyAnalysisProtectFollowedUsers = () => this.notify("Takip ettiğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.");
  notifyAnalysisOnlyRequiredActions = () => this.notify("Daha önce engellediğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.");
  notifyScrapeIDs = () => this.notify("Yazar ID'leri toplanıyor (Bu işlem biraz sürebilir)...");
  notifyScrapeIDsProgress = (index, total) => this.notify(`Yazar ID'leri toplanıyor (${index}/${total})...`);
  notifyScrapeTitleAuthors = (timeSpecifier) => {
    const timeText = timeSpecifier === enums.TimeSpecifier.ALL ? "(tümü)" : "(son 24 saat)";
    this.notify(`Hedef başlıkta ${timeText} entry'si bulunan yazarlar toplanıyor.`);
  }

  #finish = (banSource, banMode, statusText, errorText, successfulAction, performedAction, plannedAction, operationMetadata = null) => {
    this.#sendMessage(enums.NotificationType.FINISH, statusText, errorText, [], {banSource, banMode, operationMetadata}, successfulAction, performedAction, plannedAction, 0);
  }

  finishErrorAccess = (banSource, banMode, operationMetadata = null) => this.#finish(banSource, banMode, "Ekşi Sözlük'e erişilemedi.", "Ekşi Sözlük'e erişilemedi.", 0, 0, 0, operationMetadata);
  finishErrorLogin = (banSource, banMode, operationMetadata = null) => this.#finish(banSource, banMode, "Ekşi Sözlük hesabınıza giriş yapmanız gerekiyor.", "Giriş yapılmadı", 0, 0, 0, operationMetadata);
  finishErrorNoAccount = (banSource, banMode, operationMetadata = null) => this.#finish(banSource, banMode, "Engellenecek yazar listesi boş.", "Yazar listesi boş", 0, 0, 0, operationMetadata);
  finishErrorEarlyStop = (banSource, banMode, operationMetadata = null) => this.#finish(banSource, banMode, "", "İptal edildi", 0, 0, 0, operationMetadata);
  finishSuccess = (banSource, banMode, successfulAction, performedAction, plannedAction, operationMetadata = null) => this.#finish(banSource, banMode, "İşlem tamamlandı.", "Tamamlandı", successfulAction, performedAction, plannedAction, operationMetadata);

  updatePlannedProcessesList = (plannedProcessesList) => this.#sendMessage(enums.NotificationType.UPDATE_PLANNED_PROCESSES, "", "", plannedProcessesList, null, 0, 0, 0, 0);
  notifyCooldown = (remainingTimeInSec) => this.#sendMessage(enums.NotificationType.COOLDOWN, `COOLDOWN: API limiti aşıldı. Dakikada 12 engel limiti bekleniyor. <a target='_blank' href='${config.EksiSozlukURL}/eksi-sozlukun-yazar-engellemeye-sinir-getirmesi--7547420' style='color:red;'>Bu ne demek?</a>`, "", [], null, 0, 0, 0, remainingTimeInSec);

  notifyOngoing = (successfulAction, performedAction, plannedAction, operationMetadata = null) => {
    let statusText = "İşlem devam ediyor.";
    if (operationMetadata) statusText = this.#generateDescriptionFromMetadata(operationMetadata);
    this.#sendMessage(enums.NotificationType.ONGOING, statusText, "", [], null, successfulAction, performedAction, plannedAction, 0);
  }

  #generateDescriptionFromMetadata = (metadata = {}) => generateUnifiedDescription(metadata.banSource, metadata);
  notifyStatus = (statusText) => this.#sendMessage(enums.NotificationType.NOTIFY, statusText, "", [], null, 0, 0, 0, 0);
  notifyUpdateCounts = () => this.#sendMessage(enums.NotificationType.UPDATE_COUNTS, "", "", [], null, 0, 0, 0, 0);

  updateButtonStatus = (message, isError = false, clearAfterMs = 3000) => {
    const buttonStatusDiv = document.getElementById("buttonStatus");
    if (!buttonStatusDiv) return;
    buttonStatusDiv.textContent = message;
    buttonStatusDiv.style.color = isError ? '#dc3545' : '#333';
    if (clearAfterMs > 0) setTimeout(() => buttonStatusDiv.textContent === message && (buttonStatusDiv.textContent = ''), clearAfterMs);
  }

  showStatusMessage = (message, type = "info") => {
    const statusMessage = document.getElementById("buttonStatus");
    if (!statusMessage) return;
    if (statusMessage.timeoutId) clearTimeout(statusMessage.timeoutId);
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    setTimeout(() => statusMessage.classList.add("show"), 100);
    statusMessage.timeoutId = setTimeout(() => statusMessage.classList.remove("show"), 3000);
  }

  updateStatusIndicator = (status) => {
    const statusDot = document.getElementById("statusDot");
    if (!statusDot) return;
    statusDot.className = "indicator-dot";
    switch (status) {
      case 'inactive': statusDot.classList.add('inactive'); break;
      case 'error': statusDot.classList.add('error'); break;
      case 'warning': statusDot.classList.add('warning'); break;
    }
  }

  updateTableCounts = () => {
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

  updateRemainingAction = () => {
    const performedAction = parseInt(document.getElementById("performedAction")?.textContent) || 0;
    const plannedAction = parseInt(document.getElementById("plannedAction")?.textContent) || 0;
    const remainingAction = Math.max(0, plannedAction - performedAction);
    const remainingActionElement = document.getElementById("remainingAction");
    if (remainingActionElement) remainingActionElement.textContent = remainingAction;
  }

  loadMutedUserCount = async () => {
    const mutedUserCount = await storageHandler.getMutedUserCount();
    const mutedUserCountSpan = document.getElementById("mutedUserCount");
    if (mutedUserCountSpan) mutedUserCountSpan.textContent = mutedUserCount;
  }

  loadBlockedUserCount = async () => {
    const blockedUserCount = await storageHandler.getBlockedUserCount();
    const blockedUserCountSpan = document.getElementById("blockedUserCount");
    if (blockedUserCountSpan) blockedUserCountSpan.textContent = blockedUserCount;
  }

  refreshBlockedUserCountDisplay = async () => {
    try {
      const blockedUserCount = await storageHandler.getBlockedUserCount();
      const partialData = await storageHandler.getPartialBlockedUsers();
      const hasTemporaryData = partialData && partialData.usernames && partialData.usernames.length > 0;
      const blockedUserCountSpan = document.getElementById("blockedUserCount");
      if (blockedUserCountSpan) blockedUserCountSpan.textContent = blockedUserCount;
      const exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
      if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = (blockedUserCount === 0 && !hasTemporaryData);
      console.log(`notificationHandler.js: Updated blocked user count display: ${blockedUserCount} (temporary: ${hasTemporaryData})`);
    } catch (error) {
      console.error("notificationHandler.js: Error refreshing blocked user count display:", error);
      const blockedUserCountSpan = document.getElementById("blockedUserCount");
      if (blockedUserCountSpan) blockedUserCountSpan.textContent = "0";
      const exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
      if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true;
    }
  }

  downloadCSV = (usernames, listType) => {
    if (!Array.isArray(usernames) || usernames.length === 0) {
      this.updateButtonStatus("No usernames to export.", true);
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
    this.updateButtonStatus(`${listType === 'blocked' ? 'Blocked' : 'Muted'} user list exported.`, false);
  }

  handleRefreshMutedList = async () => {
    console.log("notificationHandler.js", "Refresh muted list button clicked.");
    this.updateButtonStatus("Initiating muted list refresh...", false, 0);
    chrome.runtime.sendMessage({ action: "refreshMutedList" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("notificationHandler.js: Error sending refreshMutedList message:", chrome.runtime.lastError.message);
        this.updateButtonStatus("Error initiating refresh: " + chrome.runtime.lastError.message, true, 5000);
      }
    });
  }

  handleExportMutedList = async () => {
    console.log("notificationHandler.js", "Export muted list button clicked.");
    const exportButton = document.getElementById('exportMutedListCSV');
    if (exportButton) exportButton.disabled = true;
    this.updateButtonStatus("Preparing export...", false, 0);
    try {
      let usernames = await storageHandler.getMutedUserList();
      if (!usernames || usernames.length === 0) {
        const partialData = await storageHandler.getPartialMutedUsers();
        if (partialData && partialData.usernames) {
          usernames = partialData.usernames;
          this.updateButtonStatus("Exporting partial list from early stop...", false);
        }
      }
      if (usernames && usernames.length > 0) this.downloadCSV(usernames, 'muted');
      else this.updateButtonStatus("No muted user list found in storage to export.", true);
    } catch (error) {
      console.error("notificationHandler.js", "Error exporting muted list:", error);
      this.updateButtonStatus(`Error exporting: ${error.message || 'Unknown error'}`, true);
    } finally {
      const exportButton = document.getElementById('exportMutedListCSV');
      if (exportButton) exportButton.disabled = false;
    }
  }

  handleRefreshBlockedList = async () => {
    console.log("notificationHandler.js", "Refresh blocked list button clicked.");
    this.updateButtonStatus("Initiating blocked list refresh...", false, 0);
    chrome.runtime.sendMessage({ action: "refreshBlockedList" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("notificationHandler.js: Error sending refreshBlockedList message:", chrome.runtime.lastError.message);
        this.updateButtonStatus("Error initiating refresh: " + chrome.runtime.lastError.message, true, 5000);
        this.refreshBlockedUserCountDisplay();
      }
    });
  }

  handleExportBlockedList = async () => {
    console.log("notificationHandler.js", "Export blocked list button clicked.");
    const exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
    if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true;
    this.updateButtonStatus("Preparing export...", false, 0);
    try {
      let blockedUsernames = await storageHandler.getBlockedUserList();
      if (!blockedUsernames || blockedUsernames.length === 0) {
        const partialData = await storageHandler.getPartialBlockedUsers();
        if (partialData && partialData.usernames) {
          blockedUsernames = partialData.usernames;
          this.updateButtonStatus("Exporting partial list from early stop...", false);
        }
      }
      if (blockedUsernames && blockedUsernames.length > 0) this.downloadCSV(blockedUsernames, 'blocked');
      else this.updateButtonStatus("No blocked user list found in storage to export.", true);
    } catch (error) {
      console.error("notificationHandler.js", "Error exporting blocked list:", error);
      this.updateButtonStatus(`Error exporting: ${error.message || 'Unknown error'}`, true);
    } finally {
      const blockedUserCountSpan = document.getElementById("blockedUserCount");
      const currentCount = parseInt(blockedUserCountSpan?.textContent) || 0;
      if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = currentCount === 0;
    }
  }

  handleMigrationProgressUpdate = (message) => {
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
      if (migrationStatusText) migrationStatusText.innerHTML = "İşlem devam ediyor...";
      if (statusTextDiv) {
        const isTitleUnblocking = window.location.href.includes("startTitleMigration");
        statusTextDiv.innerHTML = isTitleUnblocking ? "Durum: Başlık engelleri kaldırılıyor..." : "Durum: Engellenen kullanıcılar sessize alınıyor...";
      }
    }
  }

  handleMigrationStatusUpdate = (message) => {
    console.debug(`Received migration status update: ${message.statusText}`);
    const migrationStatusText = document.getElementById("migrationStatusText");
    if (migrationStatusText) migrationStatusText.innerHTML = message.statusText;
  }

  handleMigrationBatchComplete = (message) => {
    console.log(`Migration batch complete: ${message.message}`);
    const migrationBar = document.getElementById("migrationBar");
    const migrationBarText = document.getElementById("migrationBarText");
    const migrationStatusText = document.getElementById("migrationStatusText");
    const migrationResultText = document.getElementById("migrationResultText");
    const statusTextDiv = document.getElementById("statusText");
    if (migrationBar && migrationBarText) {
      migrationBar.style.width = "0%";
      migrationBarText.innerHTML = "%0";
    }
    if (migrationStatusText) migrationStatusText.innerHTML = "Sonraki grup işleniyor...";
    if (statusTextDiv) {
      const isTitleUnblocking = window.location.href.includes("startTitleMigration");
      statusTextDiv.innerHTML = isTitleUnblocking ? "Durum: Sonraki başlık grubu işleniyor..." : "Durum: Sonraki grup işleniyor...";
    }
    if (migrationResultText) migrationResultText.innerHTML = `Grup tamamlandı: Başarılı: ${message.migrated}, Atlanan: ${message.skipped}, Başarısız: ${message.failed}, Toplam: ${message.total}`;
  }

  handleMigrationComplete = (message) => {
    console.log(`Migration complete: ${message.message}`);
    const migrationBar = document.getElementById("migrationBar");
    const migrationBarText = document.getElementById("migrationBarText");
    const migrationStatusText = document.getElementById("migrationStatusText");
    const migrationResultText = document.getElementById("migrationResultText");
    const statusTextDiv = document.getElementById("statusText");
    const earlyStopButton = document.getElementById("earlyStop");
    if (migrationBar && migrationBarText) {
      migrationBar.style.width = "100%";
      migrationBarText.innerHTML = "%100";
    }
    if (migrationStatusText) migrationStatusText.innerHTML = "İşlem tamamlandı!";
    if (statusTextDiv) {
      const isTitleUnblocking = window.location.href.includes("startTitleMigration");
      statusTextDiv.innerHTML = isTitleUnblocking ? "Durum: Başlık engelleri kaldırma işlemi tamamlandı!" : "Durum: İşlem tamamlandı!";
    }
    if (migrationResultText) migrationResultText.innerHTML = `Sonuç: Başarılı: ${message.migrated}, Atlanan: ${message.skipped}, Başarısız: ${message.failed}, Toplam: ${message.total}`;
    if (earlyStopButton) {
      earlyStopButton.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
      earlyStopButton.disabled = false;
    }
  }

  handleMigrationStopped = (message) => {
    console.log(`Migration stopped: ${message.message}`);
    const migrationStatusText = document.getElementById("migrationStatusText");
    const migrationResultText = document.getElementById("migrationResultText");
    const statusTextDiv = document.getElementById("statusText");
    const earlyStopButton = document.getElementById("earlyStop");
    if (migrationStatusText) migrationStatusText.innerHTML = "İşlem kullanıcı tarafından durduruldu!";
    if (statusTextDiv) {
      const isTitleUnblocking = window.location.href.includes("startTitleMigration");
      statusTextDiv.innerHTML = isTitleUnblocking ? "Durum: Başlık engelleri kaldırma işlemi kullanıcı tarafından durduruldu!" : "Durum: İşlem kullanıcı tarafından durduruldu!";
    }
    if (migrationResultText) {
      if (message.cooldown) migrationResultText.innerHTML = "İşlem cooldown sırasında durduruldu.";
      else if (message.processed !== undefined) migrationResultText.innerHTML = `İşlem durduruldu. İşlenen: ${message.processed} / ${message.total}`;
      else migrationResultText.innerHTML = "İşlem durduruldu.";
    }
    if (earlyStopButton) {
      earlyStopButton.innerHTML = '<span class="btn-icon">🛑</span><span class="btn-text">Erken Durdur</span>';
      earlyStopButton.disabled = false;
    }
    const remainingTimeElements = document.querySelectorAll("#remainingTimeInSec");
    remainingTimeElements.forEach(el => el.innerHTML = message.cooldown ? "Tamamlandı" : "Durduruldu");
  }

  sendMigrationMessage = (migrationStatus, statusText, errorText, current, total, migrated, skipped, failed, simulatedBlockedCount) => {
    const message = {
      status: enums.NotificationType.MIGRATION_UPDATE, migrationStatus, statusText, errorText,
      successfulAction: migrated, performedAction: current, plannedAction: total,
      skippedCount: skipped, failedCount: failed, simulatedBlockedCount: simulatedBlockedCount,
      plannedProcesses: [], completedProcess: null, remainingTimeInSec: 0
    };
    try {
      const sendMessagePromise = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(null, {"notification": message}, response => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(response));
        setTimeout(() => reject(new Error("Timeout sending migration message")), 1000);
      });
      sendMessagePromise.catch(err => log.warn("notification", `Error sending migration message: ${err} :: ${JSON.stringify(message)}`));
    } catch (err) {
      log.warn("notification", `Error sending migration message: ${err} :: ${JSON.stringify(message)}`);
    }
  }

  notifyMigrationStart = () => this.sendMigrationMessage('started', "Engellenenleri Sessize Alma işlemi başlatılıyor...", "", 0, 0, 0, 0, 0);
  notifyMigrationAlreadyRunning = () => {
    this.sendMigrationMessage('error', "Taşıma işlemi devam ediyor.", "Zaten devam ediyor", 0, 0, 0, 0, 0);
    alert("Engellenenleri Sessize Alma işlemi zaten devam ediyor.");
  }
  notifyMigrationBlockedByQueue = () => {
    this.sendMigrationMessage('error', "Başka bir işlem (örn. FAV engelleme) devam ediyor.", "Kuyruk meşgul", 0, 0, 0, 0, 0);
    alert("Başka bir işlem (örn. FAV engelleme) devam ederken taşıma işlemi başlatılamaz.");
  }
  notifyMigrationStatus = (statusText) => this.sendMigrationMessage('progress', statusText, "", null, null, null, null, null);
  notifyMigrationProgress = (statusText, current, total) => this.sendMigrationMessage('progress', statusText, "", current, total, null, null, null);
  notifyMigrationFinish = (finalMessage, migrated, skipped, failed, totalProcessed) => this.sendMigrationMessage('finished', finalMessage, "", totalProcessed, totalProcessed, migrated, skipped, failed);
  notifyMigrationError = (errorMessage) => this.sendMigrationMessage('error', "Taşıma sırasında bir hata oluştu.", errorMessage, null, null, null, null, null);
}

export const notificationHandler = new NotificationHandler();

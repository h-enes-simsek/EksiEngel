import {config} from './config.js';
import {log} from './log.js';
import * as enums from './enums.js';
import { storageHandler } from './storageHandler.js';

class NotificationHandler
{
  constructor(){}

  // send message to notification.html
  #sendMessage = async (status,
    statusText,
    errorText,
    plannedProcesses,
    completedProcess,
    successfulAction,
    performedAction,
    plannedAction,
    remainingTimeInSec) => {

    let message = {
      status,
      statusText,
      errorText,
      plannedProcesses,
      completedProcess,
      successfulAction,
      performedAction,
      plannedAction,
      remainingTimeInSec
    };
    
    try {
      // Check if the tab exists before sending the message
      if (chrome.extension && chrome.extension.getViews) {
        const views = chrome.extension.getViews({ type: "tab" });
        if (views.length === 0) {
          log.warn("notification", "No notification tab found to send message to");
          return; // Don't try to send if there's no tab
        }
      }
      
      // Send the message with a timeout to avoid hanging
      const sendMessagePromise = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(null, {"notification": message}, response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
        
        // Add a timeout in case the message never gets a response
        setTimeout(() => {
          reject(new Error("Timeout sending notification message"));
        }, 1000);
      });
      
      await sendMessagePromise;
    } catch (err) {
      // Only log warnings for non-cooldown messages to avoid console spam during cooldown countdown
      if (message.status !== enums.NotificationType.COOLDOWN) {
        log.warn("notification", "Error sending notification: " + err + " :: " + JSON.stringify(message));
      }
      // Don't throw - we want to continue even if notifications fail
    }
 
  }

  notify = (statusText) => {
    this.#sendMessage(enums.NotificationType.NOTIFY, statusText, "", [], null, 0, 0, 0, 0);
  }

  updateMutedUserCountDisplay = () => {
    log.info("notification", "updateMutedUserCountDisplay called (placeholder)");
    // TODO: Implement actual logic to update the muted user count display
  }
  notifyControlAccess = () => {
    this.notify("Ekşi Sözlük'e erişim kontrol ediliyor.");
  }
  notifyControlLogin = () => {
    this.notify("Ekşi Sözlük'e giriş yapıp yapmadığınız kontrol ediliyor.");
  }
  notifyScrapeFavs = () => {
    this.notify("Hedef entry'i favorileyen yazarlar toplanıyor.");
  }
  notifyScrapeFollowers = () => {
    this.notify("Hedef yazarın takipçileri toplanıyor.");
  }
  notifyScrapeFollowings = () => {
    this.notify("Takip ettiğiniz yazarlar toplanıyor.");
  }
  notifyScrapeBanned = () => {
    this.notify("Engellediğiniz yazarlar toplanıyor.");
  }
  notifyAnalysisProtectFollowedUsers = () => {
    this.notify("Takip ettiğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.");
  }
  notifyAnalysisOnlyRequiredActions = () => {
    this.notify("Daha önce engellediğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.");
  }
  notifyScrapeIDs = () => {
    this.notify("Yazar ID'leri toplanıyor (Bu işlem biraz sürebilir)...");
  }
  notifyScrapeIDsProgress = (index, total) => {
    this.notify(`Yazar ID'leri toplanıyor (${index}/${total})...`);
  }
  notifyScrapeTitleAuthors = (timeSpecifier) => {
    let timeText = timeSpecifier === enums.TimeSpecifier.ALL ? "(tümü)" : "(son 24 saat)";
    this.notify(`Hedef başlıkta ${timeText} entry'si bulunan yazarlar toplanıyor.`);
  }

  #finish = (banSource, banMode, statusText, errorText, successfulAction, performedAction, plannedAction, operationMetadata = null) => {
    this.#sendMessage(enums.NotificationType.FINISH,
    statusText,
    errorText,
    [],
    {banSource, banMode, operationMetadata}, successfulAction, performedAction, plannedAction, 0);
    // todo push the dequed item to stack and update the completed list in GUI
    // make private methods
  }
  finishErrorAccess = (banSource, banMode, operationMetadata = null) => {
    this.#finish(banSource, banMode,
      "Ekşi Sözlük'e erişilemedi.",
      "Ekşi Sözlük'e erişilemedi.",
      0, 0, 0, operationMetadata);
  }
  finishErrorLogin = (banSource, banMode, operationMetadata = null) => {
    this.#finish(banSource, banMode,
      "Ekşi Sözlük hesabınıza giriş yapmanız gerekiyor.",
      "Giriş yapılmadı",
      0, 0, 0, operationMetadata);
  }
  finishErrorNoAccount = (banSource, banMode, operationMetadata = null) => {
    this.#finish(banSource, banMode,
      "Engellenecek yazar listesi boş.",
      "Yazar listesi boş",
      0, 0, 0, operationMetadata);
  }
  finishErrorEarlyStop = (banSource, banMode, operationMetadata = null) => {
    this.#finish(banSource, banMode,
      "",
      "İptal edildi",
      0, 0, 0, operationMetadata);
  }
  finishSuccess = (banSource, banMode, successfulAction, performedAction, plannedAction, operationMetadata = null) => {
    this.#finish(banSource, banMode,
      "İşlem tamamlandı.",
      "Tamamlandı",
      successfulAction, performedAction, plannedAction, operationMetadata);
  }



  updatePlannedProcessesList = (plannedProcessesList) => {
    this.#sendMessage(enums.NotificationType.UPDATE_PLANNED_PROCESSES, "", "", plannedProcessesList, null, 0, 0, 0, 0);
  }
  notifyCooldown = (remainingTimeInSec) => {
    this.#sendMessage(enums.NotificationType.COOLDOWN,
      `COOLDOWN: API limiti aşıldı. Dakikada 12 engel limiti bekleniyor. <a target='_blank' href='${config.EksiSozlukURL}/eksi-sozlukun-yazar-engellemeye-sinir-getirmesi--7547420' style='color:red;'>Bu ne demek?</a>`,
      "", [], null, 0, 0, 0, remainingTimeInSec);
  }
  notifyOngoing = (successfulAction, performedAction, plannedAction, operationMetadata = null) => {
    let statusText = "İşlem devam ediyor.";
    
    // If we have operation metadata, use the same description logic as planned/completed processes
    if (operationMetadata) {
      if (operationMetadata.actionDescription) {
        statusText = operationMetadata.actionDescription;
      } else if (operationMetadata.operationNotes) {
        statusText = operationMetadata.operationNotes;
      } else {
        // Use the same description generation logic as notification.js
        statusText = this.#generateDescriptionFromMetadata(operationMetadata);
      }
    }
    
    this.#sendMessage(enums.NotificationType.ONGOING, statusText, "", [], null, successfulAction, performedAction, plannedAction, 0);
  }
  
  #generateDescriptionFromMetadata = (metadata = {}) => {
    const { targetTypes = [], sourceEntry, sourceAuthor, sourceTitle, sourceList, timeFilter } = metadata;
    
    let baseDescription = "";
    let operationType = "Engelle"; // Default for ongoing operations
    
    // We need to determine operation type from metadata or use default
    if (metadata.banSource) {
      operationType = metadata.banSource.includes('UN') ? "Engel Kaldır" : "Engelle";
    }
    
    switch (metadata.banSource) {
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
          const timeDesc = timeFilter === enums.TimeSpecifier.ALL ? "Tümü" : "Son 24 saat";
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

  // Public method to send a simple status notification
  notifyStatus = (statusText) => {
    this.#sendMessage(enums.NotificationType.NOTIFY, statusText, "", [], null, 0, 0, 0, 0);
  }

  // Public method to trigger updating user counts in the notification page
  notifyUpdateCounts = () => {
    this.#sendMessage(enums.NotificationType.UPDATE_COUNTS, "", "", [], null, 0, 0, 0, 0);
  }

  // --- UI and Status Management Functions ---
  updateButtonStatus = (message, isError = false, clearAfterMs = 3000) => {
    const buttonStatusDiv = document.getElementById("buttonStatus");
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

  showStatusMessage = (message, type = "info") => {
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

  updateStatusIndicator = (status) => {
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
    if (remainingActionElement) {
      remainingActionElement.textContent = remainingAction;
    }
  }

  // --- User Count Management Functions ---
  loadMutedUserCount = async () => {
    const mutedUserCount = await storageHandler.getMutedUserCount();
    const mutedUserCountSpan = document.getElementById("mutedUserCount");
    if (mutedUserCountSpan) {
      mutedUserCountSpan.textContent = mutedUserCount;
    }
  }

  loadBlockedUserCount = async () => {
    const blockedUserCount = await storageHandler.getBlockedUserCount();
    const blockedUserCountSpan = document.getElementById("blockedUserCount");
    if (blockedUserCountSpan) {
      blockedUserCountSpan.textContent = blockedUserCount;
    }
  }

  refreshBlockedUserCountDisplay = async () => {
    try {
      const blockedUserCount = await storageHandler.getBlockedUserCount();
      
      // Update the count display
      const blockedUserCountSpan = document.getElementById("blockedUserCount");
      if (blockedUserCountSpan) {
        blockedUserCountSpan.textContent = blockedUserCount;
      }
      
      // Update export button state based on count
      const exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
      if (exportBlockedListCSVButton) {
        exportBlockedListCSVButton.disabled = blockedUserCount === 0;
      }
      
      console.log(`notificationHandler.js: Updated blocked user count display: ${blockedUserCount}`);
    } catch (error) {
      console.error("notificationHandler.js: Error refreshing blocked user count display:", error);
      // Set to 0 on error and disable export
      const blockedUserCountSpan = document.getElementById("blockedUserCount");
      if (blockedUserCountSpan) {
        blockedUserCountSpan.textContent = "0";
      }
      const exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
      if (exportBlockedListCSVButton) {
        exportBlockedListCSVButton.disabled = true;
      }
    }
  }

  // --- CSV Export Functions ---
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

  // --- List Management Functions ---
  handleRefreshMutedList = async () => {
    console.log("notificationHandler.js", "Refresh muted list button clicked.");
    // Note: commHandler import would be needed for analytics, but keeping this simple for now

    const refreshButton = document.getElementById('refreshMutedList');
    const earlyStopButton = document.getElementById('earlyStop');
    if (refreshButton) refreshButton.disabled = true;

    this.updateButtonStatus("Initiating muted list refresh...", false, 0);

    chrome.runtime.sendMessage({ action: "refreshMutedList" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("notificationHandler.js: Error sending refreshMutedList message:", chrome.runtime.lastError.message);
        this.updateButtonStatus("Error initiating refresh: " + chrome.runtime.lastError.message, true, 5000);
        if (refreshButton) refreshButton.disabled = false;
        if (earlyStopButton) earlyStopButton.disabled = false;
      } else {
        console.log("notificationHandler.js: refreshMutedList message sent successfully.");
      }
    });
  }

  handleExportMutedList = async () => {
    console.log("notificationHandler.js", "Export muted list button clicked.");
    // Note: commHandler import would be needed for analytics, but keeping this simple for now

    const exportButton = document.getElementById('exportMutedListCSV');
    if (exportButton) exportButton.disabled = true;

    this.updateButtonStatus("Preparing export...", false, 0);

    try {
      const usernames = await storageHandler.getMutedUserList();
      if (usernames && usernames.length > 0) {
        this.downloadCSV(usernames, 'muted');
      } else {
        this.updateButtonStatus("No muted user list found in storage to export.", true);
      }
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

    // Disable the refresh button during operation
    const refreshBlockedListButton = document.getElementById('refreshBlockedList');
    if (refreshBlockedListButton) refreshBlockedListButton.disabled = true;
    
    // Disable export button during refresh
    const exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
    if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true;

    chrome.runtime.sendMessage({ action: "refreshBlockedList" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("notificationHandler.js: Error sending refreshBlockedList message:", chrome.runtime.lastError.message);
        this.updateButtonStatus("Error initiating refresh: " + chrome.runtime.lastError.message, true, 5000);
        
        // Re-enable refresh button on error
        if (refreshBlockedListButton) refreshBlockedListButton.disabled = false;
        
        // Re-enable export button based on current stored count
        this.refreshBlockedUserCountDisplay();
      } else {
        console.log("notificationHandler.js: refreshBlockedList message sent successfully.");
      }
    });
  }

  handleExportBlockedList = async () => {
    console.log("notificationHandler.js", "Export blocked list button clicked.");

    const exportBlockedListCSVButton = document.getElementById('exportBlockedListCSV');
    if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = true;
    this.updateButtonStatus("Preparing export...", false, 0);

    try {
      const blockedUsernames = await storageHandler.getBlockedUserList();
      if (blockedUsernames && blockedUsernames.length > 0) {
        this.downloadCSV(blockedUsernames, 'blocked');
      } else {
        this.updateButtonStatus("No blocked user list found in storage to export.", true);
      }
    } catch (error) {
      console.error("notificationHandler.js", "Error exporting blocked list:", error);
      this.updateButtonStatus(`Error exporting: ${error.message || 'Unknown error'}`, true);
    } finally {
      const blockedUserCountSpan = document.getElementById("blockedUserCount");
      const currentCount = parseInt(blockedUserCountSpan?.textContent) || 0;
      if (exportBlockedListCSVButton) exportBlockedListCSVButton.disabled = currentCount === 0;
    }
  }

  // --- Migration Progress Handlers ---
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
  }

  handleMigrationStatusUpdate = (message) => {
    console.debug(`Received migration status update: ${message.statusText}`);
    const migrationStatusText = document.getElementById("migrationStatusText");
    if (migrationStatusText) {
      migrationStatusText.innerHTML = message.statusText;
    }
  }

  handleMigrationBatchComplete = (message) => {
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
  }

  handleMigrationComplete = (message) => {
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
  }

  handleMigrationStopped = (message) => {
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
  }

  // --- Migration Specific Notifications ---
  sendMigrationMessage = (migrationStatus, statusText, errorText, current, total, migrated, skipped, failed, simulatedBlockedCount) => {
    // Reusing existing fields where possible, adding migration-specific ones
    let message = {
      status: enums.NotificationType.MIGRATION_UPDATE,
      migrationStatus: migrationStatus, // e.g., 'started', 'progress', 'finished', 'error'
      statusText: statusText,         // General status message
      errorText: errorText,           // Specific error message if status is 'error'
      successfulAction: migrated,     // Reusing for migrated count
      performedAction: current,       // Reusing for current item count
      plannedAction: total,           // Reusing for total items
      skippedCount: skipped,          // New field for skipped count
      failedCount: failed,            // New field for failed count
      simulatedBlockedCount: simulatedBlockedCount, // New field for simulated blocked titles count
      // Unused fields from original #sendMessage set to default/null
      plannedProcesses: [],
      completedProcess: null,
      remainingTimeInSec: 0
    };

    try {
      // Use the same async pattern as #sendMessage to avoid port closure issues
      const sendMessagePromise = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(null, {"notification": message}, response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
        
        // Add a timeout in case the message never gets a response
        setTimeout(() => {
          reject(new Error("Timeout sending migration message"));
        }, 1000);
      });
      
      sendMessagePromise.catch(err => {
        log.warn("notification", `Error sending migration message: ${err} :: ${JSON.stringify(message)}`);
      });
    } catch (err) {
      log.warn("notification", `Error sending migration message: ${err} :: ${JSON.stringify(message)}`);
    }
  }

  notifyMigrationStart = () => {
    this.sendMigrationMessage('started', "Engellenenleri Sessize Alma işlemi başlatılıyor...", "", 0, 0, 0, 0, 0);
  }

  notifyMigrationAlreadyRunning = () => {
    this.sendMigrationMessage('error', "Taşıma işlemi devam ediyor.", "Zaten devam ediyor", 0, 0, 0, 0, 0);
    // Also consider a simple alert or console log as backup if notification page isn't guaranteed
    alert("Engellenenleri Sessize Alma işlemi zaten devam ediyor.");
  }

  notifyMigrationBlockedByQueue = () => {
    this.sendMigrationMessage('error', "Başka bir işlem (örn. FAV engelleme) devam ediyor.", "Kuyruk meşgul", 0, 0, 0, 0, 0);
    alert("Başka bir işlem (örn. FAV engelleme) devam ederken taşıma işlemi başlatılamaz.");
  }

  notifyMigrationStatus = (statusText) => {
    // Sends a general status update without changing counts
    this.sendMigrationMessage('progress', statusText, "", null, null, null, null, null); // Use null for counts to indicate no change
  }

  notifyMigrationProgress = (statusText, current, total) => {
    this.sendMigrationMessage('progress', statusText, "", current, total, null, null, null); // Update progress counts
  }

  notifyMigrationFinish = (finalMessage, migrated, skipped, failed, totalProcessed) => {
    this.sendMigrationMessage('finished', finalMessage, "", totalProcessed, totalProcessed, migrated, skipped, failed);
  }

  notifyMigrationError = (errorMessage) => {
    this.sendMigrationMessage('error', "Taşıma sırasında bir hata oluştu.", errorMessage, null, null, null, null, null);
  }
  // --- End Migration Specific Notifications ---
}

export const notificationHandler = new NotificationHandler();

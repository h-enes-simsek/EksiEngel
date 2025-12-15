import {config} from './config.js';
import {log} from './log.js';
import * as enums from './enums.js';

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
  notifyOngoing = (successfulAction, performedAction, plannedAction) => {
    this.#sendMessage(enums.NotificationType.ONGOING, "İşlem devam ediyor.", "", [], null, successfulAction, performedAction, plannedAction, 0);
  }

  // Public method to send a simple status notification
  notifyStatus = (statusText) => {
    this.#sendMessage(enums.NotificationType.NOTIFY, statusText, "", [], null, 0, 0, 0, 0);
  }

  // Public method to trigger updating user counts in the notification page
  notifyUpdateCounts = () => {
    this.#sendMessage(enums.NotificationType.UPDATE_COUNTS, "", "", [], null, 0, 0, 0, 0);
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

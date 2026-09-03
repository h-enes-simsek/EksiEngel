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
      await chrome.runtime.sendMessage({
        type: enums.RuntimeMessageType.JOB_NOTIFICATION,
        payload: message
      });
    } catch (err) {
      log.warn("notification", err + " :: " +JSON.stringify(message));
    }
 
  }

  #notify = (statusText) => {
    this.#sendMessage(enums.NotificationType.NOTIFY, statusText, "", [], null, 0, 0, 0, 0);
  }
  notifyControlAccess = () => {
    this.#notify("Ekşi Sözlük'e erişim kontrol ediliyor.");
  }
  notifyControlLogin = () => {
    this.#notify("Ekşi Sözlük'e giriş yapıp yapmadığınız kontrol ediliyor.");
  }
  notifyScrapeFavs = () => {
    this.#notify("Hedef entry'i favorileyen yazarlar toplanıyor.");
  }
  notifyScrapeFollowers = () => {
    this.#notify("Hedef yazarın takipçileri toplanıyor.");
  }
  notifyScrapeFollowings = () => {
    this.#notify("Takip ettiğiniz yazarlar toplanıyor.");
  }
  notifyScrapeBanned = () => {
    this.#notify("Engellediğiniz yazarlar toplanıyor.");
  }
  notifyScrapeUndobanAll = () => {
    this.#notify("Engeli kaldırılacak yazarlar toplanıyor.");
  }
  notifyAnalysisProtectFollowedUsers = () => {
    this.#notify("Takip ettiğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.");
  }
  notifyAnalysisOnlyRequiredActions = () => {
    this.#notify("Daha önce engellediğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.");
  }
  notifyScrapeTitle = () => {
    this.#notify("Hedef başlıkta entry'si bulunan yazarlar toplanıyor.");
  }

  updatePlannedProcessesList = (plannedProcessesList) => {
    this.#sendMessage(enums.NotificationType.UPDATE_PLANNED_PROCESSES, "", "", plannedProcessesList, null, 0, 0, 0, 0);
  }
  notifyCooldown = (remainingTimeInSec, baseUrl) => {
    if(typeof baseUrl !== "string" || baseUrl.length === 0)
      throw new TypeError("baseUrl must be a non-empty string");

    this.#sendMessage(enums.NotificationType.COOLDOWN, 
      `İşlem devam ediyor. (dakikada 6 engel limiti bekleniyor) <a target='_blank' href='${baseUrl}/eksi-sozlukun-yazar-engellemeye-sinir-getirmesi--7547420' style='color:red;'>Bu ne demek?</a>`,
      "", [], null, 0, 0, 0, remainingTimeInSec);
  }
  notifyOngoing = (successfulAction, performedAction, plannedAction) => {
    this.#sendMessage(enums.NotificationType.ONGOING, "İşlem devam ediyor.", "", [], null, successfulAction, performedAction, plannedAction, 0);
  }
}

export const notificationHandler = new NotificationHandler();

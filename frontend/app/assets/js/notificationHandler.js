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
      await chrome.runtime.sendMessage(null, {"notification": message});
    } catch (err) {
      log.warn(err + " :: " +JSON.stringify(message));
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
  notifyAnalysisProtectFollowedUsers = () => {
    this.#notify("Takip ettiğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.");
  }
  notifyAnalysisOnlyRequiredActions = () => {
    this.#notify("Daha önce engellediğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.");
  }
  notifyScrapeTitle = () => {
    this.#notify("Hedef başlıkta entry'si bulunan yazarlar toplanıyor.");
  }

  #finish = (banSource, banMode, statusText, errorText, successfulAction, performedAction, plannedAction) => {
    this.#sendMessage(enums.NotificationType.FINISH, 
    statusText, 
    errorText, 
    [], 
    {banSource, banMode}, successfulAction, performedAction, plannedAction, 0);
    // todo push the dequed item to stack and update the completed list in GUI
    // make private methods
  }
  finishErrorAccess = (banSource, banMode) => {
    this.#finish(banSource, banMode,
      "Ekşi Sözlük'e erişilemedi.",
      "ekşi sözlük'e erişilemedi", 
      0, 0, 0);
  }
  finishErrorLogin = (banSource, banMode) => {
    this.#finish(banSource, banMode,
      "Ekşi Sözlük hesabınıza giriş yapmanız gerekiyor.",
      "giriş yapılmadı", 
      0, 0, 0);
  }
  finishErrorNoAccount = (banSource, banMode) => {
    this.#finish(banSource, banMode,
      "Engellenecek yazar listesi boş.",
      "yazar listesi boş", 
      0, 0, 0);
  }
  finishErrorEarlyStop = (banSource, banMode) => {
    this.#finish(banSource, banMode,
      "",
      "iptal edildi", 
      0, 0, 0);
  }
  finishSuccess = (banSource, banMode, successfulAction, performedAction, plannedAction) => {
    this.#finish(banSource, banMode,
      "İşlem tamamlandı.",
      "yok", 
      successfulAction, performedAction, plannedAction);
  }



  updatePlannedProcessesList = (plannedProcessesList) => {
    this.#sendMessage(enums.NotificationType.UPDATE_PLANNED_PROCESSES, "", "", plannedProcessesList, null, 0, 0, 0, 0);
  }
  notifyCooldown = (remainingTimeInSec) => {
    this.#sendMessage(enums.NotificationType.COOLDOWN, 
      `İşlem devam ediyor. (dakikada 6 engel limiti bekleniyor) <a target='_blank' href='${config.EksiSozlukURL}/eksi-sozlukun-yazar-engellemeye-sinir-getirmesi--7547420' style='color:red;'>Bu ne demek?</a>`, 
      "", [], null, 0, 0, 0, remainingTimeInSec);
  }
  notifyOngoing = (successfulAction, performedAction, plannedAction) => {
    this.#sendMessage(enums.NotificationType.ONGOING, "İşlem devam ediyor.", "", [], null, successfulAction, performedAction, plannedAction, 0);
  }
}

export const notificationHandler = new NotificationHandler();
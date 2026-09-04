import * as enums from './enums.js';

const PHASE_STATUS_TEXT = Object.freeze({
  [enums.JobPhase.QUEUED]: "İşlem sırada.",
  [enums.JobPhase.PREPARING]: "İşlem başlayacak.",
  [enums.JobPhase.CHECKING_ACCESS]: "Ekşi Sözlük'e erişim kontrol ediliyor.",
  [enums.JobPhase.CHECKING_LOGIN]: "Ekşi Sözlük'e giriş yapıp yapmadığınız kontrol ediliyor.",
  [enums.JobPhase.COLLECTING_AUTHORS]: "Yazar listesi hazırlanıyor.",
  [enums.JobPhase.COLLECTING_FAVORITERS]: "Hedef entry'i favorileyen yazarlar toplanıyor.",
  [enums.JobPhase.COLLECTING_FOLLOWERS]: "Hedef yazarın takipçileri toplanıyor.",
  [enums.JobPhase.COLLECTING_EXISTING_RELATIONS]: "Mevcut yazar ilişkileriniz toplanıyor.",
  [enums.JobPhase.COLLECTING_TITLE_AUTHORS]: "Hedef başlıkta entry'si bulunan yazarlar toplanıyor.",
  [enums.JobPhase.ANALYSING_PROTECTED_USERS]: "Takip ettiğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.",
  [enums.JobPhase.ANALYSING_REQUIRED_ACTIONS]: "Daha önce engellediğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.",
  [enums.JobPhase.EXECUTING_RELATIONS]: "İşlem devam ediyor.",
  [enums.JobPhase.COOLDOWN]: "İşlem devam ediyor. (dakikada 6 engel limiti bekleniyor)",
  [enums.JobPhase.CANCELLING]: "İşlem iptal ediliyor."
});

const EMPTY_PROGRESS = Object.freeze({
  successfulAction: 0,
  performedAction: 0,
  plannedAction: 0
});

const BAN_SOURCE_TEXT = Object.freeze({
  [enums.BanSource.SINGLE]: "Tekil işlem",
  [enums.BanSource.FAV]: "Favorileyenler",
  [enums.BanSource.FOLLOW]: "Takipçiler",
  [enums.BanSource.LIST]: "Yazar listesi",
  [enums.BanSource.UNDOBANALL]: "Tüm engellenenler",
  [enums.BanSource.TITLE]: "Başlıktaki yazarlar"
});

const BAN_MODE_TEXT = Object.freeze({
  [enums.BanMode.BAN]: "Engelle",
  [enums.BanMode.UNDOBAN]: "Engeli kaldır"
});

const TERMINAL_PRESENTATION = Object.freeze({
  [enums.ProcessFinishReason.NOT_SET]: {
    statusText: "İşlem sonucu belirlenemedi.",
    errorText: "işlem sonucu belirlenemedi"
  },
  [enums.ProcessFinishReason.SUCCESS]: {
    statusText: "İşlem tamamlandı.",
    errorText: "yok"
  },
  [enums.ProcessFinishReason.CANCELLED]: {
    statusText: "İşlem iptal edildi.",
    errorText: "iptal edildi"
  },
  [enums.ProcessFinishReason.UNEXPECTED_ERROR]: {
    statusText: "Beklenmeyen bir hata oluştu.",
    errorText: "beklenmeyen hata"
  },
  [enums.ProcessFinishReason.NOTIFICATION_TAB_CREATION]: {
    statusText: "Bildirim sayfası açılamadı.",
    errorText: "bildirim sayfası açılamadı"
  },
  [enums.ProcessFinishReason.CONFIGURATION_LOADING]: {
    statusText: "Ayarlar yüklenemedi.",
    errorText: "ayarlar yüklenemedi"
  },
  [enums.ProcessFinishReason.EKSI_SOZLUK_UNREACHABLE]: {
    statusText: "Ekşi Sözlük'e erişilemedi.",
    errorText: "ekşi sözlük'e erişilemedi"
  },
  [enums.ProcessFinishReason.CLIENT_NOT_LOGGED_IN]: {
    statusText: "Ekşi Sözlük hesabınıza giriş yapmanız gerekiyor.",
    errorText: "giriş yapılmadı"
  },
  [enums.ProcessFinishReason.USER_LIST_LOADING]: {
    statusText: "Yazar listesi yüklenemedi.",
    errorText: "yazar listesi yüklenemedi"
  },
  [enums.ProcessFinishReason.USER_LIST_CLEANING]: {
    statusText: "Yazar listesi temizlenemedi.",
    errorText: "yazar listesi temizlenemedi"
  },
  [enums.ProcessFinishReason.NO_ACCOUNTS_FOUND]: {
    statusText: "Engellenecek yazar listesi boş.",
    errorText: "yazar listesi boş"
  },
  [enums.ProcessFinishReason.NO_ACCOUNTS_AFTER_FILTERING]: {
    statusText: "Engellenecek yazar listesi boş.",
    errorText: "yazar listesi boş"
  }
});

let currentJobSnapshot = null;
let notificationDomReady = false;

function isJobSnapshot(snapshot)
{
  return Boolean(snapshot) && typeof snapshot === "object" &&
    Number.isInteger(snapshot.revision) && snapshot.revision >= 0;
}

function formatTime(timestamp)
{
  const date = new Date(timestamp);
  if(Number.isNaN(date.getTime()))
    return "";

  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(value => String(value).padStart(2, "0"))
    .join(":");
}

function terminalPresentation(result)
{
  const presentation = TERMINAL_PRESENTATION[result.finishReason] ??
    TERMINAL_PRESENTATION[enums.ProcessFinishReason.NOT_SET];

  if(result.finishReason !== enums.ProcessFinishReason.UNEXPECTED_ERROR ||
     !result.errorMessage)
    return presentation;

  return {
    statusText: presentation.statusText,
    errorText: `${presentation.errorText}: ${result.errorMessage}`
  };
}

function statusTextFor(snapshot)
{
  const {activeJob, completedJobs} = snapshot;
  if(activeJob === null)
  {
    const latestCompletedJob = completedJobs[0];
    return latestCompletedJob
      ? terminalPresentation(latestCompletedJob.result).statusText
      : "Aktif işlem yok.";
  }

  if(activeJob.phase === enums.JobPhase.COLLECTING_EXISTING_RELATIONS &&
     activeJob.job.banSource === enums.BanSource.UNDOBANALL)
    return "Engeli kaldırılacak yazarlar toplanıyor.";

  return PHASE_STATUS_TEXT[activeJob.phase] ?? "İşlem devam ediyor.";
}

function progressPercentage({performedAction, plannedAction})
{
  if(plannedAction === 0)
    return 0;

  return Math.min(100, Math.floor((100 * performedAction) / plannedAction));
}

function cooldownText(activeJob)
{
  if(activeJob?.cooldownEndsAt === null || !activeJob?.cooldownEndsAt)
    return "-";

  const remainingSeconds = Math.max(
    0,
    Math.ceil((Date.parse(activeJob.cooldownEndsAt) - Date.now()) / 1000)
  );
  return `${remainingSeconds} saniye`;
}

function banSourceText(banSource)
{
  return BAN_SOURCE_TEXT[banSource] ?? banSource;
}

function banModeText(banMode)
{
  return BAN_MODE_TEXT[banMode] ?? banMode;
}

function resetTable(tableId)
{
  const tableBody = document.getElementById(tableId).tBodies[0];
  while(tableBody.rows.length > 0)
    tableBody.deleteRow(0);

  return tableBody;
}

function addTableRow(tableBody, values)
{
  const row = tableBody.insertRow();
  for(const value of values)
    row.insertCell().innerHTML = value;
}

function renderWaitingJobs(waitingJobs)
{
  const tableBody = resetTable("plannedProcesses");
  for(const job of waitingJobs)
  {
    addTableRow(tableBody, [
      formatTime(job.createdAt),
      banSourceText(job.banSource),
      banModeText(job.banMode)
    ]);
  }
}

function renderCompletedJobs(completedJobs)
{
  const tableBody = resetTable("completedProcesses");
  for(const {job, result} of completedJobs)
  {
    addTableRow(tableBody, [
      formatTime(result.completedAt),
      banSourceText(job.banSource),
      banModeText(job.banMode),
      result.successfulAction,
      result.performedAction,
      result.plannedAction,
      terminalPresentation(result).errorText
    ]);
  }
}

function renderJobState(snapshot)
{
  const activeJob = snapshot.activeJob;
  const progress = activeJob?.progress ?? EMPTY_PROGRESS;
  const percentage = progressPercentage(progress);

  document.getElementById("statusText").innerHTML = statusTextFor(snapshot);
  document.getElementById("remainingTimeInSec").innerHTML = cooldownText(activeJob);
  document.getElementById("successfulAction").innerHTML = progress.successfulAction;
  document.getElementById("performedAction").innerHTML = progress.performedAction;
  document.getElementById("plannedAction").innerHTML = progress.plannedAction;
  document.getElementById("barText").innerHTML = `%${percentage}`;
  document.getElementById("bar").style.width = `${percentage}%`;
  document.getElementById("earlyStop").disabled =
    activeJob === null || activeJob.cancelRequested;

  renderWaitingJobs(snapshot.waitingJobs);
  renderCompletedJobs(snapshot.completedJobs);
}

function acceptJobSnapshot(snapshot)
{
  if(!isJobSnapshot(snapshot))
    return false;

  if(currentJobSnapshot !== null &&
     snapshot.revision <= currentJobSnapshot.revision)
    return false;

  currentJobSnapshot = snapshot;
  if(notificationDomReady)
    renderJobState(currentJobSnapshot);

  return true;
}

async function hydrateJobSnapshot()
{
  try
  {
    const response = await chrome.runtime.sendMessage({
      type: enums.RuntimeMessageType.GET_JOB_SNAPSHOT,
      payload: null
    });

    if(!response?.ok || !isJobSnapshot(response.snapshot))
      throw new Error("The current job snapshot could not be loaded");

    acceptJobSnapshot(response.snapshot);
  }
  catch(error)
  {
    console.error("Current job snapshot could not be loaded", error);
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  notificationDomReady = true;
  const earlyStopButton = document.getElementById("earlyStop");
  earlyStopButton.disabled = true;
  earlyStopButton.addEventListener("click", function() {
    void chrome.runtime.sendMessage({
      type: enums.RuntimeMessageType.CANCEL_ALL_JOBS,
      payload: null
    }).catch(error => console.error("Cancellation request could not be sent", error));
  });

  if(currentJobSnapshot !== null)
    renderJobState(currentJobSnapshot);

  await hydrateJobSnapshot();
});

chrome.runtime.onMessage.addListener(function messageListener_Background(message, sender, sendResponse) {
  if(message?.type !== enums.RuntimeMessageType.JOB_SNAPSHOT)
    return false;

  sendResponse({
    ok: true,
    accepted: acceptJobSnapshot(message.payload)
  });
  return false;
});

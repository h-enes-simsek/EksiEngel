'use strict';

import * as enums from './enums.js';
import {handleConfig} from './config.js';
import {log} from './log.js';
import {commHandler} from './commHandler.js';
import {RelationHandler} from './relationHandler.js';
import {EksiScrapingHandler} from './scrapingHandler.js';
import {isEksiSozlukAccessible} from './urlHandler.js';
import {createJobResult} from './jobs/job.js';
import {waitForCooldown} from './jobs/cooldown.js';
import {createJobRequest} from './jobs/jobRequest.js';
import {JobManager} from './jobs/jobManager.js';
import {runJob} from './jobs/jobRunner.js';
import {JobTelemetryReporter} from './jobs/jobTelemetry.js';
import {FakeScrapingHandler} from './testing/fakeScrapingHandler.js';
import {FakeRelationHandler} from './testing/fakeRelationHandler.js';

// Development-only switch. Keep disabled in production builds.
const DEV_USE_FAKE_HANDLERS = false;
const USER_CANCELLATION_REASON = 'Cancellation requested by the user.';
const NOTIFICATION_TAB_CLOSED_REASON = 'The notification tab was closed.';

log.info("bg", "initialized");
let g_notificationTabId = null;

const handleJobTelemetryError = error => console.error("job telemetry failed: " + error);
const jobTelemetryReporter = new JobTelemetryReporter({
  isEnabled: () => !DEV_USE_FAKE_HANDLERS,
  send: (telemetry, {serverUrl}) => commHandler.sendData(
    telemetry.action,
    telemetry.actionConfig,
    serverUrl
  ),
  onError: handleJobTelemetryError
});

function publishJobSnapshot(snapshot)
{
  return chrome.runtime.sendMessage({
    type: enums.RuntimeMessageType.JOB_SNAPSHOT,
    payload: snapshot
  }).catch(() => undefined);
}

async function ensureNotificationTab()
{
  if(g_notificationTabId !== null)
  {
    try
    {
      await chrome.tabs.get(g_notificationTabId);
    }
    catch
    {
      g_notificationTabId = null;
    }
  }

  if(g_notificationTabId !== null)
    return true;

  try
  {
    const tab = await chrome.tabs.create({
      active: false,
      url: chrome.runtime.getURL("assets/html/notification.html")
    });
    g_notificationTabId = tab.id;
    return true;
  }
  catch(error)
  {
    log.err("bg", "Failed to create notification tab: " + error);
    return false;
  }
}

async function executeJob(job, {signal, reporter})
{
  if(!await ensureNotificationTab())
  {
    log.resetData();
    return createJobResult(job, {
      finishReason: enums.ProcessFinishReason.NOTIFICATION_TAB_CREATION
    });
  }

  return runJob(job, {
    signal,
    settings: job.settings,
    reporter,
    scrapingHandler: DEV_USE_FAKE_HANDLERS
      ? new FakeScrapingHandler()
      : new EksiScrapingHandler({baseUrl: job.settings.EksiSozlukURL}),
    relationHandler: DEV_USE_FAKE_HANDLERS
      ? new FakeRelationHandler()
      : new RelationHandler(),
    telemetryReporter: jobTelemetryReporter,
    accessChecker: isEksiSozlukAccessible,
    cooldownWaiter: waitForCooldown,
    userAgent: navigator.userAgent,
    extensionVersion: chrome.runtime.getManifest().version,
    onTelemetryError: handleJobTelemetryError
  });
}

const jobManager = new JobManager({
  publishSnapshot: publishJobSnapshot,
  executeJob,
  loadSettings: handleConfig
});

function cancelAllJobs(reason)
{
  const waitingJobCount = jobManager.waitingCount;
  const cancellationRequested = jobManager.cancelAll(reason);
  if(!cancellationRequested)
  {
    log.info("bg", "Cancellation requested, but there are no active or waiting jobs.");
    return false;
  }

  log.info("bg", "Cancellation requested, number of cancelled waiting jobs: " + waitingJobCount);
  return true;
}

if(DEV_USE_FAKE_HANDLERS)
  log.warn("bg", "development fake scraping and relation handlers are enabled");

chrome.runtime.onMessage.addListener(function messageListener(message, sender, sendResponse) {
  if(message?.type === enums.RuntimeMessageType.GET_JOB_SNAPSHOT)
  {
    sendResponse({ok: true, snapshot: jobManager.getSnapshot()});
    return false;
  }

  if(message?.type === enums.RuntimeMessageType.CANCEL_ALL_JOBS)
  {
    cancelAllJobs(USER_CANCELLATION_REASON);
    sendResponse({ok: true});
    return false;
  }

  if(message?.type !== enums.RuntimeMessageType.ENQUEUE_JOB)
    return false;

  let request;
  try
  {
    request = createJobRequest(message.payload);
  }
  catch
  {
    sendResponse({ok: false, errorCode: "INVALID_JOB_REQUEST"});
    return false;
  }

  void (async () => {
    try
    {
      const acceptedJob = await jobManager.enqueueRequest(request);
      if(!acceptedJob)
      {
        sendResponse({ok: false, errorCode: "CANCELLED"});
        return;
      }

      const {job} = acceptedJob;
      log.info("bg", "a new process added to the queue, banSource: " + request.banSource + ", banMode: " + request.banMode);
      sendResponse({ok: true, jobId: job.id});
      log.info("bg", "number of waiting processes in the queue: " + jobManager.waitingCount);
    }
    catch(error)
    {
      log.err("bg", "Configuration could not be loaded before accepting the job: " + error);
      sendResponse({ok: false, errorCode: "CONFIGURATION_LOADING_FAILED"});
    }
  })();

  // JobManager owns the pending request until configuration is loaded.
  return true;
});

chrome.tabs.onRemoved.addListener(function notificationTabRemoved(tabId) {
  if(tabId !== g_notificationTabId)
    return;

  g_notificationTabId = null;
  log.info("bg", "The notification tab was closed; all jobs will be cancelled.");
  cancelAllJobs(NOTIFICATION_TAB_CLOSED_REASON);
});

// this listener fired every time when the extension installed or updated.
chrome.runtime.onInstalled.addListener(async (details) =>
{
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL ||
      details.reason === chrome.runtime.OnInstalledReason.UPDATE)
  {
    // first install or extension is updated
    log.info("bg", "program installed or updated.");

    // erase local storage, because config file could have been changed in the new version.
    await chrome.storage.local.clear();

    // handle config of the extension
    await handleConfig();

    // open welcome page
    await chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/welcome.html") });
  }
});

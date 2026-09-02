'use strict';

import * as enums from './enums.js';
import * as utils from './utils.js';
import {handleConfig} from './config.js';
import {log} from './log.js';
import {createEksiSozlukUser, commHandler} from './commHandler.js';
import {RelationHandler, RelationActionStatus} from './relationHandler.js';
import {EksiScrapingHandler} from './scrapingHandler.js';
import {processQueue} from './queue.js';
import {programController} from './programController.js';
import {isEksiSozlukAccessible} from './urlHandler.js';
import { notificationHandler } from './notificationHandler.js';
import {createJobResult} from './jobs/job.js';
import {waitForCooldown} from './jobs/cooldown.js';
import {createJobRequest} from './jobs/jobRequest.js';
import {JobManager} from './jobs/jobManager.js';
import {createJobTelemetry, JobTelemetryReporter} from './jobs/jobTelemetry.js';
import {FakeScrapingHandler} from './testing/fakeScrapingHandler.js';
import {FakeRelationHandler} from './testing/fakeRelationHandler.js';

// Development-only switch. Keep disabled in production builds.
const DEV_USE_FAKE_HANDLERS = false;

log.info("bg", "initialized");
let g_notificationTabId = 0;

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

function entryIdFromUrl(entryUrl, baseUrl)
{
  const pathname = new URL(entryUrl, baseUrl).pathname;
  const match = pathname.match(/^\/entry\/(\d+)\/?$/);

  if(!match)
    throw new TypeError('entryUrl must identify a numeric Ekşi Sözlük entry');

  return match[1];
}

const jobManager = new JobManager({
  queue: processQueue,
  executeJob: (job, {signal}) => processHandler(job, {
    signal,
    scrapingHandler: DEV_USE_FAKE_HANDLERS
      ? new FakeScrapingHandler()
      : new EksiScrapingHandler({baseUrl: job.settings.EksiSozlukURL}),
    relationHandler: DEV_USE_FAKE_HANDLERS
      ? new FakeRelationHandler()
      : new RelationHandler(),
    telemetryReporter: jobTelemetryReporter
  })
});
programController.setCancelActiveJobHandler(() => jobManager.cancelActive());

if(DEV_USE_FAKE_HANDLERS)
  log.warn("bg", "development fake scraping and relation handlers are enabled");

chrome.runtime.onMessage.addListener(function messageListener(message, sender, sendResponse) {
  if(message?.type === enums.RuntimeMessageType.CANCEL_ALL_JOBS)
  {
    programController.earlyStop = true;
    sendResponse({ok: true});
    return false;
  }

  if(message?.type !== enums.RuntimeMessageType.ENQUEUE_JOB)
    return false;

  const obj = utils.filterMessage(message.payload, "banSource", "banMode");
  if(obj.resultType === enums.ResultType.FAIL)
  {
    sendResponse({ok: false, errorCode: "INVALID_JOB_REQUEST"});
    return false;
  }

  void (async () => {
    let settings;
    try
    {
      settings = await handleConfig();
    }
    catch(error)
    {
      log.err("bg", "Configuration could not be loaded before accepting the job: " + error);
      sendResponse({ok: false, errorCode: "CONFIGURATION_LOADING_FAILED"});
      return;
    }

    const request = createJobRequest(obj);
    log.info("bg", "a new process added to the queue, banSource: " + request.banSource + ", banMode: " + request.banMode);
    const {job} = jobManager.enqueue(request, settings);
    sendResponse({ok: true, jobId: job.id});
    log.info("bg", "number of waiting processes in the queue: " + jobManager.waitingCount);

    // update notification page. otherwise, the user cannot see the planned processes immediately after new request.
    notificationHandler.updatePlannedProcessesList(jobManager.waitingJobAttributes);
  })();

  // Configuration is loaded asynchronously before the response and enqueue.
  return true;
});

async function processHandler(job, {signal, scrapingHandler, relationHandler, telemetryReporter})
{
  const {request, settings} = job;
  const {
    banSource,
    banMode,
    entryUrl,
    authorName: singleAuthorName,
    authorId: singleAuthorId,
    targetType,
    clickSource,
    titleName,
    titleId,
    timeSpecifier,
    authorListText
  } = request;

  const performRelationAction = (...args) => relationHandler.performAction(
    ...args,
    {signal, baseUrl: settings.EksiSozlukURL}
  );
  const waitForRelationCooldown = () => waitForCooldown({
    signal,
    onTick: remainingSeconds => notificationHandler.notifyCooldown(
      remainingSeconds,
      settings.EksiSozlukURL
    )
  });

  let processFinishReason = enums.ProcessFinishReason.NOT_SET;
  let authorList = [];
  let plannedAction = 0;
  let successfulAction = 0;
  let performedAction = 0;
  let entryMetaData = {};
  let userAgent = null;
  let clientName = null;
  let clientId = null;
  let errorMessage = null;

  function recordRelationResult(result)
  {
    if(result.actionPerformed)
      performedAction++;

    if(result.actionSucceeded)
      successfulAction++;
  }

  const run = async () =>
  {
    log.info("bg", "Process has been started with " + 
            "banSource: "          + banSource + 
            ", banMode: "          + banMode + 
            ", entryUrl: "         + entryUrl + 
            ", singleAuthorName: " + singleAuthorName + 
            ", singleAuthorId: "   + singleAuthorId +
            ", targetType: "       + targetType +
            ", clickSource: "      + clickSource +
            ", titleName: "        + titleName +
            ", titleId: "          + titleId
            );

    // create a notification page if not exist
    try
    {
      let tab2 = await chrome.tabs.get(g_notificationTabId);
    }
    catch(e)
    {
      // not exist, so create one
      try
      {
        let tab = await chrome.tabs.create({ active: false, url: chrome.runtime.getURL("assets/html/notification.html") });
        g_notificationTabId = tab.id;
      }
      catch(createError)
      {
        log.err("bg", "Failed to create notification tab: " + createError);
        processFinishReason = enums.ProcessFinishReason.NOTIFICATION_TAB_CREATION;
        return;
      }
    }
    programController.tabId = g_notificationTabId;
    notificationHandler.updatePlannedProcessesList(jobManager.waitingJobAttributes);

    notificationHandler.notifyControlAccess();
    const urlAccessible = await isEksiSozlukAccessible({
      signal,
      baseUrl: settings.EksiSozlukURL
    });
    if(!urlAccessible)
    {
      log.err("bg", "Program has been finished (finishErrorAccess)");
      notificationHandler.finishErrorAccess(banSource, banMode);
      processFinishReason = enums.ProcessFinishReason.EKSI_SOZLUK_UNREACHABLE;
      return;
    }

    notificationHandler.notifyControlLogin();
    userAgent = navigator.userAgent;
    const currentAccount = await scrapingHandler.getCurrentAccount({signal});
    clientName = currentAccount?.authorName ?? null;
    clientId = currentAccount?.authorId ?? null;
    if(!clientName || !clientId)
    {
      log.err("bg", "Program has been finished (finishErrorLogin)");
      notificationHandler.finishErrorLogin(banSource, banMode);
      processFinishReason = enums.ProcessFinishReason.CLIENT_NOT_LOGGED_IN;
      return;
    }
    
    if(banSource === enums.BanSource.SINGLE)
    {
      let author = createEksiSozlukUser(singleAuthorName, singleAuthorId);
      if(author)
        authorList.push(author);

      plannedAction = 1;
      notificationHandler.notifyOngoing(0, 0, plannedAction);
      
      let res = await performRelationAction(banMode, singleAuthorId, targetType == enums.TargetType.USER, targetType == enums.TargetType.TITLE, targetType == enums.TargetType.MUTE);
      
      if(res.status == RelationActionStatus.RETRY_REQUIRED)
      {
        // performAction was rate limited
        await waitForRelationCooldown();
        res = await performRelationAction(banMode, singleAuthorId, targetType == enums.TargetType.USER, targetType == enums.TargetType.TITLE, targetType == enums.TargetType.MUTE);
      }
      
      recordRelationResult(res);
      notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
    }
    else if(banSource === enums.BanSource.LIST)
    {
      let authorNames;
      try
      {
        if(typeof authorListText !== "string")
          throw new TypeError("LIST job is missing its author list snapshot");

        authorNames = authorListText.split("\n");
      }
      catch(e)
      {
        processFinishReason = enums.ProcessFinishReason.USER_LIST_LOADING;
        notificationHandler.finishErrorUserListLoading(banSource, banMode);
        return;
      }
      try
      {
        utils.cleanUserList(authorNames);
      }
      catch(e)
      {
        processFinishReason = enums.ProcessFinishReason.USER_LIST_CLEANING;
        notificationHandler.finishErrorUserListCleaning(banSource, banMode);
        return;
      }
      
      plannedAction = authorNames.length;

      // stop if there is no user
      log.info("bg", "number of user to ban " + plannedAction);
      if(plannedAction === 0)
      {
        notificationHandler.finishErrorNoAccount(banSource, banMode);
        log.err("bg", "Program has been finished (finishErrorNoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }

      notificationHandler.notifyOngoing(0, 0, plannedAction);
      
      for (const authorName of authorNames)
      {
        const scrapedAuthor = await scrapingHandler.getAuthor(authorName, {signal});
        let author = createEksiSozlukUser(authorName, scrapedAuthor?.authorId);
        if(author)
          authorList.push(author);
        
        let res;
        if(banMode == enums.BanMode.BAN)
          res = await performRelationAction(banMode, author.eksisozluk_id, !settings.enableMute, settings.enableTitleBan, settings.enableMute);
        else
          res = await performRelationAction(banMode, author.eksisozluk_id, true, true, true);
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited
          await waitForRelationCooldown();
          if(banMode == enums.BanMode.BAN)
            res = await performRelationAction(banMode, author.eksisozluk_id, !settings.enableMute, settings.enableTitleBan, settings.enableMute);
          else
            res = await performRelationAction(banMode, author.eksisozluk_id, true, true, true);
        }

        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }
      
    }
    else if(banSource === enums.BanSource.FAV)
    {
      notificationHandler.notifyScrapeFavs();

      const entryId = entryIdFromUrl(entryUrl, settings.EksiSozlukURL);
      entryMetaData = await scrapingHandler.getEntryMetadata(entryId, {signal});
      if(!entryMetaData)
        log.warn("bg", `Entry ${entryId} metadata could not be retrieved.`);

      let scrapedRelations = await scrapingHandler.listEntryFavoriters(entryId, {
        includeNovices: settings.enableNoobBan,
        signal
      });
      
      log.info("bg", "number of user to ban (before analysis): " + scrapedRelations.size);
      
      // stop if there is no user
      if(scrapedRelations.size === 0)
      {
        notificationHandler.finishErrorNoAccount(banSource, banMode);
        log.err("bg", "Program has been finished (finishErrorNoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }
      
      // analysis before operation 
      if(settings.enableAnalysisBeforeOperation && settings.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        notificationHandler.notifyScrapeFollowings();
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal});
        
        // remove the authors that ${clientName} follows from the list to protect    
        notificationHandler.notifyAnalysisProtectFollowedUsers();  
        for (let name of scrapedRelations.keys()) {
          if (mapFollowing.has(name))
            scrapedRelations.delete(name);
        }
      }
      if(settings.enableAnalysisBeforeOperation && settings.enableOnlyRequiredActions)
      {
        // Note: Ekşi Sözlük API response doesn't include blocked authors, but it includes authors who muted and title blocked
        // This condition doesn't provide a simplification of the following algorithm
        
        // scrape the authors that ${clientName} blocked
        notificationHandler.notifyScrapeBanned();
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal});
        
        // update the list with info obtained from mapBlocked
        notificationHandler.notifyAnalysisOnlyRequiredActions();
        for (let name of scrapedRelations.keys()) {
          if (mapBlocked.has(name))
          {
            scrapedRelations.get(name).isBlockedUser = mapBlocked.get(name).isBlockedUser;
            scrapedRelations.get(name).areTitlesBlocked = mapBlocked.get(name).areTitlesBlocked;
            scrapedRelations.get(name).isMuted = mapBlocked.get(name).isMuted;
          }
        }
      }
      
      log.info("bg", "number of user to ban (after analysis): " + scrapedRelations.size);
      
      // stop if there is no user
      if(scrapedRelations.size === 0)
      {
        notificationHandler.finishErrorNoAccount(banSource, banMode);
        log.err("bg", "Program has been finished (finishErrorNoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_AFTER_FILTERING;
        return;
      }
      
      plannedAction = scrapedRelations.size;
      notificationHandler.notifyOngoing(0, 0, plannedAction);
      
      for (const [name, value] of scrapedRelations)
      {
        let authorId = (await scrapingHandler.getAuthor(name, {signal}))?.authorId;
        if(!authorId)
          continue;
        let res = await performRelationAction(banMode,
                                                      authorId,
                                                      (!value.isBlockedUser && !settings.enableMute),
                                                      (!value.areTitlesBlocked && settings.enableTitleBan),
                                                      (!value.isMuted && settings.enableMute));
        
        
        let author = createEksiSozlukUser(name, authorId);
        if(author)
          authorList.push(author);
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited
          await waitForRelationCooldown();
          res = await performRelationAction(banMode,
                                                    authorId,
                                                    (!value.isBlockedUser && !settings.enableMute),
                                                    (!value.areTitlesBlocked && settings.enableTitleBan),
                                                    (!value.isMuted && settings.enableMute));

        }
        
        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }
    }
    else if(banSource === enums.BanSource.FOLLOW)
    {
      notificationHandler.notifyScrapeFollowers();

      let scrapedRelations = await scrapingHandler.listFollowers(singleAuthorName, {signal});
      log.info("bg", "number of user to ban (before analysis): " + scrapedRelations.size);
      
      // stop if there is no user
      if(scrapedRelations.size === 0)
      {
        notificationHandler.finishErrorNoAccount(banSource, banMode);
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }
      
      // analysis before operation 
      if(settings.enableAnalysisBeforeOperation && settings.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        notificationHandler.notifyScrapeFollowings();
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal});
        
        // remove the authors that ${clientName} follows from the list to protect  
        notificationHandler.notifyAnalysisProtectFollowedUsers();    
        for (let name of scrapedRelations.keys()) {
          if (mapFollowing.has(name))
            scrapedRelations.delete(name);
        }
      }
      if(settings.enableAnalysisBeforeOperation && settings.enableOnlyRequiredActions)
      {
        // scrape the authors that ${clientName} blocked
        notificationHandler.notifyScrapeBanned();
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal});
        
        // update the list with info obtained from mapBlocked
        notificationHandler.notifyAnalysisOnlyRequiredActions();
        for (let name of scrapedRelations.keys()) {
          if (mapBlocked.has(name))
          {
            scrapedRelations.get(name).isBlockedUser = mapBlocked.get(name).isBlockedUser;
            scrapedRelations.get(name).areTitlesBlocked = mapBlocked.get(name).areTitlesBlocked;
            scrapedRelations.get(name).isMuted = mapBlocked.get(name).isMuted;
          }
        }
      }
        
      log.info("bg", "number of user to ban (after analysis): " + scrapedRelations.size);
      
      // stop if there is no user
      if(scrapedRelations.size === 0)
      {
        notificationHandler.finishErrorNoAccount(banSource, banMode);
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_AFTER_FILTERING;
        return;
      }

      plannedAction = scrapedRelations.size;
      authorList = Array.from(scrapedRelations, ([name, value]) =>
        createEksiSozlukUser(name, value.authorId)
      ).filter(author => author !== null);

      notificationHandler.notifyOngoing(0, 0, plannedAction);
      
      
      
      for (const [name, value] of scrapedRelations)
      {
        if(signal.aborted)
          break;
        
        // Relation flags are null if analysis is not enabled.
        let res = await performRelationAction(banMode,
                                                      value.authorId, 
                                                      (!value.isBlockedUser && !settings.enableMute),
                                                      (!value.areTitlesBlocked && settings.enableTitleBan),
                                                      (!value.isMuted && settings.enableMute));
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited
          await waitForRelationCooldown();
          // Relation flags are null if analysis is not enabled.
          res = await performRelationAction(banMode,
                                                    value.authorId,
                                                    (!value.isBlockedUser && !settings.enableMute),
                                                    (!value.areTitlesBlocked && settings.enableTitleBan),
                                                    (!value.isMuted && settings.enableMute));
        }
        
        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }

      
    }
    else if(banSource === enums.BanSource.UNDOBANALL)
    {
      notificationHandler.notifyScrapeUndobanAll();

      let scrapedRelations = await scrapingHandler.listOwnRelations({}, {signal});
      
      // stop if there is no user
      log.info("bg", "number of user to ban " + scrapedRelations.size);
      if(scrapedRelations.size === 0)
      {
        notificationHandler.finishErrorNoAccount(banSource, banMode);
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }

      plannedAction = scrapedRelations.size;
      authorList = Array.from(scrapedRelations, ([name, value]) =>
        createEksiSozlukUser(name, value.authorId)
      ).filter(author => author !== null);

      notificationHandler.notifyOngoing(0, 0, plannedAction);
      
      for (const [name, value] of scrapedRelations)
      {
        if(signal.aborted)
          break;
        
        let res = await performRelationAction(banMode, value.authorId, value.isBlockedUser, value.areTitlesBlocked, value.isMuted);
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited
          await waitForRelationCooldown();
          res = await performRelationAction(banMode, value.authorId, value.isBlockedUser, value.areTitlesBlocked, value.isMuted);
        }
        
        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }
    }
    
    else if(banSource === enums.BanSource.TITLE)
    {
      notificationHandler.notifyScrapeTitle();

      // scrapedRelations does not hold duplicated records, scraping handler is responsible to keep it clean
      let scrapedRelations = await scrapingHandler.listTitleAuthors({
        titleName,
        titleId,
        period: timeSpecifier
      }, {signal});
      log.info("bg", "number of user to ban (before analysis): " + scrapedRelations.size);
      
      // stop if there is no user
      if(scrapedRelations.size === 0)
      {
        notificationHandler.finishErrorNoAccount(banSource, banMode);
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }
      
      // analysis before operation 
      if(settings.enableAnalysisBeforeOperation && settings.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        notificationHandler.notifyScrapeFollowings();
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal});
        
        // remove the authors that ${clientName} follows from the list to protect  
        notificationHandler.notifyAnalysisProtectFollowedUsers();    
        for (let name of scrapedRelations.keys()) {
          if (mapFollowing.has(name))
            scrapedRelations.delete(name);
        }
      }
      if(settings.enableAnalysisBeforeOperation && settings.enableOnlyRequiredActions)
      {
        // scrape the authors that ${clientName} blocked
        notificationHandler.notifyScrapeBanned();
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal});
        
        // update the list with info obtained from mapBlocked
        notificationHandler.notifyAnalysisOnlyRequiredActions();
        for (let name of scrapedRelations.keys()) {
          if (mapBlocked.has(name))
          {
            scrapedRelations.get(name).isBlockedUser = mapBlocked.get(name).isBlockedUser;
            scrapedRelations.get(name).areTitlesBlocked = mapBlocked.get(name).areTitlesBlocked;
            scrapedRelations.get(name).isMuted = mapBlocked.get(name).isMuted;
          }
        }
      }
        
      log.info("bg", "number of user to ban (after analysis): " + scrapedRelations.size);
      
      // stop if there is no user
      if(scrapedRelations.size === 0)
      {
        notificationHandler.finishErrorNoAccount(banSource, banMode);
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_AFTER_FILTERING;
        return;
      }

      plannedAction = scrapedRelations.size;
      authorList = Array.from(scrapedRelations, ([name, value]) =>
        createEksiSozlukUser(name, value.authorId)
      ).filter(author => author !== null);

      notificationHandler.notifyOngoing(0, 0, plannedAction);
      
      for (const [name, value] of scrapedRelations)
      {
        if(signal.aborted)
          break;
        
        // Relation flags are null if analysis is not enabled.
        let res = await performRelationAction(banMode,
                                                      value.authorId, 
                                                      (!value.isBlockedUser && !settings.enableMute),
                                                      (!value.areTitlesBlocked && settings.enableTitleBan),
                                                      (!value.isMuted && settings.enableMute));
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited
          await waitForRelationCooldown();
          // Relation flags are null if analysis is not enabled.
          res = await performRelationAction(banMode,
                                                    value.authorId,
                                                    (!value.isBlockedUser && !settings.enableMute),
                                                    (!value.areTitlesBlocked && settings.enableTitleBan),
                                                    (!value.isMuted && settings.enableMute));
        }
        
        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }
    }
    
    processFinishReason = signal.aborted
      ? enums.ProcessFinishReason.CANCELLED
      : enums.ProcessFinishReason.SUCCESS;
  };

  try
  {
    await run();
  }
  catch(error)
  {
    if(signal.aborted)
    {
      processFinishReason = enums.ProcessFinishReason.CANCELLED;
      log.info("bg", "Early stop signal stopped the process.");
    }
    else
    {
      processFinishReason = enums.ProcessFinishReason.UNEXPECTED_ERROR;
      errorMessage = error instanceof Error ? error.message : String(error);
      log.err("bg", "Error thrown: " + error);
    }
  }
  finally
  {

    // if early stop was generated, erase planned processes in notification page
    if(programController.earlyStop)
    {
      log.info("bg", "(updatePlannedProcessesList just before finished) notification page's queue will be updated.");
      notificationHandler.updatePlannedProcessesList(""); // erase the processes in the planned processes table
      // add the remaining processes to completed process table
      let remainingProcessesArray = jobManager.waitingJobAttributes;
      for (const element of remainingProcessesArray)
        notificationHandler.finishErrorEarlyStop(element.banSource, element.banMode);
      jobManager.clearWaiting(); // clear the remaining planned processes in the queue
    }
    
    if(processFinishReason === enums.ProcessFinishReason.SUCCESS) 
    {
      notificationHandler.finishSuccess(banSource, banMode, successfulAction, performedAction, plannedAction);
      
      
      log.info("bg", "Program has been finished (successful:" + successfulAction + ", performed:" + performedAction + ", planned:" + plannedAction + ")");

      try
      {
        let telemetryLogLevel;
        let telemetryLogData;
        if(settings.sendLog && log.isEnabled)
        {
          telemetryLogLevel = log.level;
          telemetryLogData = log.getData().toString();
        }
        else
        {
          telemetryLogLevel = log.constructor.Levels.DISABLED;
          telemetryLogData = null;
        }

        const telemetry = createJobTelemetry({
          request,
          authorList,
          entryMetaData,
          userAgent,
          clientName,
          clientId,
          successfulAction,
          performedAction,
          plannedAction,
          earlyStopped: programController.earlyStop,
          version: chrome.runtime.getManifest().version,
          logLevel: telemetryLogLevel,
          logData: telemetryLogData,
          settings
        });

        if(settings.sendData)
          telemetryReporter.submit(telemetry, {serverUrl: settings.serverURL});
      }
      catch(error)
      {
        handleJobTelemetryError(error);
      }

    }
    else if(processFinishReason === enums.ProcessFinishReason.CANCELLED)
    {
      notificationHandler.finishErrorEarlyStop(banSource, banMode);
    }
    
    // common cleanup
    programController.earlyStop = false; // reset to reuse
    log.resetData();
  }

  return createJobResult(job, {
    finishReason: processFinishReason,
    successfulAction,
    performedAction,
    plannedAction,
    errorMessage
  });
}

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
    
    // analytics
    await commHandler.sendAnalyticsData({click_type:enums.ClickType.INSTALL_OR_UPDATE});
    
    // open welcome page
    let tab = await chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/welcome.html") });
  }
});


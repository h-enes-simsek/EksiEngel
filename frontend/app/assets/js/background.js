'use strict';

import * as enums from './enums.js';
import * as utils from './utils.js';
import {config, getConfig, saveConfig, handleConfig} from './config.js';
import {log} from './log.js';
import {createEksiSozlukUser, commHandler} from './commHandler.js';
import {RelationHandler, RelationActionStatus} from './relationHandler.js';
import {EksiScrapingHandler} from './scrapingHandlerNew.js';
import {processQueue} from './queue.js';
import {programController} from './programController.js';
import {isEksiSozlukAccessible} from './urlHandler.js';
import { notificationHandler } from './notificationHandler.js';
import {createJobRequest} from './jobs/jobRequest.js';
import {JobManager} from './jobs/jobManager.js';
import {createJobTelemetry, JobTelemetryReporter} from './jobs/jobTelemetry.js';
import {FakeScrapingHandler} from './testing/fakeScrapingHandler.js';
import {FakeRelationHandler} from './testing/fakeRelationHandler.js';

// Development-only switch. Keep disabled in production builds.
const DEV_USE_FAKE_HANDLERS = false;

log.info("bg", "initialized");
let g_notificationTabId = 0;

const relationHandler = new RelationHandler();
const scrapingHandler = new EksiScrapingHandler({baseUrl: config.EksiSozlukURL});
const fakeScrapingHandler = new FakeScrapingHandler();
const fakeRelationHandler = new FakeRelationHandler();
const activeScrapingHandler = DEV_USE_FAKE_HANDLERS ? fakeScrapingHandler : scrapingHandler;
const activeRelationHandler = DEV_USE_FAKE_HANDLERS ? fakeRelationHandler : relationHandler;
const handleJobTelemetryError = error => console.error("job telemetry failed: " + error);
const jobTelemetryReporter = new JobTelemetryReporter({
  isEnabled: () => config.sendData && !DEV_USE_FAKE_HANDLERS,
  send: telemetry => commHandler.sendData(telemetry.action, telemetry.actionConfig),
  onError: handleJobTelemetryError
});

function entryIdFromUrl(entryUrl)
{
  const pathname = new URL(entryUrl, config.EksiSozlukURL).pathname;
  const match = pathname.match(/^\/entry\/(\d+)\/?$/);

  if(!match)
    throw new TypeError('entryUrl must identify a numeric Ekşi Sözlük entry');

  return match[1];
}

const jobManager = new JobManager({
  queue: processQueue,
  executeJob: job => processHandler(job.request, {
    scrapingHandler: activeScrapingHandler,
    relationHandler: activeRelationHandler,
    telemetryReporter: jobTelemetryReporter
  })
});

if(DEV_USE_FAKE_HANDLERS)
  log.warn("bg", "development fake scraping and relation handlers are enabled");

chrome.runtime.onMessage.addListener(async function messageListener_Popup(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error

	const obj = utils.filterMessage(message, "banSource", "banMode");
	if(obj.resultType === enums.ResultType.FAIL)
		return;

  const request = createJobRequest(obj);
  log.info("bg", "a new process added to the queue, banSource: " + request.banSource + ", banMode: " + request.banMode);
  jobManager.enqueue(request);
  log.info("bg", "number of waiting processes in the queue: " + jobManager.waitingCount);

  // update notification page. otherwise, the user cannot see the planned processes immediately after new request.
  notificationHandler.updatePlannedProcessesList(jobManager.waitingJobAttributes);
});

async function processHandler(request, {scrapingHandler, relationHandler, telemetryReporter})
{
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
    timeSpecifier
  } = request;

  const abortController = new AbortController();
  const performRelationAction = (...args) => relationHandler.performAction(
    ...args,
    {signal: abortController.signal}
  );
  programController.setActiveAbortController(abortController);

  let processFinishReason = enums.ProcessFinishReason.NOT_SET;
  let authorList = [];
  let plannedAction = 0;
  let successfulAction = 0;
  let performedAction = 0;
  let entryMetaData = {};
  let userAgent = null;
  let clientName = null;
  let clientId = null;

  function recordRelationResult(result)
  {
    if(result.actionPerformed)
      performedAction++;

    if(result.actionSucceeded)
      successfulAction++;
  }

  try
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

    try
    {
      await handleConfig(); // load config
    }
    catch(e)
    {
      processFinishReason = enums.ProcessFinishReason.CONFIGURATION_LOADING;
      notificationHandler.finishErrorConfigurationLoading(banSource, banMode);
      return;
    }
    notificationHandler.notifyControlAccess();
    const urlAccessible = await isEksiSozlukAccessible();
    if(!urlAccessible)
    {
      log.err("bg", "Program has been finished (finishErrorAccess)");
      notificationHandler.finishErrorAccess(banSource, banMode);
      processFinishReason = enums.ProcessFinishReason.EKSI_SOZLUK_UNREACHABLE;
      return;
    }

    notificationHandler.notifyControlLogin();
    userAgent = navigator.userAgent;
    const currentAccount = await scrapingHandler.getCurrentAccount({signal: abortController.signal});
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

      plannedAction = authorList.length;
      notificationHandler.notifyOngoing(0, 0, plannedAction);
      
      let res = await performRelationAction(banMode, singleAuthorId, targetType == enums.TargetType.USER, targetType == enums.TargetType.TITLE, targetType == enums.TargetType.MUTE);
      
      if(res.status == RelationActionStatus.RETRY_REQUIRED)
      {
        // performAction was rate limited

        // while waiting cooldown, send periodic notifications to user 
        // this also provides that chrome doesn't kill the extension for being idle
        await new Promise(async resolve => 
        {
          // wait 1 minute (+2 sec to ensure)
          let waitTimeInSec = 62;
          for(let i = 1; i <= waitTimeInSec; i++)
          {
            if(programController.earlyStop)
              break;
            
            notificationHandler.notifyCooldown(waitTimeInSec-i);
            
            // wait 1 sec
            await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
          }
            
          resolve();        
        }); 
        
        if(!programController.earlyStop)
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
        authorNames = await utils.getUserList(); // names will be loaded from storage
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
        if(programController.earlyStop)
          break;
        
        const scrapedAuthor = await scrapingHandler.getAuthor(authorName, {signal: abortController.signal});
        let author = createEksiSozlukUser(authorName, scrapedAuthor?.authorId);
        if(author)
          authorList.push(author);
        
        let res;
        if(banMode == enums.BanMode.BAN)
          res = await performRelationAction(banMode, author.eksisozluk_id, !config.enableMute, config.enableTitleBan, config.enableMute);
        else
          res = await performRelationAction(banMode, author.eksisozluk_id, true, true, true);
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited

          // while waiting cooldown, send periodic notifications to user 
          // this also provides that chrome doesn't kill the extension for being idle
          await new Promise(async resolve => 
          {
            // wait 1 minute (+2 sec to ensure)
            let waitTimeInSec = 62;
            for(let i = 1; i <= waitTimeInSec; i++)
            {
              if(programController.earlyStop)
                break;
              
              // send message to notification page
              notificationHandler.notifyCooldown(waitTimeInSec-i);
              
              // wait 1 sec
              await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
            }
              
            resolve();        
          }); 
          
          if(!programController.earlyStop)
          {
            if(banMode == enums.BanMode.BAN)
              res = await performRelationAction(banMode, author.eksisozluk_id, !config.enableMute, config.enableTitleBan, config.enableMute);
            else
              res = await performRelationAction(banMode, author.eksisozluk_id, true, true, true);
          }
        }

        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }
      
    }
    else if(banSource === enums.BanSource.FAV)
    {
      notificationHandler.notifyScrapeFavs();

      const entryId = entryIdFromUrl(entryUrl);
      entryMetaData = await scrapingHandler.getEntryMetadata(entryId, {signal: abortController.signal});
      if(!entryMetaData)
        log.warn("bg", `Entry ${entryId} metadata could not be retrieved.`);

      let scrapedRelations = await scrapingHandler.listEntryFavoriters(entryId, {
        includeNovices: config.enableNoobBan,
        signal: abortController.signal
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
      if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        notificationHandler.notifyScrapeFollowings();
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal: abortController.signal});
        
        // remove the authors that ${clientName} follows from the list to protect    
        notificationHandler.notifyAnalysisProtectFollowedUsers();  
        for (let name of scrapedRelations.keys()) {
          if (mapFollowing.has(name))
            scrapedRelations.delete(name);
        }
      }
      if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions)
      {
        // Note: Ekşi Sözlük API response doesn't include blocked authors, but it includes authors who muted and title blocked
        // This condition doesn't provide a simplification of the following algorithm
        
        // scrape the authors that ${clientName} blocked
        notificationHandler.notifyScrapeBanned();
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal: abortController.signal});
        
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
        if(programController.earlyStop)
          break;
        let authorId = (await scrapingHandler.getAuthor(name, {signal: abortController.signal}))?.authorId;
        if(!authorId)
          continue;
        let res = await performRelationAction(banMode,
                                                      authorId,
                                                      (!value.isBlockedUser && !config.enableMute),
                                                      (!value.areTitlesBlocked && config.enableTitleBan),
                                                      (!value.isMuted && config.enableMute));
        
        
        let author = createEksiSozlukUser(name, authorId);
        if(author)
          authorList.push(author);
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited

          // while waiting cooldown, send periodic notifications to user 
          // this also provides that chrome doesn't kill the extension for being idle
          await new Promise(async resolve => 
          {
            // wait 1 minute (+2 sec to ensure)
            let waitTimeInSec = 62;
            for(let i = 1; i <= waitTimeInSec; i++)
            {
              if(programController.earlyStop)
                break;
              
              // send message to notification page
              notificationHandler.notifyCooldown(waitTimeInSec-i);
              
              // wait 1 sec
              await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
            }
              
            resolve();        
          }); 
          
          if(!programController.earlyStop)
          {
            res = await performRelationAction(banMode,
                                                      authorId,
                                                      (!value.isBlockedUser && !config.enableMute),
                                                      (!value.areTitlesBlocked && config.enableTitleBan),
                                                      (!value.isMuted && config.enableMute));
          }

        }
        
        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }
    }
    else if(banSource === enums.BanSource.FOLLOW)
    {
      notificationHandler.notifyScrapeFollowers();

      let scrapedRelations = await scrapingHandler.listFollowers(singleAuthorName, {signal: abortController.signal});
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
      if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        notificationHandler.notifyScrapeFollowings();
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal: abortController.signal});
        
        // remove the authors that ${clientName} follows from the list to protect  
        notificationHandler.notifyAnalysisProtectFollowedUsers();    
        for (let name of scrapedRelations.keys()) {
          if (mapFollowing.has(name))
            scrapedRelations.delete(name);
        }
      }
      if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions)
      {
        // scrape the authors that ${clientName} blocked
        notificationHandler.notifyScrapeBanned();
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal: abortController.signal});
        
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
        if(programController.earlyStop)
          break;
        
        // Relation flags are null if analysis is not enabled.
        let res = await performRelationAction(banMode,
                                                      value.authorId, 
                                                      (!value.isBlockedUser && !config.enableMute),
                                                      (!value.areTitlesBlocked && config.enableTitleBan),
                                                      (!value.isMuted && config.enableMute));
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited

          // while waiting cooldown, send periodic notifications to user 
          // this also provides that chrome doesn't kill the extension for being idle
          await new Promise(async resolve => 
          {
            // wait 1 minute (+2 sec to ensure)
            let waitTimeInSec = 62;
            for(let j = 1; j <= waitTimeInSec; j++)
            {
              if(programController.earlyStop)
                break;
              
              // send message to notification page
              notificationHandler.notifyCooldown(waitTimeInSec-j);
              
              // wait 1 sec
              await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
            }
              
            resolve();        
          }); 
          
          if(!programController.earlyStop)
          {
            // Relation flags are null if analysis is not enabled.
            res = await performRelationAction(banMode,
                                                      value.authorId, 
                                                      (!value.isBlockedUser && !config.enableMute),
                                                      (!value.areTitlesBlocked && config.enableTitleBan),
                                                      (!value.isMuted && config.enableMute));
          }
        }
        
        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }

      
    }
    else if(banSource === enums.BanSource.UNDOBANALL)
    {
      notificationHandler.notifyScrapeUndobanAll();

      let scrapedRelations = await scrapingHandler.listOwnRelations({}, {signal: abortController.signal});
      
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
        if(programController.earlyStop)
          break;
        
        let res = await performRelationAction(banMode, value.authorId, value.isBlockedUser, value.areTitlesBlocked, value.isMuted);
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited

          // while waiting cooldown, send periodic notifications to user 
          // this also provides that chrome doesn't kill the extension for being idle
          await new Promise(async resolve => 
          {
            // wait 1 minute (+2 sec to ensure)
            let waitTimeInSec = 62;
            for(let j = 1; j <= waitTimeInSec; j++)
            {
              if(programController.earlyStop)
                break;
              
              // send message to notification page
              notificationHandler.notifyCooldown(waitTimeInSec-j);
              
              // wait 1 sec
              await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
            }
              
            resolve();        
          }); 
          
          if(!programController.earlyStop)
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
      }, {signal: abortController.signal});
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
      if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        notificationHandler.notifyScrapeFollowings();
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal: abortController.signal});
        
        // remove the authors that ${clientName} follows from the list to protect  
        notificationHandler.notifyAnalysisProtectFollowedUsers();    
        for (let name of scrapedRelations.keys()) {
          if (mapFollowing.has(name))
            scrapedRelations.delete(name);
        }
      }
      if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions)
      {
        // scrape the authors that ${clientName} blocked
        notificationHandler.notifyScrapeBanned();
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal: abortController.signal});
        
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
        if(programController.earlyStop)
          break;
        
        // Relation flags are null if analysis is not enabled.
        let res = await performRelationAction(banMode,
                                                      value.authorId, 
                                                      (!value.isBlockedUser && !config.enableMute),
                                                      (!value.areTitlesBlocked && config.enableTitleBan),
                                                      (!value.isMuted && config.enableMute));
        
        if(res.status == RelationActionStatus.RETRY_REQUIRED)
        {
          // performAction was rate limited

          // while waiting cooldown, send periodic notifications to user 
          // this also provides that chrome doesn't kill the extension for being idle
          await new Promise(async resolve => 
          {
            // wait 1 minute (+2 sec to ensure)
            let waitTimeInSec = 62;
            for(let j = 1; j <= waitTimeInSec; j++)
            {
              if(programController.earlyStop)
                break;
              
              // send message to notification page
              notificationHandler.notifyCooldown(waitTimeInSec-j);
              
              // wait 1 sec
              await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
            }
              
            resolve();        
          }); 
          
          if(!programController.earlyStop)
          {
            // Relation flags are null if analysis is not enabled.
            res = await performRelationAction(banMode,
                                                      value.authorId, 
                                                      (!value.isBlockedUser && !config.enableMute),
                                                      (!value.areTitlesBlocked && config.enableTitleBan),
                                                      (!value.isMuted && config.enableMute));
          }
        }
        
        // send message to notification page
        recordRelationResult(res);
        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction);
      }
    }
    
    processFinishReason = enums.ProcessFinishReason.SUCCESS;
  }
  catch(error)
  {
    if(abortController.signal.aborted)
    {
      log.info("bg", "Early stop signal stopped the process.");
    }
    else
    {
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
        if(config.sendLog && log.isEnabled)
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
          settings: config
        });

        telemetryReporter.submit(telemetry);
      }
      catch(error)
      {
        handleJobTelemetryError(error);
      }

    }
    
    // common cleanup
    programController.clearActiveAbortController(abortController);
    programController.earlyStop = false; // reset to reuse
    log.resetData();
  }
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


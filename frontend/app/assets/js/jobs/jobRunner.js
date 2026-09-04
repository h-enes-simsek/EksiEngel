'use strict';

import * as enums from '../enums.js';
import * as utils from '../utils.js';
import {log} from '../log.js';
import {createEksiSozlukUser} from '../commHandler.js';
import {RelationActionStatus} from '../relationHandler.js';
import {createJobResult} from './job.js';
import {createJobTelemetry} from './jobTelemetry.js';

const RELATION_COOLDOWN_SECONDS = 62;

function entryIdFromUrl(entryUrl, baseUrl)
{
  const pathname = new URL(entryUrl, baseUrl).pathname;
  const match = pathname.match(/^\/entry\/(\d+)\/?$/);

  if(!match)
    throw new TypeError('entryUrl must identify a numeric Ekşi Sözlük entry');

  return match[1];
}

/**
 * Execute one accepted job without depending on the Chrome service-worker API.
 * Browser adapters and runtime values are supplied by background.js.
 */
export async function runJob(job, {
  signal,
  settings,
  reporter,
  scrapingHandler,
  relationHandler,
  telemetryReporter,
  accessChecker,
  cooldownWaiter,
  userAgent,
  extensionVersion,
  onTelemetryError
})
{
  const startedAt = performance.now();
  const {request} = job;
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

  let processFinishReason = enums.ProcessFinishReason.NOT_SET;
  let authorList = [];
  let plannedAction = 0;
  let successfulAction = 0;
  let performedAction = 0;
  let entryMetaData = {};
  let clientName = null;
  let clientId = null;
  let errorMessage = null;

  function reportPhase(phase)
  {
    reporter.reportPhase(phase);
  }

  function reportProgress()
  {
    const progress = {
      successfulAction,
      performedAction,
      plannedAction
    };

    reporter.reportProgress(progress);
  }

  async function waitForRelationCooldown()
  {
    const cooldownEndsAt = new Date(
      Date.now() + RELATION_COOLDOWN_SECONDS * 1000
    ).toISOString();
    reporter.reportCooldown({
      remainingSeconds: RELATION_COOLDOWN_SECONDS,
      cooldownEndsAt
    });

    try
    {
      await cooldownWaiter({
        seconds: RELATION_COOLDOWN_SECONDS,
        signal,
        onTick: remainingSeconds =>
          reporter.reportCooldown({remainingSeconds, cooldownEndsAt})
      });
    }
    finally
    {
      reporter.reportCooldown({remainingSeconds: 0, cooldownEndsAt: null});
    }
  }

  function recordRelationResult(result)
  {
    let changed = false;
    if(result.actionPerformed)
    {
      performedAction++;
      changed = true;
    }

    if(result.actionSucceeded)
    {
      successfulAction++;
      changed = true;
    }

    if(changed)
      reportProgress();
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

    reportPhase(enums.JobPhase.CHECKING_ACCESS);
    const urlAccessible = await accessChecker({
      signal,
      baseUrl: settings.EksiSozlukURL
    });
    if(!urlAccessible)
    {
      log.err("bg", "Program has been finished (finishErrorAccess)");
      processFinishReason = enums.ProcessFinishReason.EKSI_SOZLUK_UNREACHABLE;
      return;
    }

    reportPhase(enums.JobPhase.CHECKING_LOGIN);
    const currentAccount = await scrapingHandler.getCurrentAccount({signal});
    clientName = currentAccount?.authorName ?? null;
    clientId = currentAccount?.authorId ?? null;
    if(!clientName || !clientId)
    {
      log.err("bg", "Program has been finished (finishErrorLogin)");
      processFinishReason = enums.ProcessFinishReason.CLIENT_NOT_LOGGED_IN;
      return;
    }
    
    if(banSource === enums.BanSource.SINGLE)
    {
      let author = createEksiSozlukUser(singleAuthorName, singleAuthorId);
      if(author)
        authorList.push(author);

      plannedAction = 1;
      reportProgress();
      reportPhase(enums.JobPhase.EXECUTING_RELATIONS);
      
      let res = await performRelationAction(banMode, singleAuthorId, targetType == enums.TargetType.USER, targetType == enums.TargetType.TITLE, targetType == enums.TargetType.MUTE);
      
      if(res.status == RelationActionStatus.RETRY_REQUIRED)
      {
        // performAction was rate limited
        await waitForRelationCooldown();
        res = await performRelationAction(banMode, singleAuthorId, targetType == enums.TargetType.USER, targetType == enums.TargetType.TITLE, targetType == enums.TargetType.MUTE);
      }
      
      recordRelationResult(res);
    }
    else if(banSource === enums.BanSource.LIST)
    {
      reportPhase(enums.JobPhase.COLLECTING_AUTHORS);
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
        return;
      }
      try
      {
        utils.cleanUserList(authorNames);
      }
      catch(e)
      {
        processFinishReason = enums.ProcessFinishReason.USER_LIST_CLEANING;
        return;
      }
      
      plannedAction = authorNames.length;
      reportProgress();

      // stop if there is no user
      log.info("bg", "number of user to ban " + plannedAction);
      if(plannedAction === 0)
      {
        log.err("bg", "Program has been finished (finishErrorNoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }

      reportPhase(enums.JobPhase.EXECUTING_RELATIONS);
      
      for (const authorName of authorNames)
      {
        const scrapedAuthor = await scrapingHandler.getAuthor(authorName, {signal});
        let author = createEksiSozlukUser(authorName, scrapedAuthor?.authorId);
        if(!author)
        {
          log.info("bg", "Author could not be resolved and will be skipped: " + authorName);
          continue;
        }
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

        recordRelationResult(res);
      }
      
    }
    else if(banSource === enums.BanSource.FAV)
    {
      reportPhase(enums.JobPhase.COLLECTING_FAVORITERS);

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
        log.err("bg", "Program has been finished (finishErrorNoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }
      
      // analysis before operation 
      if(settings.enableAnalysisBeforeOperation && settings.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        reportPhase(enums.JobPhase.COLLECTING_EXISTING_RELATIONS);
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal});
        
        // remove the authors that ${clientName} follows from the list to protect    
        reportPhase(enums.JobPhase.ANALYSING_PROTECTED_USERS);
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
        reportPhase(enums.JobPhase.COLLECTING_EXISTING_RELATIONS);
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal});
        
        // update the list with info obtained from mapBlocked
        reportPhase(enums.JobPhase.ANALYSING_REQUIRED_ACTIONS);
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
        log.err("bg", "Program has been finished (finishErrorNoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_AFTER_FILTERING;
        return;
      }
      
      plannedAction = scrapedRelations.size;
      reportProgress();
      reportPhase(enums.JobPhase.EXECUTING_RELATIONS);
      
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
        
        recordRelationResult(res);
      }
    }
    else if(banSource === enums.BanSource.FOLLOW)
    {
      reportPhase(enums.JobPhase.COLLECTING_FOLLOWERS);

      let scrapedRelations = await scrapingHandler.listFollowers(singleAuthorName, {signal});
      log.info("bg", "number of user to ban (before analysis): " + scrapedRelations.size);
      
      // stop if there is no user
      if(scrapedRelations.size === 0)
      {
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }
      
      // analysis before operation 
      if(settings.enableAnalysisBeforeOperation && settings.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        reportPhase(enums.JobPhase.COLLECTING_EXISTING_RELATIONS);
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal});
        
        // remove the authors that ${clientName} follows from the list to protect  
        reportPhase(enums.JobPhase.ANALYSING_PROTECTED_USERS);
        for (let name of scrapedRelations.keys()) {
          if (mapFollowing.has(name))
            scrapedRelations.delete(name);
        }
      }
      if(settings.enableAnalysisBeforeOperation && settings.enableOnlyRequiredActions)
      {
        // scrape the authors that ${clientName} blocked
        reportPhase(enums.JobPhase.COLLECTING_EXISTING_RELATIONS);
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal});
        
        // update the list with info obtained from mapBlocked
        reportPhase(enums.JobPhase.ANALYSING_REQUIRED_ACTIONS);
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
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_AFTER_FILTERING;
        return;
      }

      plannedAction = scrapedRelations.size;
      reportProgress();
      authorList = Array.from(scrapedRelations, ([name, value]) =>
        createEksiSozlukUser(name, value.authorId)
      ).filter(author => author !== null);

      reportPhase(enums.JobPhase.EXECUTING_RELATIONS);
      
      
      
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
        
        recordRelationResult(res);
      }

      
    }
    else if(banSource === enums.BanSource.UNDOBANALL)
    {
      reportPhase(enums.JobPhase.COLLECTING_EXISTING_RELATIONS);

      let scrapedRelations = await scrapingHandler.listOwnRelations({}, {signal});
      
      // stop if there is no user
      log.info("bg", "number of user to ban " + scrapedRelations.size);
      if(scrapedRelations.size === 0)
      {
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }

      plannedAction = scrapedRelations.size;
      reportProgress();
      authorList = Array.from(scrapedRelations, ([name, value]) =>
        createEksiSozlukUser(name, value.authorId)
      ).filter(author => author !== null);

      reportPhase(enums.JobPhase.EXECUTING_RELATIONS);
      
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
        
        recordRelationResult(res);
      }
    }
    
    else if(banSource === enums.BanSource.TITLE)
    {
      reportPhase(enums.JobPhase.COLLECTING_TITLE_AUTHORS);

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
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_FOUND;
        return;
      }
      
      // analysis before operation 
      if(settings.enableAnalysisBeforeOperation && settings.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
      {
        // scrape the authors that ${clientName} follows
        reportPhase(enums.JobPhase.COLLECTING_EXISTING_RELATIONS);
        let mapFollowing = await scrapingHandler.listFollowing(clientName, {signal});
        
        // remove the authors that ${clientName} follows from the list to protect  
        reportPhase(enums.JobPhase.ANALYSING_PROTECTED_USERS);
        for (let name of scrapedRelations.keys()) {
          if (mapFollowing.has(name))
            scrapedRelations.delete(name);
        }
      }
      if(settings.enableAnalysisBeforeOperation && settings.enableOnlyRequiredActions)
      {
        // scrape the authors that ${clientName} blocked
        reportPhase(enums.JobPhase.COLLECTING_EXISTING_RELATIONS);
        let mapBlocked = await scrapingHandler.listOwnRelations({}, {signal});
        
        // update the list with info obtained from mapBlocked
        reportPhase(enums.JobPhase.ANALYSING_REQUIRED_ACTIONS);
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
        log.err("bg", "Program has been finished (error_NoAccount)");
        processFinishReason = enums.ProcessFinishReason.NO_ACCOUNTS_AFTER_FILTERING;
        return;
      }

      plannedAction = scrapedRelations.size;
      reportProgress();
      authorList = Array.from(scrapedRelations, ([name, value]) =>
        createEksiSozlukUser(name, value.authorId)
      ).filter(author => author !== null);

      reportPhase(enums.JobPhase.EXECUTING_RELATIONS);
      
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
        
        recordRelationResult(res);
      }
    }
    
    processFinishReason = signal.aborted
      ? enums.ProcessFinishReason.CANCELLED
      : enums.ProcessFinishReason.SUCCESS;
  };

  let result;
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
    result = createJobResult(job, {
      finishReason: processFinishReason,
      successfulAction,
      performedAction,
      plannedAction,
      errorMessage
    });

    const durationMs = Math.round(performance.now() - startedAt);
    log.info('job-runner', `Job ${job.id} finished in ${durationMs} ms (${result.finishReason})`);
    
    if(result.finishReason === enums.ProcessFinishReason.SUCCESS)
    {
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
          jobId: job.id,
          jobDuration: durationMs,
          request,
          authorList,
          entryMetaData,
          userAgent,
          clientName,
          clientId,
          successfulAction,
          performedAction,
          plannedAction,
          earlyStopped: result.finishReason === enums.ProcessFinishReason.CANCELLED,
          version: extensionVersion,
          logLevel: telemetryLogLevel,
          logData: telemetryLogData,
          settings
        });

        if(settings.sendData)
          telemetryReporter.submit(telemetry, {serverUrl: settings.serverURL});
      }
      catch(error)
      {
        onTelemetryError(error);
      }
    }
    
    log.resetData();
  }

  return result;
}


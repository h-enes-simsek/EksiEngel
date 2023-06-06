'use strict';

import * as enums from './enums.js';
import * as utils from './utils.js';
import {config, getConfig, saveConfig, handleConfig} from './config.js';
import {log} from './log.js';
import {commHandler} from './commHandler.js';
import {relationHandler} from './relationHandler.js';
import {scrapingHandler} from './scrapingHandler.js';
import {processQueue} from './queue.js';
import {programController} from './programController.js';
import {handleEksiSozlukURL} from './urlHandler.js';
import { notificationHandler } from './notificationHandler.js';

log.info("bg: init.");
let g_notificationTabId = 0;

chrome.runtime.onMessage.addListener(async function messageListener_Popup(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	const obj = utils.filterMessage(message, "banSource", "banMode");
	if(obj.resultType === enums.ResultType.FAIL)
		return;
	
  log.info("bg: a new process added to the queue, banSource: " + obj.banSource + ", banMode: " + obj.banMode);
  let wrapperProcessHandler = processHandler.bind(null, obj.banSource, obj.banMode, obj.entryUrl, obj.authorName, obj.authorId, obj.isTargetUser, obj.isTargetTitle, obj.isTargetMute);
  wrapperProcessHandler.banSource = obj.banSource;
  wrapperProcessHandler.banMode = obj.banMode;
  wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes(); 
  processQueue.enqueue(wrapperProcessHandler);
  log.info("bg: number of waiting processes in the queue: " + processQueue.size);
  notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);
});

async function processHandler(banSource, banMode, entryUrl, singleAuthorName, singleAuthorId, isTargetUser, isTargetTitle, isTargetMute)
{
  log.info("Process has been started with " + 
           "banSource: "    + banSource + 
           ", banMode: "    + banMode + 
           ", entryUrl: "   + entryUrl + 
           ", singleAuthorName: " + singleAuthorName + 
           ", singleAuthorId: "   + singleAuthorId);
  
  // create a notification page if not exist
  try
  {
    let tab2 = await chrome.tabs.get(g_notificationTabId);
  }
  catch(e)
  {
    // not exist, so create one
    let tab = await chrome.tabs.create({ active: false, url: chrome.runtime.getURL("assets/html/notification.html") });
    g_notificationTabId = tab.id;
  }
  notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);

  let authorNameList = [];
  let authorIdList = [];
  let entryMetaData = {};
  
  await handleConfig(); // load config
  relationHandler.reset(); // reset the counters to reuse

  notificationHandler.notifyControlAccess();
  const isEksiSozlukAccessible = await handleEksiSozlukURL();
  if(!isEksiSozlukAccessible)
  {
    log.err("Program has been finished (finishErrorAccess)");
    notificationHandler.finishErrorAccess(banSource, banMode);
    return;
  }

  notificationHandler.notifyControlLogin();
  let userAgent = await scrapingHandler.scrapeUserAgent();
  let clientName = await scrapingHandler.scrapeClientName(); 
  if(!clientName)
  {
    log.err("Program has been finished (finishErrorLogin)");
    notificationHandler.finishErrorLogin(banSource, banMode);
    return;
  }
  
  if(banSource === enums.BanSource.SINGLE)
  {
    notificationHandler.notifyOngoing(0, 0, 1);

    let res = await relationHandler.performAction(banMode, singleAuthorId, isTargetUser, isTargetTitle, isTargetMute);
    authorIdList.push(singleAuthorId);
    authorNameList.push(singleAuthorName);
    
    if(res.resultType == enums.ResultType.FAIL)
    {
      // performAction failed because to too many request

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
        res = await relationHandler.performAction(banMode, singleAuthorId, isTargetUser, isTargetTitle, isTargetMute);
    }
    
    notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorNameList.length);
  }
  else if(banSource === enums.BanSource.LIST)
  {
    authorNameList = await utils.getUserList(); // names will be loaded from storage
    utils.cleanUserList(authorNameList);
    
    // stop if there is no user
    log.info("number of user to ban " + authorNameList.length);
    if(authorNameList.length === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode);
      log.err("Program has been finished (finishErrorNoAccount)");
      return;
    }

    notificationHandler.notifyOngoing(0, 0, authorNameList.length);
    
    const enableMute = config.enableMute;
    
    for (let i = 0; i < authorNameList.length; i++)
    {
      if(programController.earlyStop)
        break;
      
      let authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(authorNameList[i]);
      authorIdList.push(authorId);
      
      let res;
      if(banMode == enums.BanMode.BAN)
        res = await relationHandler.performAction(banMode, authorId, !enableMute, true, enableMute);
      else
        res = await relationHandler.performAction(banMode, authorId, true, true, true);
      
      if(res.resultType == enums.ResultType.FAIL)
      {
        // performAction failed because to too many request

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
            res = await relationHandler.performAction(banMode, authorId, !enableMute, true, enableMute);
          else
            res = await relationHandler.performAction(banMode, authorId, true, true, true);
        }
      }

      // send message to notification page
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorNameList.length);
    }
    
  }
  else if(banSource === enums.BanSource.FAV)
  {
    notificationHandler.notifyScrapeFavs();

    const enableMute = config.enableMute;
    entryMetaData = await scrapingHandler.scrapeMetaDataFromEntryPage(entryUrl);
    let scrapedRelations = await scrapingHandler.scrapeAuthorNamesFromFavs(entryUrl); // names will be scraped
    
    log.info("number of user to ban (before analysis): " + scrapedRelations.size);
    
    // stop if there is no user
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode);
      log.err("Program has been finished (finishErrorNoAccount)");
      return;
    }
    
    // analysis before operation 
    if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
    {
      // scrape the authors that ${clientName} follows
      notificationHandler.notifyScrapeFollowings();
      let mapFollowing = await scrapingHandler.scrapeFollowing(clientName);
      
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
      let mapBlocked = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage();
      
      // update the list with info obtained from mapBlocked
      notificationHandler.notifyAnalysisOnlyRequiredActions();
      for (let name of scrapedRelations.keys()) {
        if (mapBlocked.has(name))
        {
          scrapedRelations.get(name).isBannedUser = mapBlocked.get(name).isBannedUser;
          scrapedRelations.get(name).isBannedTitle = mapBlocked.get(name).isBannedTitle;
          scrapedRelations.get(name).isBannedMute = mapBlocked.get(name).isBannedMute;
        }
      }
    }
    
    log.info("number of user to ban (after analysis): " + scrapedRelations.size);
    
    // stop if there is no user
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode);
      log.err("Program has been finished (finishErrorNoAccount)");
      return;
    }
    
    authorNameList = Array.from(scrapedRelations, ([name, value]) => name);

    notificationHandler.notifyOngoing(0, 0, authorNameList.length);
    
    for (const [name, value] of scrapedRelations)
    {
      if(programController.earlyStop)
        break;
      let authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(name);
      let res = await relationHandler.performAction(banMode, 
                                                    authorId,
                                                    (!value.isBannedUser && !enableMute),
                                                    (!value.isBannedTitle && true), 
                                                    (!value.isBannedMute && enableMute));
      
      
      authorIdList.push(authorId);
      
      if(res.resultType == enums.ResultType.FAIL)
      {
        // performAction failed because to too many request

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
          res = await relationHandler.performAction(banMode, 
                                                    authorId,
                                                    (!value.isBannedUser && !enableMute),
                                                    (!value.isBannedTitle && true), 
                                                    (!value.isBannedMute && enableMute));
        }

      }
      
      // send message to notification page
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorNameList.length);
    }
  }
  else if(banSource === enums.BanSource.FOLLOW)
  {
    notificationHandler.notifyScrapeFollowers();

    let scrapedRelations = await scrapingHandler.scrapeFollower(singleAuthorName);
    log.info("number of user to ban (before analysis): " + scrapedRelations.size);
    
    // stop if there is no user
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode);
      log.err("Program has been finished (error_NoAccount)");
      return;
    }
    
    // analysis before operation 
    if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
    {
      // scrape the authors that ${clientName} follows
      notificationHandler.notifyScrapeFollowings();
      let mapFollowing = await scrapingHandler.scrapeFollowing(clientName);
      
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
      let mapBlocked = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage();
      
      // update the list with info obtained from mapBlocked
      notificationHandler.notifyAnalysisOnlyRequiredActions();
      for (let name of scrapedRelations.keys()) {
        if (mapBlocked.has(name))
        {
          scrapedRelations.get(name).isBannedUser = mapBlocked.get(name).isBannedUser;
          scrapedRelations.get(name).isBannedTitle = mapBlocked.get(name).isBannedTitle;
          scrapedRelations.get(name).isBannedMute = mapBlocked.get(name).isBannedMute;
        }
      }
    }
      
    log.info("number of user to ban (after analysis): " + scrapedRelations.size);
    
    // stop if there is no user
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode);
      log.err("Program has been finished (error_NoAccount)");
      return;
    }

    authorNameList = Array.from(scrapedRelations, ([name, value]) => name);
    authorIdList = Array.from(scrapedRelations, ([name, value]) => value.authorId);

    notificationHandler.notifyOngoing(0, 0, authorNameList.length);
    
    const enableMute = config.enableMute;
    
    for (const [name, value] of scrapedRelations)
    {
      if(programController.earlyStop)
        break;
      
      // value.isBannedUser and others are null if analysis is not enabled
      let res = await relationHandler.performAction(banMode, 
                                                    value.authorId, 
                                                    (!value.isBannedUser && !enableMute), 
                                                    (!value.isBannedTitle && true), 
                                                    (!value.isBannedMute && enableMute));
      
      if(res.resultType == enums.ResultType.FAIL)
      {
        // performAction failed because to too many request

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
          // value.isBannedUser and others are null if analysis is not enabled
          res = await relationHandler.performAction(banMode, 
                                                    value.authorId, 
                                                    (!value.isBannedUser && !enableMute),
                                                    (!value.isBannedTitle && true), 
                                                    (!value.isBannedMute && enableMute));
        }
      }
      
      // send message to notification page
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorIdList.length);
    }

    
  }
  else if(banSource === enums.BanSource.UNDOBANALL)
  {
    let scrapedRelations = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage(); // names and ids will be scraped
    
    // stop if there is no user
    log.info("number of user to ban " + scrapedRelations.size);
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode);
      log.err("Program has been finished (error_NoAccount)");
      return;
    }

    authorNameList = Array.from(scrapedRelations, ([name, value]) => name);
    authorIdList = Array.from(scrapedRelations, ([name, value]) => value.authorId);

    notificationHandler.notifyOngoing(0, 0, authorNameList.length);
    
    for (const [name, value] of scrapedRelations)
    {
      if(programController.earlyStop)
        break;
      
      let res = await relationHandler.performAction(banMode, value.authorId, value.isBannedUser, value.isBannedTitle, value.isBannedMute);
      
      if(res.resultType == enums.ResultType.FAIL)
      {
        // performAction failed because to too many request

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
          res = await relationHandler.performAction(banMode, banMode, value.authorId, value.isBannedUser, value.isBannedTitle, value.isBannedMute);
      }
      
      // send message to notification page
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorIdList.length);
    }
  }
  
  let successfulAction = relationHandler.successfulAction;
  let performedAction = relationHandler.performedAction;
  
  let dataToSend = {
    client_name:      clientName,
    user_agent:       userAgent,
    ban_source:       banSource,
    ban_mode:         banMode,
    fav_entry_id:     entryMetaData.entryId,
    fav_author_name:  entryMetaData.authorName,
    fav_author_id:    entryMetaData.authorId,
    fav_title_name:   entryMetaData.titleName,
    fav_title_id:     entryMetaData.titleId,
    author_list_size: authorNameList.length,
    author_name_list: authorNameList,
    author_id_list:   authorIdList,
    total_action:     performedAction,
    successful_action:successfulAction,
    is_early_stopped: programController.earlyStop
  };

  if(config.sendData)
    await commHandler.sendData(dataToSend);

  notificationHandler.finishSuccess(banSource, banMode, successfulAction, performedAction, authorNameList.length);
  
  // if early stop was generated, erase planned processes in notification page
  if(programController.earlyStop)
  {
    log.info("bg: (updatePlannedProcessesList just before finished) notification page's queue will be updated.");
    notificationHandler.updatePlannedProcessesList(""); // erase the processes in the planned processes table
    // add the remaining processes to completed process table
    let remainingProcessesArray = processQueue.itemAttributes;
    for (const element of remainingProcessesArray)
      notificationHandler.finishErrorEarlyStop(element.banSource, element.banMode);
    processQueue.clear(); // clear the remaining planned processes in the queue 
  }
  
  log.info("Program has been finished (successfull:" + successfulAction + ", performed:" + performedAction + ", planned:" + authorNameList.length + ")");

  programController.earlyStop = false; // reset to reuse
  log.resetData();
}

// this listener fired every time when the extension installed or updated.
chrome.runtime.onInstalled.addListener(async (details) => 
{
  
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL || 
      details.reason === chrome.runtime.OnInstalledReason.UPDATE) 
  {
    // first install or extension is updated
    log.info("bg: program installed or updated.");
    
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

// this listener fired every time a tab is closed by the user
chrome.tabs.onRemoved.addListener(function(tabid, removed) {
  if(tabid == g_notificationTabId)
  {
    log.info("bg: user has closed the notification tab, earlyStop will be generated automatically.");
    programController.earlyStop = true;
  }
});
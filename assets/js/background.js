'use strict';

import * as enums from './enums.js';
import * as utils from './utils.js';
import {config, getConfig, saveConfig, handleConfig} from './config.js';
import {log} from './log.js';
import {CommHandler} from './commHandler.js';
import {RelationHandler} from './relationHandler.js';
import {ScrapingHandler} from './scrapingHandler.js';
import {autoQueue} from './queue.js';
import {programController} from './programController.js';

let relationHandler = new RelationHandler();
let scrapingHandler = new ScrapingHandler();
let commHandler = new CommHandler();

log.info("bg: init.");
let g_notificationTabId = 0;

chrome.runtime.onMessage.addListener(async function messageListener_Popup(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	const obj = utils.filterMessage(message, "banSource", "banMode");
	if(obj.resultType === enums.ResultType.FAIL)
		return;
	
  log.info("bg: a new process added to the queue, banSource: " + obj.banSource + ", banMode: " + obj.banMode);
  let wrapperProcessHandler = processHandler.bind(null, obj.banSource, obj.banMode, obj.entryUrl);
  wrapperProcessHandler.banSource = obj.banSource;
  wrapperProcessHandler.banMode = obj.banMode;
  autoQueue.enqueue(wrapperProcessHandler);
  log.info("bg: number of waiting processes in the queue: " + autoQueue.size);
  
  log.info("bg: (update_Planned in messageListener_Popup) notification page's queue will be updated.");
  chrome.runtime.sendMessage(null, {"notification":{"status":"update_Planned", "plannedProcesses":autoQueue.itemAttributes}}, function(response) {
    let lastError = chrome.runtime.lastError;
    // for the first operation, it should be failed here because there is no notification page yet.
    if(lastError)
      log.err("bg: (update_Planned in popopListener) could not establish a connection with notification page");
  });
});

async function processHandler(banSource, banMode, entryUrl)
{
  log.info("Process has been started with banSource: " + banSource + ", banMode: " + banMode);
  
  // create a notification page if not exist
  try
  {
    let tab2 = await chrome.tabs.get(g_notificationTabId);
  }
  catch(e)
  {
    // not exist, so create one
    let tab = await chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/notification.html") });
    g_notificationTabId = tab.id;
  }
  
  // TODO fix: lastError is generated, probably notification page is not ready here.
  /*
  // fetch takes too much time if it fails and results error_Login.  during operation user should be informed that program is running 
  chrome.runtime.sendMessage(null, {"notification":{status:"ongoing", successfulAction:0, performedAction:0, plannedAction:0}}, function(response) {
    let lastError = chrome.runtime.lastError;
    if(lastError)
      log.err("bg: (initial ongoing) could not establish a connection with notification page");
  });
  */
  
  // TODO fix: if page is new, lastError is generated, probably notification page is not ready here.
  // update planned processes table in notification page
  log.info("bg: (update_Planned in processHandler) notification page's queue will be updated.");
  chrome.runtime.sendMessage(null, {"notification":{"status":"update_Planned", "plannedProcesses":autoQueue.itemAttributes}}, function(response) {
    let lastError = chrome.runtime.lastError;
    if(lastError)
      log.err("bg: (update_Planned in processHandler) could not establish a connection with notification page");
  });

  let authorNameList = [];
  let authorIdList = [];
  let entryMetaData = {};
  
  await handleConfig(); // load config
  relationHandler.reset(); // reset the counters to reuse

  let userAgent = await scrapingHandler.scrapeUserAgent();
  let clientName = await scrapingHandler.scrapeClientName(); 
  if(!clientName)
  {
    log.err("Program has been finished (error_Login)");
    chrome.runtime.sendMessage(null, {"notification":{"status":"error_Login", "completedProcess":{"banSource":banSource, "banMode":banMode}}}, function(response) {
      let lastError = chrome.runtime.lastError;
    });
    return;
  }
    
  if(banSource === enums.BanSource.LIST)
  {
    authorNameList = await utils.getUserList(); // names will be loaded from storage
    utils.cleanUserList(authorNameList);
    
    // stop if there is no user
    log.info("number of user to ban " + authorNameList.length);
    if(authorNameList.length === 0)
    {
      chrome.runtime.sendMessage(null, {"notification":{"status":"error_NoAccount", "completedProcess":{"banSource":banSource, "banMode":banMode}}}, function(response) {
        let lastError = chrome.runtime.lastError;
      });
      log.err("Program has been finished (error_NoAccount)");
      return;
    }
    
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
            chrome.runtime.sendMessage(null, {"notification":{status:"cooldown", remainingTimeInSec:waitTimeInSec-i}}, function(response) {
              let lastError = chrome.runtime.lastError;
              if (lastError) 
              {
                // 'Could not establish connection. Receiving end does not exist.'
                console.info("relationHandler: (cooldown) notification page is probably closed, early stop will be generated automatically.");
                programController.earlyStop = true;
                return;
              }
            });
            
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
      chrome.runtime.sendMessage(null, {"notification":{status:"ongoing", successfulAction:res.successfulAction, performedAction:res.performedAction, plannedAction:authorNameList.length}}, function(response) {
        let lastError = chrome.runtime.lastError;
        if (lastError) 
        {
          // 'Could not establish connection. Receiving end does not exist.'
          console.info("relationHandler: (ongoing) notification page is probably closed, early stop will be generated automatically.");
          programController.earlyStop = true;
          return;
        }
      });
    }
    
  }
  else if(banSource === enums.BanSource.FAV)
  {
    entryMetaData = await scrapingHandler.scrapeMetaDataFromEntryPage(entryUrl);
    authorNameList = await scrapingHandler.scrapeAuthorNamesFromFavs(entryUrl); // names will be scraped
    
    // stop if there is no user
    log.info("number of user to ban " + authorNameList.length);
    if(authorNameList.length === 0)
    {
      chrome.runtime.sendMessage(null, {"notification":{"status":"error_NoAccount", "completedProcess":{"banSource":banSource, "banMode":banMode}}}, function(response) {
        let lastError = chrome.runtime.lastError;
      });
      log.err("Program has been finished (error_NoAccount)");
      return;
    }
    
    const enableMute = config.enableMute;
    
    for (let i = 0; i < authorNameList.length; i++)
    {
      if(programController.earlyStop)
        break;
      let authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(authorNameList[i]);
      let res = await relationHandler.performAction(banMode, authorId, !enableMute, true, enableMute);
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
            chrome.runtime.sendMessage(null, {"notification":{status:"cooldown", remainingTimeInSec:waitTimeInSec-i}}, function(response) {
              let lastError = chrome.runtime.lastError;
              if (lastError) 
              {
                // 'Could not establish connection. Receiving end does not exist.'
                console.info("relationHandler: (cooldown) notification page is probably closed, early stop will be generated automatically.");
                programController.earlyStop = true;
                return;
              }
            });
            
            // wait 1 sec
            await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
          }
            
          resolve();        
        }); 
        
        if(!programController.earlyStop)
          res = await relationHandler.performAction(banMode, authorId, !enableMute, true, enableMute);
      }
      
      // send message to notification page
      chrome.runtime.sendMessage(null, {"notification":{status:"ongoing", successfulAction:res.successfulAction, performedAction:res.performedAction, plannedAction:authorNameList.length}}, function(response) {
        let lastError = chrome.runtime.lastError;
        if (lastError) 
        {
          // 'Could not establish connection. Receiving end does not exist.'
          console.info("relationHandler: (ongoing) notification page is probably closed, early stop will be generated automatically.");
          programController.earlyStop = true;
          return;
        }
      });
    }
  }
  else if(banSource === enums.BanSource.UNDOBANALL)
  {
    let scrapedRelations = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage(); // names and ids will be scraped
    authorNameList = Array.from(scrapedRelations, ([name, value]) => name);
    authorIdList = Array.from(scrapedRelations, ([name, value]) => value.authorId);
    
    // stop if there is no user
    log.info("number of user to ban " + scrapedRelations.size);
    if(scrapedRelations.size === 0)
    {
      chrome.runtime.sendMessage(null, {"notification":{"status":"error_NoAccount", "completedProcess":{"banSource":banSource, "banMode":banMode}}}, function(response) {
        let lastError = chrome.runtime.lastError;
      });
      log.err("Program has been finished (error_NoAccount)");
      return;
    }
    
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
            chrome.runtime.sendMessage(null, {"notification":{status:"cooldown", remainingTimeInSec:waitTimeInSec-j}}, function(response) {
              let lastError = chrome.runtime.lastError;
              if (lastError) 
              {
                // 'Could not establish connection. Receiving end does not exist.'
                console.info("relationHandler: (cooldown) notification page is probably closed, early stop will be generated automatically.");
                programController.earlyStop = true;
                return;
              }
            });
            
            // wait 1 sec
            await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
          }
            
          resolve();        
        }); 
        
        if(!programController.earlyStop)
          res = await relationHandler.performAction(banMode, banMode, value.authorId, value.isBannedUser, value.isBannedTitle, value.isBannedMute);
      }
      
      // send message to notification page
      chrome.runtime.sendMessage(null, {"notification":{status:"ongoing", successfulAction:res.successfulAction, performedAction:res.performedAction, plannedAction:authorIdList.length}}, function(response) {
        let lastError = chrome.runtime.lastError;
        if (lastError) 
        {
          // 'Could not establish connection. Receiving end does not exist.'
          console.info("relationHandler: (ongoing) notification page is probably closed, early stop will be generated automatically.");
          programController.earlyStop = true;
          return;
        }
      });
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
  
  // if early stop was generated, erase planned processes in notification page
  if(programController.earlyStop)
  {
    log.info("bg: (update_Planned just before finished) notification page's queue will be updated.");
    chrome.runtime.sendMessage(null, {"notification":{"status":"update_Planned", "plannedProcesses":""}}, function(response) {
      let lastError = chrome.runtime.lastError;
      if(lastError)
        log.err("bg: (update_Planned just before finished) could not establish a connection with notification page");
    });
  }
  
  log.info("Program has been finished (successfull:" + successfulAction + ", performed:" + performedAction + ", planned:" + authorNameList.length + ")");
  // send message to notification page
  chrome.runtime.sendMessage(null, {"notification":{status:"finished", successfulAction:successfulAction, performedAction:performedAction, plannedAction:authorNameList.length, "completedProcess":{"banSource":banSource, "banMode":banMode}}}, function(response) {
    let lastError = chrome.runtime.lastError;
  });
  
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
    
    // open welcome page
    let tab = await chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/welcome.html") });
  }
});
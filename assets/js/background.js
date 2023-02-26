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
	
  log.info("A new process added to the queue, banSource: " + obj.banSource + ", banMode: " + obj.banMode);
  let wrapperProcessHandler = processHandler.bind(null, obj.banSource, obj.banMode, obj.entryUrl);
  autoQueue.enqueue(wrapperProcessHandler);
  log.info("Number of waiting processes in the queue: " + autoQueue.size);
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
    chrome.runtime.sendMessage(null, {"notification":{"status":"error_Login"}}, function(response) {
      let lastError = chrome.runtime.lastError;
    });
    log.err("Program has been finished (error_Login)");
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
      chrome.runtime.sendMessage(null, {"notification":{"status":"error_NoAccount"}}, function(response) {
        let lastError = chrome.runtime.lastError;
      });
      log.err("Program has been finished (error_NoAccount)");
      return;
    }
    
    for (let i = 0; i < authorNameList.length; i++)
    {
      if(programController.earlyStop)
        break;
      let authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(authorNameList[i]);
      authorIdList.push(authorId);
      
      let res = await relationHandler.performAction(banMode, authorId);

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
      chrome.runtime.sendMessage(null, {"notification":{"status":"error_NoAccount"}}, function(response) {
        let lastError = chrome.runtime.lastError;
      });
      log.err("Program has been finished (error_NoAccount)");
      return;
    }
    
    for (let i = 0; i < authorNameList.length; i++)
    {
      if(programController.earlyStop)
        break;
      let authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(authorNameList[i]);
      let res = await relationHandler.performAction(banMode, authorId);
      authorIdList.push(authorId);
      
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
    let authorListObj = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage(); // names and ids will be scraped
    authorNameList = authorListObj.authorNameList;
    authorIdList = authorListObj.authorIdList;
    
    // stop if there is no user
    log.info("number of user to ban " + authorNameList.length);
    if(authorNameList.length === 0)
    {
      chrome.runtime.sendMessage(null, {"notification":{"status":"error_NoAccount"}}, function(response) {
        let lastError = chrome.runtime.lastError;
      });
      log.err("Program has been finished (error_NoAccount)");
      return;
    }
    
    for (let i = 0; i < authorIdList.length; i++)
    {
      if(programController.earlyStop)
        break;
      
      let res = await relationHandler.performAction(banMode, authorIdList[i]);
      
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
  
  log.info("Program has been finished (successfull:" + successfulAction + ", performed:" + performedAction + ", planned:" + authorNameList.length + ")");
  // send message to notification page
  chrome.runtime.sendMessage(null, {"notification":{status:"finished", successfulAction:successfulAction, performedAction:performedAction, plannedAction:authorNameList.length}}, function(response) {
    let lastError = chrome.runtime.lastError;
  });
  
  programController.earlyStop = false; // reset to reuse
  log.resetData();
}

// this listener fired every time when the extension installed or updated.
chrome.runtime.onInstalled.addListener(async (details) => 
{
  log.info("bg: program installed or updated.");
  
  await handleConfig();
});
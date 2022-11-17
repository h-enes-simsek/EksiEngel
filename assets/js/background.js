'use strict';

import * as enums from './enums.js';
import * as utils from './utils.js';
import {config, getConfig, saveConfig} from './config.js';
import {log} from './log.js';
import {CommHandler} from './commHandler.js';
import {RelationHandler} from './relationHandler.js';
import {ScrapingHandler} from './scrapingHandler.js';

let relationHandler = new RelationHandler();
let scrapingHandler = new ScrapingHandler();
let commHandler = new CommHandler();

log.info("bg: init.");
let g_isProgramActive = false; // to prevent multiple starts from gui
let g_earlyStop = false;       // to stop the process early 

chrome.runtime.onMessage.addListener(async function messageListener_Popup(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	const obj = utils.filterMessage(message, "banSource", "banMode");
	if(obj.resultType === enums.ResultType.FAIL)
		return;
	
	if(g_isProgramActive)
	{
		log.info("bg: another start attempt from " + obj.banSource);
	}
	else 
	{
		g_isProgramActive = true; // prevent multiple starts
    await processHandler(obj.banSource, obj.banMode, obj.entryUrl);
		g_isProgramActive = false; // program can be started again
	}
});

async function processHandler(banSource, banMode, entryUrl)
{
  log.info("Program has been started with banSource: " + banSource + ", banMode: " + banMode);
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/notification.html") });
  
  let authorNameList = [];
  let authorIdList = [];
  let entryMetaData = {};
  
  relationHandler.reset(); // reset the counters to reuse
  g_earlyStop = false;

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
      if(g_earlyStop)
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
          console.info("relationHandler: notification page is probably closed, early stop will be generated automatically.");
          g_earlyStop = true;
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
      if(g_earlyStop)
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
          console.info("relationHandler: notification page is probably closed, early stop will be generated automatically.");
          g_earlyStop = true;
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
      if(g_earlyStop)
        break;
      
      let res = await relationHandler.performAction(banMode, authorIdList[i]);
      
      // send message to notification page
      chrome.runtime.sendMessage(null, {"notification":{status:"ongoing", successfulAction:res.successfulAction, performedAction:res.performedAction, plannedAction:authorIdList.length}}, function(response) {
        let lastError = chrome.runtime.lastError;
        if (lastError) 
        {
          // 'Could not establish connection. Receiving end does not exist.'
          console.info("relationHandler: notification page is probably closed, early stop will be generated automatically.");
          g_earlyStop = true;
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
    is_early_stopped: g_earlyStop
  };

  if(config.sendData)
    await commHandler.sendData(dataToSend);
  
  log.info("Program has been finished (successfull:" + successfulAction + ", performed:" + performedAction + ", planned:" + authorNameList.length + ")");
  // send message to notification page
  chrome.runtime.sendMessage(null, {"notification":{status:"finished", successfulAction:successfulAction, performedAction:performedAction, plannedAction:authorNameList.length}}, function(response) {
    let lastError = chrome.runtime.lastError;
  });
}

// this listener fired every time when the extension installed or updated.
chrome.runtime.onInstalled.addListener(async (details) => 
{
  log.info("bg: program installed or updated.");
  
  // if config is not exist in storage, save the default config to storage
  let c = await getConfig();
  if(c)
  {
    log.info("bg: there is a config in local storage: " + JSON.stringify(c));
  }
  else
  {
    log.info("bg: default config saved into storage.");
    saveConfig(config);
  }
});

// listen notification to detect early stop
chrome.runtime.onMessage.addListener(async function messageListener_Notifications(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	const obj = utils.filterMessage(message, "earlyStop");
	if(obj.resultType === enums.ResultType.FAIL || !g_isProgramActive)
		return;

  log.info("bg: early stop received.");
  g_earlyStop = true;
});
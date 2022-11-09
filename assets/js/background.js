'use strict';

try {
  importScripts("enums.js", "config.js", "log.js");
} catch (error) {
  console.error(error);
}

// log.js will be imported first, so others can use logger
let log = new Log();
log.setEnableStatus(config.enableLog);
log.setLogConsole(config.logConsole);
log.setlevel = Log.Levels.INFO;
log.info("bg: init");

try {
	importScripts("redirectHandler.js", "commHandler.js", "utils.js", "backgroundUndobanAll.js");
} catch (error) {
	console.error(error);
}

let redirectHandler = new RedirectHandler();
let commHandler = new CommHandler(log);

let g_isProgramActive = false;        // to prevent multiple starts from gui
let g_earlyStopCommand = false;       // early stop command might be recevied from gui to stop program execution
let g_tabId = -1;                     // tab id of the new tab (will be assigned by browser)

let g_counter = 0;                    // number of times the page is loaded (for every author's page)
let g_latestContentScriptInfo = "";   // JSON Obj, info about latest executed content script
let g_url = "";                       // target url
let g_isTabClosedByUser = false;      // user might close the tab before program finished
let g_isBanUserSuccessfull = false;   // is target user banned successfully
let g_isBanTitleSuccessfull = false;  // is target user's titles banned succesfully
let g_resolveSelectiveBanProcess;     // function, resolve function of process_SelectiveBan's promise
let g_rejectSelectiveBanProcess;      // function, reject function of process_SelectiveBan's promise
let g_isFirstAuthor = true;           // is the program tries to ban the first user in list
let g_clientName = "";                // client's author name
let g_clientUserAgent = "";           // client's user agent
let g_banMode = BanMode.BAN;		    	// mode of the program, will ban or undoban
let g_banSource = BanSource.FAV;		  // band source of the program

chrome.runtime.onMessage.addListener(async function messageListener_Popup(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	const obj = filterMessage(message, "banSource", "banMode");
	if(obj.resultType !== ResultType.SUCCESS)
		return;
	
	if(g_isProgramActive)
	{
		log.info("bg: another start attempt from " + obj.banSource);
	}
	else 
	{
		g_isProgramActive = true; // prevent multiple starts
		
		if(obj.banSource === BanSource.FAV && obj.banMode === BanMode.BAN)
		{
			// list is exist in storage
			await processHandler_SelectiveBan(BanSource.FAV, BanMode.BAN);
		}
    else if(obj.banSource === BanSource.LIST && obj.banMode === BanMode.BAN)
    {
      // list is exist in storage
			await processHandler_SelectiveBan(BanSource.LIST, BanMode.BAN);
    }
		else if(obj.banSource === BanSource.LIST && obj.banMode === BanMode.UNDOBAN)
		{
			// list is exist in storage
			await processHandler_SelectiveBan(BanSource.LIST, BanMode.UNDOBAN);
		}
		else if(obj.banSource === BanSource.UNDOBANALL && obj.banMode === BanMode.UNDOBAN)
		{
			await processHandler_UndobanAll();
		}
		
		g_isProgramActive = false; // program can be started again
	}
});

async function processHandler_SelectiveBan(banSource, mode=BanMode.BAN)
{
  log.info("Program has been started with mode: " + mode);
  
  let userListArray = await getUserList();
  let userListArrayId = [];
  log.info("number of user to ban (before cleaning): " + userListArray.length);
  cleanUserList(userListArray);
  log.useful("number of user to ban (after cleaning): " + userListArray.length);
	
  let objToSendServer = {};
	let favAuthorName, favAuthorId, favTitleName, favTitleId, favEntryId;
	if(banSource === BanSource.FAV)
	{
		let favBanMetaData = await getFavBanMetaData();
		if(!favBanMetaData)
		{
			log.err("bg: favBanMetaData could not obtained from storage.");
		}
		else
		{
      objToSendServer.fav_author_name = favBanMetaData.favAuthorName;
			objToSendServer.fav_author_id = favBanMetaData.favAuthorId;
			objToSendServer.fav_title_name = favBanMetaData.favTitleName;
			objToSendServer.fav_title_id = favBanMetaData.favTitleId;
			objToSendServer.fav_entry_id = favBanMetaData.favEntryId;
		}
	}
  
  if(userListArray.length == 0){
    makeNotification("Programı kullanmak için yazar ekleyin.");
    log.err("Program has been finished (getUserList function failed)");
  }
  else{
    // register function to call every time a page is closed
    chrome.tabs.onRemoved.addListener(pageCloseListener);
    
    // register function to call every time the page is updated
    // Note: chrome.tabs.onUpdated doesn't work properly
    chrome.webNavigation.onDOMContentLoaded.addListener(DOMContentLoadedListener)
    
    // register function to call every time a content script sends a message
    chrome.runtime.onMessage.addListener(contentScriptMessageListener);
    
    RedirectHandler.prepareHandler();
    g_tabId = -1; // clear variable
    g_isFirstAuthor = true;
		g_banMode = mode;
		g_banSource = banSource;
    
    let totalAction = 0;
    let successfullBans = 0;
    let pageResult;
    for(let i = 0; i < userListArray.length; i++) {
      
      pageResult = await process_SelectiveBan(userListArray[i]); // navigate to next url
      
      // early stop mechanism
      if(g_earlyStopCommand) 
      {
        break;
      }

      if(pageResult.result === ResultType.SUCCESS){
        successfullBans++;
        log.info("page result: success (" + userListArray[i] +")");
      } else {
        log.info("page result: fail (" + userListArray[i] +")");
      }
      userListArrayId[i] = pageResult.userId;
      totalAction++;
    }
    
    log.info("contentScriptMessageListener removed.");
    chrome.runtime.onMessage.removeListener(contentScriptMessageListener);
    
    log.info("DOMContentLoadedListener removed.");
    chrome.tabs.onUpdated.removeListener(DOMContentLoadedListener);
    
    log.info("pageCloseListener removed.");
    chrome.tabs.onRemoved.removeListener(pageCloseListener);
		
		await closeLastTab(pageResult.tabID);

		if(mode === BanMode.BAN)
		{
			makeNotification(userListArray.length + ' kisilik listedeki ' + successfullBans + ' kisi engellendi.');
			log.useful("Program has been finished (banned:" + successfullBans + ", total:" + userListArray.length + ")");
		}
		else if(mode === BanMode.UNDOBAN)
		{
			makeNotification(userListArray.length + ' kisilik listedeki ' + successfullBans + ' kisinin engeli kaldirildi.');
			log.useful("Program has been finished (unbanned:" + successfullBans + ", total:" + userListArray.length + ")");
		}
    
    
		if(config.sendData)
    {
		  objToSendServer.client_name = g_clientName;
		  objToSendServer.user_agent = g_clientUserAgent;
		  objToSendServer.ban_source = banSource;
		  objToSendServer.ban_mode = mode;
		  objToSendServer.author_name_list = userListArray;
		  objToSendServer.author_id_list = userListArrayId;
      objToSendServer.author_list_size = userListArray.length;
      objToSendServer.total_action = totalAction;
      objToSendServer.successful_action = successfullBans;
      objToSendServer.is_early_stopped = g_earlyStopCommand ? 1 : 0;
      
      await commHandler.sendData(config, objToSendServer)
    }
    
    // reset logger not to save duplicated values
    log.resetData();
    
    // clear to reuse this variable
    g_earlyStopCommand = false; 
  }  
}

// this function will be called every time any page is closed (iframes will call as well)
function pageCloseListener(tabid, removeInfo)
{
  if(g_tabId === tabid && !g_isTabClosedByUser)
  {
    // this is required because chrome.tabs.onRemoved fired multiple times
    // each by main page and iframes
    g_isTabClosedByUser = true;
    
    log.info("tab " + tabid + " closed by user");
    log.info("automatically early stop command was generated to stop the process.")
    g_earlyStopCommand = true;
      
    // resolve Promise after content script has executed
    g_resolveSelectiveBanProcess({result:ResultType.FAIL, tabID: g_tabId, userId: 0});
  }
}

// this function will be called every time any page is updated (when domcontent loaded)
function DOMContentLoadedListener(details) 
{
  // filter other page updates by using tab id
  if(details.tabId === g_tabId && decodeURIComponentForEksi(details.url) === g_url) {
    g_counter++;
    log.info("g_counter: " + g_counter + " tab id: "+ details.tabId + " frame id: " + details.frameId + " url: " + details.url);
    
    // outgoing values to content script
    let executeOp = "";
    let executeTarget = "";
    
    if(g_counter === 1){
      RedirectHandler.stopRedirectTimer();
			if(g_isFirstAuthor)
			{
				g_isFirstAuthor = false;
				chrome.scripting.executeScript({
					target: {tabId: g_tabId, frameIds: [0]}, // frame 0 is the main frame, there may be other frames (ads, google analytics etc)
					files: ["assets/js/contentScript_ScrapeClientData.js"]},
					()=>
					{
						log.info("contentScript_ScrapeClientData.js has been executed.");
						// execute content script to ban user
						executeOp = OpMode.ACTION;
						executeTarget = TargetType.USER;
						executeContentScript(g_banSource, executeOp, g_banMode, executeTarget);
					}
				);
			}
			else
			{
				// execute content script to ban user
				executeOp = OpMode.ACTION;
				executeTarget = TargetType.USER;
				executeContentScript(g_banSource, executeOp, g_banMode, executeTarget);
			}
    }
    else{
      log.info("DOMContentLoadedListener: unhandled g_latestContentScriptInfo: " + JSON.stringify(g_latestContentScriptInfo));
    }
  }
}

// this function will be called every time a content script sends a message
function contentScriptMessageListener(message, sender, sendResponse) 
{
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
  
  //log.info("contentScriptMessageListener:: incoming msg: " + message);
  
  // incoming values from content script
  let incomingObj;
  try
  {
    incomingObj = JSON.parse(message);
  }
  catch(e)
  {
    log.info("contentScriptMessageListener:: parse err: " + e);
    return;
  }
	
	if("clientName" in incomingObj || "userAgent" in incomingObj)
	{
		if(!incomingObj.clientName)
		{
			makeNotification("Ekşi Sözlük hesabınıza giriş yaptınız mı?");
			log.warn("contentScriptMessageListener:: client_name couldn't be obtained, maybe not logged in.");
			g_earlyStopCommand = true;
		}
		g_clientName = incomingObj.clientName;
		g_clientUserAgent = incomingObj.userAgent;
		log.useful("contentScriptMessageListener:: client name: " + g_clientName);
		log.useful("contentScriptMessageListener:: user agent: " + g_clientUserAgent);
		return;
	}
	
	if("banSource" in incomingObj)
	{
		if(incomingObj.banSource === BanSource.FAV || incomingObj.banSource === BanSource.LIST)
			;
		else
		{
			log.info("contentScriptMessageListener:: unhandled msg: " + message);
			return;
		}	
	}
	
	if("resultType" in incomingObj && "banMode" in incomingObj && "userId" in incomingObj)
	{
		let resultType = incomingObj.resultType;
		let banMode = incomingObj.banMode; // no need
		
		if(resultType === ResultType.SUCCESS){
			g_resolveSelectiveBanProcess({result: ResultType.SUCCESS, tabID: g_tabId, userId: incomingObj.userId});
		}
		else {
			g_resolveSelectiveBanProcess({result: ResultType.FAIL, tabID: g_tabId, userId: incomingObj.userId});
		}
	}
  else 
	{
    log.info("contentScriptMessageListener:: unhandled msg: " + message);
  }  
}

async function process_SelectiveBan(userName) 
{
  return new Promise(async function(resolve, reject) {
    g_resolveSelectiveBanProcess = resolve;
    g_rejectSelectiveBanProcess = reject;
    
		g_url = "https://eksisozluk.com/biri/" + userName;
    log.info("page processing started for " + g_url);
    
    g_counter = 0; // reset
    g_latestContentScriptInfo = ""; // reset
    g_isBanUserSuccessfull = false;
    g_isBanTitleSuccessfull = false;
    g_isTabClosedByUser = false;
    
    g_tabId = await RedirectHandler.handleTabOperations(g_url);
  });
}

async function executeContentScript(source, op, mode, target)
{
  return new Promise(async (resolve, reject) => {
    let configText = source + " " + op + " " + mode + " " + target;
    log.info("content script will be exed " + configText);
    
    let isTabExist = await isTargetTabExist(g_tabId);
    if(!isTabExist)
    {
      log.err("content script could not be executed. target tab is not exist. tab: " + g_tabId + " content: " + configText);
      return resolve(false);
    }
    
    // frame 0 is the main frame, there may be other frames (ads, google analytics etc)
    chrome.scripting.executeScript(
      {
        // firstly this code will be executed
        target: {tabId: g_tabId, frameIds: [0]}, 
        func: (_BanSource, _OpMode, _BanMode, _TargetType, _ResultType, _source, _op, _mode, _target)=>
        {
					// enum values
					window.enumEksiEngelBanSource= _BanSource;
					window.enumEksiEngelOpMode = _OpMode;
					window.enumEksiEngelBanMode = _BanMode;
					window.enumEksiEngelTargetType = _TargetType;
					window.enumEksiEngelResultType = _ResultType;
					
					// configured values in enums
					window.configEksiEngelBanSource = _source;
          window.configEksiEngelOp = _op;
          window.configEksiEngelMode = _mode;
          window.configEksiEngelTarget = _target;
        },
        args: [BanSource, OpMode, BanMode, TargetType, ResultType, source, op, mode, target]
      }, 
      ()=>
      {
        if(chrome.runtime.lastError) 
        {
          log.err("content script could not be executed(part1), content: " + configText + " err: " + chrome.runtime.lastError.message);
          return resolve(false); // parent function will continue executing
        }
        
        // secondly this file will be executed
        chrome.scripting.executeScript(
          {
            target: {tabId: g_tabId, frameIds: [0]},
            files: ["assets/js/contentScript_SelectiveBan.js"]
          }, 
          ()=>
          {
            if(chrome.runtime.lastError) 
            {
              log.err("content script could not be executed(part2), content: " + configText + " err: " + chrome.runtime.lastError.message);
              return resolve(false); // parent functions will continue executing
            } 
            else 
            {
              log.info("content script has been executed, content: " + configText);
              return resolve(true); // parent functions will continue executing
            }
          }
        );
      }
    );
  });
}
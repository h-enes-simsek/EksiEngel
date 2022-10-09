'use strict';
console.log("bg: init");

try {
  importScripts("redirectHandler.js", "utils.js");
} catch (error) {
  console.error(error);
}

let redirectHandler = new RedirectHandler();

let g_isProgramActive = false;        // to prevent multiple starts from gui
let g_earlyStopCommand = false;       // early stop command might be recevied from gui to stop program execution
let g_tabId = -1;                     // tab id of the new tab (will be assigned by browser)

let g_counter = 0;                    // number of times the page is loaded (for every author's page)
let g_latestContentScriptInfo = "";   // JSON Obj, info about latest executed content script
let g_url = "";                       // target url
let g_isTabClosedByUser = false;      // user might close the tab before program finished
let g_isBanUserSuccessfull = false;   // is target user banned successfully
let g_isBanTitleSuccessfull = false;  // is target user's titles banned succesfully
let g_ResolvePageProcess;             // function, resolve function of page process's promise
let g_rejectPageProcess;              // function, reject function of page process's promise
let g_isFirstAuthor = true;           // is the program tries to ban the first user in list
let g_clientName = "";                // client's author name
    
chrome.runtime.onMessage.addListener(async function popupMessageListener(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
  if((message === 'scrapeAuthors::start' || message === 'authorListPage::start'))
  { 
    if(g_isProgramActive)
    {
      console.log("bg.js: another start attempt from " + message);
    }
    else 
    {
      g_isProgramActive = true; // prevent multiple starts
      await startProcess();
      g_isProgramActive = false; // program can be started again
    }
  } 
});

async function startProcess()
{
  console.log("Program has been started.");
  
  let userListArray = await getUserList(); 
  console.log("number of user to ban (before cleaning): " + userListArray.length);
  cleanUserList(userListArray);
  console.log("number of user to ban (after cleaning): " + userListArray.length);
  
  if(userListArray.length == 0){
    makeNotification("Eklenti ayarlarından engellenecek yazarları ekleyin.");
    console.log("Program has been finished (getUserList function failed)");
  }
  else{
    // register function to call every time a page is closed
    chrome.tabs.onRemoved.addListener(PageCloseListener);
    
    // register function to call every time the page is updated
    // Note: chrome.tabs.onUpdated doesn't work properly
    chrome.webNavigation.onDOMContentLoaded.addListener(DOMContentLoadedListener)
    
    // register function to call every time a content script sends a message
    chrome.runtime.onMessage.addListener(ContentScriptMessageListener);
    
    RedirectHandler.prepareHandler();
    g_tabId = -1; // clear variable
    g_isFirstAuthor = true;
    
    let successfullBans = 0;
    let pageResult;
    for(let i = 0; i < userListArray.length; i++) {
      
      g_url = userListArray[i];
      pageResult = await pageProcess(userListArray[i]); // navigate to next url
      
      if(pageResult.result === "promise::success"){
        successfullBans++;
        console.log("page result: success (" + userListArray[i] +")");
      } else {
        console.log("page result: fail (" + userListArray[i] +")");
      }
      
      // early stop mechanism
      if(g_earlyStopCommand) {
        g_earlyStopCommand = false; // clear to reuse this variable
        break;
      }
    }
    
    console.log("ContentScriptMessageListener removed.");
    chrome.runtime.onMessage.removeListener(ContentScriptMessageListener);
    
    console.log("DOMContentLoadedListener removed.");
    chrome.tabs.onUpdated.removeListener(DOMContentLoadedListener);
    
    console.log("PageCloseListener removed.");
    chrome.tabs.onRemoved.removeListener(PageCloseListener);

    makeNotification(userListArray.length + ' kisilik listedeki ' + successfullBans + ' kisi engellendi.');
    console.log("Program has been finished (banned:" + successfullBans + ", total:" + userListArray.length + ")");
    
    await closeLastTab(pageResult.tabID);   
  }  
}

// this function will be called every time any page is closed (iframes will call as well)
function PageCloseListener(tabid, removeInfo)
{
  if(g_tabId === tabid && !g_isTabClosedByUser)
  {
    // this is required because chrome.tabs.onRemoved fired multiple times
    // each by main page and iframes
    g_isTabClosedByUser = true;
    
    console.log("tab " + tabid + " closed by user");
    console.log("automatically early stop command was generated to stop the process.")
    g_earlyStopCommand = true;
      
    // resolve Promise after content script has executed
    g_ResolvePageProcess({result:"promise::fail", tabID: g_tabId});
  } 
}

// this function will be called every time any page is updated (when domcontent loaded)
function DOMContentLoadedListener(details) {
  
  // filter other page updates by using tab id
  if(details.tabId === g_tabId && decodeURIComponentForEksi(details.url) === g_url) {
    g_counter++;
    console.log("g_counter: " + g_counter + " tab id: "+ details.tabId + " frame id: " + details.frameId + " url: " + details.url);
    
    // saved values from latest executed content script
    let res = g_latestContentScriptInfo.res;
    let op = g_latestContentScriptInfo.op;
    let mode = g_latestContentScriptInfo.mode;
    let target = g_latestContentScriptInfo.target;
    
    // outgoing values to content script
    let executeOp = "";
    let executeMode = "";
    let executeTarget = "";
    
    
    if(g_counter === 1){
      RedirectHandler.stopRedirectTimer();
			if(g_isFirstAuthor)
			{
				g_isFirstAuthor = false;
				chrome.scripting.executeScript({
					target: {tabId: g_tabId, frameIds: [0]}, // frame 0 is the main frame, there may be other frames (ads, google analytics etc)
					files: ["assets/js/scrapeClientName.js"]},
					()=>
					{
						console.log("scrapeClientName.js has been executed.");
						// execute content script to ban user
						executeOp = "op::action";
						executeMode = "mode::ban";
						executeTarget = "target::user";
						executeContentScript(executeOp, executeMode, executeTarget);
					}
				);
				
			}
			else
			{
				// execute content script to ban user
				executeOp = "op::action";
				executeMode = "mode::ban";
				executeTarget = "target::user";
				executeContentScript(executeOp, executeMode, executeTarget);
			}
      
    }
    else if(op === "op::action" && mode === "mode::ban" && target === "target::user" && res === "res::success"){
      // res::fail will be handled by ContentScriptMessageListener
      executeOp = "op::control";
      executeMode = "mode::ban";
      executeTarget = "target::user";
      executeContentScript(executeOp, executeMode, executeTarget);
    }
    else if(op === "op::action" && mode === "mode::ban" && target === "target::title" && res === "res::success"){
      // res::fail will be handled by ContentScriptMessageListener
      executeOp = "op::control";
      executeMode = "mode::ban";
      executeTarget = "target::title";
      executeContentScript(executeOp, executeMode, executeTarget);
    }
    else{
      console.log("DOMContentLoadedListener: unhandled g_latestContentScriptInfo: " + JSON.stringify(g_latestContentScriptInfo));
    }
    
  }
}

// this function will be called every time a content script sends a message
function ContentScriptMessageListener(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
  
  console.log("ContentScriptMessageListener:: incoming msg: " + message);
  
  // incoming values from content script
  let incomingObj;
  try
  {
    incomingObj = JSON.parse(message);
  }
  catch(e)
  {
    console.log("ContentScriptMessageListener:: parse err: " + e);
    return;
  }
	
	if(incomingObj.clientName)
	{
		g_clientName = incomingObj.clientName;
		console.log("ContentScriptMessageListener:: client name: " + g_clientName);
		return;
	}
	
  let res = incomingObj.res;
  let op = incomingObj.op;
  let mode = incomingObj.mode;
  let target = incomingObj.target;
  
  // outgoing values to content script
  let executeOp = "";
  let executeMode = "";
  let executeTarget = "";
  
  // update status to track (it should be filtered, because popup messages interferes)
  if(res && op && mode && target)
    g_latestContentScriptInfo = JSON.parse(message); 
  
  if(op === "op::action" && mode === "mode::ban" && target === "target::user" && res === "res::fail"){
    // res::success will be handled by DOMContentLoadedListener
    executeOp = "op::control";
    executeMode = "mode::ban";
    executeTarget = "target::user";
    executeContentScript(executeOp, executeMode, executeTarget);
  }
  else if(op === "op::control" && mode === "mode::ban" && target === "target::user"){
    g_isBanUserSuccessfull = res === "res::success";
    // execute content to ban title after banning user and controlling is user banned
    executeOp = "op::action";
    executeMode = "mode::ban";
    executeTarget = "target::title";
    executeContentScript(executeOp, executeMode, executeTarget);
  }
  else if(op === "op::action" && mode === "mode::ban" && target === "target::title" && res === "res::fail"){
    // res::success will be handled by DOMContentLoadedListener
    // execute content script to check if banning the title was successfull
    executeOp = "op::control";
    executeMode = "mode::ban";
    executeTarget = "target::title";
    executeContentScript(executeOp, executeMode, executeTarget);
  }
  else if(op === "op::control" && mode === "mode::ban" && target === "target::title"){
    //all actions have been completed.
    
    g_isBanTitleSuccessfull = res === "res::success"; 
      
    // resolve Promise after content script has executed
    if(g_isBanUserSuccessfull && g_isBanTitleSuccessfull){
      g_ResolvePageProcess({result:"promise::success", tabID: g_tabId});
    }
    else {
      g_ResolvePageProcess({result:"promise::fail", tabID: g_tabId});
    }
    
  }
  else {
    console.log("ContentScriptMessageListener:: unhandled msg: " + message);
  }  
}

async function pageProcess(url) {
  return new Promise(async function(resolve, reject) {
    g_ResolvePageProcess = resolve;
    g_rejectPageProcess = reject;
    
    console.log("page processing started for " + url);
    
    g_counter = 0; // reset
    g_latestContentScriptInfo = ""; // reset
    g_isBanUserSuccessfull = false;
    g_isBanTitleSuccessfull = false;
    g_isTabClosedByUser = false;
    
    g_tabId = await RedirectHandler.handleTabOperations(url);
  });
}

async function executeContentScript(op, mode, target)
{
  return new Promise(async (resolve, reject) => {
    let configText = op + " " + mode + " " + target;
    console.log("content script will be exed " + configText);
    
    let isTabExist = await isTargetTabExist(g_tabId);
    if(!isTabExist)
    {
      console.log("content script could not be executed. target tab is not exist. tab: " + g_tabId + " content: " + configText);
      return resolve(false);
    }
    
    // frame 0 is the main frame, there may be other frames (ads, google analytics etc)
    chrome.scripting.executeScript(
      {
        // firstly this code will be executed
        target: {tabId: g_tabId, frameIds: [0]}, 
        func: (_op, _mode, _target)=>
        {
          window.configEksiEngelOp = _op;
          window.configEksiEngelMode = _mode;
          window.configEksiEngelTarget = _target;
        },
        args: [op, mode, target]
      }, 
      ()=>
      {
        if(chrome.runtime.lastError) 
        {
          console.log("content script could not be executed(part1), content: " + configText + " err: " + chrome.runtime.lastError.message);
          return resolve(false); // parent function will continue executing
        }
        
        // secondly this file will be executed
        chrome.scripting.executeScript(
          {
            target: {tabId: g_tabId, frameIds: [0]},
            files: ["assets/js/ban.js"]
          }, 
          ()=>
          {
            if(chrome.runtime.lastError) 
            {
              console.log("content script could not be executed(part2), content: " + configText + " err: " + chrome.runtime.lastError.message);
              return resolve(false); // parent functions will continue executing
            } 
            else 
            {
              console.log("content script has been executed, content: " + configText);
              return resolve(true); // parent functions will continue executing
            }
          }
        );
      }
    );
  });
}
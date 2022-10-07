'use strict';

console.log("background.js has been started.");

let g_isProgramActive = false; // track g_isProgramActive info to prevent multiple starts from gui
let g_earlyStopCommand = false; // early stop command might be recevied from gui to stop program execution
let g_tabId = -1; // chrome assigns an id for every tab 
let g_counter = 0; // number of times the page is loaded
let g_latestContentScriptInfo = ""; // JSON Obj, info about latest executed content script
let g_url = "";
let g_isTabClosedByUser = false;
let g_isBanUserSuccessfull = false;
let g_isBanTitleSuccessfull = false;
let g_ResolvePageProcess; // resolve function of page process's promise
let g_rejectPageProcess; // reject function of page process's promise
let g_isFirstAuthor = true;
let g_clientName = "";
    
// listen popup.js for runtime messages
chrome.runtime.onMessage.addListener(function popupMessageListener(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
  if((message === 'scrapAuthors::start' || message === 'authorListPage::start') && !g_isProgramActive)
  { 
    g_isProgramActive = true; // this will prevent multiple start from gui
    console.log("Program has been started.");
    startProcess();
  } 
});

async function startProcess()
{
  g_tabId = -1; // clear variable
	g_isFirstAuthor = true;
  
  let userListArray = await getUserList(); 
  console.log("number of user to ban (before cleaning): " + userListArray.length);
  cleanUserList(userListArray);
  console.log("number of user to ban (after cleaning): " + userListArray.length);
  
  if(userListArray.length == 0){
    makeNotification("Eklenti ayarlarından engellenecek yazarları ekleyin.");
    console.log("Program has been finished (getUserList function failed)");
  }
  else{
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

    makeNotification(userListArray.length + ' kisilik listedeki ' + successfullBans + ' kisi engellendi.');
    closeLastTab(pageResult.tabID);   
    console.log("Program has been finished (banned:" + successfullBans + ", total:" + userListArray.length + ")");    
  }
  g_isProgramActive = false; // program can be started again from gui  
}

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
    
    // last actions should be taken to properly stop process
    
    // remove onMessage event as it may get duplicated
    console.log("ContentScriptMessageListener removed.");
    chrome.runtime.onMessage.removeListener(ContentScriptMessageListener);
    
    // remove tab onUpdate event to prevent duplicated listener
    console.log("DOMContentLoadedListener removed.");
    chrome.tabs.onUpdated.removeListener(DOMContentLoadedListener);
      
    // resolve Promise after content script has executed
    g_ResolvePageProcess({result:"promise::fail", tabID: g_tabId});
    
  } 
}

// this function will be called every time any page is updated (when domcontent loaded)
function DOMContentLoadedListener(details) {
  
  // saved values from latest executed content script
  let res = g_latestContentScriptInfo.res;
  let op = g_latestContentScriptInfo.op;
  let mode = g_latestContentScriptInfo.mode;
  let target = g_latestContentScriptInfo.target;
  
  // outgoing values to content script
  let executeOp = "";
  let executeMode = "";
  let executeTarget = "";
  
  // filter other page updates by using tab id
  if(details.tabId === g_tabId && decodeURIComponentForEksi(details.url) === g_url) {
    g_counter++;
    console.log("g_counter: " + g_counter + " tab id: "+ details.tabId + " frame id: " + details.frameId + " url: " + details.url);
    
    if(g_counter === 1){
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
    
    // remove onMessage event as it may get duplicated
    console.log("ContentScriptMessageListener removed.");
    chrome.runtime.onMessage.removeListener(ContentScriptMessageListener);
    
    // remove tab onUpdate event to prevent duplicated listener
    console.log("DOMContentLoadedListener removed.");
    chrome.tabs.onUpdated.removeListener(DOMContentLoadedListener);
    
    // remove tab close event listener to prevent starting the process 'early stop' caused by usual closed tabs
    console.log("PageCloseListener removed.");
    chrome.tabs.onRemoved.removeListener(PageCloseListener);
      
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
    
    // register function to call every time a page is closed (will be called multiple times because of iframes)
    chrome.tabs.onRemoved.addListener(PageCloseListener);
    
    // register function to call every time the page is updated
    // chrome.tabs.onUpdated.addListener(DOMContentLoadedListener);
    chrome.webNavigation.onDOMContentLoaded.addListener(DOMContentLoadedListener)
    
    // register function to call every time a content script sends a message
    chrome.runtime.onMessage.addListener(ContentScriptMessageListener);
    
    await handleTabOperations(url);

  });
}

  

/* <---------------------------     UTILS     --------------------------------------> */
/* <--------------------------------------------------------------------------------> */
/* <--------------------------------------------------------------------------------> */

async function handleTabOperations(url)
{
    if(g_tabId === -1){
      // create new tab when program started
      g_tabId = await createNewTab(url);
      return 0;
    }
    else{
      chrome.tabs.query({}, async function(tabs) {
        
        for (let tab of tabs) {
          if(tab.id == g_tabId){
            // the tab that was opened by this program exist, redirect the tab to a new url
            await redirectNewURL(url, g_tabId);
            return 0;
          }
        }
        
        // the tab that was opened by this program not exist (possibly closed by user), create a new tabID
        console.log("previous tab is closed, so new tab will be opened.");
        g_tabId = await createNewTab(url);
        return 0;
      }); 
    }
}

// input: url string
// output: tab id of the new tab opened
async function createNewTab(url)
{
  return new Promise((resolve, reject) => {
    // active:false means, it will not be focused
    chrome.tabs.create({url: url, active: false}, function(newTab) {
      resolve(newTab.id);
    });
  });
}

// input: url string, tab_id
// output: - (promise)
async function redirectNewURL(url, tab_id)
{
  return new Promise((resolve, reject) => {
    // active:false means, it will not be focused
    chrome.tabs.update(tab_id, {url: url, active: false}, function(newTab) {
      resolve();
    });
  });
}

// backgroung.js dont have a html page so cannot alert, instead notifications can be used
function makeNotification(message)
{
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../img/eksiengel16.png',
    title: 'Notification',
    message: message,
    priority: 1
  });
}

// clean collected user list by erasing empty inputs 
// convert nicknames to the url
// whitespaces should be - according to ekşisözlük name rules
function cleanUserList(arr)
{
  for(let i = arr.length - 1; i >= 0; i--) 
  {
    // if empty, delete it
    if(arr[i] == ''){
      arr.splice(i, 1); // remove ith element
    }
    else{
      // replace every whitespace with -
      arr[i] = arr[i].replace(/ /gi, "-");
      
      // convert nickname to the url
      arr[i] = "https://eksisozluk.com/biri/" + arr[i];
    }
  }
}

function closeLastTab(target_tab_id)
{
  let isTabExist = false; // somehow last tab could be closed already
  chrome.tabs.query({}, function(tabs) {
    // access all the open tabs and compare
    for (let tab of tabs) {
      if(tab.id == target_tab_id){
        isTabExist = true;
        console.log("last tab will be closed");
        chrome.tabs.remove(tab.id); // close last tab
      }
    }
    if(!isTabExist){
      console.log("Last tab could not be closed. (may be already closed)");
    }
  }); 
}

// get userList from storage api
// output: array (if fails, returns empty array)
async function getUserList()
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("userList", function(items){
      if(!chrome.runtime.error)
      {
        if(items != undefined && items.userList != undefined)
        {
          resolve(items.userList.split("\n"));  
        }
        else 
        {
          console.log("empty list from storage api");
          resolve([]);
        }
      }
      else 
      {
        console.log("chrome.storage.local runtime err");
        makeNotification("chrome.storage.local runtime hatası");
        resolve([]);
      }
    }); 
  });
}

// example input: abc%20def%21gh
// output: abc-def!gh
function decodeURIComponentForEksi(url)
{
  let decodedUrl = decodeURIComponent(url);
  // replace every whitespace with - (eksisozluk.com convention)
  decodedUrl.replace(/ /gi, "-");
  return decodedUrl;
}

function executeContentScript(op, mode, target)
{
  let configText = op + " " + mode + " " + target;
  console.log("content script will be exed " + configText);
  chrome.scripting.executeScript({
      target: {tabId: g_tabId, frameIds: [0]}, // frame 0 is the main frame, there may be other frames (ads, google analytics etc)
      func: (_op, _mode, _target)=>{
                  window.configEksiEngelOp = _op;
                  window.configEksiEngelMode = _mode;
                  window.configEksiEngelTarget = _target;
                },
      args: [op, mode, target]
    }, // firstly this code will be executed
    ()=>{
      chrome.scripting.executeScript({
        target: {tabId: g_tabId, frameIds: [0]}, // frame 0 is the main frame, there may be other frames (ads, google analytics etc)
        files: ["assets/js/ban.js"] }, // secondly this file will be executed
        ()=>{printExecuteScriptResult(configText); // callback function
      });
    } // callback function
  );
  
}

function printExecuteScriptResult(configText)
{
  if(chrome.runtime.lastError) {
    console.log(configText + " could not be executed, err: " + chrome.runtime.lastError.message);
  } else {
    console.log(configText + " has been executed.");
  }
}
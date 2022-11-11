let g_resolveProcess_UndobanAll;
let g_rejectProcess_UndobanAll;
let g_tabId_UndobanAll = -1;

async function processHandler_UndobanAll()
{
	log.info("Program has been started for undoban all");
	
	g_tabId_UndobanAll = -1;
	
	// register function to call every time a content script sends a message
  chrome.runtime.onMessage.addListener(contentScriptMessageListener_UndobanAll);
	
	// register function to call every time a page is closed
	chrome.tabs.onRemoved.addListener(pageCloseListener_UndobanAll);
	
	let processResult = await process_UndobanAll();
	
	let res = processResult.res;
	
	if(res === ResultType.FAIL)
	{
		log.info("Program has been finished early (unbanned user: " + "?" + " title: " + "?" +")");
	}
	else
	{
		let clientName = processResult.clientName;
		let totalUser = processResult.totalUser;
		let totalTitle = processResult.totalTitle;
	
		makeNotification("Engeli kaldırılan kullanıcı sayısı: " + totalUser + ", başlık sayısı: " + totalTitle);
		log.info("Program has been finished (unbanned user: " + totalUser + " title: " + totalTitle +")");
	}
	
	log.info("contentScriptMessageListener_UndobanAll removed.");
  chrome.runtime.onMessage.removeListener(contentScriptMessageListener_UndobanAll);
	
	log.info("pageCloseListener_UndobanAll removed.");
	chrome.tabs.onRemoved.removeListener(pageCloseListener_UndobanAll);
}

async function process_UndobanAll()
{
	return new Promise(async function(resolve, reject) {
		g_resolveProcess_UndobanAll = resolve;
    g_rejectProcess_UndobanAll = reject;
		
		g_tabId_UndobanAll = await RedirectHandler.createNewTab("https://eksisozluk.com/takip-engellenmis");
		
		await asyncCSSInject(g_tabId_UndobanAll, "assets/css/customPopup.css");
		
		// frame 0 is the main frame, there may be other frames (ads, google analytics etc)
    chrome.scripting.executeScript(
		{
			target: {tabId: g_tabId_UndobanAll, frameIds: [0]}, 
			func: (_BanSource, _OpMode, _BanMode, _TargetType, _ResultType)=>
			{
				// enum values
				window.enumEksiEngelBanSource= _BanSource;
				window.enumEksiEngelOpMode = _OpMode;
				window.enumEksiEngelBanMode = _BanMode;
				window.enumEksiEngelTargetType = _TargetType;
				window.enumEksiEngelResultType = _ResultType;
			},
			args: [BanSource, OpMode, BanMode, TargetType, ResultType]
		}, 
		()=>
		{
			if(chrome.runtime.lastError) 
				log.err("content script could not be executed, err: " + chrome.runtime.lastError.message);
			else
				syncExecuteScript(g_tabId_UndobanAll, "assets/js/contentScript_UndobanAll.js");
		}
		);
	});
}

function contentScriptMessageListener_UndobanAll(message, sender, sendResponse) 
{
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	// incoming values from content script
  let incomingObj;
  try
  {
    incomingObj = JSON.parse(message);
  }
  catch(e)
  {
    log.err("contentScriptMessageListener_UndobanAll: parse err: " + e);
    return;
  }
	
	if(incomingObj.source !== BanSource.UNDOBANALL)
	{
		log.err("contentScriptMessageListener_UndobanAll: wrong source: " + incomingObj.source);
		return;
	}
	
	if(incomingObj.clientName)
	{
		log.info("contentScriptMessageListener_UndobanAll: client name: " + incomingObj.clientName);
	}
	
	if(Object.hasOwn(incomingObj, 'res')       && Object.hasOwn(incomingObj, 'clientName') &&
	   Object.hasOwn(incomingObj, 'totalUser') && Object.hasOwn(incomingObj, 'totalTitle'))
	{
		log.info("g_resolveProcess_UndobanAll will be executed by contentScriptMessageListener_UndobanAll");
		g_resolveProcess_UndobanAll(incomingObj);
	}
}

// this function will be called every time any page is closed (iframes will call as well)
// multiple calls will not be a problem
function pageCloseListener_UndobanAll(tabid, removeInfo)
{
  if(g_tabId_UndobanAll === tabid)
  {
    log.info("tab " + tabid + " closed by user");
      
    // resolve Promise after content script has executed
    g_resolveProcess_UndobanAll({res: ResultType.FAIL});
  }
}

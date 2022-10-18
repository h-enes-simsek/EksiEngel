let g_ResolveUndobanAllProcess;
let g_rejectUndobanAllProcess;

async function processHandler_UndobanAll()
{
	log.info("Program has been started for undoban all");
	
	// register function to call every time a content script sends a message
  chrome.runtime.onMessage.addListener(contentScriptMessageListener_UndobanAll);
	
	let processResult = await process_UndobanAll();
	
	let res = processResult.res;
	let clientName = processResult.clientName;
	let totalUser = processResult.totalUser;
	let totalTitle = processResult.totalTitle;
	
	log.info("contentScriptMessageListener_UndobanAll removed.");
  chrome.runtime.onMessage.removeListener(contentScriptMessageListener_UndobanAll);
	
	makeNotification("Engeli kaldırılan kullanıcı sayısı: " + totalUser + ", başlık sayısı: " + totalTitle);
	log.useful("Program has been finished (unbanned user: " + totalUser + " title: " + totalTitle +")");
}

async function process_UndobanAll()
{
	return new Promise(async function(resolve, reject) {
		g_ResolveUndobanAllProcess = resolve;
    g_rejectUndobanAllProcess = reject;
		
		let tabId = await RedirectHandler.createNewTab("https://eksisozluk.com/takip-engellenmis");
		
		await asyncCSSInject(tabId, "assets/css/customPopup.css");
		
		syncExecuteScript(tabId, "assets/js/contentScript_UndobanAll.js");
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
	
	if(incomingObj.source !== "source::undobanAll")
	{
		log.err("contentScriptMessageListener_UndobanAll: wrong source: " + incomingObj.source);
		return;
	}
	
	if(incomingObj.clientName)
	{
		log.useful("contentScriptMessageListener_UndobanAll: client name: " + incomingObj.clientName);
	}
	
	if(incomingObj.res && incomingObj.clientName && incomingObj.totalUser && incomingObj.totalTitle)
	{
		g_ResolveUndobanAllProcess(incomingObj);
	}
}
{
	let clientName = "";
	let selector = ".mobile-notification-icons > ul > li > a";
	let element = document.querySelectorAll(selector)[0].title;
	if(element && element != null && element != undefined)
		clientName = element;
	
	let responseObj = {clientName: clientName};
	let responseObjText = JSON.stringify(responseObj);
	console.log(responseObjText);
  chrome.runtime.sendMessage(null, responseObjText); // send message back to background script
}
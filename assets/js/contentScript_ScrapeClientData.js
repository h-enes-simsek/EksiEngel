{
	// client name
	let clientName = "";
	let selector = ".mobile-notification-icons > ul > li > a";
	try
	{
		let element = document.querySelectorAll(selector)[0].title;
		if(element && element != null && element != undefined)
    {
			clientName = element;
      clientName = clientName.replace(/ /gi, "-"); /* whitespace to - char */
    }
	}
	catch(err)
	{
		// may be not logged in
		console.log(err);
	}
	
	console.log(clientName);
	
	// user agent
	let userAgent = window.navigator.userAgent;
	
	let responseObj = {clientName: clientName, userAgent: userAgent};
	let responseObjText = JSON.stringify(responseObj);
	console.log(responseObjText);
  chrome.runtime.sendMessage(null, responseObjText); // send message back to background script
}
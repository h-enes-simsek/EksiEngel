'use strict';

console.log("popup.js has been started.");

// list of urls to navigate
/*
let urls_list = [
	"https://eksisozluk.com/biri/oray",
	"https://eksisozluk.com/biri/amonares",
	"https://eksisozluk.com/biri/damarlarinizdaki-asil-kan"
];
*/

// go to settings page
openSettings.onclick = function(element) {
	chrome.runtime.openOptionsPage();
};

// start navigation when #startNavigation button is clicked
startNavigation.onclick = function(element) {
	// get saved user list from sync api
	let userListArray = [];
	chrome.storage.sync.get("userList", function(items){
		if(items != undefined){
			userListArray = items.userList.split("\n");
			
			let userNumber = userListArray.length;
			let successfullBans = 0;
			
			console.log("number of user to ban: " + userNumber);
			if(userNumber < 0){
				alert("Eklenti ayarlarından engellenecek yazarları ekleyin.");
			}
			else if(userNumber == 1 && userListArray[0] == ''){
				alert("Eklenti ayarlarından engellenecek yazarları ekleyin.");
			}
			else{
				// query the current tab to find its id
				chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
					for(let i=0; i<userNumber; i++) {
						// navigate to next url
						let result = await goToPage(userListArray[i], tabs[0].id);
						
						if(result === "promise::success"){
							successfullBans++;
						}
					}

					// navigation of all pages is finished
					alert(userNumber + ' kisilik listedeki ' + successfullBans + ' kisi engellendi.');
				});
			}
		}else{
			alert("Eklenti ayarlarından engellenecek yazarları ekleyin.");
		}
	});

};

function startToNavigate(){
	
}

async function goToPage(url, tab_id) {
	return new Promise(function(resolve, reject) {
		
		// update current tab with new url
		chrome.tabs.update({url: url});
		
		let counter = 0; // number of times the page is loaded
		let contentScriptResult = ""; // current status of the content scripts
		let isBanUserSuccessfull = false;
		let isBanTitleSuccessfull = false;
		
		// this function will be called every time the page is updated (reloaded)
		function PageUpdateListener(tabID, changeInfo) {
			console.log("tab id: "+ tabID + " changeinfo.status: " + changeInfo.status);
			
			if(changeInfo.status === 'complete') {
				counter++;
				console.log("page counter " + counter);
				
				if(counter === 1){
					// execute content script1
					console.log("PageUpdateListener: script1 will be exec");
					chrome.scripting.executeScript({ target: {tabId: tabID}, files: ['script1.js'] }, function() {
						console.log("script1 has been executed.");
					});
				}
				else if(contentScriptResult === "script1::success"){
					// script1::error will be handled by ContentScriptMessageListener
					console.log("PageUpdateListener: script1::success so contentScriptCheckUserBan.js will be exec");
					chrome.scripting.executeScript({ target: {tabId: tabID}, files: ['contentScriptCheckUserBan.js'] }, function() {
					console.log("popup.js::contentScriptCheckUserBan has been executed.");
					});
				}
				else if(contentScriptResult === "script2::success"){
					// script2::error will be handled by ContentScriptMessageListener
					console.log("PageUpdateListener: script2::success so contentScriptCheckTitleBan.js will be exec");
					chrome.scripting.executeScript({ target: {tabId: tabID}, files: ['contentScriptCheckTitleBan.js'] }, function() {
					console.log("popup.js::contentScriptCheckTitleBan has been executed.");
					});
				}
				else{
					console.log("PageUpdateListener: unhandled status contentScriptResult: " + contentScriptResult);
				}
				
			}
		}
		
		// register function to call every time the page is updated
		chrome.tabs.onUpdated.addListener(PageUpdateListener);
		
		// fired when content script sends a message
		chrome.runtime.onMessage.addListener(async function ContentScriptMessageListener(message) {
			contentScriptResult = message; // update status to track
			console.log(message);
			
			if(message === 'script1::error'){
				// script1::success will be handled by PageUpdateListener
				console.log("contentScriptCheckUserBan will be executed");
				chrome.scripting.executeScript({ target: {tabId: tab_id}, files: ['contentScriptCheckUserBan.js'] }, function() {
					console.log("popup.js::contentScriptCheckUserBan has been executed.");
				});
				
			}
			else if(message === "checkuserban::error" || message === "checkuserban::success"){
				
				isBanUserSuccessfull = message === "checkuserban::success";
				
				// execute content script2 after script1 and checkuserban
				console.log("script2 will be executed");
				chrome.scripting.executeScript({ target: {tabId: tab_id}, files: ['script2.js'] }, function() {
					console.log("script2 has been executed.");
				});
			}
			else if(message === 'script2::error'){
				// script2::success will be handled by PageUpdateListener
				// execute content script to check if script2 is successfull
				console.log("contentScriptCheckTitleBan will be executed");
				chrome.scripting.executeScript({ target: {tabId: tab_id}, files: ['contentScriptCheckTitleBan.js'] }, function() {
					console.log("popup.js::contentScriptCheckTitleBan has been executed.");
				});
			}
			
			else if(message === "checktitleban::error" || message === "checktitleban::success"){
				//all actions have been completed.
				
				isBanTitleSuccessfull = message === "checktitleban::success"; 
				
				// remove onMessage event as it may get duplicated
				console.log("ContentScriptMessageListener removed.");
				chrome.runtime.onMessage.removeListener(ContentScriptMessageListener);
				
				// remove tab onUpdate event to prevent duplicated listener
				console.log("PageUpdateListener removed.");
				chrome.tabs.onUpdated.removeListener(PageUpdateListener);
					
				// resolve Promise after content script has executed
				if(isBanUserSuccessfull && isBanTitleSuccessfull){
					resolve("promise::success");
				}
				else{
					resolve("promise::fail");
				}
				
			}
			
			else{
				console.log("ContentScriptMessageListener: unhandled msg " + message);
			}
			
		});
		
		
		
		
	});
}
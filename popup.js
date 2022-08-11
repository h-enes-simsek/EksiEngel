'use strict';

console.log("popup.js has been started.");

startBanFavorites.onclick = function(element) {
	
	
	chrome.tabs.query({}, async function(tabs) {
		for (let tab of tabs) {
			// get active tab
			if(tab.active)
			{
				//alert(tab.url);
				
				// execute content script1
				console.log("popup.js: scriptScrapAuthorsFromEntry will be exec");
				chrome.scripting.executeScript({ target: {tabId: tab.id}, files: ['scriptScrapAuthorsFromEntry.js'] }, function() {
					console.log("scriptScrapAuthorsFromEntry has been executed.");
				});
			}
		}
	}); 

	
  // send start msg to background.js
  chrome.runtime.sendMessage(null, "popup::startFavBan");
};

// go to settings page when id=#openSettings button is clicked
openSettings.onclick = function(element) {
  chrome.runtime.openOptionsPage();
};

// go to faq, how to use, page when id=#openFaq button is clicked
openFaq.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("faq.html") });
};

/* Start, Stop features are disabled
// start navigation when id=#startNavigation button is clicked
startNavigation.onclick = function(element) {
  // send start msg to background.js
  chrome.runtime.sendMessage(null, "popup::start");
};

// stop navigation when id=#stopNavigation button is clicked
stopNavigation.onclick = function(element) {
  // send stop msg to background.js
  chrome.runtime.sendMessage(null, "popup::stop");
};
*/
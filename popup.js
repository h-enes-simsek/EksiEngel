'use strict';

console.log("popup.js has been started.");

startBanFavorites.onclick = function(element) {
	
	chrome.tabs.query({}, async function(tabs) {
		for (let tab of tabs) {
			// get active tab
			if(tab.active)
			{
				if(tab.url.includes("https://eksisozluk.com/entry"))
				{
					// execute content script1
					console.log("popup.js: scriptScrapAuthorsFromEntry will be exec");
					chrome.scripting.executeScript({ target: {tabId: tab.id}, files: ['scriptScrapAuthorsFromEntry.js'] }, function() {
						console.log("scriptScrapAuthorsFromEntry has been executed.");
					});
				}
				else
				{
					// the extension should be used in an ekşisözlük entry page
					console.log("popup.js: scriptScrapAuthorsFromEntry will not be executed, current url: " + tab.url);
					alert("Bu eklenti sadece bir ekşisözlük entry sayfası açıkken kullanılabilir. Örneğin https://eksisozluk.com/entry/1");
				}
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
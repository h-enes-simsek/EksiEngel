'use strict';

console.log("popup.js has been started.");

startBanFavorites.onclick = function(element) {
	
	chrome.tabs.query({}, async function(tabs) {
		for (let tab of tabs) {
			// get active tab
			if(tab.active)
			{
				if(tab.url.includes("eksisozluk.com/entry"))
				{
					
					console.log("popup.js: scrapeAuthors will be exec");
					chrome.scripting.executeScript({ target: {tabId: tab.id}, files: ['assets/js/scrapeAuthors.js'] }, function() {
						console.log("scrapeAuthors has been executed.");
					});
					
					/*
					console.log("popup: message will be sent to background script to start ban");
					chrome.runtime.sendMessage(null, "popup::banForFavs");
					*/
				}
				else
				{
					// the extension should be used in an ekşisözlük entry page
					console.log("popup.js: scrapeAuthors will not be executed, current url: " + tab.url);
					alert("Bu eklenti sadece bir ekşisözlük entry sayfası açıkken kullanılabilir. Örneğin https://eksisozluk.com/entry/1");
				}
			}
		}
	}); 
};

// go to authorListPage page when id=#openauthorListPage button is clicked
openauthorListPage.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") });
};

// go to faq, how to use, page when id=#openFaq button is clicked
openFaq.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
};
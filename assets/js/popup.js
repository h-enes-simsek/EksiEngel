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
					
					console.log("popup.js: contentScript_ScrapeAuthors.js will be exec");
					chrome.scripting.executeScript({ target: {tabId: tab.id}, files: ['assets/js/contentScript_ScrapeAuthors.js'] }, function() {
						console.log("contentScript_ScrapeAuthors.js has been executed.");
					});
				}
				else
				{
					// the extension should be used in an ekşisözlük entry page
					console.log("popup.js: contentScript_ScrapeAuthors.js will not be executed, current url: " + tab.url);
					alert("Bu eklenti sadece bir ekşisözlük entry sayfası açıkken kullanılabilir. Örneğin https://eksisozluk.com/entry/1");
				}
			}
		}
	}); 
};

startUndobanAll.onclick = function(element) {
	chrome.runtime.sendMessage(null, "popup::undobanAll");
};

// go to authorListPage page when id=#openauthorListPage button is clicked
openauthorListPage.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") });
};

// go to faq, how to use, page when id=#openFaq button is clicked
openFaq.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
};
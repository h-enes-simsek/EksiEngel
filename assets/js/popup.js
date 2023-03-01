'use strict';

console.log("popup.js: has been started.");

startBanFavorites.onclick = function(element) {
	
	chrome.tabs.query({}, async function(tabs) {
		for (let tab of tabs) {
			// get active tab
			if(tab.active)
			{
				if(tab.url.includes("eksisozluk.com/entry"))
				{
          // send message to background page
          chrome.runtime.sendMessage(null, {"banSource":"FAV", "banMode":"BAN", "entryUrl": tab.url}, function (){
            // automatically close the popup.html if operation is successful
            window.close();
          });
          
				}
				else
				{
					// the extension should be used in an ekşisözlük entry page
					console.log("popup.js: wrong url, current url: " + tab.url);
					alert("Favorileyenleri engellemek istediğiniz ekşisözlük entry'sini açın.\nÖrneğin: https://eksisozluk.com/entry/1");
				}
			}
		}
	}); 
};

startUndobanAll.onclick = function(element) {
	// send message to background page
	chrome.runtime.sendMessage(null, {"banSource":"UNDOBANALL", "banMode":"UNDOBAN"});
};

openauthorListPage.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") });
};

openFaq.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
};
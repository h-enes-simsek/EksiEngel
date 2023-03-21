'use strict';

console.log("popup.js: has been started.");

openauthorListPage.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") }, function (){
  // automatically close the popup.html if operation is successful
    window.close();
  });
};

startUndobanAll.onclick = function(element) {
	// send message to background page
	chrome.runtime.sendMessage(null, {"banSource":"UNDOBANALL", "banMode":"UNDOBAN"});
};

openFaq.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
};
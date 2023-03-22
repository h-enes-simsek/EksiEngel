import * as enums from './enums.js';
import {commHandler} from './commHandler.js';

console.log("popup.js: has been started.");

commHandler.sendAnalyticsData({click_type:enums.ClickType.EXTENSION_ICON});

openauthorListPage.onclick = function(element) {
  commHandler.sendAnalyticsData({click_type:enums.ClickType.EXTENSION_MENU_BAN_LIST});
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") }, function (){
  // automatically close the popup.html if operation is successful
    window.close();
  });
};

startUndobanAll.onclick = function(element) {
  commHandler.sendAnalyticsData({click_type:enums.ClickType.EXTENSION_MENU_UNDOBANALL});
	// send message to background page
	chrome.runtime.sendMessage(null, {"banSource":"UNDOBANALL", "banMode":"UNDOBAN"});
};

openFaq.onclick = function(element) {
  commHandler.sendAnalyticsData({click_type:enums.ClickType.EXTENSION_MENU_FAQ});
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
};
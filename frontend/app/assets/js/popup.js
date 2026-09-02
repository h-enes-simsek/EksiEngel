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

startUndobanAll.onclick = async function(element) {
  commHandler.sendAnalyticsData({click_type:enums.ClickType.EXTENSION_MENU_UNDOBANALL});
	// send message to background page
	try
  {
    const response = await chrome.runtime.sendMessage({
      type: enums.RuntimeMessageType.ENQUEUE_JOB,
      payload: {
        banSource: enums.BanSource.UNDOBANALL,
        banMode: enums.BanMode.UNDOBAN
      }
    });

    if(response?.ok !== true)
      alert("İşlem sıraya eklenemedi.");
  }
  catch(error)
  {
    console.error("Job request could not be sent", error);
    alert("İşlem isteği gönderilemedi.");
  }
};

openFaq.onclick = function(element) {
  commHandler.sendAnalyticsData({click_type:enums.ClickType.EXTENSION_MENU_FAQ});
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
};

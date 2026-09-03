import * as enums from './enums.js';

console.log("popup.js: has been started.");

openauthorListPage.onclick = function() {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/authorListPage.html") }, function (){
  // automatically close the popup.html if operation is successful
    window.close();
  });
};

startUndobanAll.onclick = async function() {
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

openFaq.onclick = function() {
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
};

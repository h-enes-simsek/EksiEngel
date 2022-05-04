'use strict';

console.log("popup.js has been started.");

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

// go to settings page when id=#openSettings button is clicked
openSettings.onclick = function(element) {
  chrome.runtime.openOptionsPage();
};

// go to faq, how to use, page when id=#openFaq button is clicked
openFaq.onclick = function(element) {
  chrome.tabs.create({ url: chrome.runtime.getURL("faq.html") });
};
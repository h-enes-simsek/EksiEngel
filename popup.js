'use strict';

console.log("popup.js has been started.");

// go to settings page when id=#openSettings button is clicked
openSettings.onclick = function(element) {
  chrome.runtime.openOptionsPage();
};

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
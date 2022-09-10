if (document.readyState == "complete") {
  let banUserPostItem = document.getElementById("blocked-index-title-link"); // get html element, button, to click
  if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>başlıkları engellenmiş</span>") {
    chrome.runtime.sendMessage(null, "checktitleban::success"); // send message back to background script
  } else {
    chrome.runtime.sendMessage(null, "checktitleban::error"); // send message back to background script
  }
}
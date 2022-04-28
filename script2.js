{
  let banUserPostItem = document.getElementById("blocked-index-title-link"); // get html element, button, to click
  if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>başlıklarını engelle</span>") {
    chrome.runtime.sendMessage(null, "script2::success"); // send message back to background script
    banUserPostItem.click();
  } else {
    chrome.runtime.sendMessage(null, "script2::error"); // send message back to background script
  }
}
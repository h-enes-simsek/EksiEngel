{
  let banUserPostItem = document.getElementById("blocked-link"); // get html element, button, to click
  if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>engelle</span>") {
    chrome.runtime.sendMessage(null, "script1::success"); // send message back to background script
    banUserPostItem.click();
  } else {
    chrome.runtime.sendMessage(null, "script1::error"); // send message back to background script
  }
}
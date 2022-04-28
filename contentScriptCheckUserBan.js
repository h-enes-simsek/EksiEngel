if (document.readyState == "complete") {
  let banUserPostItem = document.getElementById("blocked-link"); // get html element, button, to click
  if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>engellemeyi bırak</span>") {
    chrome.runtime.sendMessage(null, "checkuserban::success"); // send message back to background script
  } else {
    chrome.runtime.sendMessage(null, "checkuserban::error"); // send message back to background script
  }
}
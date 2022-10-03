{
  if(window.configEksiEngelMode === "mode::ban")
  {
    let banUserPostItem = document.getElementById("blocked-index-title-link"); // get html element, button, to click
    if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>başlıklarını engelle</span>") 
    {
      chrome.runtime.sendMessage(null, "banTitle::success"); // send message back to background script
      console.log("banTitle::success" + " - " + window.configEksiEngelMode);
      banUserPostItem.click();
    } 
    else 
    {
      chrome.runtime.sendMessage(null, "banTitle::error"); // send message back to background script
      console.log("banTitle::error" + " - " + window.configEksiEngelMode);
    }
  }
  else if(window.configEksiEngelMode === "mode::undoban")
  {
    console.log("banTitle::success/fail" + " mode: " + window.configEksiEngelMode);
  }
  else
  {
    
  }
  
}
{
	let banUserPostItem = document.getElementById("blocked-link"); // get html element, button, to click
	if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>engellemeyi bırak</span>") {
		chrome.runtime.sendMessage(null, "isUserBanned::success"); // send message back to background script
		console.log("isUserBanned::success");
	} else {
		chrome.runtime.sendMessage(null, "isUserBanned::error"); // send message back to background script
		console.log("isUserBanned::error");
	}
}

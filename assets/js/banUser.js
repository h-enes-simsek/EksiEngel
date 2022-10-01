{
	let banUserPostItem = document.getElementById("blocked-link"); // get html element, button, to click
	if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>engelle</span>") {
		chrome.runtime.sendMessage(null, "banUser::success"); // send message back to background script
		console.log("banUser::success");
		banUserPostItem.click();
	} else {
		chrome.runtime.sendMessage(null, "banUser::error"); // send message back to background script
		console.log("banUser::error");
	}
}
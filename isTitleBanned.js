{
	let banUserPostItem = document.getElementById("blocked-index-title-link"); // get html element, button, to click
	if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>başlıkları engellenmiş</span>") {
		chrome.runtime.sendMessage(null, "isTitleBanned::success"); // send message back to background script
		console.log("isTitleBanned::success");
	} else {
		chrome.runtime.sendMessage(null, "isTitleBanned::error"); // send message back to background script
		console.log("isTitleBanned::error");
	}
}
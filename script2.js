{
	//get html elements to click buttons
	let banUserPostItem = document.getElementById("blocked-index-title-link");

	//check is already banned then click buttons to ban user posts
	if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>başlıklarını engelle</span>"){
		// send message back to popup script
		chrome.runtime.sendMessage(null, "script2::success");
		banUserPostItem.click();
	}else{
		// send message back to popup script
		chrome.runtime.sendMessage(null, "script2::error");
	}
	console.log("Eksiengel::script2.js has been executed.");
}
{
	//get html elements to click buttons
	let banUserPostItem = document.getElementById("blocked-link");

	//check is already banned then click buttons to ban user posts
	if(banUserPostItem.innerHTML === "<span>engelle</span>"){
		// send message back to popup script
		chrome.runtime.sendMessage(null, "script1::success");
		banUserPostItem.click();
	}else{
		// send message back to popup script
		chrome.runtime.sendMessage(null, "script1::error");
	}
	console.log("Eksiengel::script1.js has been executed.");
}
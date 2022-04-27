console.log("checktitleban content will be staterted.");


if (document.readyState == "complete") {
	console.log("checktitleban content staterted.");
	
	//get html elements to click buttons
	let banUserPostItem = document.getElementById("blocked-index-title-link");

	//check the text of the button
	if(banUserPostItem.innerHTML === "<span>başlıkları engellenmiş</span>"){
		chrome.runtime.sendMessage(null, "checktitleban::success");
		console.log("User's titles have been banned successfully.");
	}
	else{
		chrome.runtime.sendMessage(null, "checktitleban::error");
		console.log("User's titles could not be banned.");
	}
}
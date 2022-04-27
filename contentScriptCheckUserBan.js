console.log("checkuserban content will be staterted.");


if (document.readyState == "complete") {
	console.log("checkuserban content staterted.");
	
	//get html elements to click buttons
	let banUserPostItem = document.getElementById("blocked-link");

	//check the text of the button
	if(banUserPostItem != null && banUserPostItem.innerHTML === "<span>engellemeyi bırak</span>"){
		chrome.runtime.sendMessage(null, "checkuserban::success");
		console.log("User has been banned successfully.");
	}
	else{
		chrome.runtime.sendMessage(null, "checkuserban::error");
		console.log("User could not be banned.");
	}
}

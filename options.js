document.getElementById("save").addEventListener("click", function(){
	let userListString = document.getElementById("userList").value;
	chrome.storage.local.set({ "userList": userListString }, function(){
		blinkSavedMsg(); // set status message to 'saved'
	});
});

function blinkSavedMsg() {
	var elem = document.getElementById('status');
	elem.innerHTML = "Kaydedildi.";
	var counter = 4;
	var blinkInterval = setInterval(function(){
		counter--;
		elem.style.display = (elem.style.display == 'none' ? '' : 'none');
		if (counter === 0) {
		clearInterval(blinkInterval);
		}
	}, 100);
}

document.getElementById("getSaves").addEventListener("click", function(){
	let userListString = '';
	let userListArray = [];
	chrome.storage.local.get("userList", function(items){
		userListString = items.userList;
		userListArray = userListString.split("\n");
		document.getElementById("userList").value = userListString;
	});
});


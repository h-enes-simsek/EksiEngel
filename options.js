document.getElementById("save").addEventListener("click", function(){
	let userListString = document.getElementById("userList").value;
	chrome.storage.local.set({ "userList": userListString }, function(){
		if(!chrome.runtime.error){
			blinkSavedMsg(); // set status message to 'saved'
		}else{
			console.log("chrome.storage.local.set runtime error");
		}
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
		if(!chrome.runtime.error){
			userListString = items.userList;
			userListArray = userListString.split("\n");
			document.getElementById("userList").value = userListString;
		}else{
			console.log("chrome.storage.local.get runtime error");
		}
	});
});


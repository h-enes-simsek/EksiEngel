function saveAuthorListToStorage()
{
	let userListString = document.getElementById("userList").value;
  chrome.storage.local.set({ "userList": userListString }, function(){
    if(!chrome.runtime.error){
      blinkSavedMsg(); // set status text to 'saved' for gui
    }else{
      console.log("chrome.storage.local.set runtime error");
      alert("chrome.storage.local.set runtime error");
    }
  });
}

// send message to background.js to start banning process
document.getElementById("startBan").addEventListener("click", function(){
	saveAuthorListToStorage();
	chrome.runtime.sendMessage(null, "authorListPage::start");
});

// if local storage save is successfull, show a message to the user
function blinkSavedMsg() {
  var elem = document.getElementById('status');
  elem.innerHTML = "Girilen yazarlar yerel hafızaya kaydedildi, engelleme işlemi başlayacak.";
  var counter = 4;
  var blinkInterval = setInterval(function(){
    counter--;
    elem.style.display = (elem.style.display == 'none' ? '' : 'none');
    if (counter === 0) {
    clearInterval(blinkInterval);
    }
  }, 100);
}
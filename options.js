// save text from textarea to local storage
document.getElementById("save").addEventListener("click", function(){
  let userListString = document.getElementById("userList").value;
  chrome.storage.local.set({ "userList": userListString }, function(){
    if(!chrome.runtime.error){
      blinkSavedMsg(); // set status text to 'saved' for gui
    }else{
      console.log("chrome.storage.local.set runtime error");
      alert("chrome.storage.local.set runtime error");
    }
  });
});

// get saved text from local storage to textarea
document.getElementById("getSaves").addEventListener("click", function(){
  let userListString = '';
  let userListArray = [];
  chrome.storage.local.get("userList", function(items){
    if(!chrome.runtime.error && items != undefined && items.userList != undefined){
      userListString = items.userList;
      userListArray = userListString.split("\n");
      document.getElementById("userList").value = userListString;
    }else{
      console.log("chrome.storage.local.get runtime error");
      alert("chrome.storage.local.set runtime error");
    }
  });
});

// if local storage save is successfull, show a message to the user
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
import * as enums from './enums.js';

async function submitAuthorList(banMode)
{
  const authorListText = document.getElementById("userList").value;

  try
  {
    await chrome.storage.local.set({userList: authorListText});
  }
  catch(error)
  {
    console.error("chrome.storage.local.set failed", error);
    alert("Yazar listesi yerel hafızaya kaydedilemedi.");
    return;
  }

  let response;
  try
  {
    response = await chrome.runtime.sendMessage({
      type: enums.RuntimeMessageType.ENQUEUE_JOB,
      payload: {
        banSource: enums.BanSource.LIST,
        banMode,
        authorListText
      }
    });
  }
  catch(error)
  {
    console.error("Job request could not be sent", error);
    alert("İşlem isteği gönderilemedi.");
    return;
  }

  if(response?.ok !== true)
  {
    alert("Ayarlar yüklenemediği için işlem sıraya eklenemedi.");
    return;
  }

  blinkSavedMsg(); // set status text to 'saved' for gui
}

// send message to background.js to start banning process
document.getElementById("startBan").addEventListener("click", async function(){
	await submitAuthorList(enums.BanMode.BAN);
});

// send message to background.js to start banning process
document.getElementById("startUndoban").addEventListener("click", async function(){
	await submitAuthorList(enums.BanMode.UNDOBAN);
});

// if local storage save is successfull, show a message to the user
function blinkSavedMsg() {
  var elem = document.getElementById('status');
  elem.innerHTML = "Girilen yazarlar yerel hafızaya kaydedildi, engelleme/engeli kaldırma işlemi başlayacak.";
  var counter = 4;
  var blinkInterval = setInterval(function(){
    counter--;
    elem.style.display = (elem.style.display == 'none' ? '' : 'none');
    if (counter === 0) {
    clearInterval(blinkInterval);
    }
  }, 100);
}

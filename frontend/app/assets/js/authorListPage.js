import * as enums from './enums.js';

const saveAuthorListToStorage = () => {
  const userListString = document.getElementById("userList").value;
  chrome.storage.local.set({ "userList": userListString }, () => {
    if(!chrome.runtime.error) blinkSavedMsg();
    else {
      console.log("chrome.storage.local.set runtime error");
      alert("chrome.storage.local.set runtime error");
    }
  });
};

document.getElementById("startBan").addEventListener("click", () => {
  saveAuthorListToStorage();
  chrome.runtime.sendMessage(null, {"banSource":enums.BanSource.LIST, "banMode":enums.BanMode.BAN}, (response) => {
    if (chrome.runtime.lastError) {
      console.error("authorListPage.js: Error sending startBan message:", chrome.runtime.lastError.message);
      alert("Error starting ban process: " + chrome.runtime.lastError.message);
    }
  });
});

document.getElementById("startUndoban").addEventListener("click", () => {
  saveAuthorListToStorage();
  chrome.runtime.sendMessage(null, {"banSource":enums.BanSource.LIST, "banMode":enums.BanMode.UNDOBAN}, (response) => {
    if (chrome.runtime.lastError) {
      console.error("authorListPage.js: Error sending startUndoban message:", chrome.runtime.lastError.message);
      alert("Error starting unban process: " + chrome.runtime.lastError.message);
    }
  });
});

const blinkSavedMsg = () => {
  const elem = document.getElementById('status');
  elem.innerHTML = "Girilen yazarlar yerel hafızaya kaydedildi, engelleme/engeli kaldırma işlemi başlayacak.";
  let counter = 4;
  setInterval(() => {
    counter--;
    elem.style.display = (elem.style.display == 'none' ? '' : 'none');
    if (counter === 0) clearInterval();
  }, 100);
};
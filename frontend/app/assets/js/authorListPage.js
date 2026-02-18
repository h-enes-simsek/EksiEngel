import * as enums from './enums.js';

// Apply saved theme on load
function applyTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

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

const showStatus = (message, isError = false) => {
  const elem = document.getElementById('status');
  elem.innerHTML = message;
  elem.style.color = isError ? 'var(--danger-color, #dc3545)' : 'var(--text-muted)';
};

document.getElementById("importCSV").addEventListener("click", () => {
  document.getElementById("csvFileInput").click();
});

document.getElementById("csvFileInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      let content = e.target.result;
      
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      
      let lines = content.split(/\r?\n/);
      
      if (lines.length > 0 && lines[0].trim().toLowerCase() === 'username') {
        lines = lines.slice(1);
      }
      
      const usernames = lines
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const textarea = document.getElementById("userList");
      textarea.value = usernames.join('\n');
      
      showStatus(`${usernames.length} yazar yüklendi`);
    } catch (error) {
      console.error("CSV import error:", error);
      showStatus("CSV dosyası okunamadı", true);
    }
  };
  
  reader.onerror = () => {
    showStatus("Dosya okuma hatası", true);
  };
  
  reader.readAsText(file);
  event.target.value = '';
});

// Initialize theme on load
document.addEventListener('DOMContentLoaded', applyTheme);
applyTheme();

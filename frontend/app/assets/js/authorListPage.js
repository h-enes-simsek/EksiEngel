import * as enums from './enums.js';
import { storageHandler } from './storageHandler.js';
import * as utils from './utils.js';

// Apply saved theme on load
function applyTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

const saveAuthorListToStorage = () => {
  const userListString = document.getElementById("userList").value;
  chrome.storage.local.set({ "userList": userListString }, () => {
    if(!chrome.runtime.error) showSavedMsg();
    else {
      console.log("chrome.storage.local.set runtime error");
      alert("chrome.storage.local.set runtime error");
    }
  });
};

const showSavedMsg = () => {
  const elem = document.getElementById('status');
  elem.innerHTML = "Yazarlar kaydedildi.";
};

const showStatus = (message, isError = false) => {
  const elem = document.getElementById('status');
  elem.innerHTML = message;
  elem.style.color = isError ? 'var(--danger-color, #dc3545)' : 'var(--text-muted)';
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

// Follow users
document.getElementById("startFollow").addEventListener("click", () => {
  saveAuthorListToStorage();
  chrome.runtime.sendMessage(null, {"banSource":enums.BanSource.LIST, "action":"TAKIP_ET"}, (response) => {
    if (chrome.runtime.lastError) {
      console.error("authorListPage.js: Error sending startFollow message:", chrome.runtime.lastError.message);
      alert("Error starting follow process: " + chrome.runtime.lastError.message);
    }
  });
});

// Unblock and Follow
document.getElementById("startUnblockFollow").addEventListener("click", () => {
  saveAuthorListToStorage();
  chrome.runtime.sendMessage(null, {"banSource":enums.BanSource.LIST, "action":"ENGEL_KALDIR_VE_TAKIP_ET"}, (response) => {
    if (chrome.runtime.lastError) {
      console.error("authorListPage.js: Error sending startUnblockFollow message:", chrome.runtime.lastError.message);
      alert("Error starting unblock and follow process: " + chrome.runtime.lastError.message);
    }
  });
});

// Unmute and Follow
document.getElementById("startUnmuteFollow").addEventListener("click", () => {
  saveAuthorListToStorage();
  chrome.runtime.sendMessage(null, {"banSource":enums.BanSource.LIST, "action":"SESSIZDEN_CIKAR_VE_TAKIP_ET"}, (response) => {
    if (chrome.runtime.lastError) {
      console.error("authorListPage.js: Error sending startUnmuteFollow message:", chrome.runtime.lastError.message);
      alert("Error starting unmute and follow process: " + chrome.runtime.lastError.message);
    }
  });
});

document.getElementById("importCSV").addEventListener("click", () => {
  document.getElementById("csvFileInput").click();
});

/**
 * Parses a CSV line handling commas within values (basic CSV parsing)
 * @param {string} line - CSV line to parse
 * @returns {string[]} - Array of values
 */
const parseCSVLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
};

/**
 * Parses registration date from CSV value
 * Supports: YYYY-MM-DD, ISO format, Turkish date formats
 * @param {string} dateStr - Date string from CSV
 * @returns {string|null} - ISO date string or null
 */
const parseRegistrationDate = (dateStr) => {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const trimmed = dateStr.trim();
  
  // Try YYYY-MM-DD format first
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const date = new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]));
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  // Use existing Turkish date parser for other formats
  const parsed = utils.parseTurkishDate(trimmed);
  return parsed ? parsed.toISOString() : null;
};

document.getElementById("csvFileInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      let content = e.target.result;
      
      // Remove BOM if present
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      
      let lines = content.split(/\r?\n/);
      
      // Check if CSV has header row
      const firstLine = lines[0] ? parseCSVLine(lines[0]) : [];
      const hasHeader = firstLine.length > 0 && firstLine[0].toLowerCase() === 'username';
      
      // Skip header row if present
      const dataLines = hasHeader ? lines.slice(1) : lines;
      
      // Parse users and dates from CSV
      const users = [];
      const datesFromFile = new Map();
      
      for (const line of dataLines) {
        if (!line.trim()) continue;
        
        const values = parseCSVLine(line);
        const username = values[0]?.trim();
        
        if (username && username.length > 0) {
          users.push(username);
          
          // If CSV has date column, parse it
          if (values.length >= 2) {
            const dateValue = values[1];
            const parsedDate = parseRegistrationDate(dateValue);
            if (parsedDate) {
              datesFromFile.set(username, parsedDate);
            }
          }
        }
      }
      
      if (users.length === 0) {
        showStatus("CSV dosyasında kullanıcı bulunamadı", true);
        return;
      }
      
      // Populate textarea with usernames
      const textarea = document.getElementById("userList");
      textarea.value = users.join('\n');
      saveAuthorListToStorage();
      
      // Save dates from CSV file to cache (if any)
      if (datesFromFile.size > 0) {
        await storageHandler.saveRegistrationDatesBatch(datesFromFile);
        showStatus(`${users.length} yazar yüklendi ve kaydedildi. ${datesFromFile.size} kayıt tarihi önbelleğe alındı.`);
      } else {
        showStatus(`${users.length} yazar yüklendi ve kaydedildi.`);
      }
      
    } catch (error) {
      console.error("CSV import error:", error);
      showStatus("CSV dosyası okunamadı: " + error.message, true);
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

import * as enums from './enums.js';
import {commHandler} from './commHandler.js';
import {config, handleConfig, saveConfig} from './config.js';
import { storageHandler } from './storageHandler.js';

document.addEventListener('DOMContentLoaded', async function () {

  // load the current configuration from storage
  await handleConfig();
  console.log("sendData:" + config.sendData);
  console.log("enableTitleBan:" + config.enableTitleBan);
  console.log("enableNoobBan:" + config.enableNoobBan);
  console.log("enableMute:" + config.enableMute);
  console.log("enableProtectFollowedUsers:" + config.enableProtectFollowedUsers);
  console.log("enableOnlyRequiredActions:" + config.enableOnlyRequiredActions);
  console.log("banPremiumIcons:" + config.banPremiumIcons);
  if(!config)
  {
    alert("Konfigurasyon dosyasi bulunamadi.");
    return;
  }
  
  // load the current states to switch buttons
  document.getElementById("sendDataEnabled").checked = config.sendData === true;
  document.getElementById("sendDataDisabled").checked = config.sendData !== true;
  document.getElementById("titleBanEnabled").checked = config.enableTitleBan === true;
  document.getElementById("titleBanDisabled").checked = config.enableTitleBan !== true;
  document.getElementById("noobBanEnabled").checked = config.enableNoobBan === true;
  document.getElementById("noobBanDisabled").checked = config.enableNoobBan !== true;
  document.getElementById("muteEnabled").checked = config.enableMute === true;
  document.getElementById("muteDisabled").checked = config.enableMute !== true;
  document.getElementById("protectFollowedUsersEnabled").checked = config.enableProtectFollowedUsers === true;
  document.getElementById("protectFollowedUsersDisabled").checked = config.enableProtectFollowedUsers !== true;
  document.getElementById("onlyRequiredActionsEnabled").checked = config.enableOnlyRequiredActions === true;
  document.getElementById("onlyRequiredActionsDisabled").checked = config.enableOnlyRequiredActions !== true;
  document.getElementById("banPremiumIconsEnabled").checked = config.banPremiumIcons === true;
  document.getElementById("banPremiumIconsDisabled").checked = config.banPremiumIcons !== true;

  // add onclick function to two state radio buttons
  document.getElementById("sendDataEnabled").addEventListener("click", function(element) {
    sendDataSwitchOnClick();
  });
  document.getElementById("sendDataDisabled").addEventListener("click", function(element) {
    sendDataSwitchOnClick();
  });

  // add onclick function to two state radio buttons
  document.getElementById("titleBanEnabled").addEventListener("click", function(element) {
    titleBanSwitchOnClick();
  });
  document.getElementById("titleBanDisabled").addEventListener("click", function(element) {
    titleBanSwitchOnClick();
  });
  
  // add onclick function to two state radio buttons
  document.getElementById("noobBanEnabled").addEventListener("click", function(element) {
    noobBanSwitchOnClick();
  });
  document.getElementById("noobBanDisabled").addEventListener("click", function(element) {
    noobBanSwitchOnClick();
  });
  
  // add onclick function to two state radio buttons
  document.getElementById("muteEnabled").addEventListener("click", function(element) {
    muteSwitchOnClick();
  });
  document.getElementById("muteDisabled").addEventListener("click", function(element) {
    muteSwitchOnClick();
  });
    
  // add onclick function to two state radio buttons
  document.getElementById("protectFollowedUsersEnabled").addEventListener("click", function(element) {
    protectFollowedUsersSwitchOnClick();
  });
  document.getElementById("protectFollowedUsersDisabled").addEventListener("click", function(element) {
    protectFollowedUsersSwitchOnClick();
  });

  // add onclick function to two state radio buttons
  document.getElementById("onlyRequiredActionsEnabled").addEventListener("click", function(element) {
    onlyRequiredActionsSwitchOnClick();
  });
  document.getElementById("onlyRequiredActionsDisabled").addEventListener("click", function(element) {
    onlyRequiredActionsSwitchOnClick();
  });

  // add onclick function to two state radio buttons
  document.getElementById("banPremiumIconsEnabled").addEventListener("click", function(element) {
    banPremiumIconsSwitchOnClick();
  });
  document.getElementById("banPremiumIconsDisabled").addEventListener("click", function(element) {
    banPremiumIconsSwitchOnClick();
  });

  // Storage management
  await updateStorageUsageDisplay();
  document.getElementById('clearStoredData')?.addEventListener('click', handleClearStoredData);

  // Initialize theme on load
  initTheme();
  setupThemeToggle();
});

function sendDataSwitchOnClick()
{
	config.sendData = document.getElementById("sendDataEnabled").checked;
	console.log("sendData:" + config.sendData);
	saveConfig(config);
}

function muteSwitchOnClick()
{
	config.enableMute = document.getElementById("muteEnabled").checked;
	console.log("enableMute:" + config.enableMute);
	saveConfig(config);
}

function titleBanSwitchOnClick()
{
	config.enableTitleBan = document.getElementById("titleBanEnabled").checked;
	console.log("enableTitleBan:" + config.enableTitleBan);
	saveConfig(config);
}

function noobBanSwitchOnClick()
{
	config.enableNoobBan = document.getElementById("noobBanEnabled").checked;
	console.log("enableNoobBan:" + config.enableNoobBan);
	saveConfig(config);
}

function protectFollowedUsersSwitchOnClick()
{
	config.enableProtectFollowedUsers = document.getElementById("protectFollowedUsersEnabled").checked;
	console.log("enableProtectFollowedUsers:" + config.enableProtectFollowedUsers);
	saveConfig(config);
}

function onlyRequiredActionsSwitchOnClick()
{
	config.enableOnlyRequiredActions = document.getElementById("onlyRequiredActionsEnabled").checked;
	console.log("enableOnlyRequiredActions:" + config.enableOnlyRequiredActions);
	saveConfig(config);
}

function banPremiumIconsSwitchOnClick()
{
	config.banPremiumIcons = document.getElementById("banPremiumIconsEnabled").checked;
	console.log("banPremiumIcons:" + config.banPremiumIcons);
	saveConfig(config);
}

async function updateStorageUsageDisplay() {
  try {
    const bytesInUse = await storageHandler.getStorageUsage();
    const kbInUse = Math.round(bytesInUse / 1024);
    const mbInUse = (bytesInUse / (1024 * 1024)).toFixed(2);
    
    const storageUsageSpan = document.getElementById('storageUsage');
    if (storageUsageSpan) {
      storageUsageSpan.textContent = `${mbInUse} MB (${kbInUse} KB)`;
    }
  } catch (error) {
    console.warn('Failed to get storage usage:', error);
    const storageUsageSpan = document.getElementById('storageUsage');
    if (storageUsageSpan) {
      storageUsageSpan.textContent = "Hata";
    }
  }
}

async function handleClearStoredData() {
  if (!confirm("Saklanan kuyruk ve tamamlanan işlem verilerini temizlemek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
    return;
  }
  
  const clearButton = document.getElementById('clearStoredData');
  if (clearButton) {
    clearButton.disabled = true;
    clearButton.textContent = '⏳ Temizleniyor...';
  }
  
  try {
    await storageHandler.clearPersistedData();
    await updateStorageUsageDisplay();
    alert("Saklanan veriler temizlendi.");
  } catch (error) {
    console.error('Failed to clear stored data:', error);
    alert("Veriler temizlenirken hata oluştu: " + error.message);
  } finally {
    if (clearButton) {
      clearButton.disabled = false;
      clearButton.textContent = '🗑️ Saklanan Verileri Temizle';
    }
  }
}

// Dark Mode Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  updateThemeButtons(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function updateThemeButtons(activeTheme) {
  const lightBtn = document.getElementById('themeLight');
  const darkBtn = document.getElementById('themeDark');
  
  if (lightBtn && darkBtn) {
    if (activeTheme === 'light') {
      lightBtn.classList.add('active');
      darkBtn.classList.remove('active');
    } else {
      lightBtn.classList.remove('active');
      darkBtn.classList.add('active');
    }
  }
}

function setupThemeToggle() {
  const lightBtn = document.getElementById('themeLight');
  const darkBtn = document.getElementById('themeDark');
  
  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      applyTheme('light');
      updateThemeButtons('light');
    });
  }
  
  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      applyTheme('dark');
      updateThemeButtons('dark');
    });
  }
}


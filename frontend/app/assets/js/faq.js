import * as enums from './enums.js';
import {commHandler} from './commHandler.js';
import {config, handleConfig, saveConfig} from './config.js';

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


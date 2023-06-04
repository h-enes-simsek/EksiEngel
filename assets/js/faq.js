import * as enums from './enums.js';
import {commHandler} from './commHandler.js';
import {config, handleConfig, saveConfig} from './config.js';

document.addEventListener('DOMContentLoaded', async function () {

  // load the current configuration from storage
  await handleConfig();
  console.log("sendData:" + config.sendData + ", sendClientName:" + config.sendClientName);
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
  
  // link about restrictions applied by eksisozluk 
  linkAboutLimit.onclick = function(element) {
    commHandler.sendAnalyticsData({click_type:enums.ClickType.FAQ_LINK_ENTRY_LIMIT});
  };
  linkAboutLimit.href = `${config.EksiSozlukURL}/eksi-sozlukun-yazar-engellemeye-sinir-getirmesi--7547420`;

  // load the current configuration to switch buttons
	if(!config.sendData)
	{
		document.getElementById("threeStateNone").checked = true;
		document.getElementById("threeStateSwitchText").innerHTML = "Hiçbir veriniz <b style='color:green'>Ekşi Engel</b> sunucularına gönderilmiyor.";
	}
	else if(!config.sendClientName)
	{
		document.getElementById("threeStateOnlyList").checked = true;
		document.getElementById("threeStateSwitchText").innerHTML = "Engel listeniz <b style='color:green'>Ekşi Engel</b> sunucularına gönderiliyor. (Kullanıcı adınız gönderilmiyor.)";
	}
	else
	{
		document.getElementById("threeStateBoth").checked = true;
		document.getElementById("threeStateSwitchText").innerHTML = "Ekşi Sözlük kullanıcı adınız ve engel listeniz <b style='color:green'>Ekşi Engel</b> sunucularına gönderiliyor.";
	}

  // load the current states to switch buttons
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

  // add onclick function to three state radio buttons
  document.getElementById("threeStateNone").addEventListener("click", function(element) {
		document.getElementById("threeStateSwitchText").innerHTML = "Hiçbir veriniz <b style='color:green'>Ekşi Engel</b> sunucularına gönderilmiyor.";
    threeStateSwitchOnClick();
  });
	document.getElementById("threeStateOnlyList").addEventListener("click", function(element) {
		document.getElementById("threeStateSwitchText").innerHTML = "Log verileri <b style='color:green'>Ekşi Engel</b> sunucularına gönderiliyor. (Kullanıcı adınız gönderilmiyor.)";
    threeStateSwitchOnClick();
  });
	document.getElementById("threeStateBoth").addEventListener("click", function(element) {
		document.getElementById("threeStateSwitchText").innerHTML = "Ekşi Sözlük kullanıcı adınız ve log verileri <b style='color:green'>Ekşi Engel</b> sunucularına gönderiliyor.";
    threeStateSwitchOnClick();
  });
  
  // add onclick function to two state radio buttons
  document.getElementById("noobBanEnabled").addEventListener("click", function(element) {
		//document.getElementById("noobBanSwitchText").innerHTML = "";
    noobBanSwitchOnClick();
  });
  document.getElementById("noobBanDisabled").addEventListener("click", function(element) {
		//document.getElementById("noobBanSwitchText").innerHTML = "";
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

function threeStateSwitchOnClick()
{
	config.sendData = !document.getElementById("threeStateNone").checked;
	config.sendClientName = document.getElementById("threeStateBoth").checked;
  
  // kindly ask the user to send at least anonymous data to the server
  let res;
  if(!config.sendData)
  {
    res = confirm("Ekşi Engeli sorunsuzca geliştirmeye devam ettirmek için log verilerine ihtiyacımız var.\n" + 
                  "Verileri anonim olarak olarak göndermek ister misiniz?");
    if(res)
    {
      // user changed his/her idea
      document.getElementById("threeStateOnlyList").click();
      return;
    }
  }
    
	console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
	saveConfig(config);
}

function muteSwitchOnClick()
{
	config.enableMute = document.getElementById("muteEnabled").checked;
	console.log("enableMute:" + config.enableMute);
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


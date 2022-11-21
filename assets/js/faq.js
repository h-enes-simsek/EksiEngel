document.addEventListener('DOMContentLoaded', async function () {
  // load the current configuration from storage
  let config = await getConfig();
  console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
  if(!config)
    return;
  
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
  
  // add onclick function to three state radio buttons
  document.getElementById("threeStateNone").addEventListener("click", function(element) {
		threeStateSwitchOnClick(config);
		document.getElementById("threeStateSwitchText").innerHTML = "Hiçbir veriniz <b style='color:green'>Ekşi Engel</b> sunucularına gönderilmiyor.";
	});
	document.getElementById("threeStateOnlyList").addEventListener("click", function(element) {
		threeStateSwitchOnClick(config);
		document.getElementById("threeStateSwitchText").innerHTML = "Engel listeniz <b style='color:green'>Ekşi Engel</b> sunucularına gönderiliyor. (Kullanıcı adınız gönderilmiyor.)";
	});
	document.getElementById("threeStateBoth").addEventListener("click", function(element) {
		threeStateSwitchOnClick(config);
		document.getElementById("threeStateSwitchText").innerHTML = "Ekşi Sözlük kullanıcı adınız ve engel listeniz <b style='color:green'>Ekşi Engel</b> sunucularına gönderiliyor.";
	});
});

function threeStateSwitchOnClick(config)
{
	config.sendData = !document.getElementById("threeStateNone").checked;
	config.sendClientName = document.getElementById("threeStateBoth").checked;
	console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
	saveConfig(config);
}

async function getConfig()
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("config", function(items){
      if(!chrome.runtime.error)
      {
        if(items != undefined && items.config != undefined && Object.keys(items.config).length != 0)
        {
          resolve(items.config);  
        }
        else 
        {
          alert("Konfigurasyon dosyasi bulunamadi.");
          resolve("");
        }
      }
      else 
      {
        alert("Konfigurasyon dosyasi bulunamadi_2.");
        resolve("");
      }
    }); 
  });
}

async function saveConfig(config)
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ "config": config }, function(){
      if(chrome.runtime.error){
        resolve(false);
      }else{
        // send message to background script that config is updated
        chrome.runtime.sendMessage(null, {"config":0});
        resolve(true);
      }
    });
  });
}

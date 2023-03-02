document.addEventListener('DOMContentLoaded', async function () {
  // load the current configuration from storage
  let config = await getConfig();
  console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
  console.log("enableNoobBan:" + config.enableNoobBan);
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
  
  // load the current configuration to switch buttons
  if(config.enableNoobBan)
  {
    document.getElementById("noobBanEnabled").checked = true;
    //document.getElementById("noobBanSwitchText").innerHTML = "";
  }
  else
  {
    document.getElementById("noobBanDisabled").checked = true;
    //document.getElementById("noobBanSwitchText").innerHTML = "";
  }
  
  // add onclick function to three state radio buttons
  document.getElementById("threeStateNone").addEventListener("click", function(element) {
		document.getElementById("threeStateSwitchText").innerHTML = "Hiçbir veriniz <b style='color:green'>Ekşi Engel</b> sunucularına gönderilmiyor.";
    threeStateSwitchOnClick(config);
  });
	document.getElementById("threeStateOnlyList").addEventListener("click", function(element) {
		document.getElementById("threeStateSwitchText").innerHTML = "Log verileri <b style='color:green'>Ekşi Engel</b> sunucularına gönderiliyor. (Kullanıcı adınız gönderilmiyor.)";
    threeStateSwitchOnClick(config);
  });
	document.getElementById("threeStateBoth").addEventListener("click", function(element) {
		document.getElementById("threeStateSwitchText").innerHTML = "Ekşi Sözlük kullanıcı adınız ve log verileri <b style='color:green'>Ekşi Engel</b> sunucularına gönderiliyor.";
    threeStateSwitchOnClick(config);
  });
  
  // add onclick function to three state radio buttons
  document.getElementById("noobBanEnabled").addEventListener("click", function(element) {
		//document.getElementById("noobBanSwitchText").innerHTML = "";
    noobBanSwitchOnClick(config);
  });
  document.getElementById("noobBanDisabled").addEventListener("click", function(element) {
		//document.getElementById("noobBanSwitchText").innerHTML = "";
    noobBanSwitchOnClick(config);
  });
});

function threeStateSwitchOnClick(config)
{
	config.sendData = !document.getElementById("threeStateNone").checked;
	config.sendClientName = document.getElementById("threeStateBoth").checked;
  
  // kindly ask the user to send at least anonymous data to the server
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

function noobBanSwitchOnClick(config)
{
	config.enableNoobBan = document.getElementById("noobBanEnabled").checked;
	console.log("enableNoobBan:" + config.enableNoobBan);
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

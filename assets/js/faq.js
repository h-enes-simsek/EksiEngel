document.addEventListener('DOMContentLoaded', async function () {
  // load the current configuration from storage
  let config = await getConfig();
  console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
  if(!config)
    return;
  
  // load the current configuration to switch buttons
  document.getElementById("sendData").checked = config.sendData;
  document.getElementById("sendClientName").checked = config.sendClientName;
  
  // sendData switch button onlick
  document.getElementById("sendData").addEventListener("click", function(element) {
    config.sendData = document.getElementById("sendData").checked;
    config.sendClientName = config.sendData;
    document.getElementById("sendClientName").checked = config.sendClientName;
    
    console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
    saveConfig(config);
  });

  // sendClientName switch button onlick
  document.getElementById("sendClientName").addEventListener("click", function(element) {
    config.sendClientName = document.getElementById("sendClientName").checked;
    console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
    saveConfig(config);
  });
});

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

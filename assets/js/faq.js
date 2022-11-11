document.addEventListener('DOMContentLoaded', async function () {
  // set current configuration
  let config = await getConfig();
  console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
  document.getElementById("sendData").checked = config.sendData;
  document.getElementById("sendClientName").checked = config.sendClientName;
  
  document.getElementById("sendData").addEventListener("click", function(element) {
    config.sendData = document.getElementById("sendData").checked;
    config.sendClientName = config.sendData;
    document.getElementById("sendClientName").checked = config.sendClientName;
    
    console.log("sendData:" + config.sendData + " sendClientName:" + config.sendClientName);
    saveConfig(config);
  });

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
          alert("Konfigürasyon dosyası bulunamadı.");
          resolve();
        }
      }
      else 
      {
        alert("Konfigürasyon dosyası bulunamadı_2.");
        resolve();
      }
    }); 
  });
}

async function saveConfig(config)
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ "config": config }, function(){
      if(!chrome.runtime.error){
        resolve(true);
      }else{
        resolve(false);
      }
    });
  });
}

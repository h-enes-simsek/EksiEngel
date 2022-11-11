const configDefault = 
{
	"serverURL": 				"https://eksiengel.hesimsek.com/client_data_collector/upload",
	"sendData": 				true,														  /* send data to server */
		"sendClientName": true,															/* send client name to server */
		"sendLog": 				true,															/* send log data to server */
	
	"enableLog": 				true,														  /* enable/disable logger */
		"logConsole": 		false, 														/* log into console as well */
	
	"anonymouseClientName": "anonymouse",									/* client name if sendClientName false */
	"erroneousText": 				"",											      /* default text if smt goes wrong */
	"erroneousInt": 				"0",													/* default int if smt goes wrong */
};

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
          resolve(configDefault);
        }
      }
      else 
      {
        resolve(configDefault);
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


import * as enums from './enums.js';
import * as utils from './utils.js';
import {log} from './log.js';

export let config = 
{
  "EksiSozlukURL":      "https://eksisozluk1923.com",
  "whereIsEksiSozlukURL":"https://eksiengel.hesimsek.com/where_is_eksisozluk",
	"serverURL": 				  "https://eksiengel.hesimsek.com/client_data_collector/upload",
	"serverAnalyticsURL": "https://eksiengel.hesimsek.com/client_data_collector/analytics",
	"sendData": 				  true,														  /* send data to server */
		"sendClientName":   true,															/* send client name to server */
		"sendLog": 				  true,															/* send log data to server */
	
	"enableLog": 				  true,														  /* enable/disable logger */
		"logConsole": 		  true, 														/* log into console as well */
    
  "enableNoobBan":      false,                            /* enable/disable noob author scraping for FAV */
  "enableMute":         false,                            /* enable/disable TargetType.MUTE operations */
  
  "enableAnalysisBeforeOperation": true,                  /* do analysis before performing any operation */
    "enableOnlyRequiredActions": true,                   /* do analysis to reduce unnecessary blocking/unblocking actions */
    "enableProtectFollowedUsers": true,                   /* do not block if an author is followed by the user */
	
	"anonymouseClientName": "anonymouse",									  /* client name if sendClientName false */
	"erroneousText": 				"",											        /* default text if smt goes wrong */
	"erroneousInt": 				"0", 													  /* default int if smt goes wrong */
};

export async function getConfig()
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("config", function(items){
      if(!chrome.runtime.error)
      {
        if(items != undefined && items.config != undefined && Object.keys(items.config).length !== 0)
        {
          resolve(items.config);  
        }
        else 
        {
          resolve(false);
        }
      }
      else 
      {
        resolve(false);
      }
    }); 
  });
}

export async function saveConfig(config)
{
  log.info("A config saved into storage");
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

// load config from storage, if not exist save default config storage
export async function handleConfig()
{
  let c = await getConfig();
  if(c)
  {
    log.info("Config restored from storage");
    config = c;
  }
  else
  {
    log.info("No config in storage, hardcoded config will be saved into storage");
    saveConfig(config);
  }
}

// listen to update config from settings
chrome.runtime.onMessage.addListener(async function messageListener_Faq(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	const obj = utils.filterMessage(message, "config");
	if(obj.resultType === enums.ResultType.FAIL)
		return;
  
  // config in storage updated by settings, load it.
  log.info("Config updated by faq");
  await handleConfig();
});
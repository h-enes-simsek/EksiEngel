import * as enums from './enums.js';
import {log} from './log.js';

let config =
{
  "EksiSozlukURL":       "https://eksisozluk.com",
  "serverURL":           "https://eksiengel.hesimsek.com/api/action/",

  "sendData":           true,                             /* send data to server */   
    "sendLog":          true,                             /* send log data to server */
  
  "enableLog":          true,                             /* enable/disable logger */
    "logConsole":       true,                             /* log into console as well */
    
  "enableNoobBan":      false,                            /* enable/disable noob author scraping for FAV */
  "enableMute":         false,                            /* enable/disable TargetType.MUTE operations */
  "enableTitleBan":     true,                             /* enable/disable title ban */
  
  "enableAnalysisBeforeOperation": true,                  /* do analysis before performing any operation */
    "enableOnlyRequiredActions": false,                    /* do analysis to reduce unnecessary blocking/unblocking actions */
    "enableProtectFollowedUsers": false,                   /* do not block if an author is followed by the user */
    
  "banPremiumIcons": false                               /* hide premium icons, green and yellow badges */
};

export async function getConfig()
{
  const items = await chrome.storage.local.get("config");

  if(items != undefined && items.config != undefined && Object.keys(items.config).length !== 0)
  {
    return items.config;
  }

  return false;
}

export async function saveConfig(config)
{
  await chrome.storage.local.set({ "config": config });
  log.info("config", "A config saved into storage");
  return true;
}

// load config from storage, if not exist save default config storage
export async function handleConfig()
{
  let c = await getConfig();
  if(c)
  {
    log.info("config", "Config restored from storage");
    config = c;
  }
  else
  {
    log.info("config", "No config in storage, hardcoded config will be saved into storage");
    await saveConfig(config);
  }

  return config;
}

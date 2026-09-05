import * as enums from './enums.js';
import {log} from './log.js';

export const CONFIG_VERSION = 1;

let config =
{
  "configVersion":     CONFIG_VERSION,                               // integer config schema version
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

export async function saveConfig(configToSave)
{
  const mergedConfig = {
    ...config,
    ...configToSave,
    configVersion: CONFIG_VERSION
  };

  await chrome.storage.local.set({
    config: mergedConfig
  });

  log.info("config", "Config saved into storage");

  return true;
}

// load config from storage, if not exist save default config storage
export async function handleConfig()
{
  const storedConfig = await getConfig();

  if (storedConfig)
  {
    log.info("config", "Config restored from storage");

    config = {
      ...config,          // default/hardcoded values
      ...storedConfig,    // preserve user's existing values
      configVersion: CONFIG_VERSION // ensure configVersion is always the latest
    };

    await saveConfig(config);
  }
  else
  {
    log.info("config", "No config in storage, hardcoded config will be saved into storage");
    await saveConfig(config);
  }

  return config;
}
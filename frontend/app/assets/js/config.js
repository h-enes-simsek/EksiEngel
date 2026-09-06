export const CONFIG_VERSION = 1;

const authoritativeConfigValues =
{
  "configVersion":       CONFIG_VERSION,
  "EksiSozlukURL":       "https://eksisozluk.com",
  "serverURL":           "https://eksiengel.hesimsek.com/api/action/"
};

let config =
{
  ...authoritativeConfigValues,

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
    ...authoritativeConfigValues
  };

  await chrome.storage.local.set({
    config: mergedConfig
  });
  return true;
}

// load config from storage, if not exist save default config storage
export async function handleConfig()
{
  const storedConfig = await getConfig();

  if (storedConfig)
  {
    config = {
      ...config,          // default/hardcoded values
      ...storedConfig,    // preserve user's existing values
      ...authoritativeConfigValues // ensure application-controlled values are always the latest
    };

    await saveConfig(config);
  }
  else
  {
    await saveConfig(config);
  }

  return config;
}

import {handleConfig, saveConfig} from './config.js';

const settingControls = [
  {key: "sendData", enabledId: "sendDataEnabled", disabledId: "sendDataDisabled"},
  {key: "enableTitleBan", enabledId: "titleBanEnabled", disabledId: "titleBanDisabled"},
  {key: "enableNoobBan", enabledId: "noobBanEnabled", disabledId: "noobBanDisabled"},
  {key: "enableMute", enabledId: "muteEnabled", disabledId: "muteDisabled"},
  {
    key: "enableProtectFollowedUsers",
    enabledId: "protectFollowedUsersEnabled",
    disabledId: "protectFollowedUsersDisabled"
  },
  {
    key: "enableOnlyRequiredActions",
    enabledId: "onlyRequiredActionsEnabled",
    disabledId: "onlyRequiredActionsDisabled"
  },
  {
    key: "banPremiumIcons",
    enabledId: "banPremiumIconsEnabled",
    disabledId: "banPremiumIconsDisabled"
  }
];

function bindSettingControl(settings, {key, enabledId, disabledId})
{
  const enabledInput = document.getElementById(enabledId);
  const disabledInput = document.getElementById(disabledId);
  const isEnabled = settings[key] === true;

  enabledInput.checked = isEnabled;
  disabledInput.checked = !isEnabled;

  const saveSelectedValue = () =>
  {
    settings[key] = enabledInput.checked;
    console.log(`${key}:${settings[key]}`);
    void saveConfig(settings).catch(error =>
      console.error(`Failed to save ${key}:`, error)
    );
  };

  enabledInput.addEventListener("click", saveSelectedValue);
  disabledInput.addEventListener("click", saveSelectedValue);
}

document.addEventListener('DOMContentLoaded', async function () {
  let settings;
  try
  {
    settings = await handleConfig();
  }
  catch(error)
  {
    console.error("Failed to load configuration:", error);
    alert("Konfigurasyon dosyasi bulunamadi.");
    return;
  }

  if(!settings)
  {
    alert("Konfigurasyon dosyasi bulunamadi.");
    return;
  }

  for(const control of settingControls)
  {
    console.log(`${control.key}:${settings[control.key]}`);
    bindSettingControl(settings, control);
  }
});

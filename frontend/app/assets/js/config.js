import * as enums from './enums.js';
import * as utils from './utils.js';
import {log} from './log.js';

export let config = {
  "EksiSozlukURL": "https://eksisozluk.com",
  "whereIsEksiSozlukURL": "https://eksiengelplus.duzgun.org/api/where_is_eksisozluk",
  "serverURL": "https://eksiengelplus.duzgun.org/api/action/",
  "sendData": true,
  "sendLog": true,
  "enableLog": true,
  "logConsole": true,
  "enableNoobBan": false,
  "enableMute": false,
  "enableTitleBan": true,
  "enableAnalysisBeforeOperation": true,
  "enableOnlyRequiredActions": false,
  "enableProtectFollowedUsers": false,
  "banPremiumIcons": false
};

export async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get("config", (items) => {
      if (!chrome.runtime.error && items && items.config && Object.keys(items.config).length !== 0) resolve(items.config);
      else resolve(false);
    });
  });
}

export async function saveConfig(config) {
  log.info("config", "A config saved into storage");
  return new Promise((resolve) => {
    chrome.storage.local.set({ "config": config }, () => resolve(!chrome.runtime.error));
  });
}

export async function handleConfig() {
  const c = await getConfig();
  if (c) {
    log.info("config", "Config restored from storage");
    Object.assign(config, c);
  } else {
    log.info("config", "No config in storage, hardcoded config will be saved into storage");
    saveConfig(config);
  }
}
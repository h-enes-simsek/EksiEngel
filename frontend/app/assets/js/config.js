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
  "banPremiumIcons": false,
  "enableDateFilter": false,
  "dateFilterRules": []
};

// Helper function to create default date filter rules
export function createDefaultDateFilterRules() {
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  
  return [
    {
      id: "protect-legacy-users",
      criteria: enums.DateFilterCriteria.OLDER_THAN,
      value: 1825, // approximately 5 years in days
      valueType: "days",
      action: enums.DateFilterAction.PROTECT,
      description: "Korumalı: 5 yıldan eski hesaplar",
      isDefault: true
    }
  ];
}

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
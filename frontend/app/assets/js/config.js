import * as enums from './enums.js';
import * as utils from './utils.js';
import {log} from './log.js';

// Shared API key - embedded directly in the extension (not accessible to websites)
const SHARED_API_KEY = "cbjhsabj=iuhfnkenkfjnbekvbkjhdsbkjucbviujsdvnk./.d876fwuj*/8*f";

/**
 * Get the shared API key
 * @returns {string} The shared API key
 */
function getApiKey() {
  return SHARED_API_KEY;
}

export {getApiKey};

// Default config - apiKey loaded from getApiKey()
let defaultConfig = {
  "EksiSozlukURL": "https://eksisozluk.com",
  "whereIsEksiSozlukURL": "https://eksiengelplus.duzgun.org/api/where_is_eksisozluk",
  "serverURL": "https://eksiengelplus.duzgun.org/api/action/",
  "analyticsURL": "https://eksiengelplus.duzgun.org/admin/api/client_data/analytics",
  "apiKey": getApiKey(),
  "sendData": true,
  "sendLog": true,
  "enableLog": true,
  "logConsole": true,
  "enableNoobBan": true,
  "enableMute": true,
  "enableTitleBan": false,
  "enableAnalysisBeforeOperation": true,
  "enableOnlyRequiredActions": false,
  "enableProtectFollowedUsers": true,
  "banPremiumIcons": false,
  "enableDateFilter": false,
  "dateFilterRules": []
};

export let config = {...defaultConfig};

// Helper function to create default date filter rules
export function createDefaultDateFilterRules() {
  return [
    {
      id: "block-new-users",
      criteria: enums.DateFilterCriteria.NEWER_THAN,
      value: 3650,
      valueType: "days",
      action: enums.DateFilterAction.ENGELLE,
      description: "Yapılacak işlem 10 yıldan yeni hesapları kapsar",
      isDefault: true
    }
  ];
}

// Helper function to get default date bulk action config
export function createDefaultDateBulkConfig() {
  return {
    lastSource: enums.DateBulkSource.MUTED_USERS,
    lastCriteria: enums.DateFilterCriteria.OLDER_THAN,
    lastValue: 3650,
    lastValueType: "days",
    lastAction: enums.DateBulkAction.SESSIZDEN_CIKAR
  };
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
  
  // Set API key from getApiKey()
  config.apiKey = getApiKey();
  
  if (c) {
    log.info("config", "Config restored from storage");
    // Merge stored config
    Object.assign(config, c);
    // Ensure API key is set
    config.apiKey = getApiKey();
    if (!config.dateFilterRules || config.dateFilterRules.length === 0) {
      log.info("config", "Applying default date filter rules");
      config.dateFilterRules = createDefaultDateFilterRules();
      saveConfig(config);
    }
  } else {
    log.info("config", "No config in storage, hardcoded config will be saved into storage");
    config.dateFilterRules = createDefaultDateFilterRules();
    saveConfig(config);
  }
}

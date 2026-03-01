import * as enums from './enums.js';
import * as utils from './utils.js';
import {log} from './log.js';

/**
 * Load API key from .env file at runtime
 * @returns {Promise<string>} The API key from .env file
 */
async function loadApiKeyFromEnv() {
  try {
    // Use chrome.runtime.getURL for proper extension path resolution
    const envUrl = chrome.runtime.getURL('.env');
    const response = await fetch(envUrl);
    if (!response.ok) {
      log.warn('config', '.env dosyası yüklenemedi, API anahtarı kullanılmayacak');
      return '';
    }
    const envContent = await response.text();
    const apiKeyMatch = envContent.match(/^API_KEY=(.+)$/m);
    if (apiKeyMatch && apiKeyMatch[1]) {
      const apiKey = apiKeyMatch[1].trim();
      log.info('config', 'API anahtarı .env dosyasından yüklendi');
      return apiKey;
    }
    log.warn('config', '.env dosyasında API_KEY bulunamadı');
    return '';
  } catch (error) {
    log.error('config', '.env dosyası yüklenirken hata: ' + error.message);
    return '';
  }
}

// Default config - apiKey loaded from .env at runtime
let defaultConfig = {
  "EksiSozlukURL": "https://eksisozluk.com",
  "whereIsEksiSozlukURL": "https://eksiengelplus.duzgun.org/api/where_is_eksisozluk",
  "serverURL": "https://eksiengelplus.duzgun.org/api/action/",
  "analyticsURL": "https://eksiengelplus.duzgun.org/client_data_collector/analytics",
  "apiKey": "",  // Loaded from .env at runtime
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
  
  // Load API key from .env file at runtime
  const envApiKey = await loadApiKeyFromEnv();
  if (envApiKey) {
    config.apiKey = envApiKey;
  }
  
  if (c) {
    log.info("config", "Config restored from storage");
    // Merge stored config with runtime-loaded API key from .env
    Object.assign(config, c);
    // Ensure API key from .env takes precedence if available
    if (envApiKey) {
      config.apiKey = envApiKey;
    }
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

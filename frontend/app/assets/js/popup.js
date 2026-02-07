import * as enums from './enums.js';
import { commHandler } from './commHandler.js';
import { config, getConfig, saveConfig } from './config.js';

commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_ICON });

const updateStatus = (message, isError = false, clearAfterMs = 3000) => {
  const popupStatusDiv = document.getElementById('popupStatus');
  if (!popupStatusDiv) return;
  popupStatusDiv.textContent = message;
  popupStatusDiv.style.color = isError ? '#dc3545' : '#333';
  if (clearAfterMs > 0) setTimeout(() => popupStatusDiv.textContent === message && (popupStatusDiv.textContent = ''), clearAfterMs);
};

const handleOpenNotification = () => {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_FAQ });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/notification.html") }, () => window.close());
};

const handleOpenFaq = () => {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_FAQ });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
};

// Date Filter functionality
const initDateFilter = async () => {
  const checkbox = document.getElementById('enableDateFilter');
  const statusDiv = document.getElementById('dateFilterStatus');
  const configureBtn = document.getElementById('configureDateFilter');
  
  if (!checkbox) return;
  
  // Load current config
  const currentConfig = await getConfig();
  if (currentConfig) {
    checkbox.checked = currentConfig.enableDateFilter || false;
    updateDateFilterStatus(currentConfig.enableDateFilter, currentConfig.dateFilterRules, statusDiv, configureBtn);
  }
  
  // Handle toggle
  checkbox.addEventListener('change', async () => {
    const enabled = checkbox.checked;
    
    // Get current config
    const cfg = await getConfig() || config;
    cfg.enableDateFilter = enabled;
    
    // If enabling and no rules exist, add default rule
    if (enabled && (!cfg.dateFilterRules || cfg.dateFilterRules.length === 0)) {
      cfg.dateFilterRules = createDefaultDateFilterRules();
    }
    
    // Save config
    await saveConfig(cfg);
    Object.assign(config, cfg);
    
    updateDateFilterStatus(enabled, cfg.dateFilterRules, statusDiv, configureBtn);
    updateStatus(enabled ? 'Tarih filtresi etkinleştirildi' : 'Tarih filtresi devre dışı bırakıldı');
  });
  
  // Handle configure button click
  configureBtn?.addEventListener('click', () => {
    // For now, open FAQ page. In future, this could open a dedicated config page
    chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
  });
};

const createDefaultDateFilterRules = () => {
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
};

const updateDateFilterStatus = (enabled, rules, statusDiv, configureBtn) => {
  if (!statusDiv) return;
  
  if (enabled) {
    const ruleCount = rules?.length || 0;
    const activeRules = rules?.filter(r => !r.isDefault).length || 0;
    
    if (ruleCount === 0) {
      statusDiv.textContent = 'Aktif - Varsayılan koruma (5 yıl)';
      statusDiv.style.color = '#4CAF50';
    } else if (activeRules > 0) {
      statusDiv.textContent = `Aktif - ${activeRules} özel filtre`;
      statusDiv.style.color = '#4CAF50';
    } else {
      statusDiv.textContent = 'Aktif - Sadece varsayılan koruma';
      statusDiv.style.color = '#4CAF50';
    }
    
    if (configureBtn) configureBtn.style.display = 'block';
  } else {
    statusDiv.textContent = 'Devre dışı';
    statusDiv.style.color = '#999';
    if (configureBtn) configureBtn.style.display = 'none';
  }
};

document.getElementById('openNotification')?.addEventListener('click', handleOpenNotification);
document.getElementById('openFaq')?.addEventListener('click', handleOpenFaq);

// Initialize date filter on load
initDateFilter();

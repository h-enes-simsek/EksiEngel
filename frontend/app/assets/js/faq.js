import * as enums from './enums.js';
import {commHandler} from './commHandler.js';
import {config, handleConfig, saveConfig} from './config.js';
import { storageHandler } from './storageHandler.js';

let currentRules = [];
let editingRuleId = null;

document.addEventListener('DOMContentLoaded', async function () {

  // load the current configuration from storage
  await handleConfig();
  console.log("sendData:" + config.sendData);
  console.log("enableTitleBan:" + config.enableTitleBan);
  console.log("enableNoobBan:" + config.enableNoobBan);
  console.log("enableMute:" + config.enableMute);
  console.log("enableProtectFollowedUsers:" + config.enableProtectFollowedUsers);
  console.log("enableOnlyRequiredActions:" + config.enableOnlyRequiredActions);
  console.log("banPremiumIcons:" + config.banPremiumIcons);
  if(!config)
  {
    alert("Konfigurasyon dosyasi bulunamadi.");
    return;
  }
  
  // load the current states to switch buttons
  document.getElementById("sendDataEnabled").checked = config.sendData === true;
  document.getElementById("sendDataDisabled").checked = config.sendData !== true;
  document.getElementById("titleBanEnabled").checked = config.enableTitleBan === true;
  document.getElementById("titleBanDisabled").checked = config.enableTitleBan !== true;
  document.getElementById("noobBanEnabled").checked = config.enableNoobBan === true;
  document.getElementById("noobBanDisabled").checked = config.enableNoobBan !== true;
  document.getElementById("muteEnabled").checked = config.enableMute === true;
  document.getElementById("muteDisabled").checked = config.enableMute !== true;
  document.getElementById("protectFollowedUsersEnabled").checked = config.enableProtectFollowedUsers === true;
  document.getElementById("protectFollowedUsersDisabled").checked = config.enableProtectFollowedUsers !== true;
  document.getElementById("onlyRequiredActionsEnabled").checked = config.enableOnlyRequiredActions === true;
  document.getElementById("onlyRequiredActionsDisabled").checked = config.enableOnlyRequiredActions !== true;
  document.getElementById("banPremiumIconsEnabled").checked = config.banPremiumIcons === true;
  document.getElementById("banPremiumIconsDisabled").checked = config.banPremiumIcons !== true;

  // add onclick function to two state radio buttons
  document.getElementById("sendDataEnabled").addEventListener("click", function(element) {
    sendDataSwitchOnClick();
  });
  document.getElementById("sendDataDisabled").addEventListener("click", function(element) {
    sendDataSwitchOnClick();
  });

  // add onclick function to two state radio buttons
  document.getElementById("titleBanEnabled").addEventListener("click", function(element) {
    titleBanSwitchOnClick();
  });
  document.getElementById("titleBanDisabled").addEventListener("click", function(element) {
    titleBanSwitchOnClick();
  });
  
  // add onclick function to two state radio buttons
  document.getElementById("noobBanEnabled").addEventListener("click", function(element) {
    noobBanSwitchOnClick();
  });
  document.getElementById("noobBanDisabled").addEventListener("click", function(element) {
    noobBanSwitchOnClick();
  });
  
  // add onclick function to two state radio buttons
  document.getElementById("muteEnabled").addEventListener("click", function(element) {
    muteSwitchOnClick();
  });
  document.getElementById("muteDisabled").addEventListener("click", function(element) {
    muteSwitchOnClick();
  });
    
  // add onclick function to two state radio buttons
  document.getElementById("protectFollowedUsersEnabled").addEventListener("click", function(element) {
    protectFollowedUsersSwitchOnClick();
  });
  document.getElementById("protectFollowedUsersDisabled").addEventListener("click", function(element) {
    protectFollowedUsersSwitchOnClick();
  });

  // add onclick function to two state radio buttons
  document.getElementById("onlyRequiredActionsEnabled").addEventListener("click", function(element) {
    onlyRequiredActionsSwitchOnClick();
  });
  document.getElementById("onlyRequiredActionsDisabled").addEventListener("click", function(element) {
    onlyRequiredActionsSwitchOnClick();
  });

  // add onclick function to two state radio buttons
  document.getElementById("banPremiumIconsEnabled").addEventListener("click", function(element) {
    banPremiumIconsSwitchOnClick();
  });
  document.getElementById("banPremiumIconsDisabled").addEventListener("click", function(element) {
    banPremiumIconsSwitchOnClick();
  });

  // Storage management
  await updateStorageUsageDisplay();
  document.getElementById('clearStoredData')?.addEventListener('click', handleClearStoredData);

  // Initialize theme on load
  initTheme();
  setupThemeToggle();

  // Initialize date filter UI
  setupDateFilterRuleUI();
  loadDateFilterCacheStats();
});

function sendDataSwitchOnClick()
{
	config.sendData = document.getElementById("sendDataEnabled").checked;
	console.log("sendData:" + config.sendData);
	saveConfig(config);
}

function muteSwitchOnClick()
{
	config.enableMute = document.getElementById("muteEnabled").checked;
	console.log("enableMute:" + config.enableMute);
	saveConfig(config);
}

function titleBanSwitchOnClick()
{
	config.enableTitleBan = document.getElementById("titleBanEnabled").checked;
	console.log("enableTitleBan:" + config.enableTitleBan);
	saveConfig(config);
}

function noobBanSwitchOnClick()
{
	config.enableNoobBan = document.getElementById("noobBanEnabled").checked;
	console.log("enableNoobBan:" + config.enableNoobBan);
	saveConfig(config);
}

function protectFollowedUsersSwitchOnClick()
{
	config.enableProtectFollowedUsers = document.getElementById("protectFollowedUsersEnabled").checked;
	console.log("enableProtectFollowedUsers:" + config.enableProtectFollowedUsers);
	saveConfig(config);
}

function onlyRequiredActionsSwitchOnClick()
{
	config.enableOnlyRequiredActions = document.getElementById("onlyRequiredActionsEnabled").checked;
	console.log("enableOnlyRequiredActions:" + config.enableOnlyRequiredActions);
	saveConfig(config);
}

function banPremiumIconsSwitchOnClick()
{
	config.banPremiumIcons = document.getElementById("banPremiumIconsEnabled").checked;
	console.log("banPremiumIcons:" + config.banPremiumIcons);
	saveConfig(config);
}

async function updateStorageUsageDisplay() {
  try {
    const bytesInUse = await storageHandler.getStorageUsage();
    const kbInUse = Math.round(bytesInUse / 1024);
    const mbInUse = (bytesInUse / (1024 * 1024)).toFixed(2);
    
    const storageUsageSpan = document.getElementById('storageUsage');
    if (storageUsageSpan) {
      storageUsageSpan.textContent = `${mbInUse} MB (${kbInUse} KB)`;
    }
  } catch (error) {
    console.warn('Failed to get storage usage:', error);
    const storageUsageSpan = document.getElementById('storageUsage');
    if (storageUsageSpan) {
      storageUsageSpan.textContent = "Hata";
    }
  }
}

async function handleClearStoredData() {
  if (!confirm("Saklanan kuyruk ve tamamlanan işlem verilerini temizlemek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
    return;
  }
  
  const clearButton = document.getElementById('clearStoredData');
  if (clearButton) {
    clearButton.disabled = true;
    clearButton.textContent = '⏳ Temizleniyor...';
  }
  
  try {
    await storageHandler.clearPersistedData();
    await updateStorageUsageDisplay();
    alert("Saklanan veriler temizlendi.");
  } catch (error) {
    console.error('Failed to clear stored data:', error);
    alert("Veriler temizlenirken hata oluştu: " + error.message);
  } finally {
    if (clearButton) {
      clearButton.disabled = false;
      clearButton.textContent = '🗑️ Saklanan Verileri Temizle';
    }
  }
}

// Dark Mode Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  updateThemeButtons(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function updateThemeButtons(activeTheme) {
  const lightBtn = document.getElementById('themeLight');
  const darkBtn = document.getElementById('themeDark');
  
  if (lightBtn && darkBtn) {
    if (activeTheme === 'light') {
      lightBtn.classList.add('active');
      darkBtn.classList.remove('active');
    } else {
      lightBtn.classList.remove('active');
      darkBtn.classList.add('active');
    }
  }
}

function setupThemeToggle() {
  const lightBtn = document.getElementById('themeLight');
  const darkBtn = document.getElementById('themeDark');
  
  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      applyTheme('light');
      updateThemeButtons('light');
    });
  }
  
  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      applyTheme('dark');
      updateThemeButtons('dark');
    });
  }
}

// ============================================
// DATE FILTER RULE MANAGEMENT
// ============================================

function setupDateFilterRuleUI() {
  const addRuleBtn = document.getElementById('addNewRuleBtn');
  if (addRuleBtn) {
    addRuleBtn.addEventListener('click', showRuleForm);
  }
  
  const saveRuleBtn = document.getElementById('saveRuleBtn');
  if (saveRuleBtn) {
    saveRuleBtn.addEventListener('click', saveRule);
  }
  
  const cancelRuleBtn = document.getElementById('cancelRuleBtn');
  if (cancelRuleBtn) {
    cancelRuleBtn.addEventListener('click', hideRuleForm);
  }
  
  const criteriaSelect = document.getElementById('ruleCriteria');
  if (criteriaSelect) {
    criteriaSelect.addEventListener('change', handleCriteriaChange);
  }
  
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', clearDateFilterCache);
  }
  
  loadDateFilterRules();
}

async function loadDateFilterRules() {
  try {
    await handleConfig();
    
    currentRules = config.dateFilterRules || [];
    renderRulesList();
    
  } catch (error) {
    console.error('Error loading date filter rules:', error);
  }
}

function createDefaultRule() {
  return {
    id: 'block-new-users',
    criteria: 'NEWER_THAN',
    value: 3650,
    valueType: 'days',
    action: 'ENGELLE',
    description: '10 yıldan yeni hesapları engelle',
    isDefault: true
  };
}

function renderRulesList() {
  const rulesList = document.getElementById('rulesList');
  const rulesCount = document.getElementById('rulesCount');
  
  if (!rulesList) return;
  
  if (rulesCount) {
    const count = currentRules.length;
    rulesCount.textContent = `${count} kural`;
  }
  
  rulesList.innerHTML = '';
  
  currentRules.forEach((rule, index) => {
    const ruleElement = createRuleElement(rule, index);
    rulesList.appendChild(ruleElement);
  });
}

function createRuleElement(rule, index) {
  const div = document.createElement('div');
  div.className = 'rule-item';
  div.dataset.ruleId = rule.id;
  
  const action = rule.action === 'BLOCK' ? 'ENGELLE' : rule.action;
  const icon = '🚫';
  
  let criteriaText = formatCriteriaText(rule);
  
  div.innerHTML = `
    <div class="rule-icon">${icon}</div>
    <div class="rule-content">
      <div class="rule-title">${getActionText(action)} - ${criteriaText}</div>
      <div class="rule-description">${rule.description || criteriaText}</div>
    </div>
    ${rule.isDefault ? '<span class="rule-badge">Varsayılan</span>' : ''}
    <div class="rule-actions">
      <button class="rule-btn rule-btn-edit" title="Düzenle">✏️</button>
      <button class="rule-btn rule-btn-delete" title="Sil">🗑️</button>
    </div>
  `;
  
  const editBtn = div.querySelector('.rule-btn-edit');
  const deleteBtn = div.querySelector('.rule-btn-delete');
  
  editBtn.addEventListener('click', () => editRule(rule.id));
  deleteBtn.addEventListener('click', () => deleteRule(rule.id));
  
  return div;
}

function formatCriteriaText(rule) {
  const criteriaMap = {
    'NEWER_THAN': 'Hesap yaşı <',
    'OLDER_THAN': 'Hesap yaşı >',
    'BEFORE_DATE': 'Kayıt tarihi <',
    'AFTER_DATE': 'Kayıt tarihi >'
  };
  
  if (rule.criteria === 'BEFORE_DATE' || rule.criteria === 'AFTER_DATE') {
    const date = new Date(rule.value);
    return `${criteriaMap[rule.criteria]} ${date.toLocaleDateString('tr-TR')}`;
  } else {
    let value = rule.value;
    let unit = rule.valueType === 'days' ? 'gün' : (rule.valueType === 'months' ? 'ay' : 'yıl');
    return `${criteriaMap[rule.criteria]} ${value} ${unit}`;
  }
}

function getActionText(action) {
  const actionMap = {
    'ENGELLE': 'Engelle',
    'BLOCK': 'Engelle'
  };
  return actionMap[action] || action;
}

function showRuleForm() {
  editingRuleId = null;
  document.getElementById('ruleFormTitle').textContent = '📝 Yeni Kural Ekle';
  document.getElementById('ruleId').value = '';
  document.getElementById('ruleIsDefault').value = 'false';
  
  document.getElementById('ruleCriteria').value = 'NEWER_THAN';
  document.getElementById('ruleValueDays').value = '30';
  document.getElementById('ruleUnit').value = 'days';
  document.getElementById('ruleAction').value = 'ENGELLE';
  document.getElementById('ruleDescription').value = '';
  
  handleCriteriaChange();
  
  document.getElementById('ruleFormSection').style.display = 'block';
  document.getElementById('addNewRuleBtn').style.display = 'none';
}

function hideRuleForm() {
  document.getElementById('ruleFormSection').style.display = 'none';
  document.getElementById('addNewRuleBtn').style.display = 'block';
  editingRuleId = null;
}

function editRule(ruleId) {
  const rule = currentRules.find(r => r.id === ruleId);
  if (!rule) return;
  
  editingRuleId = ruleId;
  document.getElementById('ruleFormTitle').textContent = '✏️ Kuralı Düzenle';
  document.getElementById('ruleId').value = rule.id;
  document.getElementById('ruleIsDefault').value = rule.isDefault ? 'true' : 'false';
  
  document.getElementById('ruleCriteria').value = rule.criteria;
  document.getElementById('ruleAction').value = rule.action;
  document.getElementById('ruleDescription').value = rule.description || '';
  
  if (rule.criteria === 'BEFORE_DATE' || rule.criteria === 'AFTER_DATE') {
    document.getElementById('ruleValueDate').value = rule.value;
  } else {
    document.getElementById('ruleValueDays').value = rule.value;
    document.getElementById('ruleUnit').value = rule.valueType || 'days';
  }
  
  handleCriteriaChange();
  
  document.getElementById('ruleFormSection').style.display = 'block';
  document.getElementById('addNewRuleBtn').style.display = 'none';
}

async function deleteRule(ruleId) {
  const rule = currentRules.find(r => r.id === ruleId);
  if (rule && rule.isDefault) {
    alert('Varsayılan kural silinemez');
    return;
  }
  
  if (!confirm('Bu kuralı silmek istediğinizden emin misiniz?')) {
    return;
  }
  
  currentRules = currentRules.filter(r => r.id !== ruleId);
  
  try {
    config.dateFilterRules = currentRules;
    await saveConfig(config);
    
    renderRulesList();
    alert('Kural silindi');
    
  } catch (error) {
    console.error('Error deleting rule:', error);
    alert('Kural silinirken hata oluştu');
  }
}

async function saveRule() {
  const criteria = document.getElementById('ruleCriteria').value;
  const action = document.getElementById('ruleAction').value;
  const description = document.getElementById('ruleDescription').value.trim();
  
  let value;
  let valueType = 'days';
  
  if (criteria === 'BEFORE_DATE' || criteria === 'AFTER_DATE') {
    value = document.getElementById('ruleValueDate').value;
    if (!value) {
      alert('Lütfen bir tarih seçin');
      return;
    }
  } else {
    value = parseInt(document.getElementById('ruleValueDays').value);
    valueType = document.getElementById('ruleUnit').value;
    
    if (isNaN(value) || value < 1) {
      alert('Lütfen geçerli bir değer girin');
      return;
    }
    
    if (valueType === 'months') value = value * 30;
    else if (valueType === 'years') value = value * 365;
  }
  
  const rule = {
    id: editingRuleId || 'rule-' + Date.now(),
    criteria,
    value,
    valueType,
    action,
    description: description || formatCriteriaText({ criteria, value, valueType }),
    isDefault: false
  };
  
  if (editingRuleId) {
    const index = currentRules.findIndex(r => r.id === editingRuleId);
    if (index !== -1) {
      currentRules[index] = rule;
    }
  } else {
    currentRules.push(rule);
  }
  
  try {
    config.dateFilterRules = currentRules;
    await saveConfig(config);
    
    renderRulesList();
    hideRuleForm();
    alert(editingRuleId ? 'Kural güncellendi' : 'Kural eklendi');
    
  } catch (error) {
    console.error('Error saving rule:', error);
    alert('Kural kaydedilirken hata oluştu');
  }
}

function handleCriteriaChange() {
  const criteria = document.getElementById('ruleCriteria').value;
  const daysGroup = document.getElementById('daysValueGroup');
  const dateGroup = document.getElementById('dateValueGroup');
  
  if (criteria === 'BEFORE_DATE' || criteria === 'AFTER_DATE') {
    daysGroup.style.display = 'none';
    dateGroup.style.display = 'block';
  } else {
    daysGroup.style.display = 'block';
    dateGroup.style.display = 'none';
  }
}

// ============================================
// DATE FILTER CACHE MANAGEMENT
// ============================================

async function loadDateFilterCacheStats() {
  try {
    const stats = await storageHandler.getRegistrationDateCacheStats();
    
    document.getElementById('cacheTotalCount').textContent = stats.total;
    document.getElementById('cacheValidCount').textContent = stats.valid;
    document.getElementById('cacheExpiredCount').textContent = stats.expired;
    
  } catch (error) {
    console.error('Error loading cache stats:', error);
  }
}

async function clearDateFilterCache() {
  if (!confirm('Tüm kayıt tarihi önbelleğini temizlemek istediğinizden emin misiniz?')) {
    return;
  }
  
  try {
    await storageHandler.clearRegistrationDateCache();
    await loadDateFilterCacheStats();
    alert('Önbellek temizlendi');
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    alert('Önbellek temizlenirken hata oluştu');
  }
}
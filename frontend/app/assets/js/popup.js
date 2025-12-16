import * as enums from './enums.js';
import { commHandler } from './commHandler.js';

commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_ICON });

function updateStatus(message, isError = false, clearAfterMs = 3000) {
  const popupStatusDiv = document.getElementById('popupStatus');
  if (!popupStatusDiv) return;
  
  popupStatusDiv.textContent = message;
  popupStatusDiv.style.color = isError ? '#dc3545' : '#333';

  if (clearAfterMs > 0) {
    setTimeout(() => {
      if (popupStatusDiv.textContent === message) {
        popupStatusDiv.textContent = '';
      }
    }, clearAfterMs);
  }
}

function handleOpenNotification() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_FAQ });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/notification.html") }, () => {
    window.close();
  });
}

function handleOpenFaq() {
  commHandler.sendAnalyticsData({ click_type: enums.ClickType.EXTENSION_MENU_FAQ });
  chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/faq.html") });
}

document.getElementById('openNotification')?.addEventListener('click', handleOpenNotification);
document.getElementById('openFaq')?.addEventListener('click', handleOpenFaq);
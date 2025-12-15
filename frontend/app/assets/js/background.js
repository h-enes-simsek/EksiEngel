'use strict';

import * as enums from './enums.js';
import * as utils from './utils.js';
import {config, getConfig, saveConfig, handleConfig} from './config.js';
import {log} from './log.js';
import {Action, createEksiSozlukEntry, createEksiSozlukTitle, createEksiSozlukUser, commHandler, ActionConfig} from './commHandler.js';
import {relationHandler} from './relationHandler.js';
import {scrapingHandler} from './scrapingHandler.js';
import {processQueue} from './queue.js';
import {programController} from './programController.js';
import {handleEksiSozlukURL} from './urlHandler.js';
import { notificationHandler } from './notificationHandler.js';
import { storageHandler } from './storageHandler.js';

log.info("bg", "initialized");
let g_notificationTabId = 0;
let g_notificationTabCreationInProgress = null;

async function ensureNotificationTabExistsAndIsReady() {
  log.info("bg", "Ensuring notification tab exists and is ready (without forcing focus)...");
  
  // If tab creation is already in progress, wait for it to complete
  if (g_notificationTabCreationInProgress) {
    log.info("bg", "Tab creation already in progress, waiting...");
    return g_notificationTabCreationInProgress;
  }

  // Create a promise to track this tab creation process
  g_notificationTabCreationInProgress = (async () => {
    let currentNotificationTabId = g_notificationTabId; 

    try {
      // 1. Check if g_notificationTabId points to a valid, existing tab
      if (currentNotificationTabId) {
        try {
          await chrome.tabs.get(currentNotificationTabId);
          log.info("bg", `Confirmed stored notification tab ID ${currentNotificationTabId} exists.`);
          // No explicit activation here
        } catch (e) {
          log.warn("bg", `Stored notification tab ID ${currentNotificationTabId} not found or invalid: ${e}. Will query/create.`);
          currentNotificationTabId = 0; 
        }
      }

      // 2. If no valid stored ID, query by URL
      if (!currentNotificationTabId) {
        const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("assets/html/notification.html") });
        if (tabs && tabs.length > 0) {
          currentNotificationTabId = tabs[0].id;
          g_notificationTabId = currentNotificationTabId;
          log.info("bg", `Found existing notification tab by URL: ${currentNotificationTabId}`);
          // No explicit activation here
        }
      }

      // 3. If still no tab ID, create a new one (inactive)
      if (!currentNotificationTabId) {
        const notificationUrl = chrome.runtime.getURL("assets/html/notification.html");
        const tab = await chrome.tabs.create({ active: false, url: notificationUrl }); // Ensure tab is created inactive
        currentNotificationTabId = tab.id;
        log.info("bg", `Created new inactive notification tab: ${currentNotificationTabId}`);
      }

      g_notificationTabId = currentNotificationTabId;
      programController.tabId = g_notificationTabId;

      // 4. Wait for the page to be ready
      log.info("bg", `Waiting for notification page (ID: ${g_notificationTabId}) to be ready...`);
      const waitForNotificationPage = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for notification page (ID: ${g_notificationTabId}) to load`));
        }, 5000);

        const messageListener = (msg, sender) => {
          if (sender.tab && sender.tab.id === g_notificationTabId && msg && msg.action === "notificationPageReady") {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(messageListener);
            log.info("bg", `Notification page (ID: ${g_notificationTabId}) sent ready message.`);
            
            // Send current queue state to the newly ready notification page
            log.info("bg", `Sending current queue state with ${processQueue.itemAttributes.length} items to notification page`);
            notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);
            
            resolve();
          }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        try {
          chrome.tabs.sendMessage(g_notificationTabId, { action: "ping" }, response => {
            if (chrome.runtime.lastError) {
              log.info("bg", `Ping to notification tab (ID: ${g_notificationTabId}) failed, waiting for ready message: ${chrome.runtime.lastError.message}`);
              return;
            }
            if (response && response.status === "ok") {
              clearTimeout(timeout);
              chrome.runtime.onMessage.removeListener(messageListener);
              log.info("bg", `Notification page (ID: ${g_notificationTabId}) responded to ping.`);
              resolve();
            }
          });
        } catch (e) {
          log.warn("bg", `Error sending ping to notification tab (ID: ${g_notificationTabId}): ${e}`);
        }
      });

      await waitForNotificationPage;
      log.info("bg", `Notification page (ID: ${g_notificationTabId}) is ready.`);
      await utils.sleep(150);
      log.info("bg", "Added 150ms delay after page ready.");
      return true; 
    } catch (e) {
      log.err("bg", `Error in ensureNotificationTabExistsAndIsReady: ${e}`);
      g_notificationTabId = 0; 
      return false; 
    } finally {
      g_notificationTabCreationInProgress = null;
    }
  })();

  return g_notificationTabCreationInProgress;
}

chrome.runtime.onMessage.addListener(async function messageListener_Popup(message, sender, sendResponse) {
  log.info("bg", "Received message:", message);
  let responseSent = false; 

  const actionsRequiringNotification = [
    "startMigration",
    "startTitleMigration",
    "refreshMutedList",
    "refreshBlockedList",
    "blockMutedUsers",
    "blockTitlesOfBlockedMuted"
  ];

  if (message && actionsRequiringNotification.includes(message.action)) {
    log.info("bg", `Handling action ${message.action} requiring notification tab.`);
    const notificationTabReady = await ensureNotificationTabExistsAndIsReady();
    if (!notificationTabReady) {
      log.err("bg", `Failed to ensure notification tab was ready for action: ${message.action}. Aborting.`);
      if (!responseSent) {
        sendResponse({ status: 'error', message: 'Could not open or confirm notification page readiness.' });
        responseSent = true;
      }
      return;
    }

    // Helper to create a descriptive string for banMode if not a standard BAN/UNDOBAN
    const getDisplayMode = (action) => {
      switch (action) {
        case "startMigration":
        case "blockMutedUsers":
        case "blockTitlesOfBlockedMuted":
        case "startTitleMigration":
          return "PROCESS"; // General process mode
        case "refreshMutedList":
        case "refreshBlockedList":
          return "REFRESH";
        default:
          return "UNKNOWN";
      }
    };

    if (message.action === "startMigration" || message.action === "startTitleMigration") {
      const isTitleMigration = message.action === "startTitleMigration";
      const specificTaskInProgress = isTitleMigration ? programController.isBlockTitlesInProgress : programController.isMigrationInProgress;
      const taskName = isTitleMigration ? "Title Unblock" : "User Migration (Blocked to Muted)";
      const banSource = isTitleMigration ? enums.BanSource.TITLE : enums.BanSource.MIGRATE_BLOCKED_TO_MUTED; // TITLE for unblocking, MIGRATE for the other
      const banMode = isTitleMigration ? enums.BanMode.UNDOBAN : "PROCESS"; // UNDOBAN for title unblock

      if (specificTaskInProgress) {
        log.warn("bg", `${taskName} is already in progress.`);
        notificationHandler.notify(`${taskName} işlemi zaten devam ediyor.`);
      } else if (programController.isActive && processQueue.size === 0 && !processQueue.isRunning) {
        // Only block if truly another different major task is running and queue is not just about to pick this up
        log.warn("bg", `Cannot start ${taskName} while another operation is active.`);
        notificationHandler.notify(`Başka bir işlem aktifken ${taskName} başlatılamaz. Sıraya eklendi.`);
      }

      let wrapperProcessHandler = async () => {
        log.info("bg", `Queue executing ${taskName}`);
        if (isTitleMigration) await programController.migrateBlockedTitlesToUnblocked();
        else await programController.migrateBlockedToMuted();
      };
      wrapperProcessHandler.banSource = banSource;
      wrapperProcessHandler.banMode = banMode;
      wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes();
      
      // Add comprehensive metadata for enhanced queue display
      wrapperProcessHandler.metadata = {
        operationNotes: isTitleMigration ? "Başlık engellerini kaldırır" : "Engelli kullanıcıları sessiz listesine taşır",
        requiresUserInteraction: false,
        targetTypes: [enums.TargetType.TITLE], // Title operations
        sourceTitle: "Mevcut Engelli/Sessiz Başlıklar"
      };
      
      processQueue.enqueue(wrapperProcessHandler);
      notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);

      if (!responseSent) {
        sendResponse({ status: 'ok', message: `${taskName} process enqueued.` });
        responseSent = true;
      }
      return true;
    } else if (message.action === "refreshMutedList") {
      if (programController.isMutedListRefreshInProgress) {
        log.warn("bg", "Muted list refresh is already in progress. Ignoring new request.");
        notificationHandler.notify("Sessiz listesi yenileme zaten devam ediyor.");
      } else if (programController.isActive && processQueue.size === 0 && !processQueue.isRunning) {
        log.warn("bg", "Cannot start muted list refresh while another operation is active.");
        notificationHandler.notify("Başka bir işlem aktifken sessiz listesi yenileme başlatılamaz. Sıraya eklendi.");
      }

      let wrapperProcessHandler = async () => {
        log.info("bg", "Queue executing Muted List Refresh.");
        if (programController.isMutedListRefreshInProgress) return; // Re-check before starting
        programController.isMutedListRefreshInProgress = true;
        programController.earlyStop = false;
        const updateProgress = async (progress) => {
          if (g_notificationTabId) {
              chrome.tabs.sendMessage(g_notificationTabId, {
                action: "mutedListRefreshProgress", count: progress.currentCount
              }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
          }
          await storageHandler.saveMutedUserCount(progress.currentCount);
        };
        try {
          const result = await scrapingHandler.scrapeAllMutedUsers(updateProgress);
          if (result.success) {
            await storageHandler.saveMutedUserList(result.usernames);
            await storageHandler.saveMutedUserCount(result.count);
            log.info("bg", `Successfully scraped and saved ${result.count} muted users.`);
            if (g_notificationTabId) {
                chrome.tabs.sendMessage(g_notificationTabId, {
                  action: "mutedListRefreshComplete", success: true, count: result.count
                }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
            }
          } else {
            if (result.stoppedEarly) {
              log.info("bg", "Muted user scraping stopped by user.");
              if (g_notificationTabId) {
                  chrome.tabs.sendMessage(g_notificationTabId, {
                    action: "mutedListRefreshComplete", success: false, stoppedEarly: true, count: result.count || 0, error: result.error || "Process stopped by user"
                  }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
              }
            } else {
              log.err("bg", "Error scraping muted users:", result.error);
              if (g_notificationTabId) {
                  chrome.tabs.sendMessage(g_notificationTabId, {
                    action: "mutedListRefreshComplete", success: false, error: result.error
                  }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
              }
            }
          }
        } catch (e) {
          log.err("bg", `Unexpected error during refreshMutedList: ${e}`);
          if (g_notificationTabId) {
              chrome.tabs.sendMessage(g_notificationTabId, {
                action: "mutedListRefreshComplete", success: false, error: e.message || "Unknown error"
              }).catch(err => log.warn("bg", `Error sending message to notification tab: ${err}`));
          }
        } finally {
          programController.isMutedListRefreshInProgress = false;
        }
      };
      wrapperProcessHandler.banSource = enums.BanSource.REFRESH_MUTED_LIST;
      wrapperProcessHandler.banMode = getDisplayMode(message.action);
      wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes();
      
      // Add metadata for muted list refresh
      wrapperProcessHandler.metadata = {
        operationNotes: "Sessiz kullanıcı listesini sunucudan yeniler",
        requiresUserInteraction: false,
        targetTypes: [enums.TargetType.MUTE],
        sourceTitle: "Sessiz Kullanıcı Listesi"
      };
      
      processQueue.enqueue(wrapperProcessHandler);
      notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);

      if (!responseSent) { sendResponse({ status: 'ok', message: 'Muted list refresh enqueued.' }); responseSent = true; }
      return true;
    } else if (message.action === "refreshBlockedList") {
      if (programController.isBlockedListRefreshInProgress) {
        log.warn("bg", "Blocked list refresh is already in progress. Ignoring new request.");
        notificationHandler.notify("Engelli listesi yenileme zaten devam ediyor.");
      } else if (programController.isActive && processQueue.size === 0 && !processQueue.isRunning) {
        log.warn("bg", "Cannot start blocked list refresh while another operation is active.");
        notificationHandler.notify("Başka bir işlem aktifken engelli listesi yenileme başlatılamaz. Sıraya eklendi.");
      }

      let wrapperProcessHandler = async () => {
        log.info("bg", "Queue executing Blocked List Refresh.");
        if (programController.isBlockedListRefreshInProgress) return; // Re-check
        programController.isBlockedListRefreshInProgress = true;
        programController.earlyStop = false;
        const updateProgress = async (progress) => {
          if (g_notificationTabId) {
              chrome.tabs.sendMessage(g_notificationTabId, {
                action: "blockedListRefreshProgress", count: progress.currentCount
              }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
          }
          await storageHandler.saveBlockedUserCount(progress.currentCount);
        };
        try {
          const result = await scrapingHandler.scrapeAllBlockedUsers(updateProgress);
          if (result.success) {
            await storageHandler.saveBlockedUserList(result.usernames);
            await storageHandler.saveBlockedUserCount(result.count);
            log.info("bg", `Successfully scraped and saved ${result.count} blocked users.`);
            if (g_notificationTabId) {
                chrome.tabs.sendMessage(g_notificationTabId, {
                  action: "blockedListRefreshComplete", success: true, count: result.count
                }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
            }
          } else {
            if (result.stoppedEarly) {
              log.info("bg", "Blocked user scraping stopped by user.");
              if (g_notificationTabId) {
                  chrome.tabs.sendMessage(g_notificationTabId, {
                    action: "blockedListRefreshComplete", success: false, stoppedEarly: true, count: result.count || 0, error: result.error || "Process stopped by user"
                  }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
              }
            } else {
              log.err("bg", "Error scraping blocked users:", result.error);
              if (g_notificationTabId) {
                  chrome.tabs.sendMessage(g_notificationTabId, {
                    action: "blockedListRefreshComplete", success: false, error: result.error
                  }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
              }
            }
          }
        } catch (e) {
          log.err("bg", `Unexpected error during refreshBlockedList: ${e}`);
          if (g_notificationTabId) {
              chrome.tabs.sendMessage(g_notificationTabId, {
                action: "blockedListRefreshComplete", success: false, error: e.message || "Unknown error"
              }).catch(err => log.warn("bg", `Error sending message to notification tab: ${err}`));
          }
        } finally {
          programController.isBlockedListRefreshInProgress = false;
        }
      };
      wrapperProcessHandler.banSource = enums.BanSource.REFRESH_BLOCKED_LIST;
      wrapperProcessHandler.banMode = getDisplayMode(message.action);
      wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes();
      
      // Add metadata for blocked list refresh
      wrapperProcessHandler.metadata = {
        operationNotes: "Engelli kullanıcı listesini sunucudan yeniler",
        requiresUserInteraction: false,
        targetTypes: [enums.TargetType.USER],
        sourceTitle: "Engelli Kullanıcı Listesi"
      };
      
      processQueue.enqueue(wrapperProcessHandler);
      notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);

      if (!responseSent) { sendResponse({ status: 'ok', message: 'Blocked list refresh enqueued.' }); responseSent = true; }
      return true;
    } else if (message.action === "blockMutedUsers") {
      if (programController.isBlockMutedUsersInProgress) {
        log.warn("bg", "Block Muted Users process is already in progress.");
        notificationHandler.notify("Sessizleri engelleme işlemi zaten devam ediyor.");
      } else if (programController.isActive && processQueue.size === 0 && !processQueue.isRunning) {
        log.warn("bg", "Cannot start Block Muted Users while another operation is active.");
        notificationHandler.notify("Başka bir işlem aktifken sessizleri engelleme başlatılamaz.");
      }

      let wrapperProcessHandler = async () => {
        log.info("bg", "Queue executing Block Muted Users.");
        await programController.blockMutedUsers();
      };
      wrapperProcessHandler.banSource = enums.BanSource.BLOCK_MUTED_USERS;
      wrapperProcessHandler.banMode = getDisplayMode(message.action);
      wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes();
      
      // Add metadata for block muted users operation
      wrapperProcessHandler.metadata = {
        operationNotes: "Sessiz listesindeki kullanıcıları engeller ve sessizliklerini kaldırır",
        requiresUserInteraction: false,
        targetTypes: [enums.TargetType.USER, enums.TargetType.MUTE],
        sourceTitle: "Mevcut Sessiz Kullanıcılar"
      };
      
      processQueue.enqueue(wrapperProcessHandler);
      notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);

      if (!responseSent) {
        sendResponse({ status: 'ok', message: 'Block Muted Users process enqueued.' });
        responseSent = true;
      }
      return true;
    } else if (message.action === "blockTitlesOfBlockedMuted") {
      if (programController.isBlockTitlesInProgress) {
        log.warn("bg", "Block Titles of Blocked/Muted process is already in progress.");
        notificationHandler.notify("Engellilerin başlıklarını engelleme işlemi zaten devam ediyor.");
      } else if (programController.isActive && processQueue.size === 0 && !processQueue.isRunning) {
        log.warn("bg", "Cannot start Block Titles of Blocked/Muted while another operation is active.");
        notificationHandler.notify("Başka bir işlem aktifken engellilerin başlıklarını engelleme başlatılamaz.");
      }

      let wrapperProcessHandler = async () => {
        log.info("bg", "Queue executing Block Titles of Blocked/Muted.");
        await programController.blockTitlesOfBlockedMuted();
      };
      wrapperProcessHandler.banSource = enums.BanSource.BLOCKED_MUTED_TITLES; // Already exists
      wrapperProcessHandler.banMode = getDisplayMode(message.action);
      wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes();
      
      // Add metadata for block titles operation
      wrapperProcessHandler.metadata = {
        operationNotes: "Engelli ve sessiz kullanıcıların başlıklarını engeller",
        requiresUserInteraction: false,
        targetTypes: [enums.TargetType.TITLE],
        sourceTitle: "Engelli/Sessiz Kullanıcı Başlıkları"
      };
      
      processQueue.enqueue(wrapperProcessHandler);
      notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);

      if (!responseSent) {
        sendResponse({ status: 'ok', message: 'Block Titles of Blocked/Muted process enqueued.' });
        responseSent = true;
      }
      return true;
    }
    // Fallthrough for actions not explicitly handled above that require notification tab
    // but don't have specific programController flags to check beyond the general isActive.
    // This ensures sendResponse is called if no other branch handles it.
    if (!responseSent) {
        sendResponse({ status: 'ok', message: 'Action received and will be processed if no other operation is active.' });
        responseSent = true;
    }
  } else if (message && message.earlyStop !== undefined) {
    log.info("bg", "Received early stop message");
    programController.earlyStop = true;
    if (!responseSent) {
        sendResponse({status: 'ok', message: 'Early stop received'});
        responseSent = true;
    }
    return true; // Keep message channel open for async response
  } else { 
    const obj = utils.filterMessage(message, "banSource", "banMode");
    if(obj.resultType === enums.ResultType.FAIL) {
      log.info("bg", "Received message doesn't match known action types. Ignoring.");
      if (!responseSent) {
        sendResponse({status: 'ok', message: 'Unknown action or already handled.'});
        responseSent = true;
      }
      return true; // Keep message channel open for async response
    }
    
    log.info("bg", "a new process added to the queue, banSource: " + obj.banSource + ", banMode: " + obj.banMode);
    let wrapperProcessHandler = processHandler.bind(null, obj.banSource, obj.banMode, obj.entryUrl, obj.authorName, obj.authorId, obj.targetType, obj.clickSource, obj.titleName, obj.titleId, obj.timeSpecifier);
    wrapperProcessHandler.banSource = obj.banSource;
    wrapperProcessHandler.banMode = obj.banMode;
    wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes();
    
    // Add comprehensive metadata for standard operations (no hardcoded predictions)
    wrapperProcessHandler.metadata = {
      // No hardcoded estimates
      operationNotes: getOperationNotes(obj.banSource, obj),
      requiresUserInteraction: false,
      targetTypes: obj.targetType ? [obj.targetType] : [],
      
      // Source information for display
      sourceEntry: obj.entryUrl || null,
      sourceAuthor: obj.authorName || null,
      sourceTitle: obj.titleName || null,
      timeFilter: obj.timeSpecifier || null,
      
      // Operation context
      clickSource: obj.clickSource || null
    };
    
    processQueue.enqueue(wrapperProcessHandler);
    log.info("bg", "number of waiting processes in the queue: " + processQueue.size);

    // Ensure notification tab is ready and then update the list
    // This will show the item in the queue even if processHandler doesn't run immediately
    (async () => {
      const notificationTabReady = await ensureNotificationTabExistsAndIsReady();
      if (notificationTabReady) {
        notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);
      }
    })();

    if (!responseSent) {
        sendResponse({status: 'ok', message: 'Process enqueued.'});
        responseSent = true;
    }
    return true; // Keep message channel open for async response
  }
});

// Helper functions for queue metadata (removed hardcoded predictions)
function getEstimatedUserCount(banSource, obj) {
  // Return 0 to indicate no hardcoded prediction
  return 0;
}

function getOperationNotes(banSource, obj) {
  switch (banSource) {
    case enums.BanSource.SINGLE:
      return `Tek kullanıcı ${obj.banMode === enums.BanMode.BAN ? 'engelleme' : 'engel kaldırma'}`;
    case enums.BanSource.FAV:
      return "Entry'yi favorileyen kullanıcıları engelle";
    case enums.BanSource.FOLLOW:
      return `${obj.authorName} kullanıcısının takipçilerini engelle`;
    case enums.BanSource.LIST:
      return "Kullanıcı listesinden toplu engelleme";
    case enums.BanSource.TITLE:
      return `${obj.titleName} başlığındaki yazarları engelle`;
    case enums.BanSource.UNDOBANALL:
      return "Tüm engelleri ve sessizlikleri kaldır";
    default:
      return "Kullanıcı engelleme işlemi";
  }
}

async function processHandler(banSource, banMode, entryUrl, singleAuthorName, singleAuthorId, targetType, clickSource, titleName, titleId, timeSpecifier)
{
  log.info("bg", "Process has been started with " + 
           "banSource: "          + banSource + 
           ", banMode: "          + banMode + 
           ", entryUrl: "         + entryUrl + 
           ", singleAuthorName: " + singleAuthorName + 
           ", singleAuthorId: "   + singleAuthorId +
           ", targetType: "       + targetType +
           ", clickSource: "      + clickSource +
           ", titleName: "        + titleName +
           ", titleId: "          + titleId
           );
  
  const notificationTabReady = await ensureNotificationTabExistsAndIsReady();
  if (!notificationTabReady) {
    log.err("bg", `Failed to ensure notification tab was ready for processHandler (${banSource}, ${banMode}). Process will likely fail to notify fully.`);
  }
  
  // Update queue display to show current items before starting the process
  // This ensures the queue remains visible during operation
  notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);

  let authorNameList = [];
  let authorIdList = [];
  let entryMetaData = {};
  
  await handleConfig();
  relationHandler.reset();

  notificationHandler.notifyControlAccess();
  const isEksiSozlukAccessible = await handleEksiSozlukURL();
  if(!isEksiSozlukAccessible)
  {
    log.err("bg", "Program has been finished (finishErrorAccess)");
    notificationHandler.finishErrorAccess(banSource, banMode, processQueue.currentItemMetadata);
    return;
  }

  notificationHandler.notifyControlLogin();
  let userAgent = await scrapingHandler.scrapeUserAgent();
  const {clientName, clientId} = await scrapingHandler.scrapeClientNameAndId();
  if(!clientName)
  {
    log.err("bg", "Program has been finished (finishErrorLogin)");
    notificationHandler.finishErrorLogin(banSource, banMode, processQueue.currentItemMetadata);
    return;
  }
  
  if(banSource === enums.BanSource.SINGLE)
  {
    notificationHandler.notifyOngoing(0, 0, 1);
    let res = await relationHandler.performAction(banMode, singleAuthorId, targetType == enums.TargetType.USER, targetType == enums.TargetType.TITLE, targetType == enums.TargetType.MUTE);
    authorIdList.push(singleAuthorId);
    authorNameList.push(singleAuthorName);
    if(res.resultType == enums.ResultType.FAIL)
    {
      await new Promise(async resolve => 
      {
        let waitTimeInSec = 62;
        for(let i = 1; i <= waitTimeInSec; i++)
        {
          if(programController.earlyStop) break;
          notificationHandler.notifyCooldown(waitTimeInSec-i);
          await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
        }
        resolve();        
      }); 
      if(!programController.earlyStop)
        res = await relationHandler.performAction(banMode, singleAuthorId, targetType == enums.TargetType.USER, targetType == enums.TargetType.TITLE, targetType == enums.TargetType.MUTE);
    }
    notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorNameList.length);
  }
  else if(banSource === enums.BanSource.LIST)
  {
    authorNameList = await utils.getUserList();
    utils.cleanUserList(authorNameList);
    if(authorNameList.length === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.err("bg", "Program has been finished (finishErrorNoAccount)");
      return;
    }
    notificationHandler.notifyOngoing(0, 0, authorNameList.length);
    for (let i = 0; i < authorNameList.length; i++)
    {
      if(programController.earlyStop) break;
      let authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(authorNameList[i]);
      authorIdList.push(authorId);
      let res;
      if(banMode == enums.BanMode.BAN)
        res = await relationHandler.performAction(banMode, authorId, !config.enableMute, config.enableTitleBan, config.enableMute);
      else
        res = await relationHandler.performAction(banMode, authorId, true, true, true);
      if(res.resultType == enums.ResultType.FAIL)
      {
        await new Promise(async resolve => 
        {
          let waitTimeInSec = 62;
          for(let i = 1; i <= waitTimeInSec; i++)
          {
            if(programController.earlyStop) break;
            notificationHandler.notifyCooldown(waitTimeInSec-i);
            await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
          }
          resolve();        
        }); 
        if(!programController.earlyStop)
        {
          if(banMode == enums.BanMode.BAN)
            res = await relationHandler.performAction(banMode, authorId, !config.enableMute, config.enableTitleBan, config.enableMute);
          else
            res = await relationHandler.performAction(banMode, authorId, true, true, true);
        }
      }
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorNameList.length);
    }
  }
  else if(banSource === enums.BanSource.FAV)
  {
    notificationHandler.notifyScrapeFavs();
    entryMetaData = await scrapingHandler.scrapeMetaDataFromEntryPage(entryUrl);
    let scrapedRelations = await scrapingHandler.scrapeAuthorNamesFromFavs(entryUrl);
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.err("bg", "Program has been finished (error_NoAccount)");
      return;
    }
    if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
    {
      notificationHandler.notifyScrapeFollowings();
      let mapFollowing = await scrapingHandler.scrapeFollowing(clientName);
      notificationHandler.notifyAnalysisProtectFollowedUsers();  
      for (let name of scrapedRelations.keys()) {
        if (mapFollowing.has(name))
          scrapedRelations.delete(name);
      }
    }
    if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions)
    {
      notificationHandler.notifyScrapeBanned();
      let mapBlocked = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage();
      notificationHandler.notifyAnalysisOnlyRequiredActions();
      for (let name of scrapedRelations.keys()) {
        if (mapBlocked.has(name))
        {
          scrapedRelations.get(name).isBannedUser = mapBlocked.get(name).isBannedUser;
          scrapedRelations.get(name).isBannedTitle = mapBlocked.get(name).isBannedTitle;
          scrapedRelations.get(name).isBannedMute = mapBlocked.get(name).isBannedMute;
        }
      }
    }
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.err("bg", "Program has been finished (error_NoAccount after analysis)");
      return;
    }
    notificationHandler.notifyScrapeIDs();
    let validScrapedRelations = new Map();
    authorNameList = []; authorIdList = [];
    let favIndex = 0;
    for (const [name, relation] of scrapedRelations) {
      if(programController.earlyStop) break;
      favIndex++;
      notificationHandler.notifyScrapeIDsProgress(favIndex, scrapedRelations.size);
      const authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(name);
      if (authorId && authorId !== "0") {
        relation.authorId = authorId;
        validScrapedRelations.set(name, relation);
        authorNameList.push(name); authorIdList.push(authorId);
      } else {
        log.warn("bg", `Could not fetch authorId for fav user: ${name}`);
      }
      await utils.sleep(50);
    }
    scrapedRelations = validScrapedRelations;
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.err("bg", "Program has been finished (error_NoAccount after fetching IDs)");
      return;
    }
    notificationHandler.notifyOngoing(0, 0, scrapedRelations.size);
    for (const [name, value] of scrapedRelations)
    {
      if(programController.earlyStop) break;
      let res = await relationHandler.performAction(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
      if(res.resultType == enums.ResultType.FAIL)
      {
        await new Promise(async resolve => 
        {
          let waitTimeInSec = 62;
          for(let j = 1; j <= waitTimeInSec; j++)
          {
            if(programController.earlyStop) break;
            notificationHandler.notifyCooldown(waitTimeInSec-j);
            await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
          }
          resolve();        
        }); 
        if(!programController.earlyStop)
        {
          res = await relationHandler.performAction(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
        }
      }
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, scrapedRelations.size);
    }
  }
  else if (banSource === enums.BanSource.FOLLOW)
  {
    notificationHandler.notifyScrapeFollowers();
    let scrapedRelations = await scrapingHandler.scrapeFollower(singleAuthorName);
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.err("bg", "Program has been finished (error_NoAccount - followers)");
      return;
    }
    if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
    {
      notificationHandler.notifyScrapeFollowings();
      let mapFollowing = await scrapingHandler.scrapeFollowing(clientName);
      notificationHandler.notifyAnalysisProtectFollowedUsers();
      for (let name of scrapedRelations.keys()) {
        if (mapFollowing.has(name))
          scrapedRelations.delete(name);
      }
    }
    if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions)
    {
      notificationHandler.notifyScrapeBanned();
      let mapBlocked = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage();
      notificationHandler.notifyAnalysisOnlyRequiredActions();
      for (let name of scrapedRelations.keys()) {
        if (mapBlocked.has(name))
        {
          if (!scrapedRelations.has(name)) continue;
          scrapedRelations.get(name).isBannedUser = mapBlocked.get(name).isBannedUser;
          scrapedRelations.get(name).isBannedTitle = mapBlocked.get(name).isBannedTitle;
          scrapedRelations.get(name).isBannedMute = mapBlocked.get(name).isBannedMute;
        }
      }
    }
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.err("bg", "Program has been finished (error_NoAccount - followers after analysis)");
      return;
    }
    authorNameList = Array.from(scrapedRelations, ([name, value]) => name);
    authorIdList = Array.from(scrapedRelations, ([name, value]) => value.authorId);
    notificationHandler.notifyOngoing(0, 0, scrapedRelations.size);
    notificationHandler.notifyStatus("Takipçiler engelleniyor...");
    for (const [name, value] of scrapedRelations)
    {
      if(programController.earlyStop) break;
      if (!value.authorId || value.authorId === "0") {
          log.warn("bg", `Skipping follower with invalid ID: ${name}`);
          continue;
      }
      let res = await relationHandler.performAction(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
      if(res.resultType == enums.ResultType.FAIL)
      {
        await new Promise(async resolve =>
        {
          let waitTimeInSec = 62;
          for(let j = 1; j <= waitTimeInSec; j++)
          {
            if(programController.earlyStop) break;
            notificationHandler.notifyCooldown(waitTimeInSec-j);
            await new Promise(resolve2 => { setTimeout(resolve2, 1000); });
          }
          resolve();
        });
        if(!programController.earlyStop)
        {
          res = await relationHandler.performAction(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
        }
      }
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, scrapedRelations.size);
    }
  }
  else if (banSource === enums.BanSource.TITLE)
  {
    notificationHandler.notifyScrapeTitleAuthors(timeSpecifier);
    let scrapedRelations = await scrapingHandler.scrapeAuthorsFromTitle(titleName, titleId, timeSpecifier);
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.err("bg", "Program has been finished (error_NoAccount - title authors)");
      return;
    }
    if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN)
    {
      notificationHandler.notifyScrapeFollowings();
      let mapFollowing = await scrapingHandler.scrapeFollowing(clientName);
      notificationHandler.notifyAnalysisProtectFollowedUsers();
      for (let name of scrapedRelations.keys()) {
        if (mapFollowing.has(name))
          scrapedRelations.delete(name);
      }
    }
    if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions)
    {
      notificationHandler.notifyScrapeBanned();
      let mapBlocked = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage();
      notificationHandler.notifyAnalysisOnlyRequiredActions();
      for (let name of scrapedRelations.keys()) {
        if (mapBlocked.has(name))
        {
          if (!scrapedRelations.has(name)) continue;
          scrapedRelations.get(name).isBannedUser = mapBlocked.get(name).isBannedUser;
          scrapedRelations.get(name).isBannedTitle = mapBlocked.get(name).isBannedTitle;
          scrapedRelations.get(name).isBannedMute = mapBlocked.get(name).isBannedMute;
        }
      }
    }
    if(scrapedRelations.size === 0)
    {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.err("bg", "Program has been finished (error_NoAccount - title authors after analysis)");
      return;
    }
    authorNameList = Array.from(scrapedRelations, ([name, value]) => name);
    authorIdList = Array.from(scrapedRelations, ([name, value]) => value.authorId);
    notificationHandler.notifyOngoing(0, 0, scrapedRelations.size);
    for (const [name, value] of scrapedRelations)
    {
      if(programController.earlyStop) break;
      if (!value.authorId || value.authorId === "0") {
          log.warn("bg", `Skipping title author with invalid ID: ${name}`);
          continue;
      }
      let res = await relationHandler.performAction(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
      if(res.resultType == enums.ResultType.FAIL)
      {
        await new Promise(async resolve =>
        {
          let waitTimeInSec = 62;
          for(let j = 1; j <= waitTimeInSec; j++)
          {
            if(programController.earlyStop) break;
            notificationHandler.notifyCooldown(waitTimeInSec-j);
            await new Promise(resolve2 => { setTimeout(resolve2, 1000); });
          }
          resolve();
        });
        if(!programController.earlyStop)
        {
          res = await relationHandler.performAction(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
        }
      }
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, scrapedRelations.size);
    }
  }
  else if (banSource === enums.BanSource.UNDOBANALL) {
      log.info("bg", "Handling UNDOBANALL request.");
      notificationHandler.notify("Tüm engeller ve sessize almalar kaldırılıyor...");
      let totalProcessed = 0, totalSuccessful = 0, totalFailed = 0, totalPlanned = 0;

      notificationHandler.notify("Engellenen kullanıcılar alınıyor...");
      const blockedUsersResult = await scrapingHandler.scrapeAllBlockedUsers();
      if (blockedUsersResult.success && blockedUsersResult.usernames.length > 0) {
          const blockedUsers = blockedUsersResult.usernames.map(username => ({ authorName: username, authorId: null }));
          totalPlanned += blockedUsers.length;
          notificationHandler.notify(`Engellenen ${blockedUsers.length} kullanıcı bulundu. Engeller kaldırılıyor...`);
          notificationHandler.notifyOngoing(totalSuccessful, totalProcessed, totalPlanned);
          for (let i = 0; i < blockedUsers.length; i++) {
              if (programController.earlyStop) break;
              const user = blockedUsers[i];
              notificationHandler.notifyStatus(`Engel kaldırılıyor: ${user.authorName} (${totalProcessed + 1}/${totalPlanned})`);
              const authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(user.authorName);
              if (!authorId || authorId === "0") {
                  log.err("bg", `Could not scrape user ID for ${user.authorName}. Skipping unblock.`);
                  totalFailed++; totalProcessed++;
                  notificationHandler.notifyStatus(`ID alınamadı, engel kaldırılamadı: ${user.authorName}`);
                  continue;
              }
              const unblockUserResult = await programController._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, true, false, false);
              if (unblockUserResult.earlyStop) break;
              if (unblockUserResult.resultType === enums.ResultType.SUCCESS) {
                  totalSuccessful++;
              } else {
                  totalFailed++;
              }
              totalProcessed++;
              notificationHandler.notifyOngoing(totalSuccessful, totalProcessed, totalPlanned);
              await utils.sleep(500);
          }
      } else if (!blockedUsersResult.success) {
          log.err("bg", `Failed to fetch blocked users: ${blockedUsersResult.error}`);
          notificationHandler.notify(`Engellenen kullanıcılar alınamadı: ${blockedUsersResult.error}`);
          totalFailed += blockedUsersResult.count || 0;
      } else {
          notificationHandler.notify("Engellenen kullanıcı bulunamadı.");
      }

      if (programController.earlyStop) {
          notificationHandler.notify("İşlem kullanıcı tarafından durduruldu.");
      } else {
          notificationHandler.notify("Sessize alınan kullanıcılar alınıyor...");
          const mutedUsersResult = await scrapingHandler.scrapeAllMutedUsers();
          if (mutedUsersResult.success && mutedUsersResult.usernames.length > 0) {
              const mutedUsers = mutedUsersResult.usernames.map(username => ({ authorName: username, authorId: null }));
              totalPlanned += mutedUsers.length;
              notificationHandler.notify(`Sessize alınan ${mutedUsers.length} kullanıcı bulundu. Sessize almalar kaldırılıyor...`);
              notificationHandler.notifyOngoing(totalSuccessful, totalProcessed, totalPlanned);
              for (let i = 0; i < mutedUsers.length; i++) {
                  if (programController.earlyStop) break;
                  const user = mutedUsers[i];
                  notificationHandler.notifyStatus(`Sessize alma kaldırılıyor: ${user.authorName} (${totalProcessed + 1}/${totalPlanned})`);
                  const authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(user.authorName);
                  if (!authorId || authorId === "0") {
                      log.err("bg", `Could not scrape user ID for ${user.authorName}. Skipping unmute.`);
                      totalFailed++; totalProcessed++;
                      notificationHandler.notifyStatus(`ID alınamadı, sessize alma kaldırılamadı: ${user.authorName}`);
                      continue;
                  }
                  const unmuteResult = await programController._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, false, false, true);
                  if (unmuteResult.earlyStop) break;
                  if (unmuteResult.resultType === enums.ResultType.SUCCESS) {
                      totalSuccessful++;
                  } else {
                      totalFailed++;
                  }
                  totalProcessed++;
                  notificationHandler.notifyOngoing(totalSuccessful, totalProcessed, totalPlanned);
                  await utils.sleep(500);
              }
              if (!programController.earlyStop) {
                   await storageHandler.saveMutedUserList([]);
                   await storageHandler.saveMutedUserCount(0);
              } else {
                   await storageHandler.saveMutedUserList([]);
                   await storageHandler.saveMutedUserCount(0);
              }
          } else if (!mutedUsersResult.success) {
              log.err("bg", `Failed to fetch muted users: ${mutedUsersResult.error}`);
              notificationHandler.notify(`Sessize alınan kullanıcılar alınamadı: ${mutedUsersResult.error}`);
              totalFailed += mutedUsersResult.count || 0;
          } else {
              notificationHandler.notify("Sessize alınan kullanıcı bulunamadı.");
          }
      }

      if (programController.earlyStop) {
          notificationHandler.finishErrorEarlyStop(banSource, banMode, processQueue.currentItemMetadata);
      } else {
          notificationHandler.finishSuccess(banSource, banMode, totalSuccessful, totalProcessed, totalPlanned, processQueue.currentItemMetadata);
      }
      if (!programController.earlyStop) {
          await storageHandler.saveBlockedUserList([]);
          await storageHandler.saveBlockedUserCount(0);
      } else {
          await storageHandler.saveBlockedUserList([]);
          await storageHandler.saveBlockedUserCount(0);
      }
  }

  let successfulAction = relationHandler.successfulAction;
  let performedAction = relationHandler.performedAction;
  
  let eksi_engel_user = createEksiSozlukUser(clientName, clientId);
  let fav_author = createEksiSozlukUser(entryMetaData.authorName, entryMetaData.authorId);
  let fav_title = createEksiSozlukTitle(entryMetaData.titleName, entryMetaData.titleId);
  let fav_entry = createEksiSozlukEntry(fav_title, entryMetaData.entryId);

  let author_list = authorIdList.map((id, index) => ({
      eksisozluk_id: id,
      eksisozluk_name: authorNameList[index]
  })).filter(item => item.eksisozluk_id != 0);

  let action = new Action({
    eksi_engel_user, version: chrome.runtime.getManifest().version, user_agent: userAgent,
    ban_source: banSource, ban_mode: banMode, author_list, author_list_size: author_list.length,
    planned_action: authorNameList.length, performed_action: performedAction, successful_action: successfulAction,
    is_early_stopped: programController.earlyStop, log_level: null, log: null, target_type: targetType,
    click_source: clickSource, fav_title, fav_entry, fav_author, time_specifier: timeSpecifier
  });

  if(config.sendLog && log.isEnabled) {
    action.log_level = log.level;
    action.log = log.getData().toString();
  } else {
    action.log_level = log.constructor.Levels.DISABLED; 
    action.log = null;
  }

  let action_config = new ActionConfig({
    eksi_sozluk_url: config.EksiSozlukURL, send_data: config.sendData, enable_noob_ban: config.enableNoobBan,
    enable_mute: config.enableTitleBan, enable_anaylsis_before_operations: config.enableAnalysisBeforeOperation,
    enable_only_required_actions: config.enableOnlyRequiredActions,
    enable_protect_followed_users: config.enableProtectFollowedUsers, ban_premium_icons: config.banPremiumIcons
  });

  if(config.sendData) await commHandler.sendData(action, action_config);

  // Conditional final notifications to avoid redundancy for SINGLE and UNDOBANALL
  if (banSource !== enums.BanSource.SINGLE && banSource !== enums.BanSource.UNDOBANALL) {
    // This block is for LIST, FAV, FOLLOW, TITLE
    if (programController.earlyStop) {
      notificationHandler.finishErrorEarlyStop(banSource, banMode, processQueue.currentItemMetadata);
    } else {
      notificationHandler.finishSuccess(banSource, banMode, successfulAction, performedAction, authorNameList.length, processQueue.currentItemMetadata);
    }
  } else if (banSource === enums.BanSource.SINGLE && programController.earlyStop) {
    // For a single action that was stopped early, it needs an explicit early stop message
    // as its own completion (line 398) might not have been reached.
    notificationHandler.finishErrorEarlyStop(banSource, banMode, processQueue.currentItemMetadata);
  }
  // If banSource IS SINGLE and NOT earlyStop: its completion is considered handled by notifyOngoing at line 398.
  // If banSource IS UNDOBANALL: its completion/error was handled within its own block (lines 774-778).
  
  if(programController.earlyStop) {
    log.info("bg", "(updatePlannedProcessesList just before finished) notification page's queue will be updated.");
    let remainingProcessesArray = processQueue.itemAttributes;
    // It's important to get remainingProcessesArray *before* clearing the queue.
    // The finishErrorEarlyStop might trigger UI updates for each stopped item.
    for (const element of remainingProcessesArray) {
      notificationHandler.finishErrorEarlyStop(element.banSource, element.banMode, processQueue.currentItemMetadata);
    }
    processQueue.clear();
    // After clearing the queue, update the UI to reflect it's now empty.
    notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes); // Should now be an empty array
  }
  
  log.info("bg", "Program has been finished (successfull:" + successfulAction + ", performed:" + performedAction + ", planned:" + authorNameList.length + ")");
  programController.earlyStop = false;
  log.resetData();
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL || 
      details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    log.info("bg", "program installed or updated.");
    await chrome.storage.local.clear();
    await handleConfig();
    await commHandler.sendAnalyticsData({click_type:enums.ClickType.INSTALL_OR_UPDATE});
    await chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/welcome.html") });
  }
});

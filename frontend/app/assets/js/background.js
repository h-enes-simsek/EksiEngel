'use strict';

import * as enums from './enums.js';
import * as utils from './utils.js';
import {config, getConfig, saveConfig, handleConfig} from './config.js';
import {log} from './log.js';
import {Action, createEksiSozlukEntry, createEksiSozlukTitle, createEksiSozlukUser, commHandler, ActionConfig} from './commHandler.js';
import {relationHandler} from './relationHandler.js';
import {scrapingHandler} from './scrapingHandler.js';
import {processQueue, generateUnifiedDescription} from './queue.js';
import {programController} from './programController.js';
import {handleEksiSozlukURL} from './urlHandler.js';
import { notificationHandler } from './notificationHandler.js';
import { storageHandler } from './storageHandler.js';

log.info("bg", "initialized");
let g_notificationTabId = 0;
let g_notificationTabCreationInProgress = null;

async function ensureNotificationTabExistsAndIsReady() {
  if (g_notificationTabCreationInProgress) {
    return g_notificationTabCreationInProgress;
  }

  g_notificationTabCreationInProgress = (async () => {
    let currentNotificationTabId = g_notificationTabId;

    try {
      if (currentNotificationTabId) {
        try {
          await chrome.tabs.get(currentNotificationTabId);
        } catch (e) {
          currentNotificationTabId = 0;
        }
      }

      if (!currentNotificationTabId) {
        const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("assets/html/notification.html") });
        if (tabs && tabs.length > 0) {
          currentNotificationTabId = tabs[0].id;
          g_notificationTabId = currentNotificationTabId;
        }
      }

      if (!currentNotificationTabId) {
        const notificationUrl = chrome.runtime.getURL("assets/html/notification.html");
        const tab = await chrome.tabs.create({ active: false, url: notificationUrl });
        currentNotificationTabId = tab.id;
      }

      g_notificationTabId = currentNotificationTabId;
      programController.tabId = g_notificationTabId;

      const waitForNotificationPage = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for notification page (ID: ${g_notificationTabId}) to load`));
        }, 5000);

        const messageListener = (msg, sender) => {
          if (sender.tab && sender.tab.id === g_notificationTabId && msg && msg.action === "notificationPageReady") {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(messageListener);
            notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);
            resolve();
          }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        try {
          chrome.tabs.sendMessage(g_notificationTabId, { action: "ping" }, response => {
            if (chrome.runtime.lastError) {
              return;
            }
            if (response && response.status === "ok") {
              clearTimeout(timeout);
              chrome.runtime.onMessage.removeListener(messageListener);
              resolve();
            }
          });
        } catch (e) {
          log.warn("bg", `Error sending ping to notification tab: ${e}`);
        }
      });

      await waitForNotificationPage;
      await utils.sleep(150);
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
  const actionsRequiringNotification = [
    "startMigration", "startTitleMigration", "refreshMutedList", "refreshBlockedList",
    "blockMutedUsers", "blockTitlesOfBlockedMuted"
  ];

  if (message && actionsRequiringNotification.includes(message.action)) {
    const notificationTabReady = await ensureNotificationTabExistsAndIsReady();
    if (!notificationTabReady) {
      sendResponse({ status: 'error', message: 'Could not open notification page.' });
      return;
    }

    const getDisplayMode = (action) => {
      switch (action) {
        case "startMigration": case "blockMutedUsers": case "blockTitlesOfBlockedMuted": case "startTitleMigration":
          return "PROCESS";
        case "refreshMutedList": case "refreshBlockedList":
          return "REFRESH";
        default:
          return "UNKNOWN";
      }
    };

    const createWrapperProcessHandler = (handler, banSource, metadata, displayMode) => {
      let wrapperProcessHandler = async () => {
        await handler();
      };
      wrapperProcessHandler.banSource = banSource;
      wrapperProcessHandler.banMode = displayMode;
      wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes();
      wrapperProcessHandler.metadata = metadata;
      return wrapperProcessHandler;
    };

    const handleProcessQueue = (wrapperProcessHandler, successMessage) => {
      processQueue.enqueue(wrapperProcessHandler);
      notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);
      sendResponse({ status: 'ok', message: successMessage });
      return true;
    };

    if (message.action === "startMigration" || message.action === "startTitleMigration") {
      const isTitleMigration = message.action === "startTitleMigration";
      const specificTaskInProgress = isTitleMigration ? programController.isBlockTitlesInProgress : programController.isMigrationInProgress;
      const taskName = isTitleMigration ? "Title Unblock" : "User Migration (Blocked to Muted)";
      const banSource = isTitleMigration ? enums.BanSource.TITLE : enums.BanSource.MIGRATE_BLOCKED_TO_MUTED;
      const banMode = isTitleMigration ? enums.BanMode.UNDOBAN : "PROCESS";

      if (specificTaskInProgress) {
        notificationHandler.notify(`${taskName} işlemi zaten devam ediyor.`);
      } else if (programController.isActive && processQueue.size === 0 && !processQueue.isRunning) {
        notificationHandler.notify(`Başka bir işlem aktifken ${taskName} başlatılamaz. Sıraya eklendi.`);
      } else {
        const handler = isTitleMigration ?
          () => programController.migrateBlockedTitlesToUnblocked() :
          () => programController.migrateBlockedToMuted();
        
        const metadata = {
          operationNotes: isTitleMigration ? "Başlık engellerini kaldırır" : "Engelli kullanıcıları sessiz listesine taşır",
          requiresUserInteraction: false,
          targetTypes: [enums.TargetType.TITLE],
          sourceTitle: "Mevcut Engelli/Sessiz Başlıklar"
        };
        
        const wrapperProcessHandler = createWrapperProcessHandler(handler, banSource, metadata, banMode);
        return handleProcessQueue(wrapperProcessHandler, `${taskName} process enqueued.`);
      }
    } else if (message.action === "refreshMutedList") {
      if (!programController.isMutedListRefreshInProgress && !(programController.isActive && processQueue.size === 0 && !processQueue.isRunning)) {
        const handler = async () => {
          if (programController.isMutedListRefreshInProgress) return;
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
              if (g_notificationTabId) {
                  chrome.tabs.sendMessage(g_notificationTabId, {
                    action: "mutedListRefreshComplete", success: true, count: result.count
                  }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
              }
            } else {
              if (result.stoppedEarly) {
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
        
        const metadata = {
          operationNotes: "Sessiz kullanıcı listesini sunucudan yeniler",
          requiresUserInteraction: false,
          targetTypes: [enums.TargetType.MUTE],
          sourceTitle: "Sessiz Kullanıcı Listesi"
        };
        
        const wrapperProcessHandler = createWrapperProcessHandler(handler, enums.BanSource.REFRESH_MUTED_LIST, metadata, getDisplayMode(message.action));
        return handleProcessQueue(wrapperProcessHandler, 'Muted list refresh enqueued.');
      }
    } else if (message.action === "refreshBlockedList") {
      if (!programController.isBlockedListRefreshInProgress && !(programController.isActive && processQueue.size === 0 && !processQueue.isRunning)) {
        const handler = async () => {
          if (programController.isBlockedListRefreshInProgress) return;
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
              if (g_notificationTabId) {
                  chrome.tabs.sendMessage(g_notificationTabId, {
                    action: "blockedListRefreshComplete", success: true, count: result.count
                  }).catch(e => log.warn("bg", `Error sending message to notification tab: ${e}`));
              }
            } else {
              if (result.stoppedEarly) {
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
        
        const metadata = {
          operationNotes: "Engelli kullanıcı listesini sunucudan yeniler",
          requiresUserInteraction: false,
          targetTypes: [enums.TargetType.USER],
          sourceTitle: "Engelli Kullanıcı Listesi"
        };
        
        const wrapperProcessHandler = createWrapperProcessHandler(handler, enums.BanSource.REFRESH_BLOCKED_LIST, metadata, getDisplayMode(message.action));
        return handleProcessQueue(wrapperProcessHandler, 'Blocked list refresh enqueued.');
      }
    } else if (message.action === "blockMutedUsers") {
      if (!programController.isBlockMutedUsersInProgress && !(programController.isActive && processQueue.size === 0 && !processQueue.isRunning)) {
        const handler = () => programController.blockMutedUsers();
        
        const metadata = {
          operationNotes: "Sessiz listesindeki kullanıcıları engeller ve sessizliklerini kaldırır",
          requiresUserInteraction: false,
          targetTypes: [enums.TargetType.USER, enums.TargetType.MUTE],
          sourceTitle: "Mevcut Sessiz Kullanıcılar"
        };
        
        const wrapperProcessHandler = createWrapperProcessHandler(handler, enums.BanSource.BLOCK_MUTED_USERS, metadata, getDisplayMode(message.action));
        return handleProcessQueue(wrapperProcessHandler, 'Block Muted Users process enqueued.');
      }
    } else if (message.action === "blockTitlesOfBlockedMuted") {
      if (!programController.isBlockTitlesInProgress && !(programController.isActive && processQueue.size === 0 && !processQueue.isRunning)) {
        const handler = () => programController.blockTitlesOfBlockedMuted();
        
        const metadata = {
          operationNotes: "Engelli ve sessiz kullanıcıların başlıklarını engeller",
          requiresUserInteraction: false,
          targetTypes: [enums.TargetType.TITLE],
          sourceTitle: "Engelli/Sessiz Kullanıcı Başlıkları"
        };
        
        const wrapperProcessHandler = createWrapperProcessHandler(handler, enums.BanSource.BLOCKED_MUTED_TITLES, metadata, getDisplayMode(message.action));
        return handleProcessQueue(wrapperProcessHandler, 'Block Titles of Blocked/Muted process enqueued.');
      }
    }
    sendResponse({ status: 'ok', message: 'Action received and will be processed if no other operation is active.' });
  } else if (message && message.earlyStop !== undefined) {
    programController.earlyStop = true;
    sendResponse({status: 'ok', message: 'Early stop received'});
    return true;
  } else {
    const obj = utils.filterMessage(message, "banSource", "banMode");
    if(obj.resultType === enums.ResultType.FAIL) {
      sendResponse({status: 'ok', message: 'Unknown action or already handled.'});
      return true;
    }
    
    let wrapperProcessHandler = processHandler.bind(null, obj.banSource, obj.banMode, obj.entryUrl, obj.authorName, obj.authorId, obj.targetType, obj.clickSource, obj.titleName, obj.titleId, obj.timeSpecifier);
    wrapperProcessHandler.banSource = obj.banSource;
    wrapperProcessHandler.banMode = obj.banMode;
    wrapperProcessHandler.creationDateInStr = new Date().getHours() + ":" + new Date().getMinutes();
    
    wrapperProcessHandler.metadata = {
      actionDescription: getActionDescription(obj.banSource, obj),
      operationNotes: getOperationNotes(obj.banSource, obj),
      requiresUserInteraction: false,
      targetTypes: obj.targetType ? [obj.targetType] : [],
      sourceEntry: obj.entryUrl || null,
      sourceAuthor: obj.authorName || null,
      sourceTitle: obj.titleName || null,
      timeFilter: obj.timeSpecifier || null,
      clickSource: obj.clickSource || null,
      banSource: obj.banSource,
      banMode: obj.banMode
    };
    
    processQueue.enqueue(wrapperProcessHandler);

    (async () => {
      const notificationTabReady = await ensureNotificationTabExistsAndIsReady();
      if (notificationTabReady) {
        notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);
      }
    })();

    sendResponse({status: 'ok', message: 'Process enqueued.'});
    return true;
  }
});

function getEstimatedUserCount(banSource, obj) {
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

function getActionDescription(banSource, obj) {
  // Use unified description generator for consistency across all sections
  return generateUnifiedDescription(banSource, obj);
}

async function processHandler(banSource, banMode, entryUrl, singleAuthorName, singleAuthorId, targetType, clickSource, titleName, titleId, timeSpecifier) {
  log.info("bg", `Process started: banSource=${banSource}, banMode=${banMode}, entryUrl=${entryUrl}, singleAuthorName=${singleAuthorName}, singleAuthorId=${singleAuthorId}, targetType=${targetType}, clickSource=${clickSource}, titleName=${titleName}, titleId=${titleId}`);
  
  const notificationTabReady = await ensureNotificationTabExistsAndIsReady();
  if (!notificationTabReady) {
    log.err("bg", `Failed to ensure notification tab was ready for processHandler (${banSource}, ${banMode}).`);
  }
  
  notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);

  let authorNameList = [];
  let authorIdList = [];
  let entryMetaData = {};
  
  await handleConfig();
  relationHandler.reset();

  notificationHandler.notifyControlAccess();
  const isEksiSozlukAccessible = await handleEksiSozlukURL();
  if(!isEksiSozlukAccessible) {
    log.err("bg", "Program finished (finishErrorAccess)");
    notificationHandler.finishErrorAccess(banSource, banMode, processQueue.currentItemMetadata);
    return;
  }

  notificationHandler.notifyControlLogin();
  let userAgent = await scrapingHandler.scrapeUserAgent();
  const {clientName, clientId} = await scrapingHandler.scrapeClientNameAndId();
  if(!clientName) {
    log.err("bg", "Program finished (finishErrorLogin)");
    notificationHandler.finishErrorLogin(banSource, banMode, processQueue.currentItemMetadata);
    return;
  }
  
  const handleCooldown = async () => {
    if(programController.earlyStop) return;
    await new Promise(async resolve => {
      let waitTimeInSec = 62;
      for(let i = 1; i <= waitTimeInSec; i++) {
        if(programController.earlyStop) break;
        notificationHandler.notifyCooldown(waitTimeInSec-i);
        await new Promise(resolve2 => { setTimeout(resolve2, 1000); });
      }
      resolve();
    });
  };

  const performWithRetry = async (banMode, id, isTargetUser, isTargetTitle, isTargetMute) => {
    let res = await relationHandler.performAction(banMode, id, isTargetUser, isTargetTitle, isTargetMute);
    if(res.resultType == enums.ResultType.FAIL) {
      await handleCooldown();
      if(!programController.earlyStop) {
        res = await relationHandler.performAction(banMode, id, isTargetUser, isTargetTitle, isTargetMute);
      }
    }
    return res;
  };

  if(banSource === enums.BanSource.SINGLE) {
    notificationHandler.notifyOngoing(0, 0, 1, processQueue.currentItemMetadata);
    let res = await performWithRetry(banMode, singleAuthorId, targetType == enums.TargetType.USER, targetType == enums.TargetType.TITLE, targetType == enums.TargetType.MUTE);
    authorIdList.push(singleAuthorId);
    authorNameList.push(singleAuthorName);
    notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorNameList.length, processQueue.currentItemMetadata);
  } else if(banSource === enums.BanSource.LIST) {
    authorNameList = await utils.getUserList();
    utils.cleanUserList(authorNameList);
    if(authorNameList.length === 0) {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.info("bg", "No users found in LIST operation - completing with 0 results");
      return;
    }
    notificationHandler.notifyOngoing(0, 0, authorNameList.length, processQueue.currentItemMetadata);
    for (let i = 0; i < authorNameList.length; i++) {
      if(programController.earlyStop) break;
      let authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(authorNameList[i]);
      authorIdList.push(authorId);
      let res = await performWithRetry(banMode, authorId, banMode == enums.BanMode.BAN ? !config.enableMute : true, config.enableTitleBan, config.enableMute);
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, authorNameList.length, processQueue.currentItemMetadata);
    }
  } else if(banSource === enums.BanSource.FAV) {
    notificationHandler.notifyScrapeFavs();
    entryMetaData = await scrapingHandler.scrapeMetaDataFromEntryPage(entryUrl);
    let scrapedRelations = await scrapingHandler.scrapeAuthorNamesFromFavs(entryUrl);
    if(scrapedRelations.size === 0) {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.info("bg", "No users found in FAV operation");
      return;
    }
    
    if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN) {
      notificationHandler.notifyScrapeFollowings();
      let mapFollowing = await scrapingHandler.scrapeFollowing(clientName);
      notificationHandler.notifyAnalysisProtectFollowedUsers();
      for (let name of scrapedRelations.keys()) {
        if (mapFollowing.has(name))
          scrapedRelations.delete(name);
      }
    }
    
    if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions) {
      notificationHandler.notifyScrapeBanned();
      let mapBlocked = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage();
      notificationHandler.notifyAnalysisOnlyRequiredActions();
      for (let name of scrapedRelations.keys()) {
        if (mapBlocked.has(name)) {
          scrapedRelations.get(name).isBannedUser = mapBlocked.get(name).isBannedUser;
          scrapedRelations.get(name).isBannedTitle = mapBlocked.get(name).isBannedTitle;
          scrapedRelations.get(name).isBannedMute = mapBlocked.get(name).isBannedMute;
        }
      }
    }
    
    if(scrapedRelations.size === 0) {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.info("bg", "No users found in FAV operation after analysis");
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
    
    if(scrapedRelations.size === 0) {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.info("bg", "No users found in FAV operation after fetching IDs");
      return;
    }
    
    notificationHandler.notifyOngoing(0, 0, scrapedRelations.size, processQueue.currentItemMetadata);
    for (const [name, value] of scrapedRelations) {
      if(programController.earlyStop) break;
      let res = await performWithRetry(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, scrapedRelations.size, processQueue.currentItemMetadata);
    }
  } else if (banSource === enums.BanSource.FOLLOW) {
    notificationHandler.notifyScrapeFollowers();
    let scrapedRelations = await scrapingHandler.scrapeFollower(singleAuthorName);
    if(scrapedRelations.size === 0) {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.info("bg", "No users found in FOLLOW operation");
      return;
    }
    
    if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN) {
      notificationHandler.notifyScrapeFollowings();
      let mapFollowing = await scrapingHandler.scrapeFollowing(clientName);
      notificationHandler.notifyAnalysisProtectFollowedUsers();
      for (let name of scrapedRelations.keys()) {
        if (mapFollowing.has(name))
          scrapedRelations.delete(name);
      }
    }
    
    if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions) {
      notificationHandler.notifyScrapeBanned();
      let mapBlocked = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage();
      notificationHandler.notifyAnalysisOnlyRequiredActions();
      for (let name of scrapedRelations.keys()) {
        if (mapBlocked.has(name)) {
          if (!scrapedRelations.has(name)) continue;
          scrapedRelations.get(name).isBannedUser = mapBlocked.get(name).isBannedUser;
          scrapedRelations.get(name).isBannedTitle = mapBlocked.get(name).isBannedTitle;
          scrapedRelations.get(name).isBannedMute = mapBlocked.get(name).isBannedMute;
        }
      }
    }
    
    if(scrapedRelations.size === 0) {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.info("bg", "No users found in FOLLOW operation after analysis");
      return;
    }
    
    authorNameList = Array.from(scrapedRelations, ([name, value]) => name);
    authorIdList = Array.from(scrapedRelations, ([name, value]) => value.authorId);
    notificationHandler.notifyOngoing(0, 0, scrapedRelations.size, processQueue.currentItemMetadata);
    notificationHandler.notifyStatus("Takipçiler engelleniyor...");
    
    for (const [name, value] of scrapedRelations) {
      if(programController.earlyStop) break;
      if (!value.authorId || value.authorId === "0") {
          log.warn("bg", `Skipping follower with invalid ID: ${name}`);
          continue;
      }
      let res = await performWithRetry(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, scrapedRelations.size, processQueue.currentItemMetadata);
    }
  } else if (banSource === enums.BanSource.TITLE) {
    notificationHandler.notifyScrapeTitleAuthors(timeSpecifier);
    let scrapedRelations = await scrapingHandler.scrapeAuthorsFromTitle(titleName, titleId, timeSpecifier);
    if(scrapedRelations.size === 0) {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.info("bg", "No users found in TITLE operation");
      return;
    }
    
    if(config.enableAnalysisBeforeOperation && config.enableProtectFollowedUsers && banMode == enums.BanMode.BAN) {
      notificationHandler.notifyScrapeFollowings();
      let mapFollowing = await scrapingHandler.scrapeFollowing(clientName);
      notificationHandler.notifyAnalysisProtectFollowedUsers();
      for (let name of scrapedRelations.keys()) {
        if (mapFollowing.has(name))
          scrapedRelations.delete(name);
      }
    }
    
    if(config.enableAnalysisBeforeOperation && config.enableOnlyRequiredActions) {
      notificationHandler.notifyScrapeBanned();
      let mapBlocked = await scrapingHandler.scrapeAuthorNamesFromBannedAuthorPage();
      notificationHandler.notifyAnalysisOnlyRequiredActions();
      for (let name of scrapedRelations.keys()) {
        if (mapBlocked.has(name)) {
          if (!scrapedRelations.has(name)) continue;
          scrapedRelations.get(name).isBannedUser = mapBlocked.get(name).isBannedUser;
          scrapedRelations.get(name).isBannedTitle = mapBlocked.get(name).isBannedTitle;
          scrapedRelations.get(name).isBannedMute = mapBlocked.get(name).isBannedMute;
        }
      }
    }
    
    if(scrapedRelations.size === 0) {
      notificationHandler.finishErrorNoAccount(banSource, banMode, processQueue.currentItemMetadata);
      log.info("bg", "No users found in TITLE operation after analysis");
      return;
    }
    
    authorNameList = Array.from(scrapedRelations, ([name, value]) => name);
    authorIdList = Array.from(scrapedRelations, ([name, value]) => value.authorId);
    notificationHandler.notifyOngoing(0, 0, scrapedRelations.size, processQueue.currentItemMetadata);
    
    for (const [name, value] of scrapedRelations) {
      if(programController.earlyStop) break;
      if (!value.authorId || value.authorId === "0") {
          log.warn("bg", `Skipping title author with invalid ID: ${name}`);
          continue;
      }
      let res = await performWithRetry(banMode, value.authorId, (!value.isBannedUser && !config.enableMute), (!value.isBannedTitle && config.enableTitleBan), (!value.isBannedMute && config.enableMute));
      notificationHandler.notifyOngoing(res.successfulAction, res.performedAction, scrapedRelations.size, processQueue.currentItemMetadata);
    }
  } else if (banSource === enums.BanSource.UNDOBANALL) {
      log.info("bg", "Handling UNDOBANALL request.");
      notificationHandler.notify("Tüm engeller ve sessize almalar kaldırılıyor...");
      let totalProcessed = 0, totalSuccessful = 0, totalFailed = 0, totalPlanned = 0;

      notificationHandler.notify("Engellenen kullanıcılar alınıyor...");
      const blockedUsersResult = await scrapingHandler.scrapeAllBlockedUsers();
      if (blockedUsersResult.success && blockedUsersResult.usernames.length > 0) {
          const blockedUsers = blockedUsersResult.usernames.map(username => ({ authorName: username, authorId: null }));
          totalPlanned += blockedUsers.length;
          notificationHandler.notify(`Engellenen ${blockedUsers.length} kullanıcı bulundu. Engeller kaldırılıyor...`);
          notificationHandler.notifyOngoing(totalSuccessful, totalProcessed, totalPlanned, processQueue.currentItemMetadata);
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
              notificationHandler.notifyOngoing(totalSuccessful, totalProcessed, totalPlanned, processQueue.currentItemMetadata);
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
              notificationHandler.notifyOngoing(totalSuccessful, totalProcessed, totalPlanned, processQueue.currentItemMetadata);
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
                  notificationHandler.notifyOngoing(totalSuccessful, totalProcessed, totalPlanned, processQueue.currentItemMetadata);
                  await utils.sleep(500);
              }
              await storageHandler.saveMutedUserList([]);
              await storageHandler.saveMutedUserCount(0);
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
      await storageHandler.saveBlockedUserList([]);
      await storageHandler.saveBlockedUserCount(0);
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

  if (banSource !== enums.BanSource.UNDOBANALL) {
    if (programController.earlyStop) {
      notificationHandler.finishErrorEarlyStop(banSource, banMode, processQueue.currentItemMetadata);
    } else {
      notificationHandler.finishSuccess(banSource, banMode, successfulAction, performedAction, authorNameList.length, processQueue.currentItemMetadata);
    }
  }
  
  if(programController.earlyStop) {
    log.info("bg", "notification page's queue will be updated.");
    let remainingProcessesArray = processQueue.itemAttributes;
    for (const element of remainingProcessesArray) {
      notificationHandler.finishErrorEarlyStop(element.banSource, element.banMode, processQueue.currentItemMetadata);
    }
    processQueue.clear();
    notificationHandler.updatePlannedProcessesList(processQueue.itemAttributes);
  }
  
  log.info("bg", `Program finished: successful=${successfulAction}, performed=${performedAction}, planned=${authorNameList.length}`);
  programController.earlyStop = false;
  log.resetData();
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL ||
      details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    await chrome.storage.local.clear();
    await handleConfig();
    await commHandler.sendAnalyticsData({click_type:enums.ClickType.INSTALL_OR_UPDATE});
    await chrome.tabs.create({ url: chrome.runtime.getURL("assets/html/welcome.html") });
  }
});

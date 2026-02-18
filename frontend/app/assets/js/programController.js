import * as utils from './utils.js'
import * as enums from './enums.js';
import {processQueue} from './queue.js';
import {log} from './log.js';
import { notificationHandler } from './notificationHandler.js';
import { relationHandler } from './relationHandler.js';
import { scrapingHandler } from './scrapingHandler.js';
import { config } from './config.js';
import { storageHandler } from './storageHandler.js';
import { resumableOperationRegistry, OperationState } from './resumableOperation.js';

/**
 * Helper function to check if pause or stop is requested
 * This function only checks flags and does NOT block waiting for pause.
 * The actual pause waiting is handled by checkpointReached() in the scraping functions.
 * @param {Object} options - Options for the check
 * @param {boolean} options.immediate - If true, only check flags without waiting for pause
 * @returns {Promise<{ paused: boolean, stopped: boolean, timeout: boolean }>}
 */
async function checkPauseOrStop(options = {}) {
  const { immediate = false } = options;
  
  // Check early stop flag first - this is set by the user clicking "Early Stop"
  if (programController.earlyStop) {
    log.info('progctrl', 'Early stop flag is set, stopping operation...');
    return { paused: false, stopped: true, timeout: false };
  }
  
  // Check if stop was requested through registry
  const op = resumableOperationRegistry.getCurrentOperation();
  if (op && op.state === OperationState.STOPPING) {
    return { paused: false, stopped: true, timeout: false };
  }
  
  // Check if pause is requested - just return the status, don't wait
  // The scraping function will call checkpointReached() to resolve the pause
  if (resumableOperationRegistry.isPauseRequested()) {
    log.info('progctrl', 'Pause requested, returning paused status');
    return { paused: true, stopped: false, timeout: false };
  }
  
  return { paused: false, stopped: false, timeout: false };
}

class ProgramController {
  constructor() {
    this._earlyStop = false;
    this._migrationInProgress = false;
    this._isBlockedListRefreshInProgress = false;
    this._isMutedListRefreshInProgress = false;
    this._blockMutedUsersInProgress = false;
    this._blockTitlesInProgress = false;
    this._dateBasedBulkInProgress = false;
    this._unmuteAllInProgress = false;
    this._tabId = 0;
  }

  get isActive() {
    // Check if operation is being stopped or stopped - do not count these as active
    const op = resumableOperationRegistry.getCurrentOperation();
    const isOperationStopping = op && (op.state === OperationState.STOPPING || op.state === OperationState.STOPPED);
    
    // If operation is stopping/stopped, do not count paused operation as active
    const hasPausedOp = !isOperationStopping && resumableOperationRegistry.hasPausedOperation();
    
    return processQueue.isRunning ||
           this._migrationInProgress ||
           this._isMutedListRefreshInProgress ||
           this._isBlockedListRefreshInProgress ||
           this._blockMutedUsersInProgress ||
           this._blockTitlesInProgress ||
           this._dateBasedBulkInProgress ||
           this._unmuteAllInProgress ||
           hasPausedOp;
  }


  set tabId(val) { this._tabId = val; }
  get tabId() { return this._tabId; }

  get earlyStop() { return this._earlyStop; }

  set earlyStop(val) {
    this._earlyStop = val;
    if(val) {
      if (this._migrationInProgress) {
        log.info("progctrl", "early stop received during migration process. Queued tasks will continue after current task stops.");
      } else if (this._isMutedListRefreshInProgress) {
        log.info("progctrl", "early stop received during muted list refresh process. Queued tasks will continue after current task stops.");
      } else if (this._isBlockedListRefreshInProgress) {
        log.info("progctrl", "early stop received during blocked list refresh process. Queued tasks will continue after current task stops.");
      } else if (this._blockMutedUsersInProgress) {
        log.info("progctrl", "early stop received during block muted users process. Queued tasks will continue after current task stops.");
      } else if (this._blockTitlesInProgress) {
        log.info("progctrl", "early stop received during block titles process. Queued tasks will continue after current task stops.");
      } else if (this._dateBasedBulkInProgress) {
        log.info("progctrl", "early stop received during date-based bulk action process. Current operation will stop.");
      } else if (this._unmuteAllInProgress) {
        log.info("progctrl", "early stop received during unmute all process. Current operation will stop.");
      } else if (processQueue.isRunning) {
        log.info("progctrl", "early stop received while queue is processing. Current operation will stop, remaining queued operations will continue.");
      } else {
        log.info("progctrl", "early stop received, but no process is currently running.");
      }
    } else {
      log.info("progctrl", "early stop flag cleared.");
    }
  }

  forceClearAllFlags() {
    log.info("progctrl", "Force clearing all in-progress flags");
    this._earlyStop = false;
    this._migrationInProgress = false;
    this._isBlockedListRefreshInProgress = false;
    this._isMutedListRefreshInProgress = false;
    this._blockMutedUsersInProgress = false;
    this._blockTitlesInProgress = false;
    this._dateBasedBulkInProgress = false;
    this._unmuteAllInProgress = false;
  }

  stopAllOperations() {
    this.earlyStop = true;
    log.info("progctrl", `Early stop triggered - will stop current operation but preserve ${processQueue.size} queued tasks`);
  }

  get hasAnyRunningTasks() {
    return processQueue.isRunning ||
           this._migrationInProgress ||
           this._isMutedListRefreshInProgress ||
           this._isBlockedListRefreshInProgress ||
           this._blockMutedUsersInProgress ||
           this._blockTitlesInProgress ||
           this._dateBasedBulkInProgress ||
           this._unmuteAllInProgress;
  }

  get isMutedListRefreshInProgress() { return this._isMutedListRefreshInProgress; }

  set isMutedListRefreshInProgress(val) {
    this._isMutedListRefreshInProgress = val;
    if (val) {
      log.info("progctrl", "Muted list refresh process started.");
    } else {
      log.info("progctrl", "Muted list refresh process finished.");
    }
  }

  get isMigrationInProgress() { return this._migrationInProgress; }
  get isBlockedListRefreshInProgress() { return this._isBlockedListRefreshInProgress; }

  set isBlockedListRefreshInProgress(val) {
    this._isBlockedListRefreshInProgress = val;
    if (val) {
      log.info("progctrl", "Blocked list refresh process started.");
    } else {
      log.info("progctrl", "Blocked list refresh process finished.");
    }
  }

  get isBlockMutedUsersInProgress() { return this._blockMutedUsersInProgress; }
  get isBlockTitlesInProgress() { return this._blockTitlesInProgress; }
  get isDateBasedBulkInProgress() { return this._dateBasedBulkInProgress; }
  get isUnmuteAllInProgress() { return this._unmuteAllInProgress; }

  async startDateBasedBulkAction(params) {
    const { source, criteria, value, valueType, bulkAction } = params;
    
    log.info("progctrl", `startDateBasedBulkAction started: source=${source}, criteria=${criteria}, value=${value}, bulkAction=${bulkAction}`);
    
    if (this._dateBasedBulkInProgress) {
      log.warn("progctrl", "Date-based bulk action is already in progress.");
      notificationHandler.notify("Tarih bazlı toplu işlem zaten devam ediyor.");
      return;
    }
    
    this._dateBasedBulkInProgress = true;
    await storageHandler.saveLastOperationResult('RUNNING');
    this.earlyStop = false;
    
    // Register with resumable operation registry for pause/resume support
    const operationId = 'date-bulk-' + Date.now();
    resumableOperationRegistry.registerOperation(
      operationId,
      'DATE_BASED_BULK',
      params,
      ['FETCH_USERS', 'FETCH_DATES', 'FILTER_USERS', 'PERFORM_ACTIONS']
    );
    
    try {
      // Get user list based on source
      let userList = [];
      notificationHandler.notify("Kullanıcı listesi getiriliyor...");
      
      if (source === 'BLOCKED_USERS') {
        // Fetch fresh data from server instead of using cached list
        notificationHandler.notify("Engellenen kullanıcılar sunucudan getiriliyor...");
        
        // Create pause check callback for the scraping function
        const pauseCheckCallback = async () => {
          const status = await checkPauseOrStop();
          return status.paused || status.stopped;
        };
        
        const scrapeResult = await scrapingHandler.scrapeAllBlockedUsers(
          (progress) => {
            notificationHandler.notify('Engellenen kullanıcılar getiriliyor: ' + progress.currentCount + ' kullanıcı...');
          },
          null, // resumeFromIndex
          pauseCheckCallback // shouldStopCallback
        );
        
        // Check if scraping function returned due to pause
        // Note: checkpointReached is already called by the scraping function when paused
        if (scrapeResult.paused) {
          log.info("progctrl", "Date-based bulk action paused during blocked users fetch.");
          return;
        }
        
        // Check for stop request
        if (scrapeResult.stoppedEarly && !scrapeResult.paused) {
          log.info("progctrl", "Date-based bulk action stopped during blocked users fetch.");
          notificationHandler.finishErrorEarlyStop(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, processQueue.currentItemMetadata);
          return;
        }
        
        if (!scrapeResult.success) {
          log.err("progctrl", 'Failed to fetch blocked users: ' + scrapeResult.error);
          notificationHandler.notify('Engellenen kullanıcılar getirilemedi: ' + (scrapeResult.error || 'Bilinmeyen hata'));
          return;
        }
        
        userList = scrapeResult.usernames || [];
        
        // Save to storage for future reference
        if (userList.length > 0) {
          await storageHandler.saveBlockedUserList(userList);
          await storageHandler.saveBlockedUserCount(userList.length);
        }
      } else if (source === 'MUTED_USERS') {
        // Fetch fresh data from server instead of using cached list
        notificationHandler.notify("Sessize alınan kullanıcılar sunucudan getiriliyor...");
        
        // Create pause check callback for the scraping function
        const pauseCheckCallback = async () => {
          const status = await checkPauseOrStop();
          return status.paused || status.stopped;
        };
        
        const scrapeResult = await scrapingHandler.scrapeAllMutedUsers(
          (progress) => {
            notificationHandler.notify('Sessize alınan kullanıcılar getiriliyor: Sayfa ' + progress.currentPage + ', ' + progress.currentCount + ' kullanıcı...');
          },
          null, // resumeFromIndex
          pauseCheckCallback // shouldStopCallback
        );
        
        // Check if scraping function returned due to pause
        // Note: checkpointReached is already called by the scraping function when paused
        if (scrapeResult.paused) {
          log.info("progctrl", "Date-based bulk action paused during muted users fetch.");
          return;
        }
        
        // Check for stop request
        if (scrapeResult.stoppedEarly && !scrapeResult.paused) {
          log.info("progctrl", "Date-based bulk action stopped during muted users fetch.");
          notificationHandler.finishErrorEarlyStop(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, processQueue.currentItemMetadata);
          return;
        }
        
        if (!scrapeResult.success) {
          log.err("progctrl", 'Failed to fetch muted users: ' + scrapeResult.error);
          notificationHandler.notify('Sessize alınan kullanıcılar getirilemedi: ' + (scrapeResult.error || 'Bilinmeyen hata'));
          return;
        }
        
        userList = scrapeResult.usernames || [];
        
        // Save to storage for future reference
        if (userList.length > 0) {
          await storageHandler.saveMutedUserList(userList);
          await storageHandler.saveMutedUserCount(userList.length);
        }
      } else if (source === 'AUTHOR_LIST') {
        userList = await utils.getUserList();
        utils.cleanUserList(userList);
      }
      
      if (userList.length === 0) {
        log.info("progctrl", "No users found in selected source - completing with 0 results");
        notificationHandler.finishSuccess(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
        this._dateBasedBulkInProgress = false;
        resumableOperationRegistry.completeOperation();
        return;
      }
      
      log.info("progctrl", `Found ${userList.length} users in source list.`);
      notificationHandler.notify(`${userList.length} kullanıcı bulundu. Kayıt tarihleri kontrol ediliyor...`);
      
      // Fetch registration dates for all users
      const userRelations = new Map();
      for (const username of userList) {
        userRelations.set(username, { registrationDate: null });
      }
      
      // Use the same fetchRegistrationDates logic from background.js
      const cachedDates = await storageHandler.getRegistrationDatesBatch(userList);
      const usersToFetch = userList.filter(name => !cachedDates.has(name));
      
      log.info("progctrl", `Found ${cachedDates.size} cached dates, need to fetch ${usersToFetch.length}`);
      
      let fetchedCount = 0;
      const newlyFetchedDates = new Map();
      
      // Save checkpoint before starting date fetching
      await resumableOperationRegistry.checkpointReached({
        stage: 'FETCH_DATES',
        userList: userList,
        fetchedCount: 0,
        processedCount: 0
      });
      
      for (let i = 0; i < usersToFetch.length; i++) {
        const username = usersToFetch[i];
        
        if (this.earlyStop) break;
        
        // Check for pause/stop more frequently - every 5 users
        if (i % 5 === 0 && i > 0) {
          const status = await checkPauseOrStop();
          if (status.paused) {
            // Save checkpoint with current progress
            await resumableOperationRegistry.checkpointReached({
              stage: 'FETCH_DATES',
              userList: userList,
              fetchedCount: i,
              processedCount: 0,
              newlyFetchedDates: Array.from(newlyFetchedDates.entries())
            });
            return;
          }
          if (status.stopped) {
            notificationHandler.finishErrorEarlyStop(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, processQueue.currentItemMetadata);
            return;
          }
          if (status.timeout) {
            log.info("progctrl", "Pause timed out during date fetching, continuing...");
          }
        }
        
        try {
          const regDate = await scrapingHandler.scrapeRegistrationDate(username);
          if (regDate) {
            newlyFetchedDates.set(username, regDate);
            const relation = userRelations.get(username);
            if (relation) {
              relation.registrationDate = regDate;
              userRelations.set(username, relation);
            }
          }
          
          fetchedCount++;
          if (fetchedCount % 10 === 0) {
            notificationHandler.notifyStatus(`Kayıt tarihi alınıyor: ${fetchedCount}/${usersToFetch.length}`);
          }
          
          await utils.sleep(50);
        } catch (err) {
          log.err("progctrl", `Error fetching registration date for ${username}: ${err}`);
        }
      }
      
      // Cache newly fetched dates
      if (newlyFetchedDates.size > 0) {
        await storageHandler.saveRegistrationDatesBatch(newlyFetchedDates);
      }
      
      // Add cached dates to relations
      for (const [username, regDate] of cachedDates) {
        const relation = userRelations.get(username);
        if (relation) {
          relation.registrationDate = regDate;
          userRelations.set(username, relation);
        }
      }
      
      // Create a filter rule to evaluate users
      const filterRule = {
        criteria: criteria,
        value: value,
        valueType: valueType,
        action: 'MATCH' // This is a pseudo-action for filtering
      };
      
      // Filter users based on date criteria
      const matchingUsers = [];
      for (const [username, userData] of userRelations) {
        if (this.earlyStop) break;
        
        if (userData.registrationDate && utils.evaluateDateFilter(userData.registrationDate, filterRule)) {
          matchingUsers.push(username);
        }
      }
      
      log.info("progctrl", `Found ${matchingUsers.length} users matching the date criteria.`);
      
      if (matchingUsers.length === 0) {
        log.info("progctrl", "No users matched date criteria - completing with 0 results");
        notificationHandler.finishSuccess(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
        this._dateBasedBulkInProgress = false;
        resumableOperationRegistry.completeOperation();
        return;
      }
      
      notificationHandler.notify(`${matchingUsers.length} kullanıcı tarih kriterine uyuyor. İşlem başlatılıyor...`);
      
      // Perform the bulk action on matching users
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < matchingUsers.length; i++) {
        // Check for pause/stop request
        const status = await checkPauseOrStop();
        if (status.paused) {
          // Save checkpoint for resume
          await resumableOperationRegistry.checkpointReached({
            stage: 'PERFORM_ACTIONS',
            matchingUsers: matchingUsers,
            processedCount: i,
            successCount: successCount,
            failCount: failCount
          });
          return;
        }

        if (status.stopped || this.earlyStop) {
          log.info("progctrl", "Date-based bulk action stopped early by user.");
          notificationHandler.notify(`İşlem erken durduruldu. İşlenen: ${i}/${matchingUsers.length}`);
          // Save checkpoint for potential resume
          await resumableOperationRegistry.checkpointReached({
            stage: 'PERFORM_ACTIONS',
            matchingUsers: matchingUsers,
            processedCount: i,
            successCount: successCount,
            failCount: failCount
          });
          break;
        }
        
        const username = matchingUsers[i];
        notificationHandler.notifyOngoing(successCount, i + 1, matchingUsers.length, processQueue.currentItemMetadata);
        
        // Get user ID
        const authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(username);
        if (!authorId || authorId === "0") {
          log.err("progctrl", `Could not get user ID for ${username}`);
          failCount++;
          continue;
        }
        
        // Perform the action based on bulkAction
        let result;
        switch (bulkAction) {
          case 'ENGELLE':
            result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, true, false, false);
            break;
          case 'SESSIZE_AL':
            result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, true);
            break;
          case 'ENGEL_KALDIR':
            result = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, true, false, false);
            break;
          case 'SESSIZDEN_CIKAR':
            result = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, false, false, true);
            break;
          case 'TAKIP_ET':
            result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, false, true);
            break;
          case 'ENGEL_KALDIR_VE_TAKIP_ET':
            // First unblock, then follow
            result = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, true, false, false);
            if (result.resultType === enums.ResultType.SUCCESS) {
              result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, false, true);
            }
            break;
          case 'SESSIZDEN_CIKAR_VE_TAKIP_ET':
            // First unmute, then follow
            result = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, false, false, true);
            if (result.resultType === enums.ResultType.SUCCESS) {
              result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, false, true);
            }
            break;
          default:
            log.err("progctrl", `Unknown bulk action: ${bulkAction}`);
            failCount++;
            continue;
        }
        
        if (result.earlyStop) {
          break;
        }
        
        if (result.resultType === enums.ResultType.SUCCESS) {
          successCount++;
        } else {
          failCount++;
        }
        
        await utils.sleep(500);
      }
      
      const totalProcessed = successCount + failCount;
      
      if (this.earlyStop) {
        notificationHandler.finishErrorEarlyStop(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, processQueue.currentItemMetadata);
      } else {
        notificationHandler.finishSuccess(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, successCount, totalProcessed, matchingUsers.length, processQueue.currentItemMetadata);
      }
      
    } catch (error) {
      log.err("progctrl", `Error during date-based bulk action: ${error}`, error);
      notificationHandler.finishSuccess(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
    } finally {
      log.info("progctrl", "startDateBasedBulkAction completed.");
      this.earlyStop = false;
      this._dateBasedBulkInProgress = false;
      
      // Only call completeOperation if not paused (paused operations should persist for resume)
      const currentOp = resumableOperationRegistry.getCurrentOperation();
      if (!currentOp || currentOp.state !== OperationState.PAUSED) {
        resumableOperationRegistry.completeOperation();
        await storageHandler.saveLastOperationResult('COMPLETED');
      } else {
        await storageHandler.saveLastOperationResult('PAUSED');
      }
      
      notificationHandler.notifyUpdateCounts();
    }
  }

  async startMutedRefreshFromIndex(startIndex) {
    log.info("progctrl", `Starting muted refresh from index ${startIndex}`);
    if (this._isMutedListRefreshInProgress) {
      log.warn("progctrl", "Muted refresh already in progress");
      return false;
    }
    
    this._isMutedListRefreshInProgress = true;
    this.earlyStop = false;
    
    try {
      const updateProgress = async (progress) => {
        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "mutedListRefreshProgress",
            count: progress.currentCount,
            resumeMode: true
          }).catch(e => log.warn("progctrl", `Error sending resume progress message: ${e}`));
        }
        await storageHandler.saveMutedUserCount(progress.currentCount);
        await storageHandler.saveMutedRefreshResumeState(progress.currentPage || 0, progress.currentCount);
      };
      
      const result = await scrapingHandler.scrapeAllMutedUsers(updateProgress, startIndex);
      
      if (result.success) {
        await storageHandler.clearMutedRefreshResumeState();
        await storageHandler.clearPartialMutedUsers();
        await storageHandler.saveMutedUserList(result.usernames);
        await storageHandler.saveMutedUserCount(result.count);
        
        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "mutedListRefreshComplete",
            success: true,
            count: result.count,
            resumeMode: true
          }).catch(e => log.warn("progctrl", `Error sending resume complete message: ${e}`));
        }
        return true;
      } else if (result.stoppedEarly) {
        await storageHandler.savePartialMutedUsers(result.usernames || [], true);
        await storageHandler.clearMutedRefreshResumeState();
        
        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "mutedListRefreshComplete",
            success: false,
            stoppedEarly: true,
            usernames: result.usernames || [],
            count: result.count || 0,
            error: result.error || "İşlem kullanıcı tarafından durduruldu",
            resumeMode: true
          }).catch(e => log.warn("progctrl", `Error sending resume early stop message: ${e}`));
        }
        return false;
      } else {
        await storageHandler.clearMutedRefreshResumeState();
        await storageHandler.clearPartialMutedUsers();
        
        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "mutedListRefreshComplete",
            success: false,
            error: result.error,
            resumeMode: true
          }).catch(e => log.warn("progctrl", `Error sending resume error message: ${e}`));
        }
        return false;
      }
    } catch (error) {
      log.err("progctrl", `Error during resume muted refresh: ${error}`);
      await storageHandler.clearMutedRefreshResumeState();
      await storageHandler.clearPartialMutedUsers();
      
      if (this.tabId) {
        chrome.tabs.sendMessage(this.tabId, {
          action: "mutedListRefreshComplete",
          success: false,
          error: error.message || "Bilinmeyen hata",
          resumeMode: true
        }).catch(e => log.warn("progctrl", `Error sending resume error message: ${e}`));
      }
      return false;
    } finally {
      this._isMutedListRefreshInProgress = false;
    }
  }

  async isMutedRefreshResumable() {
    try {
      const resumeState = await storageHandler.getMutedRefreshResumeState();
      const partialUsers = await storageHandler.getPartialMutedUsers();
      
      const hasResumeState = resumeState && typeof resumeState.pageIndex === 'number';
      const hasPartialData = partialUsers && Array.isArray(partialUsers.usernames) && partialUsers.usernames.length > 0;
      
      return hasResumeState || hasPartialData;
    } catch (error) {
      log.err("progctrl", `Error checking if muted refresh is resumable: ${error}`);
      return false;
    }
  }

  async getMutedRefreshResumeInfo() {
    try {
      const resumeState = await storageHandler.getMutedRefreshResumeState();
      const partialUsers = await storageHandler.getPartialMutedUsers();
      
      if (resumeState) {
        return {
          type: 'pageResume',
          pageIndex: resumeState.pageIndex,
          count: resumeState.count,
          timestamp: resumeState.timestamp
        };
      } else if (partialUsers && partialUsers.usernames.length > 0) {
        return {
          type: 'partialData',
          partialCount: partialUsers.usernames.length,
          timestamp: partialUsers.timestamp,
          isTemporary: partialUsers.isTemporary
        };
      }
      
      return null;
    } catch (error) {
      log.err("progctrl", `Error getting muted refresh resume info: ${error}`);
      return null;
    }
  }

  async clearMutedRefreshState() {
    try {
      await storageHandler.clearMutedRefreshResumeState();
      await storageHandler.clearPartialMutedUsers();
      log.info("progctrl", "Cleared all muted refresh state");
    } catch (error) {
      log.err("progctrl", `Error clearing muted refresh state: ${error}`);
    }
  }

  async _performActionWithRetry(banMode, id, isTargetUser, isTargetTitle, isTargetMute, isTargetFollow = false, retries = 3) {
    let attempt = 0;
    while (attempt < retries) {
      if (this.earlyStop) {
        log.info("progctrl", "Migration stopped early during action retry.");
        return { resultType: enums.ResultType.FAIL, earlyStop: true };
      }

      const banModeStr = Object.keys(enums.BanMode).find(key => enums.BanMode[key] === banMode) || banMode;
      if (attempt === 0) {
        log.debug("progctrl", `Attempt ${attempt + 1} for action: ${banModeStr}, id: ${id}, user: ${isTargetUser}, title: ${isTargetTitle}, mute: ${isTargetMute}, follow: ${isTargetFollow}`);
      }

      relationHandler.reset();
      const result = await relationHandler.performAction(banMode, id, isTargetUser, isTargetTitle, isTargetMute, isTargetFollow);

      if (result.resultType === enums.ResultType.SUCCESS) {
        log.debug("progctrl", `Action successful for id: ${id}`);
        return { resultType: enums.ResultType.SUCCESS };
      } else if (result.resultType === enums.ResultType.FAIL && result.retryAfter) {
        let waitTimeInSec = result.retryAfter > 0 ? result.retryAfter : 65;
        log.warn("progctrl", `Action failed for id: ${id} (Rate limited). Retrying after ${waitTimeInSec} seconds...`);

        for(let i = 1; i <= waitTimeInSec; i++) {
            if(this.earlyStop) break;
            notificationHandler.notifyCooldown(waitTimeInSec - i);
            await utils.sleep(1000);
        }

        if(this.earlyStop) {
             log.info("progctrl", "Operation stopped early during cooldown wait.");
             try {
               chrome.tabs.sendMessage(this.tabId, {
                 action: "operationStopped",
                 message: "Bekleme süresinde işlem kullanıcı tarafından durduruldu.",
                 cooldown: true
               });
             } catch (e) {
               log.warn("progctrl", `Error sending stop message: ${e}`);
             }
             return { resultType: enums.ResultType.FAIL, earlyStop: true };
        }

        attempt++;
      } else {
        log.err("progctrl", `Action failed for id: ${id} with result type: ${result.resultType}. Not retrying.`);
        return { resultType: enums.ResultType.FAIL };
      }
    }
    log.err("progctrl", `Action failed for id: ${id} after ${retries} attempts.`);
    return { resultType: enums.ResultType.FAIL };
  }

  async migrateBlockedToMuted() {
    log.info("progctrl", "migrateBlockedToMuted function started.");

    if (this._migrationInProgress) {
       log.warn("progctrl", "Migration from Blocked to Muted is already in progress.");
       try {
         chrome.tabs.sendMessage(this.tabId, {
           action: "updateMigrationStatus",
           statusText: "Taşıma işlemi zaten devam ediyor."
         });
       } catch (e) {
         log.warn("progctrl", `Error sending status update: ${e}`);
       }
       return;
    }

    this._migrationInProgress = true;
    await storageHandler.saveLastOperationResult('RUNNING');
    this.earlyStop = false;

    // Register with resumable operation registry for pause/resume support
    const operationId = 'migrate-' + Date.now();
    resumableOperationRegistry.registerOperation(
      operationId,
      'MIGRATE_BLOCKED_TO_MUTED',
      {},
      ['FETCH_USERS', 'PROCESS_USERS']
    );

    try {
      log.info("progctrl", "Fetching all blocked users...");
      notificationHandler.notify("Engellenen kullanıcılar getiriliyor...");

      const pauseCheckCallback = async () => {
        const status = await checkPauseOrStop();
        return status.paused || status.stopped;
      };

      const scrapeResult = await scrapingHandler.scrapeAllBlockedUsers(null, null, pauseCheckCallback);

      if (scrapeResult.paused) {
        log.info("progctrl", "Migration paused during blocked users fetch.");
        return;
      }

      if (!scrapeResult.success) {
        log.err("progctrl", `Failed to fetch blocked users: ${scrapeResult.error}`);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/img/eksiengel48.png'),
          title: 'EksiEngel - Error',
          message: `Failed to fetch blocked users: ${scrapeResult.error}`
        });
        this._migrationInProgress = false;
        resumableOperationRegistry.completeOperation();
        notificationHandler.notify(`Engellenen kullanıcılar getirilemedi: ${scrapeResult.error}`);
        return;
      }

      const blockedUsers = scrapeResult.usernames.map(username => ({ authorName: username, authorId: null }));
      const totalBlockedUsers = scrapeResult.count;

      if (blockedUsers.length === 0) {
        log.info("progctrl", "No blocked users found - completing with 0 results");
        notificationHandler.finishSuccess(enums.BanSource.MIGRATE_BLOCKED_TO_MUTED, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
        this._migrationInProgress = false;
        resumableOperationRegistry.completeOperation();
        return;
      }

      log.info("progctrl", `Found ${blockedUsers.length} blocked users.`);
      notificationHandler.notify(`Engellenen ${blockedUsers.length} kullanıcı sessize alınıyor...`);

      // Save checkpoint after fetching users
      await resumableOperationRegistry.checkpointReached({
        stage: 'FETCH_USERS',
        blockedUsers: blockedUsers,
        totalCount: blockedUsers.length,
        processedCount: 0
      });

      let migratedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < blockedUsers.length; i++) {
        const user = blockedUsers[i];

        const status = await checkPauseOrStop();
        if (status.paused) {
          await resumableOperationRegistry.checkpointReached({
            stage: 'PROCESS_USERS',
            blockedUsers: blockedUsers,
            processedCount: i,
            migratedCount: migratedCount,
            failedCount: failedCount
          });
          return;
        }
        if (status.stopped || this.earlyStop) {
          log.info("progctrl", "Migration stopped early by user.");
          notificationHandler.notify(`Taşıma işlemi kullanıcı tarafından durduruldu. İşlenen: ${i}/${blockedUsers.length}`);
          break;
        }

        const currentProgress = i + 1;
        const totalUsers = blockedUsers.length;

        notificationHandler.notifyOngoing(migratedCount, currentProgress, totalUsers, processQueue.currentItemMetadata);

        log.info("progctrl", `Scraping user ID for: ${user.authorName}...`);
        const authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(user.authorName);

        if (!authorId || authorId === "0") {
          log.err("progctrl", `Could not scrape user ID for ${user.authorName}. Skipping.`);
          failedCount++;
          continue;
        }

        log.info("progctrl", `Successfully scraped user ID for ${user.authorName}: ${authorId}`);

        log.info("progctrl", `Unblocking user: ${user.authorName} (ID: ${authorId})...`);
        const unblockResult = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, true, false, false);

        if (unblockResult.earlyStop) {
          log.info("progctrl", "Migration stopped early by user during unblock operation.");
          break;
        }

        if (unblockResult.resultType !== enums.ResultType.SUCCESS) {
          log.err("progctrl", `Failed to unblock user: ${user.authorName} (ID: ${authorId})`);
          failedCount++;
          continue;
        }

        log.debug("progctrl", `Proceeding with muting regardless of config.enableMute setting`);

        log.info("progctrl", `Muting user: ${user.authorName} (ID: ${authorId})...`);
        const muteResult = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, true);

        if (muteResult.earlyStop) {
          log.info("progctrl", "Migration stopped early by user during mute operation.");
          break;
        }

        if (muteResult.resultType !== enums.ResultType.SUCCESS) {
          log.err("progctrl", `Failed to mute user: ${user.authorName} (ID: ${authorId})`);
          failedCount++;
        } else {
          log.info("progctrl", `Successfully migrated user: ${user.authorName} (ID: ${authorId})`);
          migratedCount++;
        }

        await utils.sleep(500);
      }

      const totalProcessed = migratedCount + failedCount + skippedCount;
      if (this.earlyStop) {
          log.info("progctrl", `Migration stopped early. Migrated: ${migratedCount}, Failed: ${failedCount}, Skipped: ${skippedCount}, Total Processed: ${totalProcessed}`);
          notificationHandler.finishErrorEarlyStop(enums.BanSource.MIGRATE_BLOCKED_TO_MUTED, enums.BanMode.BAN, processQueue.currentItemMetadata);
      } else {
          const finalMessage = `Taşıma tamamlandı. Başarıyla taşınan: ${migratedCount}, Başarısız: ${failedCount}, Atlanan: ${skippedCount}, Toplam işlenen: ${totalProcessed}`;
          log.info("progctrl", finalMessage);
          notificationHandler.finishSuccess(enums.BanSource.MIGRATE_BLOCKED_TO_MUTED, enums.BanMode.BAN, migratedCount, totalProcessed, blockedUsers.length, processQueue.currentItemMetadata);
      }

    } catch (error) {
      log.err("progctrl", `An error occurred during migration: ${error}`, error);
      notificationHandler.finishSuccess(enums.BanSource.MIGRATE_BLOCKED_TO_MUTED, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
    } finally {
      log.info("progctrl", "migrateBlockedToMuted function completed.");
      this.earlyStop = false;
      this._migrationInProgress = false;
      
      // Only call completeOperation if not paused
      const currentOp = resumableOperationRegistry.getCurrentOperation();
      if (!currentOp || currentOp.state !== OperationState.PAUSED) {
        resumableOperationRegistry.completeOperation();
        await storageHandler.saveLastOperationResult('COMPLETED');
      } else {
        await storageHandler.saveLastOperationResult('PAUSED');
      }
      
      notificationHandler.notifyUpdateCounts();
    }
  }
  async blockMutedUsers() {
    log.info("progctrl", "blockMutedUsers function started.");

    if (this._blockMutedUsersInProgress) {
      log.warn("progctrl", "Blocking muted users is already in progress.");
      notificationHandler.notify("Sessize alınmış kullanıcıları engelleme zaten devam ediyor.");
      return;
    }

    this._blockMutedUsersInProgress = true;
    await storageHandler.saveLastOperationResult('RUNNING');
    this.earlyStop = false;

    // Register with resumable operation registry for pause/resume support
    const operationId = 'block-muted-' + Date.now();
    resumableOperationRegistry.registerOperation(
      operationId,
      'BLOCK_MUTED_USERS',
      {},
      ['FETCH_PAGES', 'PROCESS_USERS']
    );

    let blockedCount = 0;
    let unmutedCount = 0;
    let failedCount = 0;
    let processedCount = 0;
    const successfullyProcessedUsernames = [];
    let totalUsersFound = 0;

    try {
      notificationHandler.notify("Sessize alınan kullanıcılar sayfa sayfa getiriliyor ve işleniyor...");

      let isLastPage = false;
      let pageIndex = 0;
      const politeDelayMs = 500;

      while (!isLastPage && !this.earlyStop) {
        pageIndex++;
        log.info("progctrl", `Fetching muted users page ${pageIndex}...`);
        notificationHandler.notify(`Sessize alınan kullanıcılar getiriliyor: Sayfa ${pageIndex}...`);

        // Check for pause before fetching each page
        const prePageStatus = await checkPauseOrStop();
        if (prePageStatus.paused) {
          await resumableOperationRegistry.checkpointReached({
            stage: 'FETCH_PAGES',
            pageIndex: pageIndex,
            processedCount: processedCount,
            totalUsersFound: totalUsersFound,
            blockedCount: blockedCount,
            unmutedCount: unmutedCount,
            failedCount: failedCount
          });
          return;
        }
        if (prePageStatus.stopped || this.earlyStop) {
          log.info("progctrl", "Blocking muted users stopped early by user during page fetch.");
          notificationHandler.notify(`Sessize alınan kullanıcıları engelleme işlemi kullanıcı tarafından durduruldu. İşlenen: ${processedCount} kullanıcı.`);
          break;
        }

        let partialListObj;
        try {
          partialListObj = await scrapingHandler.scrapeMutedUsersPage(pageIndex);

          if (this.earlyStop) {
            log.info("progctrl", "Blocking muted users stopped early by user during page fetch.");
            notificationHandler.notify(`Sessize alınan kullanıcıları engelleme işlemi kullanıcı tarafından durduruldu. İşlenen: ${processedCount} kullanıcı.`);
            break;
          }

          if (!partialListObj || typeof partialListObj.isLast !== 'boolean' || !Array.isArray(partialListObj.authorNameList)) {
             throw new Error(`Unexpected result fetching page ${pageIndex}.`);
          }

          isLastPage = partialListObj.isLast;
          const pageUsernames = partialListObj.authorNameList;
          const pageUserIds = partialListObj.authorIdList;

          if (pageUsernames.length > 0) {
            totalUsersFound += pageUsernames.length;
            log.info("progctrl", `Found ${pageUsernames.length} users on page ${pageIndex}. Total found so far: ${totalUsersFound}`);
            notificationHandler.notify(`Sayfa ${pageIndex}'de ${pageUsernames.length} kullanıcı bulundu. Şu ana kadar toplam: ${totalUsersFound}. İşleniyor...`);

            // Save checkpoint before processing page
            await resumableOperationRegistry.checkpointReached({
              stage: 'FETCH_PAGES',
              pageIndex: pageIndex,
              totalUsersFound: totalUsersFound,
              processedCount: processedCount
            });

            for (let i = 0; i < pageUsernames.length; i++) {
              if (this.earlyStop) {
                log.info("progctrl", "Blocking muted users stopped early by user during page processing.");
                notificationHandler.notify(`Sessize alınan kullanıcıları engelleme işlemi kullanıcı tarafından durduruldu. İşlenen: ${processedCount} kullanıcı.`);
                break;
              }

              const username = pageUsernames[i];
              const authorIdFromPage = pageUserIds[i];
              processedCount++;

              const status = await checkPauseOrStop();
              if (status.paused) {
                await resumableOperationRegistry.checkpointReached({
                  stage: 'PROCESS_USERS',
                  pageIndex: pageIndex,
                  processedCount: processedCount,
                  totalUsersFound: totalUsersFound,
                  blockedCount: blockedCount,
                  unmutedCount: unmutedCount,
                  failedCount: failedCount
                });
                return;
              }
              if (status.stopped || this.earlyStop) {
                log.info("progctrl", "Blocking muted users stopped early by user.");
                notificationHandler.notify(`Sessize alınan kullanıcıları engelleme işlemi kullanıcı tarafından durduruldu. İşlenen: ${processedCount} kullanıcı.`);
                break;
              }

              notificationHandler.notifyOngoing(unmutedCount, processedCount, totalUsersFound, processQueue.currentItemMetadata);

              log.info("progctrl", `Processing user: ${username}...`);

              let authorId = authorIdFromPage;
              if (!authorId || authorId === "0") {
                 log.info("progctrl", `Scraping user ID for: ${username}...`);
                 authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(username);
              }

              if (!authorId || authorId === "0") {
                log.err("progctrl", `Could not get user ID for ${username}. Skipping.`);
                failedCount++;
                continue;
              }

              log.info("progctrl", `Using user ID for ${username}: ${authorId}`);

              log.info("progctrl", `Blocking user: ${username} (ID: ${authorId})...`);
              const blockResult = await this._performActionWithRetry(enums.BanMode.BAN, authorId, true, false, false);

              if (blockResult.earlyStop) {
                log.info("progctrl", "Blocking muted users stopped early by user during block operation.");
                break;
              }

              if (blockResult.resultType !== enums.ResultType.SUCCESS) {
                log.err("progctrl", `Failed to block user: ${username} (ID: ${authorId})`);
                failedCount++;
                continue;
              }

              log.info("progctrl", `Successfully blocked user: ${username} (ID: ${authorId})`);
              blockedCount++;

              log.info("progctrl", `Unmuting user: ${username} (ID: ${authorId})...`);
              const unmuteResult = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, false, false, true);

              if (unmuteResult.earlyStop) {
                log.info("progctrl", "Blocking muted users stopped early by user during unmute operation.");
                break;
              }

              if (unmuteResult.resultType !== enums.ResultType.SUCCESS) {
                log.err("progctrl", `Failed to unmute user: ${username} (ID: ${authorId})`);
                failedCount++;
              } else {
                log.info("progctrl", `Successfully unmuted user: ${username} (ID: ${authorId})`);
                unmutedCount++;
                successfullyProcessedUsernames.push(username);
              }

              await utils.sleep(500);
            }

            if (this.earlyStop) {
                break;
            }

          } else {
            log.info("progctrl", `No users found on page ${pageIndex}. Assuming this is the last page.`);
            isLastPage = true;
          }

        } catch (pageError) {
          log.err("progctrl", `Error fetching or processing page ${pageIndex}: ${pageError.message || pageError}`);
          failedCount++;
          notificationHandler.notify(`Sayfa ${pageIndex} işlenirken hata: ${pageError.message || "Bilinmeyen hata"}. Durduruluyor.`);
          break;
        }

        if (!isLastPage && !this.earlyStop) {
           await utils.sleep(politeDelayMs);
        }
      }

      if (successfullyProcessedUsernames.length > 0) {
          log.info("progctrl", `Removing ${successfullyProcessedUsernames.length} users from muted list storage.`);
          await storageHandler.removeMutedUsers(successfullyProcessedUsernames);
      }

      const totalProcessed = processedCount;
      if (this.earlyStop) {
          log.info("progctrl", `Blocking muted users stopped early. Successfully processed: ${unmutedCount}, Failed: ${failedCount}, Total Processed: ${totalProcessed}`);
          notificationHandler.finishErrorEarlyStop(enums.BanSource.BLOCK_MUTED_USERS, enums.BanMode.BAN, processQueue.currentItemMetadata);
      } else {
          const finalMessage = `Sessize alınan kullanıcıları engelleme tamamlandı. Başarıyla engellenip sessizden çıkarılan: ${unmutedCount}, Başarısız: ${failedCount}, Toplam işlenen: ${totalProcessed}`;
          log.info("progctrl", finalMessage);
          notificationHandler.finishSuccess(enums.BanSource.BLOCK_MUTED_USERS, enums.BanMode.BAN, unmutedCount, totalProcessed, totalUsersFound, processQueue.currentItemMetadata);
      }

    } catch (error) {
      log.err("progctrl", `An unexpected error occurred during blocking muted users: ${error}`, error);
      notificationHandler.finishSuccess(enums.BanSource.BLOCK_MUTED_USERS, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
    } finally {
      log.info("progctrl", "blockMutedUsers function completed.");
      this.earlyStop = false;
      this._blockMutedUsersInProgress = false;
      
      // Only call completeOperation if not paused
      const currentOp = resumableOperationRegistry.getCurrentOperation();
      if (!currentOp || currentOp.state !== OperationState.PAUSED) {
        resumableOperationRegistry.completeOperation();
        await storageHandler.saveLastOperationResult('COMPLETED');
      } else {
        await storageHandler.saveLastOperationResult('PAUSED');
      }
      
      notificationHandler.notifyUpdateCounts();
    }
  }
  async blockTitlesOfBlockedMuted() {
    log.info("progctrl", "blockTitlesOfBlockedMuted function started.");

    if (this._blockTitlesInProgress) {
      log.warn("progctrl", "Blocking titles of blocked/muted users is already in progress.");
      notificationHandler.notify("Engellenen/sessize alınan kullanıcıların başlıklarını engelleme işlemi zaten devam ediyor.");
      return;
    }

    this._blockTitlesInProgress = true;
    await storageHandler.saveLastOperationResult('RUNNING');
    this.earlyStop = false;

    // Register with resumable operation registry for pause/resume support
    const operationId = 'block-titles-' + Date.now();
    resumableOperationRegistry.registerOperation(
      operationId,
      'BLOCK_TITLES',
      {},
      ['FETCH_USERS', 'PROCESS_USERS']
    );

    try {
      notificationHandler.notify("Engellenen ve sessize alınan kullanıcı listeleri getiriliyor...");

      const pauseCheckCallback = async () => {
        const status = await checkPauseOrStop();
        return status.paused || status.stopped;
      };

      const blockedUsersResult = await scrapingHandler.scrapeAllBlockedUsers(null, null, pauseCheckCallback);

      if (blockedUsersResult.paused) {
        log.info("progctrl", "Blocking titles paused during blocked users fetch.");
        return;
      }

      if (!blockedUsersResult.success) {
          log.err("progctrl", `Failed to fetch blocked users: ${blockedUsersResult.error}`);
          notificationHandler.notify(`Engellenen kullanıcılar getirilemedi: ${blockedUsersResult.error}`);
          return;
      }
      const blockedUsers = blockedUsersResult.usernames.map(username => ({ authorName: username, authorId: null }));
      log.info("progctrl", `Found ${blockedUsers.length} blocked users.`);

      const mutedUsernames = await storageHandler.getMutedUserList();
      const mutedUsers = mutedUsernames ? mutedUsernames.map(username => ({ authorName: username, authorId: null })) : [];
      log.info("progctrl", `Found ${mutedUsers.length} muted users.`);

      const combinedUsersMap = new Map();

      blockedUsers.forEach(user => {
        if (user.authorId) {
          combinedUsersMap.set(user.authorName, user);
        } else if (!combinedUsersMap.has(user.authorName)) {
           combinedUsersMap.set(user.authorName, user);
        }
      });

      mutedUsers.forEach(user => {
         if (!combinedUsersMap.has(user.authorName)) {
           combinedUsersMap.set(user.authorName, user);
         }
      });

      const usersToProcess = Array.from(combinedUsersMap.values());

      if (usersToProcess.length === 0) {
        log.info("progctrl", "No blocked or muted users found to process titles for - completing with 0 results");
        notificationHandler.finishSuccess(enums.BanSource.BLOCKED_MUTED_TITLES, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
        this._blockTitlesInProgress = false;
        resumableOperationRegistry.completeOperation();
        return;
      }

      log.info("progctrl", `Found ${usersToProcess.length} unique blocked/muted users to process titles for.`);
      notificationHandler.notify(`${usersToProcess.length} benzersiz engellenmiş/sessize alınmış kullanıcı bulundu. Başlık engelleme işlemi başlatılıyor...`);

      // Save checkpoint after fetching users
      await resumableOperationRegistry.checkpointReached({
        stage: 'FETCH_USERS',
        usersToProcess: usersToProcess,
        totalCount: usersToProcess.length,
        processedCount: 0
      });

      let serverBlockedTitlesCount = 0;
      let simulatedBlockedTitlesCount = 0;
      let usersProcessedCount = 0;
      let failedUsersCount = 0;
      let successfulUsersCount = 0;

      notificationHandler.notifyOngoing(successfulUsersCount, usersProcessedCount, usersToProcess.length, processQueue.currentItemMetadata);

      for (let i = 0; i < usersToProcess.length; i++) {
        const status = await checkPauseOrStop();
        if (status.paused) {
          await resumableOperationRegistry.checkpointReached({
            stage: 'PROCESS_USERS',
            usersToProcess: usersToProcess,
            processedCount: i,
            serverBlockedTitlesCount: serverBlockedTitlesCount,
            simulatedBlockedTitlesCount: simulatedBlockedTitlesCount
          });
          return;
        }
        if (status.stopped || this.earlyStop) {
          log.info("progctrl", "Blocking titles stopped early by user.");
          notificationHandler.notify(`Başlık engelleme erken durduruldu. İşlenen kullanıcı: ${i}/${usersToProcess.length}.`);
          break;
        }

        const user = usersToProcess[i];
        const isOriginallyBlocked = blockedUsers.some(blockedUser => blockedUser.authorName === user.authorName);

        notificationHandler.notifyOngoing(successfulUsersCount, usersProcessedCount, usersToProcess.length, processQueue.currentItemMetadata);

        log.info("progctrl", `Attempting to process titles for user: ${user.authorName} (ID: ${user.authorId || 'N/A'})...`);

        let authorId = user.authorId;
        if (!authorId || authorId === "0") {
            log.info("progctrl", `Scraping user ID for: ${user.authorName}...`);
            authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(user.authorName);

            if (!authorId || authorId === "0") {
                log.warn("progctrl", `Skipping title processing for user ${user.authorName} due to missing or invalid ID after scraping.`);
                failedUsersCount++;
                usersProcessedCount++;
                notificationHandler.notifyOngoing(successfulUsersCount, usersProcessedCount, usersToProcess.length, processQueue.currentItemMetadata);
                continue;
            }
             log.info("progctrl", `Successfully scraped user ID for ${user.authorName}: ${authorId}`);
             user.authorId = authorId;
        }

        let actionSuccessful = false;

        if (isOriginallyBlocked) {
            log.info("progctrl", `Attempting server-side title block for blocked user: ${user.authorName} (ID: ${user.authorId})...`);
            const blockResult = await this._performActionWithRetry(enums.BanMode.BAN, user.authorId, false, true, false);

            if (blockResult.earlyStop) {
              log.info("progctrl", "Blocking titles stopped early by user during server-side action.");
              break;
            }

            if (blockResult.resultType !== enums.ResultType.SUCCESS) {
              log.err("progctrl", `Failed to block titles server-side for user: ${user.authorName} (ID: ${user.authorId})`);
              failedUsersCount++;
            } else {
              log.info("progctrl", `Successfully blocked titles server-side for user: ${user.authorName}`);
              serverBlockedTitlesCount++;
              actionSuccessful = true;
            }
        } else {
            log.info("progctrl", `Attempting client-side title hiding for muted user: ${user.authorName} (ID: ${user.authorId})...`);
            try {
                const response = await chrome.tabs.sendMessage(this.tabId, {
                    action: "hideTitlesByAuthorId",
                    authorId: user.authorId
                });
                if (response && response.success) {
                    log.info("progctrl", `Successfully requested client-side hiding for user: ${user.authorName}. Hidden titles count: ${response.hiddenCount}`);
                    simulatedBlockedTitlesCount += response.hiddenCount;
                    actionSuccessful = true;
                } else {
                    log.warn("progctrl", `Client-side hiding request failed or returned no count for user: ${user.authorName}`);
                    failedUsersCount++;
                }
            } catch (e) {
                log.err("progctrl", `Error sending client-side hiding message for user ${user.authorName}: ${e}`);
                failedUsersCount++;
            }
        }

        usersProcessedCount++;
        if (actionSuccessful) {
            successfulUsersCount++;
        }

        notificationHandler.notifyOngoing(successfulUsersCount, usersProcessedCount, usersToProcess.length, processQueue.currentItemMetadata);

        await utils.sleep(500);
      }

      const finalMessage = `Blocking titles completed. Successfully processed users: ${successfulUsersCount}, Failed users: ${failedUsersCount}, Total users processed: ${usersProcessedCount}. Simulated titles blocked: ${simulatedBlockedTitlesCount}.`;
      log.info("progctrl", finalMessage);

      if (this.earlyStop) {
          notificationHandler.finishErrorEarlyStop(enums.BanSource.BLOCKED_MUTED_TITLES, enums.BanMode.BAN, processQueue.currentItemMetadata);
      } else {
          notificationHandler.finishSuccess(enums.BanSource.BLOCKED_MUTED_TITLES, enums.BanMode.BAN, successfulUsersCount, usersProcessedCount, usersToProcess.length, processQueue.currentItemMetadata);
      }

    } catch (error) {
      log.err("progctrl", `An error occurred during blocking titles: ${error}`, error);
      notificationHandler.finishSuccess(enums.BanSource.BLOCKED_MUTED_TITLES, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
    } finally {
      log.info("progctrl", "blockTitlesOfBlockedMuted function completed.");
      this.earlyStop = false;
      this._blockTitlesInProgress = false;
      
      // Only call completeOperation if not paused
      const currentOp = resumableOperationRegistry.getCurrentOperation();
      if (!currentOp || currentOp.state !== OperationState.PAUSED) {
        resumableOperationRegistry.completeOperation();
        await storageHandler.saveLastOperationResult('COMPLETED');
      } else {
        await storageHandler.saveLastOperationResult('PAUSED');
      }
    }
  }

  async startUnmuteAll() {
    log.info("progctrl", "startUnmuteAll function started.");

    if (this._unmuteAllInProgress) {
      log.warn("progctrl", "Unmute all operation is already in progress.");
      notificationHandler.notify("Tüm sessizleri kaldırma işlemi zaten devam ediyor.");
      return;
    }

    this._unmuteAllInProgress = true;
    await storageHandler.saveLastOperationResult('RUNNING');
    this.earlyStop = false;

    try {
      const mutedUsers = await storageHandler.getMutedUserList();

      if (!mutedUsers || mutedUsers.length === 0) {
        log.info("progctrl", "No muted users found - completing with 0 results");
        notificationHandler.finishSuccess(enums.BanSource.UNMUTEALL, enums.BanMode.UNDOBAN, 0, 0, 0, processQueue.currentItemMetadata);
        this._unmuteAllInProgress = false;
        resumableOperationRegistry.completeOperation();
        return;
      }

      const plannedAction = mutedUsers.length;
      log.info("progctrl", `Found ${plannedAction} muted users to unmute.`);
      notificationHandler.notify(`Sessiz listede ${plannedAction} kullanıcı bulundu. Sessizleri kaldırma başlatılıyor...`);

      let performedAction = 0;
      let successfulAction = 0;
      let failedCount = 0;

      for (let i = 0; i < mutedUsers.length; i++) {
        if (this.earlyStop) {
          log.info("progctrl", "Unmute all stopped early by user.");
          notificationHandler.notify(`Tüm sessizleri kaldırma işlemi kullanıcı tarafından durduruldu. İşlenen: ${i}/${mutedUsers.length}.`);
          break;
        }

        const username = mutedUsers[i];
        performedAction = i + 1;

        notificationHandler.notifyOngoing(successfulAction, performedAction, plannedAction, processQueue.currentItemMetadata);

        log.info("progctrl", `Unmuting user: ${username}...`);

        const authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(username);
        if (!authorId || authorId === "0") {
          log.err("progctrl", `Could not get user ID for ${username}. Skipping.`);
          failedCount++;
          continue;
        }

        const unmuteResult = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, false, false, true);

        if (unmuteResult.earlyStop) {
          log.info("progctrl", "Unmute all stopped early by user during unmute operation.");
          break;
        }

        if (unmuteResult.resultType !== enums.ResultType.SUCCESS) {
          log.err("progctrl", `Failed to unmute user: ${username} (ID: ${authorId})`);
          failedCount++;
        } else {
          log.info("progctrl", `Successfully unmuted user: ${username} (ID: ${authorId})`);
          successfulAction++;
        }

        await utils.sleep(500);
      }

      const totalProcessed = successfulAction + failedCount;
      
      if (this.earlyStop) {
        log.info("progctrl", `Unmute all stopped early. Unmuted: ${successfulAction}, Failed: ${failedCount}, Total Processed: ${totalProcessed}`);
        notificationHandler.finishErrorEarlyStop(enums.BanSource.UNMUTEALL, enums.BanMode.UNDOBAN, processQueue.currentItemMetadata);
      } else {
        log.info("progctrl", `Unmute all completed. Unmuted: ${successfulAction}, Failed: ${failedCount}, Total Processed: ${totalProcessed}`);
        notificationHandler.finishSuccess(enums.BanSource.UNMUTEALL, enums.BanMode.UNDOBAN, successfulAction, totalProcessed, plannedAction, processQueue.currentItemMetadata);
      }

      // Clear the muted list storage
      await storageHandler.saveMutedUserList([]);
      await storageHandler.saveMutedUserCount(0);
      notificationHandler.notifyUpdateCounts();

    } catch (error) {
      log.err("progctrl", `An error occurred during unmute all: ${error}`, error);
      notificationHandler.finishSuccess(enums.BanSource.UNMUTEALL, enums.BanMode.UNDOBAN, 0, 0, 0, processQueue.currentItemMetadata);
    } finally {
      log.info("progctrl", "startUnmuteAll function completed.");
      this.earlyStop = false;
      this._unmuteAllInProgress = false;
      await storageHandler.saveLastOperationResult('COMPLETED');
    }
  }

  async refreshMutedList(savedState = null) {
    log.info("progctrl", "refreshMutedList function started.");

    if (this._isMutedListRefreshInProgress) {
      log.warn("progctrl", "Muted list refresh is already in progress.");
      notificationHandler.notify("Sessiz liste yenileme zaten devam ediyor.");
      return;
    }

    this._isMutedListRefreshInProgress = true;
    await storageHandler.saveLastOperationResult('RUNNING');
    this.earlyStop = false;

    const operationId = savedState?.operationId || 'refresh-muted-' + Date.now();
    
    const initialState = savedState?.checkpointData ? {
      scrapedUsers: savedState.checkpointData.collectedUsers || [],
      currentPage: savedState.checkpointData.currentPage || 0,
      totalCount: savedState.checkpointData.userCount || 0
    } : null;

    resumableOperationRegistry.registerOperation(
      operationId,
      'REFRESH_MUTED_LIST',
      {},
      ['FETCH_PAGES']
    );

    try {
      const updateProgress = async (progress) => {
        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "mutedListRefreshProgress",
            count: progress.currentCount
          }).catch(e => log.warn("progctrl", `Error sending progress message: ${e}`));
        }
        await storageHandler.saveMutedUserCount(progress.currentCount);
      };

      if (initialState && initialState.totalCount > 0) {
        await updateProgress({ currentCount: initialState.totalCount });
      }

      const pauseCheckCallback = async () => {
        const status = await checkPauseOrStop();
        return status.paused || status.stopped;
      };

      const result = await scrapingHandler.scrapeAllMutedUsers(updateProgress, null, pauseCheckCallback, null, initialState);

      if (result.paused) {
        log.info("progctrl", "Muted list refresh paused by user.");
        return;
      }

      if (result.success) {
        await storageHandler.clearMutedRefreshResumeState();
        await storageHandler.clearPartialMutedUsers();
        await storageHandler.saveMutedUserList(result.usernames);
        await storageHandler.saveMutedUserCount(result.count);

        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "mutedListRefreshComplete",
            success: true,
            count: result.count
          }).catch(e => log.warn("progctrl", `Error sending complete message: ${e}`));
        }
        
        notificationHandler.finishSuccess(enums.BanSource.REFRESH_MUTED_LIST, null, result.count, result.count, result.count, processQueue.currentItemMetadata);
      } else if (result.stoppedEarly) {
        await storageHandler.savePartialMutedUsers(result.usernames || [], true);
        await storageHandler.clearMutedRefreshResumeState();

        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "mutedListRefreshComplete",
            success: false,
            stoppedEarly: true,
            usernames: result.usernames || [],
            count: result.count || 0,
            error: result.error || "İşlem kullanıcı tarafından durduruldu"
          }).catch(e => log.warn("progctrl", `Error sending early stop message: ${e}`));
        }
        
        notificationHandler.finishErrorEarlyStop(enums.BanSource.REFRESH_MUTED_LIST, null, processQueue.currentItemMetadata);
      } else {
        log.err("progctrl", "Error scraping muted users:", result.error);
        await storageHandler.clearMutedRefreshResumeState();
        await storageHandler.clearPartialMutedUsers();

        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "mutedListRefreshComplete",
            success: false,
            error: result.error
          }).catch(e => log.warn("progctrl", `Error sending error message: ${e}`));
        }
        
        notificationHandler.finishSuccess(enums.BanSource.REFRESH_MUTED_LIST, null, 0, 0, 0, processQueue.currentItemMetadata);
      }
    } catch (e) {
      log.err("progctrl", `Unexpected error during refreshMutedList: ${e}`);
      await storageHandler.clearMutedRefreshResumeState();
      await storageHandler.clearPartialMutedUsers();

      if (this.tabId) {
        chrome.tabs.sendMessage(this.tabId, {
          action: "mutedListRefreshComplete",
          success: false,
          error: e.message || "Bilinmeyen hata"
        }).catch(err => log.warn("progctrl", `Error sending error message: ${err}`));
      }
      
      notificationHandler.finishSuccess(enums.BanSource.REFRESH_MUTED_LIST, null, 0, 0, 0, processQueue.currentItemMetadata);
    } finally {
      log.info("progctrl", "refreshMutedList function completed.");
      this.earlyStop = false;
      this._isMutedListRefreshInProgress = false;

      const currentOp = resumableOperationRegistry.getCurrentOperation();
      if (!currentOp || currentOp.state !== OperationState.PAUSED) {
        resumableOperationRegistry.completeOperation();
        await storageHandler.saveLastOperationResult('COMPLETED');
      } else {
        await storageHandler.saveLastOperationResult('PAUSED');
      }

      notificationHandler.notifyUpdateCounts();
    }
  }

  async refreshBlockedList(savedState = null) {
    log.info("progctrl", "refreshBlockedList function started.");

    if (this._isBlockedListRefreshInProgress) {
      log.warn("progctrl", "Blocked list refresh is already in progress.");
      notificationHandler.notify("Engelli liste yenileme zaten devam ediyor.");
      return;
    }

    this._isBlockedListRefreshInProgress = true;
    await storageHandler.saveLastOperationResult('RUNNING');
    this.earlyStop = false;

    const operationId = savedState?.operationId || 'refresh-blocked-' + Date.now();
    
    const initialState = savedState?.checkpointData ? {
      scrapedUsers: savedState.checkpointData.collectedUsers || [],
      currentPage: savedState.checkpointData.currentPage || 0,
      totalCount: savedState.checkpointData.userCount || 0
    } : null;

    resumableOperationRegistry.registerOperation(
      operationId,
      'REFRESH_BLOCKED_LIST',
      {},
      ['FETCH_PAGES']
    );

    try {
      const updateProgress = async (progress) => {
        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "blockedListRefreshProgress",
            count: progress.currentCount
          }).catch(e => log.warn("progctrl", `Error sending progress message: ${e}`));
        }
        await storageHandler.saveBlockedUserCount(progress.currentCount);
      };

      if (initialState && initialState.totalCount > 0) {
        await updateProgress({ currentCount: initialState.totalCount });
      }

      const pauseCheckCallback = async () => {
        const status = await checkPauseOrStop();
        return status.paused || status.stopped;
      };

      const result = await scrapingHandler.scrapeAllBlockedUsers(updateProgress, null, pauseCheckCallback, null, initialState);

      if (result.paused) {
        log.info("progctrl", "Blocked list refresh paused by user.");
        return;
      }

      if (result.success) {
        await storageHandler.clearPartialBlockedUsers();
        await storageHandler.saveBlockedUserList(result.usernames);
        await storageHandler.saveBlockedUserCount(result.count);

        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "blockedListRefreshComplete",
            success: true,
            count: result.count
          }).catch(e => log.warn("progctrl", `Error sending complete message: ${e}`));
        }
        
        notificationHandler.finishSuccess(enums.BanSource.REFRESH_BLOCKED_LIST, null, result.count, result.count, result.count, processQueue.currentItemMetadata);
      } else if (result.stoppedEarly) {
        await storageHandler.savePartialBlockedUsers(result.usernames || [], true);

        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "blockedListRefreshComplete",
            success: false,
            stoppedEarly: true,
            usernames: result.usernames || [],
            count: result.count || 0,
            error: result.error || "İşlem kullanıcı tarafından durduruldu"
          }).catch(e => log.warn("progctrl", `Error sending early stop message: ${e}`));
        }
        
        notificationHandler.finishErrorEarlyStop(enums.BanSource.REFRESH_BLOCKED_LIST, null, processQueue.currentItemMetadata);
      } else {
        log.err("progctrl", "Error scraping blocked users:", result.error);
        await storageHandler.clearPartialBlockedUsers();

        if (this.tabId) {
          chrome.tabs.sendMessage(this.tabId, {
            action: "blockedListRefreshComplete",
            success: false,
            error: result.error
          }).catch(e => log.warn("progctrl", `Error sending error message: ${e}`));
        }
        
        notificationHandler.finishSuccess(enums.BanSource.REFRESH_BLOCKED_LIST, null, 0, 0, 0, processQueue.currentItemMetadata);
      }
    } catch (e) {
      log.err("progctrl", `Unexpected error during refreshBlockedList: ${e}`);

      if (this.tabId) {
        chrome.tabs.sendMessage(this.tabId, {
          action: "blockedListRefreshComplete",
          success: false,
          error: e.message || "Bilinmeyen hata"
        }).catch(err => log.warn("progctrl", `Error sending error message: ${err}`));
      }
      
      notificationHandler.finishSuccess(enums.BanSource.REFRESH_BLOCKED_LIST, null, 0, 0, 0, processQueue.currentItemMetadata);
    } finally {
      log.info("progctrl", "refreshBlockedList function completed.");
      this.earlyStop = false;
      this._isBlockedListRefreshInProgress = false;

      const currentOp = resumableOperationRegistry.getCurrentOperation();
      if (!currentOp || currentOp.state !== OperationState.PAUSED) {
        resumableOperationRegistry.completeOperation();
        await storageHandler.saveLastOperationResult('COMPLETED');
      } else {
        await storageHandler.saveLastOperationResult('PAUSED');
      }

      notificationHandler.notifyUpdateCounts();
    }
  }

  async migrateBlockedTitlesToUnblocked() {
    log.info("progctrl", "migrateBlockedTitlesToUnblocked function started.");

    if (this._blockTitlesInProgress) {
      log.warn("progctrl", "Unblocking blocked titles is already in progress.");
      notificationHandler.notify("Engellenen başlıkların engelini kaldırma işlemi zaten devam ediyor.");
      return;
    }

    this._blockTitlesInProgress = true;
    await storageHandler.saveLastOperationResult('RUNNING');
    this.earlyStop = false;

    try {
      notificationHandler.notify("Başlıkları engellenen kullanıcıların listesi getiriliyor...");

      const scrapeResult = await scrapingHandler.scrapeAllUsersWithBlockedTitles(
        (progress) => {
        }
      );

      if (!scrapeResult.success) {
        log.err("progctrl", `Failed to fetch list of users with blocked titles: ${scrapeResult.error}`);
        notificationHandler.notify(`Başlıkları engellenen kullanıcıların listesi getirilemedi: ${scrapeResult.error}`);
        this._blockTitlesInProgress = false;
        return;
      }

      const usersWithBlockedTitles = scrapeResult.users;
      const totalCount = scrapeResult.count;

      if (usersWithBlockedTitles.length === 0) {
        log.info("progctrl", "No users with blocked titles found - completing with 0 results");
        notificationHandler.finishSuccess(enums.BanSource.TITLE, enums.BanMode.UNDOBAN, 0, 0, 0, processQueue.currentItemMetadata);
        this._blockTitlesInProgress = false;
        resumableOperationRegistry.completeOperation();
        return;
      }
log.info("progctrl", `Successfully fetched list of ${totalCount} users with blocked titles. Starting unblocking process...`);
notificationHandler.notify(`${totalCount} adet başlıkları engellenen kullanıcı bulundu. Engel kaldırma işlemi başlatılıyor...`);

      let unblockedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < usersWithBlockedTitles.length; i++) {
        if (this.earlyStop) {
          log.info("progctrl", "Unblocking titles stopped early by user.");
          notificationHandler.notify(`Başlık engeli kaldırma erken durduruldu. İşlenen kullanıcı: ${i}/${usersWithBlockedTitles.length}.`);
          break;
        }
 
         const user = usersWithBlockedTitles[i];
         const currentProgress = i + 1;
         const totalUsers = usersWithBlockedTitles.length;
 
         notificationHandler.notifyOngoing(unblockedCount, currentProgress, totalUsers, processQueue.currentItemMetadata);
 
         log.info("progctrl", `Unblocking titles for user: ${user.authorName} (ID: ${user.authorId})...`);
 
         const unblockResult = await this._performActionWithRetry(enums.BanMode.UNDOBAN, user.authorId, false, true, false);
 
         if (unblockResult.earlyStop) {
           log.info("progctrl", "Unblocking titles stopped early by user during action.");
           break;
         }
 
         if (unblockResult.resultType !== enums.ResultType.SUCCESS) {
           log.err("progctrl", `Failed to unblock titles for user: ${user.authorName}`);
           failedCount++;
         } else {
           log.info("progctrl", `Successfully unblocked titles for user: ${user.authorName}`);
           unblockedCount++;
         }
 
         await utils.sleep(500);
       }
  
       const totalProcessed = unblockedCount + failedCount;
       if (this.earlyStop) {
           log.info("progctrl", `Unblocking titles stopped early. Unblocked: ${unblockedCount}, Failed: ${failedCount}, Total Processed: ${totalProcessed}`);
           notificationHandler.finishErrorEarlyStop(enums.BanSource.TITLE, enums.BanMode.UNDOBAN, processQueue.currentItemMetadata);
       } else {
           const finalMessage = `Durum: Engellenen başlıkların engeli kaldırıldı. Başarıyla engeli kaldırılan kullanıcılar: ${unblockedCount}, Başarısız kullanıcılar: ${failedCount}, Toplam işlenen kullanıcı: ${totalProcessed}`;
           log.info("progctrl", finalMessage);
           notificationHandler.finishSuccess(enums.BanSource.TITLE, enums.BanMode.UNDOBAN, unblockedCount, totalProcessed, usersWithBlockedTitles.length, processQueue.currentItemMetadata);
       }
  
      } catch (error) {
       log.err("progctrl", `An error occurred during unblocking blocked titles: ${error}`, error);
       notificationHandler.finishSuccess(enums.BanSource.TITLE, enums.BanMode.UNDOBAN, 0, 0, 0, processQueue.currentItemMetadata);
      } finally {
        log.info("progctrl", "migrateBlockedTitlesToUnblocked function completed.");
        this.earlyStop = false;
        this._blockTitlesInProgress = false;
        await storageHandler.saveLastOperationResult('COMPLETED');
      }
   }

  // ============================
  // PAUSE / RESUME / CONTINUE
  // ============================

  /**
   * Get the resumable operation registry
   * @returns {ResumableOperationRegistry}
   */
  getResumableRegistry() {
    return resumableOperationRegistry;
  }

  /**
   * Pause the current operation
   * @returns {Promise<Object>}
   */
  async pauseCurrentOperation() {
    log.info("progctrl", "Pause requested for current operation");
    
    // Check if there's a resumable operation registered
    const currentOp = resumableOperationRegistry.getCurrentOperation();
    if (!currentOp) {
      log.warn("progctrl", "No operation running to pause");
      return { success: false, error: 'Duraklatılacak işlem bulunamadı' };
    }
    
    return await resumableOperationRegistry.requestPause();
  }

  /**
   * Resume a paused operation
   * @param {string} operationId - The operation ID to resume
   * @returns {Promise<Object>}
   */
  async resumeOperation(operationId) {
    log.info("progctrl", `Resume requested for operation ${operationId}`);
    
    // Get saved state
    const savedState = await storageHandler.getOperationState(operationId);
    if (!savedState) {
      return { success: false, error: 'İşlem için kayıtlı durum bulunamadı' };
    }

    // Check if operation is already running
    if (this._dateBasedBulkInProgress || 
        this._migrationInProgress ||
        this._blockMutedUsersInProgress ||
        this._blockTitlesInProgress) {
      return { success: false, error: 'Başka bir işlem zaten devam ediyor' };
    }

    // Validate that the saved state has the required data for resume
    if (!savedState.checkpointData || !savedState.operationType) {
      return { success: false, error: 'Geçersiz işlem - kontrol noktası verisi veya işlem türü eksik' };
    }

    // Dispatch to appropriate handler based on operation type
    switch (savedState.operationType) {
      case 'DATE_BASED_BULK':
        return await this._resumeDateBasedBulkAction(savedState);
      case 'MIGRATE_BLOCKED_TO_MUTED':
        return await this._resumeMigrateBlockedToMuted(savedState);
      case 'BLOCK_MUTED_USERS':
        return await this._resumeBlockMutedUsers(savedState);
      case 'BLOCK_TITLES':
        return await this._resumeBlockTitles(savedState);
      case 'REFRESH_MUTED_LIST':
        return await this._resumeRefreshMutedList(savedState);
      case 'REFRESH_BLOCKED_LIST':
        return await this._resumeRefreshBlockedList(savedState);
      default:
        return { success: false, error: `Bilinmeyen işlem türü: ${savedState.operationType}` };
    }
  }

  /**
   * Stop the current operation
   * @param {boolean} clearState - Whether to clear saved state
   * @returns {Promise<Object>}
   */
  async stopCurrentOperation(clearState = false) {
    log.info("progctrl", `Stop requested for current operation (clearState: ${clearState})`);
    
    // Set early stop flag for immediate effect
    this.earlyStop = true;
    
    // Force clear flags immediately to allow queue to continue
    this.forceClearAllFlags();
    
    // Also use registry stop
    const result = await resumableOperationRegistry.requestStop(clearState);
    
    // Trigger queue processing for next item
    if (result.success) {
      log.info("progctrl", "Stop successful, triggering queue processing");
      await storageHandler.saveLastOperationResult('STOPPED');
      processQueue.triggerProcessing();
    }
    
    return result;
  }


  /**
   * Get current operation info
   * @returns {Object|null}
   */
  getCurrentOperation() {
    // First check for resumable operations
    const resumableOp = resumableOperationRegistry.getCurrentOperation();
    if (resumableOp) {
      // All operations registered with the registry now support checkpoint-based pausing
      return { ...resumableOp, canPause: true };
    }
    
    return null;
  }


  /**
   * Check if there's a running operation
   * @returns {boolean}
   */
  hasRunningOperation() {
    return resumableOperationRegistry.isOperationRunning();
  }

  /**
   * List all paused operations
   * @returns {Promise<Array>}
   */
  async getPausedOperations() {
    const allOperations = await storageHandler.listResumableOperations();
    return allOperations.filter(op => op.state === OperationState.PAUSED || op.state === OperationState.STOPPED);
  }

  /**
   * Resume date-based bulk action from saved state
   * @private
   */
  async _resumeDateBasedBulkAction(savedState) {
    const { params, checkpointData } = savedState;
    
    log.info("progctrl", `Resuming date-based bulk action from checkpoint: ${savedState.currentCheckpoint}`);
    log.info("progctrl", `Checkpoint data: ${JSON.stringify(checkpointData)}`);
    
    // Re-register the operation with RUNNING state
    const operationId = savedState.operationId;
    this._dateBasedBulkInProgress = true;
    this.earlyStop = false;
    
    // Re-register with resumable operation registry
    resumableOperationRegistry.registerOperation(
      operationId,
      'DATE_BASED_BULK',
      params,
      ['FETCH_USERS', 'FETCH_DATES', 'FILTER_USERS', 'PERFORM_ACTIONS']
    );
    
    // Update stats if available
    if (savedState.stats) {
      const op = resumableOperationRegistry.getCurrentOperation();
      if (op) {
        op.stats = savedState.stats;
      }
    }

    try {
      let userList = [];
      let matchingUsers = [];
      let successCount = 0;
      let failCount = 0;
      
      // Restore state based on the checkpoint stage
      if (checkpointData) {
        switch (checkpointData.stage) {
          case 'FETCH_USERS':
            // We have already collected some users but not all
            log.info("progctrl", `Resuming from FETCH_USERS checkpoint with ${checkpointData.collectedUsers?.length || 0} users collected, currentPage: ${checkpointData.currentPage}`);
            
            // Start with already collected users
            userList = checkpointData.collectedUsers || [];
            
            if (params.source === 'BLOCKED_USERS') {
              notificationHandler.notify(`Engellenen kullanıcılar getirilmeye devam ediliyor... (${userList.length} kullanıcı zaten alındı)`);
              
              const pauseCheckCallback = async () => {
                const status = await checkPauseOrStop();
                return status.paused || status.stopped;
              };
              
              // Pass initialState to continue from where we left off
              const initialState = {
                scrapedUsers: userList,
                currentPage: checkpointData.currentPage || 0,
                totalCount: checkpointData.userCount || userList.length
              };
              
              const scrapeResult = await scrapingHandler.scrapeAllBlockedUsers(
                (progress) => {
                  notificationHandler.notify('Engellenen kullanıcılar getiriliyor: ' + progress.currentCount + ' kullanıcı...');
                },
                null, // resumeFromIndex - deprecated, use initialState
                pauseCheckCallback,
                null, // checkpointCallback - not needed for resume
                initialState
              );
              
              if (scrapeResult.paused) {
                log.info("progctrl", "Date-based bulk action paused during blocked users fetch resume.");
                this._dateBasedBulkInProgress = false;
                return { success: true, paused: true };
              }
              
              if (scrapeResult.stoppedEarly && !scrapeResult.paused) {
                log.info("progctrl", "Date-based bulk action stopped during blocked users fetch resume.");
                notificationHandler.finishErrorEarlyStop(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, processQueue.currentItemMetadata);
                this._dateBasedBulkInProgress = false;
                return { success: true, stopped: true };
              }
              
              if (!scrapeResult.success && !scrapeResult.usernames?.length) {
                log.err("progctrl", 'Failed to fetch remaining blocked users: ' + scrapeResult.error);
                notificationHandler.notify('Engellenen kullanıcılar getirilemedi: ' + (scrapeResult.error || 'Bilinmeyen hata'));
                this._dateBasedBulkInProgress = false;
                return { success: false, error: scrapeResult.error };
              }
              
              userList = scrapeResult.usernames || userList;
              if (userList.length > 0) {
                await storageHandler.saveBlockedUserList(userList);
                await storageHandler.saveBlockedUserCount(userList.length);
              }
            } else if (params.source === 'MUTED_USERS') {
              notificationHandler.notify(`Sessize alınan kullanıcılar getirilmeye devam ediliyor... (${userList.length} kullanıcı zaten alındı)`);
              
              const pauseCheckCallback = async () => {
                const status = await checkPauseOrStop();
                return status.paused || status.stopped;
              };
              
              // Pass initialState to continue from where we left off
              const initialState = {
                scrapedUsers: userList,
                currentPage: checkpointData.currentPage || 0,
                totalCount: checkpointData.userCount || userList.length
              };
              
              const scrapeResult = await scrapingHandler.scrapeAllMutedUsers(
                (progress) => {
                  notificationHandler.notify('Sessize alınan kullanıcılar getiriliyor: Sayfa ' + progress.currentPage + ', ' + progress.currentCount + ' kullanıcı...');
                },
                null, // resumeFromIndex - deprecated, use initialState
                pauseCheckCallback,
                null, // checkpointCallback - not needed for resume
                initialState
              );
              
              if (scrapeResult.paused) {
                log.info("progctrl", "Date-based bulk action paused during muted users fetch resume.");
                this._dateBasedBulkInProgress = false;
                return { success: true, paused: true };
              }
              
              if (scrapeResult.stoppedEarly && !scrapeResult.paused) {
                log.info("progctrl", "Date-based bulk action stopped during muted users fetch resume.");
                notificationHandler.finishErrorEarlyStop(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, processQueue.currentItemMetadata);
                this._dateBasedBulkInProgress = false;
                return { success: true, stopped: true };
              }
              
              if (!scrapeResult.success && !scrapeResult.usernames?.length) {
                log.err("progctrl", 'Failed to fetch remaining muted users: ' + scrapeResult.error);
                notificationHandler.notify('Sessize alınan kullanıcılar getirilemedi: ' + (scrapeResult.error || 'Bilinmeyen hata'));
                this._dateBasedBulkInProgress = false;
                return { success: false, error: scrapeResult.error };
              }
              
              userList = scrapeResult.usernames || userList;
              if (userList.length > 0) {
                await storageHandler.saveMutedUserList(userList);
                await storageHandler.saveMutedUserCount(userList.length);
              }
            } else if (params.source === 'AUTHOR_LIST') {
              // Author list doesn't have incremental fetching, just use the collected users
              userList = checkpointData.collectedUsers || [];
            }
            break;
            
          case 'FETCH_DATES':
            // We have all users and need to continue fetching registration dates
            userList = checkpointData.userList || [];
            log.info("progctrl", `Resuming from FETCH_DATES checkpoint with ${userList.length} users, fetchedCount: ${checkpointData.fetchedCount}`);
            break;
            
          case 'PERFORM_ACTIONS':
            // We have filtered users and need to continue performing actions
            matchingUsers = checkpointData.matchingUsers || [];
            successCount = checkpointData.successCount || 0;
            failCount = checkpointData.failCount || 0;
            userList = checkpointData.userList || [];
            log.info("progctrl", `Resuming from PERFORM_ACTIONS checkpoint with ${matchingUsers.length} matching users, processedCount: ${checkpointData.processedCount}, successCount: ${successCount}`);
            break;
            
          default:
            // Unknown checkpoint, restart from beginning
            log.warn("progctrl", `Unknown checkpoint stage: ${checkpointData.stage}, will fetch users from scratch`);
        }
      }
      
      // If no userList yet, fetch it
      if (userList.length === 0 && !checkpointData?.userList) {
        notificationHandler.notify("Kullanıcı listesi getiriliyor...");
        
        if (params.source === 'BLOCKED_USERS') {
          const scrapeResult = await scrapingHandler.scrapeAllBlockedUsers();
          if (scrapeResult.success) {
            userList = scrapeResult.usernames || [];
            await storageHandler.saveBlockedUserList(userList);
            await storageHandler.saveBlockedUserCount(userList.length);
          }
        } else if (params.source === 'MUTED_USERS') {
          const scrapeResult = await scrapingHandler.scrapeAllMutedUsers();
          if (scrapeResult.success) {
            userList = scrapeResult.usernames || [];
            await storageHandler.saveMutedUserList(userList);
            await storageHandler.saveMutedUserCount(userList.length);
          }
        } else if (params.source === 'AUTHOR_LIST') {
          userList = await utils.getUserList();
          utils.cleanUserList(userList);
        }
      }
      
      if (userList.length === 0) {
        log.info("progctrl", "No users found to resume operation - completing with 0 results");
        notificationHandler.finishSuccess(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
        this._dateBasedBulkInProgress = false;
        resumableOperationRegistry.completeOperation();
        return { success: true, completed: true };
      }
      
      log.info("progctrl", `Resuming with ${userList.length} users`);
      
      // Now continue with the date filtering and action phase
      // Build user relations map
      const userRelations = new Map();
      for (const username of userList) {
        userRelations.set(username, { registrationDate: null });
      }
      
      // Fetch registration dates if not already done
      const cachedDates = await storageHandler.getRegistrationDatesBatch(userList);
      const usersToFetch = userList.filter(name => !cachedDates.has(name));
      
      log.info("progctrl", `Found ${cachedDates.size} cached dates, need to fetch ${usersToFetch.length}`);
      
      let fetchedCount = 0;
      const newlyFetchedDates = new Map();
      
      // Resume fetching dates from where we left off
      const fetchStartIndex = checkpointData?.stage === 'FETCH_DATES' || checkpointData?.stage === 'FILTER_USERS' 
        ? (checkpointData.fetchedCount || 0) 
        : 0;
      
      for (let i = fetchStartIndex; i < usersToFetch.length; i++) {
        if (this.earlyStop) break;
        
        const status = await checkPauseOrStop();
        if (status.paused) {
          // Save checkpoint and return
          await resumableOperationRegistry.checkpointReached({
            stage: 'FETCH_DATES',
            userList: userList,
            fetchedCount: i,
            processedCount: 0
          });
          this._dateBasedBulkInProgress = false;
          return { success: true, paused: true };
        }
        if (status.stopped) {
          this._dateBasedBulkInProgress = false;
          return { success: true, stopped: true };
        }
        
        const username = usersToFetch[i];
        try {
          const regDate = await scrapingHandler.scrapeRegistrationDate(username);
          if (regDate) {
            newlyFetchedDates.set(username, regDate);
            const relation = userRelations.get(username);
            if (relation) {
              relation.registrationDate = regDate;
              userRelations.set(username, relation);
            }
          }
          
          fetchedCount++;
          if (fetchedCount % 10 === 0) {
            notificationHandler.notifyStatus(`Kayıt tarihi alınıyor: ${fetchedCount}/${usersToFetch.length}`);
          }
          
          await utils.sleep(50);
        } catch (err) {
          log.err("progctrl", `Error fetching registration date for ${username}: ${err}`);
        }
      }
      
      // Cache newly fetched dates
      if (newlyFetchedDates.size > 0) {
        await storageHandler.saveRegistrationDatesBatch(newlyFetchedDates);
      }
      
      // Add cached dates to relations
      for (const [username, regDate] of cachedDates) {
        const relation = userRelations.get(username);
        if (relation) {
          relation.registrationDate = regDate;
          userRelations.set(username, relation);
        }
      }
      
      // Create a filter rule to evaluate users
      const filterRule = {
        criteria: params.criteria,
        value: params.value,
        valueType: params.valueType,
        action: 'MATCH'
      };
      
      // Filter users based on date criteria (only if not already restored from checkpoint)
      if (matchingUsers.length === 0) {
        for (const [username, userData] of userRelations) {
          if (this.earlyStop) break;
          
          if (userData.registrationDate && utils.evaluateDateFilter(userData.registrationDate, filterRule)) {
            matchingUsers.push(username);
          }
        }
      }
      
      log.info("progctrl", `Found ${matchingUsers.length} users matching the date criteria.`);
      
      if (matchingUsers.length === 0) {
        log.info("progctrl", "No users matched date criteria - completing with 0 results");
        notificationHandler.finishSuccess(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, 0, 0, 0, processQueue.currentItemMetadata);
        this._dateBasedBulkInProgress = false;
        await resumableOperationRegistry.completeOperation();
        return { success: true, completed: true };
      }
      
      notificationHandler.notify(`${matchingUsers.length} kullanıcı tarih kriterine uyuyor. İşlem devam ediyor...`);
      
      // Perform the bulk action on matching users
      // Use already restored successCount/failCount from checkpoint, or start from 0
      const resumeIndex = checkpointData?.stage === 'PERFORM_ACTIONS' ? (checkpointData.processedCount || 0) : 0;
      
      for (let i = resumeIndex; i < matchingUsers.length; i++) {
        // Check for pause/stop request
        const status = await checkPauseOrStop();
        if (status.paused) {
          // Save checkpoint for resume
          await resumableOperationRegistry.checkpointReached({
            stage: 'PERFORM_ACTIONS',
            matchingUsers: matchingUsers,
            processedCount: i,
            successCount: successCount,
            failCount: failCount
          });
          return;
        }

        if (status.stopped || this.earlyStop) {
          log.info("progctrl", "Date-based bulk action stopped early by user during resume.");
          notificationHandler.notify(`İşlem erken durduruldu. İşlenen: ${i}/${matchingUsers.length}`);
          
          // Save checkpoint for resume
          await resumableOperationRegistry.checkpointReached({
            stage: 'PERFORM_ACTIONS',
            matchingUsers: matchingUsers,
            processedCount: i,
            successCount: successCount,
            failCount: failCount
          });
          
          this._dateBasedBulkInProgress = false;
          notificationHandler.finishErrorEarlyStop(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, processQueue.currentItemMetadata);
          return { success: true, stopped: true };
        }
        
        if (status.paused) {
          await resumableOperationRegistry.checkpointReached({
            stage: 'PERFORM_ACTIONS',
            matchingUsers: matchingUsers,
            processedCount: i,
            successCount: successCount,
            failCount: failCount
          });
          this._dateBasedBulkInProgress = false;
          return { success: true, paused: true };
        }
        
        const username = matchingUsers[i];
        notificationHandler.notifyOngoing(successCount, i + 1, matchingUsers.length, processQueue.currentItemMetadata);
        
        // Get user ID
        const authorId = await scrapingHandler.scrapeAuthorIdFromAuthorProfilePage(username);
        if (!authorId || authorId === "0") {
          log.err("progctrl", `Could not get user ID for ${username}`);
          failCount++;
          continue;
        }
        
        // Perform the action based on bulkAction
        let result;
        switch (params.bulkAction) {
          case 'ENGELLE':
            result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, true, false, false);
            break;
          case 'SESSIZE_AL':
            result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, true);
            break;
          case 'ENGEL_KALDIR':
            result = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, true, false, false);
            break;
          case 'SESSIZDEN_CIKAR':
            result = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, false, false, true);
            break;
          case 'TAKIP_ET':
            result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, false, true);
            break;
          case 'ENGEL_KALDIR_VE_TAKIP_ET':
            // First unblock, then follow
            result = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, true, false, false);
            if (result.resultType === enums.ResultType.SUCCESS) {
              result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, false, true);
            }
            break;
          case 'SESSIZDEN_CIKAR_VE_TAKIP_ET':
            // First unmute, then follow
            result = await this._performActionWithRetry(enums.BanMode.UNDOBAN, authorId, false, false, true);
            if (result.resultType === enums.ResultType.SUCCESS) {
              result = await this._performActionWithRetry(enums.BanMode.BAN, authorId, false, false, false, true);
            }
            break;
          default:
            log.err("progctrl", `Unknown bulk action: ${params.bulkAction}`);
            failCount++;
            continue;
        }
        
        if (result.earlyStop) {
          // Save checkpoint before stopping
          await resumableOperationRegistry.checkpointReached({
            stage: 'PERFORM_ACTIONS',
            matchingUsers: matchingUsers,
            processedCount: i + 1,
            successCount: successCount,
            failCount: failCount
          });
          break;
        }
        
        if (result.resultType === enums.ResultType.SUCCESS) {
          successCount++;
        } else {
          failCount++;
        }
        
        await utils.sleep(500);
      }
      
      const totalProcessed = successCount + failCount;
      
      if (this.earlyStop) {
        notificationHandler.finishErrorEarlyStop(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, processQueue.currentItemMetadata);
      } else {
        notificationHandler.finishSuccess(enums.BanSource.DATE_BASED_BULK, enums.BanMode.BAN, successCount, totalProcessed, matchingUsers.length, processQueue.currentItemMetadata);
      }
      
      await resumableOperationRegistry.completeOperation();
      this._dateBasedBulkInProgress = false;
      return { success: true, completed: true };
      
    } catch (error) {
      log.err("progctrl", `Error resuming date-based bulk action: ${error}`, error);
      this._dateBasedBulkInProgress = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume migration from saved state
   * @private
   */
  async _resumeMigrateBlockedToMuted(savedState) {
    log.info("progctrl", "Resuming migration from saved state - restarting operation");
    
    // Migration doesn't have granular checkpoints, so we restart it
    // The blocked users list is cached, so it will be faster
    this._migrationInProgress = false;
    
    try {
      await this.migrateBlockedToMuted();
      return { success: true };
    } catch (error) {
      log.err("progctrl", `Error resuming migration: ${error}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume block muted users from saved state
   * @private
   */
  async _resumeBlockMutedUsers(savedState) {
    log.info("progctrl", "Resuming block muted users from saved state - restarting operation");
    
    // Block muted users doesn't have granular checkpoints, so we restart it
    this._blockMutedUsersInProgress = false;
    
    try {
      await this.blockMutedUsers();
      return { success: true };
    } catch (error) {
      log.err("progctrl", `Error resuming block muted users: ${error}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume block titles from saved state
   * @private
   */
  async _resumeBlockTitles(savedState) {
    log.info("progctrl", "Resuming block titles from saved state - restarting operation");
    
    this._blockTitlesInProgress = false;
    
    try {
      await this.blockTitlesOfBlockedMuted();
      return { success: true };
    } catch (error) {
      log.err("progctrl", `Error resuming block titles: ${error}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume muted list refresh from saved state
   * @private
   */
  async _resumeRefreshMutedList(savedState) {
    log.info("progctrl", "Resuming muted list refresh from saved state");
    
    this._isMutedListRefreshInProgress = false;
    
    try {
      await this.refreshMutedList(savedState);
      return { success: true };
    } catch (error) {
      log.err("progctrl", `Error resuming muted list refresh: ${error}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume blocked list refresh from saved state
   * @private
   */
  async _resumeRefreshBlockedList(savedState) {
    log.info("progctrl", "Resuming blocked list refresh from saved state");
    
    this._isBlockedListRefreshInProgress = false;
    
    try {
      await this.refreshBlockedList(savedState);
      return { success: true };
    } catch (error) {
      log.err("progctrl", `Error resuming blocked list refresh: ${error}`);
      return { success: false, error: error.message };
    }
  }
}
 
 export const programController = new ProgramController();

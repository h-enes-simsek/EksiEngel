import * as enums from './enums.js';
import * as utils from './utils.js'
import {processQueue} from './queue.js';
import {log} from './log.js';
import { notificationHandler } from './notificationHandler.js';
import { relationHandler } from './relationHandler.js';
import { scrapingHandler } from './scrapingHandler.js';
import { config } from './config.js';
import { storageHandler } from './storageHandler.js';

class ProgramController {
  constructor() {
    this._earlyStop = false;
    this._migrationInProgress = false;
    this._isBlockedListRefreshInProgress = false;
    this._isMutedListRefreshInProgress = false;
    this._blockMutedUsersInProgress = false;
    this._blockTitlesInProgress = false;
    this._tabId = 0;
  }

  get isActive() {
    return processQueue.isRunning ||
           this._migrationInProgress ||
           this._isMutedListRefreshInProgress ||
           this._isBlockedListRefreshInProgress ||
           this._blockMutedUsersInProgress ||
           this._blockTitlesInProgress;
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
      } else if (processQueue.isRunning) {
        log.info("progctrl", "early stop received while queue is processing. Current operation will stop, remaining queued operations will continue.");
      } else {
        log.info("progctrl", "early stop received, but no process is currently running.");
      }
    } else {
      log.info("progctrl", "early stop flag cleared.");
    }
  }

  stopAllOperations() {
    this.earlyStop = true;
    log.info("progctrl", `Early stop triggered - will stop current operation but preserve ${processQueue.size} queued tasks`);
  }

  get hasAnyRunningTasks() {
    return this._migrationInProgress ||
           this._isMutedListRefreshInProgress ||
           this._isBlockedListRefreshInProgress ||
           this._blockMutedUsersInProgress ||
           this._blockTitlesInProgress;
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
            error: result.error || "Process stopped by user",
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
          error: error.message || "Unknown error",
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

  async _performActionWithRetry(banMode, id, isTargetUser, isTargetTitle, isTargetMute, retries = 3) {
    let attempt = 0;
    while (attempt < retries) {
      if (this.earlyStop) {
        log.info("progctrl", "Migration stopped early during action retry.");
        return { resultType: enums.ResultType.FAIL, earlyStop: true };
      }

      const banModeStr = Object.keys(enums.BanMode).find(key => enums.BanMode[key] === banMode) || banMode;
      if (attempt === 0) {
        log.debug("progctrl", `Attempt ${attempt + 1} for action: ${banModeStr}, id: ${id}, user: ${isTargetUser}, title: ${isTargetTitle}, mute: ${isTargetMute}`);
      }

      relationHandler.reset();
      const result = await relationHandler.performAction(banMode, id, isTargetUser, isTargetTitle, isTargetMute);

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
                 message: "Operation stopped by user during cooldown.",
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
           statusText: "Migration already in progress."
         });
       } catch (e) {
         log.warn("progctrl", `Error sending status update: ${e}`);
       }
       return;
    }

    this._migrationInProgress = true;
    this.earlyStop = false;

    try {
      log.info("progctrl", "Fetching all blocked users...");
      notificationHandler.notify("Engellenen kullanıcılar getiriliyor...");
      const scrapeResult = await scrapingHandler.scrapeAllBlockedUsers();

      if (!scrapeResult.success) {
        log.err("progctrl", `Failed to fetch blocked users: ${scrapeResult.error}`);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/img/eksiengel48.png'),
          title: 'EksiEngel - Error',
          message: `Failed to fetch blocked users: ${scrapeResult.error}`
        });
        this._migrationInProgress = false;
        notificationHandler.notify(`Engellenen kullanıcılar getirilemedi: ${scrapeResult.error}`);
        return;
      }

      const blockedUsers = scrapeResult.usernames.map(username => ({ authorName: username, authorId: null }));
      const totalBlockedUsers = scrapeResult.count;

      if (blockedUsers.length === 0) {
        log.info("progctrl", "No blocked users found - completing with 0 results");
        this._migrationInProgress = false;
        notificationHandler.notify("Engellenen kullanıcı bulunamadı.");
        return;
      }

      log.info("progctrl", `Found ${blockedUsers.length} blocked users.`);
      notificationHandler.notify(`Engellenen ${blockedUsers.length} kullanıcı sessize alınıyor...`);

      let migratedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < blockedUsers.length; i++) {
        const user = blockedUsers[i];

        if (this.earlyStop) {
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
      notificationHandler.notify(`Taşıma sırasında bir hata oluştu: ${error.message || "Bilinmeyen hata"}`);
    } finally {
      log.info("progctrl", "migrateBlockedToMuted function completed.");
      this.earlyStop = false;
      this._migrationInProgress = false;
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
    this.earlyStop = false;

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

            for (let i = 0; i < pageUsernames.length; i++) {
              if (this.earlyStop) {
                log.info("progctrl", "Blocking muted users stopped early by user during page processing.");
                notificationHandler.notify(`Sessize alınan kullanıcıları engelleme işlemi kullanıcı tarafından durduruldu. İşlenen: ${processedCount} kullanıcı.`);
                break;
              }

              const username = pageUsernames[i];
              const authorIdFromPage = pageUserIds[i];
              processedCount++;

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
      notificationHandler.notify(`Sessize alınan kullanıcıları engelleme sırasında beklenmedik bir hata oluştu: ${error.message || "Bilinmeyen hata"}. İşlenen: ${processedCount} kullanıcı.`);
    } finally {
      log.info("progctrl", "blockMutedUsers function completed.");
      this.earlyStop = false;
      this._blockMutedUsersInProgress = false;
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
    this.earlyStop = false;

    try {
      notificationHandler.notify("Engellenen ve sessize alınan kullanıcı listeleri getiriliyor...");

      const blockedUsersResult = await scrapingHandler.scrapeAllBlockedUsers();
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
        log.info("progctrl", "No blocked or muted users found to process titles for - completing with 0 results, queue will continue with next item");
        notificationHandler.notify("Başlıkları işlenecek engellenmiş veya sessize alınmış kullanıcı bulunamadı.");
        return;
      }

      log.info("progctrl", `Found ${usersToProcess.length} unique blocked/muted users to process titles for.`);
      notificationHandler.notify(`${usersToProcess.length} benzersiz engellenmiş/sessize alınmış kullanıcı bulundu. Başlık engelleme işlemi başlatılıyor...`);

      let serverBlockedTitlesCount = 0;
      let simulatedBlockedTitlesCount = 0;
      let usersProcessedCount = 0;
      let failedUsersCount = 0;
      let successfulUsersCount = 0;

      notificationHandler.notifyOngoing(successfulUsersCount, usersProcessedCount, usersToProcess.length, processQueue.currentItemMetadata);

      for (let i = 0; i < usersToProcess.length; i++) {
        if (this.earlyStop) {
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
      notificationHandler.notify(`Başlık engelleme sırasında bir hata oluştu: ${error.message}. İşlenen kullanıcı sayısı: ${usersProcessedCount}.`);
    } finally {
      log.info("progctrl", "blockTitlesOfBlockedMuted function completed.");
      this.earlyStop = false;
      this._blockTitlesInProgress = false;
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
        log.info("progctrl", "No users with blocked titles found - completing with 0 results, queue will continue with next item");
        notificationHandler.notify("Başlıkları engellenen kullanıcı bulunamadı.");
        this._blockTitlesInProgress = false;
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
       notificationHandler.notify(`Engellenen başlıkların engeli kaldırılırken bir hata oluştu: ${error.message}`);
     } finally {
       log.info("progctrl", "migrateBlockedTitlesToUnblocked function completed.");
       this.earlyStop = false;
       this._blockTitlesInProgress = false;
     }
   }
 
 }
 
 export const programController = new ProgramController();

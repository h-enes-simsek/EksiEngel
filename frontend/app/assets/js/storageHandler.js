import { log } from './log.js';

const MUTED_USER_LIST_KEY = 'mutedUserList';

class StorageHandler {

  async saveMutedUserList(usernamesArray) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [MUTED_USER_LIST_KEY]: usernamesArray }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving muted user list: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved ${usernamesArray.length} muted usernames.`);
          resolve();
        }
      });
    });
  }

  async getMutedUserList() {
    return new Promise((resolve) => {
      chrome.storage.local.get([MUTED_USER_LIST_KEY], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting muted user list: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          const list = result[MUTED_USER_LIST_KEY];
          if (Array.isArray(list)) {
            log.info('storage', `Retrieved ${list.length} muted usernames from storage.`);
            resolve(list);
          } else {
            log.info('storage', 'No muted user list found in storage.');
            resolve(null);
          }
        }
      });
    });
  }

  async saveMutedUserCount(count) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'mutedUserCount': count }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving muted user count: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved muted user count: ${count}.`);
          resolve();
        }
      });
    });
  }

  async getMutedUserCount() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['mutedUserCount'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting muted user count: ${chrome.runtime.lastError.message}`);
          resolve(0);
        } else {
          const count = result['mutedUserCount'];
          if (typeof count === 'number') {
            log.info('storage', `Retrieved muted user count: ${count} from storage.`);
            resolve(count);
          } else {
            log.info('storage', 'No muted user count found in storage, or it is not a number.');
            resolve(0);
          }
        }
      });
    });
  }

  async getMutedUserCountFromStorage() {
    try {
      const list = await this.getMutedUserList();
      return list ? list.length : 0;
    } catch (error) {
      return 0;
    }
  }

  async saveBlockedUserList(usernamesArray) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'blockedUserList': usernamesArray }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving blocked user list: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved ${usernamesArray.length} blocked usernames.`);
          resolve();
        }
      });
    });
  }

  async getBlockedUserList() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['blockedUserList'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting blocked user list: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          const list = result['blockedUserList'];
          if (Array.isArray(list)) {
            log.info('storage', `Retrieved ${list.length} blocked usernames from storage.`);
            resolve(list);
          } else {
            log.info('storage', 'No blocked user list found in storage.');
            resolve(null);
          }
        }
      });
    });
  }

  async saveBlockedUserCount(count) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'blockedUserCount': count }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving blocked user count: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved blocked user count: ${count}.`);
          resolve();
        }
      });
    });
  }

  async getBlockedUserCount() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['blockedUserCount'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting blocked user count: ${chrome.runtime.lastError.message}`);
          resolve(0);
        } else {
          const count = result['blockedUserCount'];
          if (typeof count === 'number') {
            log.info('storage', `Retrieved blocked user count: ${count} from storage.`);
            resolve(count);
          } else {
            log.info('storage', 'No blocked user count found in storage, or it is not a number.');
            resolve(0);
          }
        }
      });
    });
  }

  async getBlockedUserCountFromStorage() {
    try {
      const list = await this.getBlockedUserList();
      return list ? list.length : 0;
    } catch (error) {
      return 0;
    }
  }

  async removeMutedUsers(usernamesToRemove) {
    if (!Array.isArray(usernamesToRemove) || usernamesToRemove.length === 0) {
      log.warn('storage', 'removeMutedUsers called with empty or invalid list.');
      return Promise.resolve();
    }

    try {
      const currentList = await this.getMutedUserList();
      if (!currentList || currentList.length === 0) {
        log.info('storage', 'removeMutedUsers: Muted user list is already empty.');
        return Promise.resolve();
      }

      const usernamesToRemoveSet = new Set(usernamesToRemove);
      const updatedList = currentList.filter(username => !usernamesToRemoveSet.has(username));

      await this.saveMutedUserList(updatedList);
      await this.saveMutedUserCount(updatedList.length);

      log.info('storage', `Removed ${usernamesToRemove.length} users from muted list storage. New count: ${updatedList.length}`);

    } catch (error) {
      log.err('storage', `Error removing muted users: ${error.message}`);
      throw error;
    }
  }

  _handleStorageError(error) {
    if (error.message.includes('QUOTA_BYTES') || error.message.includes('quota')) {
      return new Error('Storage quota exceeded. Please clear some data and try again.');
    }
    if (error.message.includes('INVALID')) {
      return new Error('Invalid data format. Data may be corrupted.');
    }
    return error;
  }

  async saveQueueData(queueItems) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 
        queueData: {
          version: '1.0',
          timestamp: Date.now(),
          items: queueItems
        }
      }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving queue data: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved queue data with ${queueItems.length} items.`);
          resolve();
        }
      });
    });
  }

  async getQueueData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['queueData'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting queue data: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          const queueData = result.queueData;
          if (queueData && queueData.items && Array.isArray(queueData.items)) {
            log.info('storage', `Retrieved queue data with ${queueData.items.length} items.`);
            resolve(queueData.items);
          } else {
            log.info('storage', 'No queue data found in storage.');
            resolve(null);
          }
        }
      });
    });
  }

  async saveCompletedItems(completedItems) {
    return new Promise((resolve, reject) => {
      const MAX_COMPLETED_ITEMS = 100;
      const trimmedItems = completedItems.slice(-MAX_COMPLETED_ITEMS);
      
      chrome.storage.local.set({ 
        completedData: {
          version: '1.0',
          timestamp: Date.now(),
          items: trimmedItems
        }
      }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving completed items: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved completed data with ${trimmedItems.length} items.`);
          resolve();
        }
      });
    });
  }

  async getCompletedItems() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['completedData'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting completed items: ${chrome.runtime.lastError.message}`);
          resolve([]);
        } else {
          const completedData = result.completedData;
          if (completedData && completedData.items && Array.isArray(completedData.items)) {
            log.info('storage', `Retrieved completed data with ${completedData.items.length} items.`);
            resolve(completedData.items);
          } else {
            log.info('storage', 'No completed data found in storage.');
            resolve([]);
          }
        }
      });
    });
  }

  async addCompletedItem(completedItem) {
    try {
      const existingItems = await this.getCompletedItems();
      existingItems.push(completedItem);
      await this.saveCompletedItems(existingItems);
    } catch (error) {
      log.warn('storage', `Failed to save completed item: ${error.message}`);
      throw error;
    }
  }

  async clearPersistedData() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['queueData', 'completedData'], () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error clearing persisted data: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', 'Cleared persisted queue and completed data.');
          resolve();
        }
      });
    });
  }

  async getStorageUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting storage usage: ${chrome.runtime.lastError.message}`);
          resolve(0);
        } else {
          resolve(bytesInUse);
        }
      });
    });
  }

  async savePartialMutedUsers(usernames, isTemporary = true) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 
        'partialMutedUsers': usernames,
        'partialMutedUsersTimestamp': Date.now(),
        'partialMutedUsersTemporary': isTemporary
      }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving partial muted users: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved ${usernames.length} partial muted users (temporary: ${isTemporary}).`);
          resolve();
        }
      });
    });
  }

  async getPartialMutedUsers() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['partialMutedUsers', 'partialMutedUsersTimestamp', 'partialMutedUsersTemporary'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting partial muted users: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          const users = result.partialMutedUsers;
          if (Array.isArray(users)) {
            log.info('storage', `Retrieved ${users.length} partial muted users from storage.`);
            resolve({
              usernames: users,
              timestamp: result.partialMutedUsersTimestamp,
              isTemporary: result.partialMutedUsersTemporary
            });
          } else {
            log.info('storage', 'No partial muted users found in storage.');
            resolve(null);
          }
        }
      });
    });
  }

  async clearPartialMutedUsers() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['partialMutedUsers', 'partialMutedUsersTimestamp', 'partialMutedUsersTemporary'], () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error clearing partial muted users: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', 'Cleared partial muted users from storage.');
          resolve();
        }
      });
    });
  }

  async saveMutedRefreshResumeState(pageIndex, count) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 
        'mutedRefreshResumeState': {
          pageIndex,
          count,
          timestamp: Date.now()
        }
      }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving muted refresh resume state: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved muted refresh resume state: page ${pageIndex}, count ${count}.`);
          resolve();
        }
      });
    });
  }

  async getMutedRefreshResumeState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['mutedRefreshResumeState'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting muted refresh resume state: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          const state = result.mutedRefreshResumeState;
          if (state && typeof state.pageIndex === 'number' && typeof state.count === 'number') {
            log.info('storage', `Retrieved muted refresh resume state: page ${state.pageIndex}, count ${state.count}.`);
            resolve(state);
          } else {
            log.info('storage', 'No muted refresh resume state found in storage.');
            resolve(null);
          }
        }
      });
    });
  }

  async clearMutedRefreshResumeState() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['mutedRefreshResumeState'], () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error clearing muted refresh resume state: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', 'Cleared muted refresh resume state from storage.');
          resolve();
        }
      });
    });
  }

  async savePartialBlockedUsers(usernames, isTemporary = true) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({
        'partialBlockedUsers': usernames,
        'partialBlockedUsersTimestamp': Date.now(),
        'partialBlockedUsersTemporary': isTemporary
      }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving partial blocked users: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved ${usernames.length} partial blocked users (temporary: ${isTemporary}).`);
          resolve();
        }
      });
    });
  }

  async getPartialBlockedUsers() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['partialBlockedUsers', 'partialBlockedUsersTimestamp', 'partialBlockedUsersTemporary'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting partial blocked users: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          const users = result.partialBlockedUsers;
          if (Array.isArray(users)) {
            log.info('storage', `Retrieved ${users.length} partial blocked users from storage.`);
            resolve({
              usernames: users,
              timestamp: result.partialBlockedUsersTimestamp,
              isTemporary: result.partialBlockedUsersTemporary
            });
          } else {
            log.info('storage', 'No partial blocked users found in storage.');
            resolve(null);
          }
        }
      });
    });
  }

  async clearPartialBlockedUsers() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['partialBlockedUsers', 'partialBlockedUsersTimestamp', 'partialBlockedUsersTemporary'], () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error clearing partial blocked users: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', 'Cleared partial blocked users from storage.');
          resolve();
        }
      });
    });
  }

  // Registration date cache methods
  // Cache TTL: 30 days (in milliseconds)
  static REGISTRATION_DATE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  static REGISTRATION_DATE_CACHE_KEY = 'registrationDateCache';

  /**
   * Saves a registration date to the cache
   * @param {string} username - The username
   * @param {string} registrationDate - ISO date string
   * @returns {Promise<void>}
   */
  async saveRegistrationDate(username, registrationDate) {
    return new Promise((resolve, reject) => {
      // First get existing cache
      chrome.storage.local.get([StorageHandler.REGISTRATION_DATE_CACHE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting registration date cache: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
          return;
        }

        const cache = result[StorageHandler.REGISTRATION_DATE_CACHE_KEY] || {};
        
        // Add/update the entry
        cache[username] = {
          date: registrationDate,
          cachedAt: Date.now()
        };

        // Save back to storage
        chrome.storage.local.set({ 
          [StorageHandler.REGISTRATION_DATE_CACHE_KEY]: cache 
        }, () => {
          if (chrome.runtime.lastError) {
            log.err('storage', `Error saving registration date cache: ${chrome.runtime.lastError.message}`);
            reject(this._handleStorageError(chrome.runtime.lastError));
          } else {
            log.info('storage', `Cached registration date for ${username}`);
            resolve();
          }
        });
      });
    });
  }

  /**
   * Saves multiple registration dates to the cache in one operation
   * @param {Map<string, string>} usernameDateMap - Map of username to registration date
   * @returns {Promise<void>}
   */
  async saveRegistrationDatesBatch(usernameDateMap) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([StorageHandler.REGISTRATION_DATE_CACHE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting registration date cache for batch: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
          return;
        }

        const cache = result[StorageHandler.REGISTRATION_DATE_CACHE_KEY] || {};
        const now = Date.now();

        // Add all entries
        for (const [username, registrationDate] of usernameDateMap) {
          if (registrationDate) { // Only cache valid dates
            cache[username] = {
              date: registrationDate,
              cachedAt: now
            };
          }
        }

        chrome.storage.local.set({ 
          [StorageHandler.REGISTRATION_DATE_CACHE_KEY]: cache 
        }, () => {
          if (chrome.runtime.lastError) {
            log.err('storage', `Error saving registration date cache batch: ${chrome.runtime.lastError.message}`);
            reject(this._handleStorageError(chrome.runtime.lastError));
          } else {
            log.info('storage', `Cached registration dates for ${usernameDateMap.size} users`);
            resolve();
          }
        });
      });
    });
  }

  /**
   * Retrieves a cached registration date if it exists and is not expired
   * @param {string} username - The username to look up
   * @returns {Promise<string|null>} - Registration date or null if not found/expired
   */
  async getRegistrationDate(username) {
    return new Promise((resolve) => {
      chrome.storage.local.get([StorageHandler.REGISTRATION_DATE_CACHE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting registration date: ${chrome.runtime.lastError.message}`);
          resolve(null);
          return;
        }

        const cache = result[StorageHandler.REGISTRATION_DATE_CACHE_KEY];
        if (!cache || !cache[username]) {
          resolve(null);
          return;
        }

        const entry = cache[username];
        const now = Date.now();

        // Check if cache entry is expired
        if (now - entry.cachedAt > StorageHandler.REGISTRATION_DATE_CACHE_TTL) {
          log.info('storage', `Registration date cache expired for ${username}`);
          resolve(null);
          return;
        }

        log.info('storage', `Retrieved cached registration date for ${username}`);
        resolve(entry.date);
      });
    });
  }

  /**
   * Retrieves multiple cached registration dates, filtering out expired entries
   * @param {string[]} usernames - Array of usernames to look up
   * @returns {Promise<Map<string, string>>} - Map of username to registration date (only valid, non-expired entries)
   */
  async getRegistrationDatesBatch(usernames) {
    return new Promise((resolve) => {
      chrome.storage.local.get([StorageHandler.REGISTRATION_DATE_CACHE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting registration dates batch: ${chrome.runtime.lastError.message}`);
          resolve(new Map());
          return;
        }

        const cache = result[StorageHandler.REGISTRATION_DATE_CACHE_KEY] || {};
        const now = Date.now();
        const results = new Map();
        let expiredCount = 0;

        for (const username of usernames) {
          const entry = cache[username];
          if (entry) {
            // Check if expired
            if (now - entry.cachedAt <= StorageHandler.REGISTRATION_DATE_CACHE_TTL) {
              results.set(username, entry.date);
            } else {
              expiredCount++;
            }
          }
        }

        log.info('storage', `Retrieved ${results.size} cached registration dates (${expiredCount} expired)`);
        resolve(results);
      });
    });
  }

  /**
   * Clears expired entries from the registration date cache
   * @returns {Promise<number>} - Number of entries removed
   */
  async cleanupRegistrationDateCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get([StorageHandler.REGISTRATION_DATE_CACHE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error cleaning up registration date cache: ${chrome.runtime.lastError.message}`);
          resolve(0);
          return;
        }

        const cache = result[StorageHandler.REGISTRATION_DATE_CACHE_KEY];
        if (!cache) {
          resolve(0);
          return;
        }

        const now = Date.now();
        let removedCount = 0;

        // Remove expired entries
        for (const [username, entry] of Object.entries(cache)) {
          if (now - entry.cachedAt > StorageHandler.REGISTRATION_DATE_CACHE_TTL) {
            delete cache[username];
            removedCount++;
          }
        }

        // Save cleaned cache back
        chrome.storage.local.set({ 
          [StorageHandler.REGISTRATION_DATE_CACHE_KEY]: cache 
        }, () => {
          if (chrome.runtime.lastError) {
            log.err('storage', `Error saving cleaned registration date cache: ${chrome.runtime.lastError.message}`);
          } else {
            log.info('storage', `Cleaned up ${removedCount} expired registration date cache entries`);
          }
          resolve(removedCount);
        });
      });
    });
  }

  /**
   * Clears all registration date cache
   * @returns {Promise<void>}
   */
  async clearRegistrationDateCache() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([StorageHandler.REGISTRATION_DATE_CACHE_KEY], () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error clearing registration date cache: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', 'Cleared all registration date cache');
          resolve();
        }
      });
    });
  }

  /**
   * Gets cache statistics for registration dates
   * @returns {Promise<Object>} - Stats object with total, valid, and expired counts
   */
  async getRegistrationDateCacheStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get([StorageHandler.REGISTRATION_DATE_CACHE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting registration date cache stats: ${chrome.runtime.lastError.message}`);
          resolve({ total: 0, valid: 0, expired: 0 });
          return;
        }

        const cache = result[StorageHandler.REGISTRATION_DATE_CACHE_KEY];
        if (!cache) {
          resolve({ total: 0, valid: 0, expired: 0 });
          return;
        }

        const now = Date.now();
        let valid = 0;
        let expired = 0;

        for (const entry of Object.values(cache)) {
          if (now - entry.cachedAt <= StorageHandler.REGISTRATION_DATE_CACHE_TTL) {
            valid++;
          } else {
            expired++;
          }
        }

        resolve({ 
          total: valid + expired, 
          valid, 
          expired,
          ttlDays: 30
        });
      });
    });
  }

  // ============================
  // RESUMABLE OPERATION STATE
  // ============================

  static RESUMABLE_OPERATION_KEY_PREFIX = 'resumableOp_';
  static LAST_OPERATION_RESULT_KEY = 'lastOperationResult';

  /**
   * Saves operation state for resumable operations
   * @param {string} operationId - Unique operation identifier
   * @param {Object} stateData - Operation state data
   * @returns {Promise<void>}
   */
  async saveOperationState(operationId, stateData) {
    return new Promise((resolve, reject) => {
      const key = StorageHandler.RESUMABLE_OPERATION_KEY_PREFIX + operationId;
      chrome.storage.local.set({
        [key]: {
          ...stateData,
          savedAt: Date.now()
        }
      }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving operation state: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved operation state for ${operationId}`);
          resolve();
        }
      });
    });
  }

  /**
   * Retrieves saved operation state
   * @param {string} operationId - Operation identifier
   * @returns {Promise<Object|null>} - Operation state or null if not found
   */
  async getOperationState(operationId) {
    return new Promise((resolve) => {
      const key = StorageHandler.RESUMABLE_OPERATION_KEY_PREFIX + operationId;
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting operation state: ${chrome.runtime.lastError.message}`);
          resolve(null);
          return;
        }

        const state = result[key];
        if (state) {
          log.info('storage', `Retrieved operation state for ${operationId}`);
          resolve(state);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Clears saved operation state
   * @param {string} operationId - Operation identifier
   * @returns {Promise<void>}
   */
  async clearOperationState(operationId) {
    return new Promise((resolve, reject) => {
      const key = StorageHandler.RESUMABLE_OPERATION_KEY_PREFIX + operationId;
      chrome.storage.local.remove([key], () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error clearing operation state: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Cleared operation state for ${operationId}`);
          resolve();
        }
      });
    });
  }

  /**
   * Lists all resumable operations
   * @returns {Promise<Array>} - Array of operation states
   */
  async listResumableOperations() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error listing resumable operations: ${chrome.runtime.lastError.message}`);
          resolve([]);
          return;
        }

        const operations = [];
        for (const [key, value] of Object.entries(result)) {
          if (key.startsWith(StorageHandler.RESUMABLE_OPERATION_KEY_PREFIX)) {
            operations.push({
              operationId: key.replace(StorageHandler.RESUMABLE_OPERATION_KEY_PREFIX, ''),
              ...value
            });
          }
        }

        // Sort by timestamp (newest first)
        operations.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        log.info('storage', `Listed ${operations.length} resumable operations`);
        resolve(operations);
      });
    });
  }

  /**
   * Clears all resumable operation states
   * @returns {Promise<number>} - Number of states cleared
   */
  async clearAllOperationStates() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error clearing operation states: ${chrome.runtime.lastError.message}`);
          resolve(0);
          return;
        }

        const keysToRemove = Object.keys(result).filter(key =>
          key.startsWith(StorageHandler.RESUMABLE_OPERATION_KEY_PREFIX)
        );

        if (keysToRemove.length === 0) {
          resolve(0);
          return;
        }

        chrome.storage.local.remove(keysToRemove, () => {
          if (chrome.runtime.lastError) {
            log.err('storage', `Error clearing operation states: ${chrome.runtime.lastError.message}`);
          } else {
            log.info('storage', `Cleared ${keysToRemove.length} operation states`);
          }
          resolve(keysToRemove.length);
        });
      });
    });
  }


  // ============================
  // LAST OPERATION RESULT TRACKING
  // ============================

  /**
   * Saves the last operation result
   * @param {string} result - 'COMPLETED' | 'STOPPED' | 'INTERRUPTED' | 'PAUSED' | 'RUNNING'
   * @returns {Promise<void>}
   */
  async saveLastOperationResult(result) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({
        [StorageHandler.LAST_OPERATION_RESULT_KEY]: {
          result: result,
          timestamp: Date.now()
        }
      }, () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error saving last operation result: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', `Saved last operation result: ${result}`);
          resolve();
        }
      });
    });
  }

  /**
   * Gets the last operation result
   * @returns {Promise<Object|null>} - { result: string, timestamp: number } or null
   */
  async getLastOperationResult() {
    return new Promise((resolve) => {
      chrome.storage.local.get([StorageHandler.LAST_OPERATION_RESULT_KEY], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting last operation result: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          const data = result[StorageHandler.LAST_OPERATION_RESULT_KEY];
          if (data && data.result) {
            log.info('storage', `Retrieved last operation result: ${data.result}`);
            resolve(data);
          } else {
            resolve(null);
          }
        }
      });
    });
  }

  /**
   * Clears the last operation result
   * @returns {Promise<void>}
   */
  async clearLastOperationResult() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([StorageHandler.LAST_OPERATION_RESULT_KEY], () => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error clearing last operation result: ${chrome.runtime.lastError.message}`);
          reject(this._handleStorageError(chrome.runtime.lastError));
        } else {
          log.info('storage', 'Cleared last operation result');
          resolve();
        }
      });
    });
  }

  async getActiveOperation() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['activeOperation'], (result) => {
        if (chrome.runtime.lastError) {
          log.err('storage', `Error getting active operation: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          resolve(result.activeOperation || null);
        }
      });
    });
  }
}

export let storageHandler = new StorageHandler();

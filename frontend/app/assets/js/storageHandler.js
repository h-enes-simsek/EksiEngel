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
}

export let storageHandler = new StorageHandler();
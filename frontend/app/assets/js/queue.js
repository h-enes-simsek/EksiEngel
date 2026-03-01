import { programController } from './programController.js';
import * as enums from './enums.js';
import { storageHandler } from './storageHandler.js';
import { resumableOperationRegistry, OperationState } from './resumableOperation.js';

class Queue {
  constructor() { this._items = []; }
  enqueue(item) { this._items.push(item); }
  dequeue() { return this._items.shift(); }
  get size() { return this._items.length; }
}

export function getTaskCategory(banSource) {
  switch (banSource) {
    case enums.BanSource.SINGLE:
    case enums.BanSource.FAV:
    case enums.BanSource.FOLLOW:
    case enums.BanSource.LIST:
    case enums.BanSource.TITLE:
      return enums.TaskCategory.BLOCKING;
    case enums.BanSource.MIGRATE_BLOCKED_TO_MUTED:
    case enums.BanSource.BLOCK_MUTED_USERS:
    case enums.BanSource.BLOCKED_MUTED_TITLES:
      return enums.TaskCategory.MIGRATION;
    case enums.BanSource.REFRESH_MUTED_LIST:
    case enums.BanSource.REFRESH_BLOCKED_LIST:
    case enums.BanSource.REFRESH_FOLLOWED_LIST:
      return enums.TaskCategory.REFRESH;
    case enums.BanSource.UNDOBANALL:
    case enums.BanSource.UNMUTEALL:
      return enums.TaskCategory.UNBLOCKING;
    case enums.BanSource.DATE_BASED_BULK:
      return enums.TaskCategory.BLOCKING;
    default:
      return enums.TaskCategory.BLOCKING;
  }
}

function getTaskComplexity(banSource) {
  switch (banSource) {
    case enums.BanSource.SINGLE:
      return enums.TaskComplexity.SIMPLE;
    case enums.BanSource.FAV:
    case enums.BanSource.FOLLOW:
    case enums.BanSource.LIST:
      return enums.TaskComplexity.MODERATE;
    case enums.BanSource.TITLE:
    case enums.BanSource.MIGRATE_BLOCKED_TO_MUTED:
    case enums.BanSource.BLOCK_MUTED_USERS:
    case enums.BanSource.BLOCKED_MUTED_TITLES:
      return enums.TaskComplexity.COMPLEX;
    case enums.BanSource.UNDOBANALL:
    case enums.BanSource.REFRESH_MUTED_LIST:
    case enums.BanSource.REFRESH_BLOCKED_LIST:
    case enums.BanSource.REFRESH_FOLLOWED_LIST:
      return enums.TaskComplexity.HEAVY;
    default:
      return enums.TaskComplexity.MODERATE;
  }
}

function getTaskPriority(banSource) {
  switch (banSource) {
    case enums.BanSource.REFRESH_MUTED_LIST:
    case enums.BanSource.REFRESH_BLOCKED_LIST:
    case enums.BanSource.REFRESH_FOLLOWED_LIST:
      return enums.TaskPriority.LOW;
    case enums.BanSource.SINGLE:
      return enums.TaskPriority.HIGH;
    default:
      return enums.TaskPriority.NORMAL;
  }
}

export function generateUnifiedDescription(banSource, metadata = {}) {
  const { targetTypes = [], sourceEntry, sourceAuthor, sourceTitle, sourceList, timeFilter, banMode } = metadata;
  let baseDescription = "";
  const operationType = banMode === enums.BanMode.UNDOBAN ? "Engel Kaldır" : "Engelle";
  
  switch (banSource) {
    case enums.BanSource.SINGLE:
      baseDescription = `Tek Kullanıcı ${operationType}`;
      if (targetTypes && targetTypes.length > 0) {
        const targets = targetTypes.map(t => t === enums.TargetType.USER ? "Kullanıcı" : t === enums.TargetType.TITLE ? "Başlık" : "Sessiz").join(", ");
        baseDescription += ` (${targets})`;
      }
      break;
    case enums.BanSource.FAV:
      baseDescription = `Favori Edenleri ${operationType}`;
      if (sourceEntry) baseDescription += " (Entry)";
      break;
    case enums.BanSource.FOLLOW:
      baseDescription = `Takipçileri ${operationType}`;
      if (sourceAuthor) baseDescription += ` (${sourceAuthor})`;
      break;
    case enums.BanSource.LIST:
      baseDescription = `Listeden ${operationType}`;
      if (sourceList && sourceList.length > 0) baseDescription += ` (${sourceList.length} kullanıcı)`;
      break;
    case enums.BanSource.TITLE:
      baseDescription = `Başlıktaki Yazarları ${operationType}`;
      if (sourceTitle) baseDescription += ` (${sourceTitle})`;
      if (timeFilter) {
        const timeDesc = timeFilter === enums.TimeSpecifier.LAST_24_H ? "Son 24 saat" : "Tümü";
        baseDescription += ` - ${timeDesc}`;
      }
      break;
    case enums.BanSource.UNDOBANALL:
      baseDescription = "Tüm Engelleri Kaldır";
      break;
    case enums.BanSource.MIGRATE_BLOCKED_TO_MUTED:
      baseDescription = "Engelli Kullanıcıları Sessize al";
      break;
    case enums.BanSource.BLOCK_MUTED_USERS:
      baseDescription = "Sessiz Kullanıcıları Engelle";
      break;
    case enums.BanSource.BLOCKED_MUTED_TITLES:
      baseDescription = "Engelli/Sessiz Başlıkları Engelle";
      break;
    case enums.BanSource.REFRESH_MUTED_LIST:
      baseDescription = "Sessiz Listesi Yenile";
      break;
    case enums.BanSource.REFRESH_BLOCKED_LIST:
      baseDescription = "Engelli Listesi Yenile";
      break;
    case enums.BanSource.REFRESH_FOLLOWED_LIST:
      baseDescription = "Takip Edilenler Listesi Yenile";
      break;
    case enums.BanSource.UNMUTEALL:
      baseDescription = "Tüm Sessizleri Kaldır";
      break;
    case enums.BanSource.DATE_BASED_BULK:
      baseDescription = "Tarih Bazlı Toplu İşlem";
      break;
    default:
      baseDescription = `${operationType} İşlemi`;
  }
  return baseDescription;
}

class AutoQueue extends Queue {
  constructor() {
    super();
    this._pendingPromise = false;
    this._currentItem = null;
    this._isInitialized = false;
    this._initializePersistedQueue();
  }

  async _initializePersistedQueue() {
    try {
      const lastResult = await storageHandler.getLastOperationResult();
      
      // If previous operation was STOPPED, clear any stale queue data
      // This prevents stale/invalid items from being restored after user cancels
      if (lastResult && lastResult.result === 'STOPPED') {
        console.log("Queue: Previous operation was STOPPED, clearing stale queue data");
        await storageHandler.saveQueueData([]);
        this._items = [];
        this._isInitialized = true;
        return;
      }
      
      const persistedItems = await storageHandler.getQueueData();
      
      // Handle edge cases: no items, not an array, or empty
      if (!persistedItems || !Array.isArray(persistedItems) || persistedItems.length === 0) {
        console.log("Queue: No persisted queue items found");
        this._items = [];
        this._isInitialized = true;
        return;
      }
      
      // Validate items - remove non-executable ones
      const validItems = [];
      for (const item of persistedItems) {
        // Check if item has required properties for reconstruction
        // Also verify banSource is not null/undefined
        const hasValidAction = item && item.action && 
          typeof item.action.banSource !== 'undefined' && 
          item.action.banSource !== null;
        
        if (hasValidAction) {
          validItems.push(item);
        } else {
          // Log detailed info about what's missing for debugging
          const missingProps = [];
          if (!item) missingProps.push('item is null/undefined');
          if (!item?.action) missingProps.push('item.action is missing');
          if (item?.action && typeof item.action.banSource === 'undefined') missingProps.push('item.action.banSource is undefined');
          if (item?.action && item.action.banSource === null) missingProps.push('item.action.banSource is null');
          
          console.debug(`Queue: Removing invalid item - missing: ${missingProps.join(', ')}`, item);
        }
      }
      
      // If ALL items were invalid, clear the queue to prevent repeated warnings
      if (validItems.length === 0 && persistedItems.length > 0) {
        console.log("Queue: All items were invalid, clearing queue storage");
        await storageHandler.saveQueueData([]);
        this._items = [];
        this._isInitialized = true;
        return;
      }
      
      this._items = validItems;
      const invalidCount = persistedItems.length - validItems.length;
      if (invalidCount > 0) {
        console.log(`Queue: Restored ${this._items.length} valid items from storage (${invalidCount} invalid items removed)`);
      }
      
      // Only auto-start if previous operation completed successfully
      if (this._items.length > 0) {
        const shouldAutoStart = !lastResult || lastResult.result === 'COMPLETED';
        
        if (shouldAutoStart) {
          // Delay to allow other components to initialize
          setTimeout(() => {
            console.log("Queue: Auto-starting queue processing after restoration (previous: COMPLETED or none)");
            this.dequeue();
          }, 1000);
        } else {
          console.log(`Queue: Not auto-starting - previous operation result was: ${lastResult?.result}`);
        }
      }
    } catch (error) {
      console.warn('Queue: Failed to restore queue from storage:', error);
    } finally {
      this._isInitialized = true;
    }
  }

  async _saveQueueState() {
    if (!this._isInitialized) return;
    try {
      // Filter out invalid items before saving (defensive check)
      const validItems = this._items.filter(item => {
        const isValid = item && item.action && 
          typeof item.action.banSource !== 'undefined' && 
          item.action.banSource !== null;
        
        if (!isValid) {
          // Log what's invalid for debugging
          const issue = !item ? 'item is falsy' : 
            !item.action ? 'item.action is falsy' : 
            typeof item.action.banSource === 'undefined' ? 'banSource is undefined' : 
            item.action.banSource === null ? 'banSource is null' : 'unknown';
          console.debug(`Queue: Filtering out invalid item before save: ${issue}`, item);
        }
        
        return isValid;
      });
      
      if (validItems.length !== this._items.length) {
        console.warn(`Queue: Filtering out ${this._items.length - validItems.length} invalid items before saving`);
        this._items = validItems;
      }
      
      // Log what we're about to save (limited info for privacy)
      const saveInfo = validItems.map(item => ({
        hasAction: !!item?.action,
        banSource: item?.action?.banSource,
        hasResolve: !!item?.resolve,
        hasReject: !!item?.reject
      }));
      console.log(`Queue: Saving ${validItems.length} items to storage:`, saveInfo);
      
      const itemsData = validItems.map(item => ({ action: item.action, resolve: undefined, reject: undefined }));
      await storageHandler.saveQueueData(itemsData);
    } catch (error) {
      console.warn('Queue: Failed to save queue state:', error);
    }
  }

  get item() { return this._items; }


  get itemAttributes() {
    const attrs = [];
    
    // First, add the currently running task if there is one
    if (this._pendingPromise && this._currentItem) {
      const item = this._currentItem;
      const action = item.action || {};
      const metadata = action.metadata || {};
      attrs.push({
        banSource: action.banSource,
        banMode: action.banMode,
        creationDateInStr: action.creationDateInStr,
        actionDescription: action.actionDescription || generateUnifiedDescription(action.banSource, { ...metadata, banMode: action.banMode }),
        taskCategory: getTaskCategory(action.banSource),
        taskComplexity: getTaskComplexity(action.banSource),
        taskPriority: getTaskPriority(action.banSource),
        sourceEntry: metadata.sourceEntry || null,
        sourceAuthor: metadata.sourceAuthor || null,
        sourceTitle: metadata.sourceTitle || null,
        sourceList: metadata.sourceList || null,
        targetTypes: metadata.targetTypes || [],
        timeFilter: metadata.timeFilter || null,
        taskStatus: enums.TaskStatus.PROCESSING,
        operationNotes: metadata.operationNotes || "",
        requiresUserInteraction: metadata.requiresUserInteraction || false,
        queuePosition: 0,
        totalQueueSize: this._items.length + 1
      });
    }
    
    // Then add all queued items
    for(let i = 0; i < this._items.length; i++) {
      const action = this._items[i].action;
      const metadata = action.metadata || {};
      attrs.push({
        banSource: action.banSource,
        banMode: action.banMode,
        creationDateInStr: action.creationDateInStr,
        actionDescription: action.actionDescription || generateUnifiedDescription(action.banSource, { ...action.metadata, banMode: action.banMode }),
        taskCategory: getTaskCategory(action.banSource),
        taskComplexity: getTaskComplexity(action.banSource),
        taskPriority: getTaskPriority(action.banSource),
        sourceEntry: metadata.sourceEntry || null,
        sourceAuthor: metadata.sourceAuthor || null,
        sourceTitle: metadata.sourceTitle || null,
        sourceList: metadata.sourceList || null,
        targetTypes: metadata.targetTypes || [],
        timeFilter: metadata.timeFilter || null,
        taskStatus: enums.TaskStatus.QUEUED,
        operationNotes: metadata.operationNotes || "",
        requiresUserInteraction: metadata.requiresUserInteraction || false,
        queuePosition: i + 1,
        totalQueueSize: this._items.length + (this._pendingPromise ? 1 : 0)
      });
    }
    return attrs;
  }


  get isRunning() { return this._pendingPromise; }

  async clear() {
    this._items = [];
    await this._saveQueueState();
  }

  async enqueue(action) {
    return new Promise(async (resolve, reject) => {
      super.enqueue({ action, resolve, reject });
      await this._saveQueueState();
      this.dequeue();
    });
  }


  async dequeue() {
    if (this._pendingPromise) {
      console.log("Queue: Skipping dequeue - promise already pending");
      return false;
    }
    
    // Check if programController is truly active (not just has a paused operation)
    // We need to allow dequeue if there's only a paused operation that's about to be cleared
    if (programController && programController.isActive) {
      // Check if the only thing blocking is a paused operation that's about to be cleared
      const hasPausedOp = resumableOperationRegistry.hasPausedOperation();
      if (hasPausedOp) {
        console.log("Queue: Skipping dequeue - paused operation exists (resume or stop it first)");
        return false;
      }
      console.log("Queue: Skipping dequeue - programController is active");
      return false;
    }

    const item = super.dequeue();
    if (!item) {
      console.log("Queue: No item to dequeue");
      return false;
    }

    // Check if the action is actually executable (a function)
    // Items restored from storage will have a plain object as action, not a function
    if (typeof item.action !== 'function') {
      console.warn("Queue: Item action is not executable (likely restored from storage). Skipping item.");
      await this._saveQueueState();
      // Try to process next item
      setTimeout(() => this.dequeue(), 0);
      return false;
    }

    console.log(`Queue: Processing item, queue size before: ${this._items.length + 1}`);
    
    try {
      this._pendingPromise = true;
      // Store the full item for itemAttributes to include currently running task
      this._currentItem = item;
      this._currentItemMetadata = (item.action && item.action.metadata) ? item.action.metadata : null;
      const payload = await item.action(this);
      this._pendingPromise = false;
      if (item.resolve) item.resolve(payload);
    } catch (e) {
      this._pendingPromise = false;
      if (item.reject) item.reject(e);
    } finally {
      this._currentItem = null;
      this._currentItemMetadata = null;
      console.log(`Queue: Finished processing item, queue size after: ${this._items.length}, continuing to next item...`);
      await this._saveQueueState();
      setTimeout(() => this.dequeue(), 0);
    }
    return true;
  }


  /**
   * Trigger queue processing - called after an operation stops
   * This allows the next queued item to start
   */
  triggerProcessing() {
    console.log("Queue: Trigger processing called - checking for next item");
    // Small delay to ensure flags are cleared
    setTimeout(() => this.dequeue(), 100);
  }

  get currentItemMetadata() { return this._currentItemMetadata || null; }
  async restoreFromStorage() { await this._initializePersistedQueue(); }
  async forceSave() { await this._saveQueueState(); }
}

export let processQueue = new AutoQueue();

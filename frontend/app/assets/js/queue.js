import { programController } from './programController.js';
import * as enums from './enums.js';

class Queue {
  constructor() { this._items = []; }
  enqueue(item) { this._items.push(item); }
  dequeue()     { return this._items.shift(); }
  get size()    { return this._items.length; }
}

function getTaskCategory(banSource) {
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
      return enums.TaskCategory.REFRESH;
    case enums.BanSource.UNDOBANALL:
      return enums.TaskCategory.UNBLOCKING;
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
      return enums.TaskComplexity.HEAVY;
    default:
      return enums.TaskComplexity.MODERATE;
  }
}

function getTaskPriority(banSource) {
  switch (banSource) {
    case enums.BanSource.REFRESH_MUTED_LIST:
    case enums.BanSource.REFRESH_BLOCKED_LIST:
      return enums.TaskPriority.LOW;
    case enums.BanSource.SINGLE:
      return enums.TaskPriority.HIGH;
    default:
      return enums.TaskPriority.NORMAL;
  }
}

function estimateDuration(banSource, complexity) {
  return 0;
}

// Unified description generator - used by all sections to ensure consistency
export function generateUnifiedDescription(banSource, metadata = {}) {
  const { targetTypes = [], sourceEntry, sourceAuthor, sourceTitle, sourceList, timeFilter, banMode } = metadata;
  
  let baseDescription = "";
  let operationType = banMode === enums.BanMode.UNDOBAN ? "Engel Kaldır" : "Engelle";
  
  switch (banSource) {
    case enums.BanSource.SINGLE:
      baseDescription = `Tek Kullanıcı ${operationType}`;
      if (targetTypes && targetTypes.length > 0) {
        const targets = targetTypes.map(t =>
          t === enums.TargetType.USER ? "Kullanıcı" :
          t === enums.TargetType.TITLE ? "Başlık" : "Sessiz"
        ).join(", ");
        baseDescription += ` (${targets})`;
      }
      break;
    case enums.BanSource.FAV:
      baseDescription = `Favori Edenleri ${operationType}`;
      if (sourceEntry) {
        baseDescription += " (Entry)";
      }
      break;
    case enums.BanSource.FOLLOW:
      baseDescription = `Takipçileri ${operationType}`;
      if (sourceAuthor) {
        baseDescription += ` (${sourceAuthor})`;
      }
      break;
    case enums.BanSource.LIST:
      baseDescription = `Listeden ${operationType}`;
      if (sourceList && sourceList.length > 0) {
        baseDescription += ` (${sourceList.length} kullanıcı)`;
      }
      break;
    case enums.BanSource.TITLE:
      baseDescription = `Başlıktaki Yazarları ${operationType}`;
      if (sourceTitle) {
        baseDescription += ` (${sourceTitle})`;
      }
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
    default:
      baseDescription = `${operationType} İşlemi`;
  }
  
  return baseDescription;
}

class AutoQueue extends Queue {
  constructor() {
    super();
    this._pendingPromise = false;
  }
  
  get item() { return this._items; }
  
  get itemAttributes() {
    let attrs = [];
    for(let i = 0; i < this._items.length; i++) {
      const action = this._items[i].action;
      const metadata = action.metadata || {};
      
      const complexity = getTaskComplexity(action.banSource);
      
      let obj = {
        banSource: action.banSource,
        banMode: action.banMode,
        creationDateInStr: action.creationDateInStr,
        actionDescription: action.actionDescription || generateUnifiedDescription(action.banSource, { ...action.metadata, banMode: action.banMode }),
        
        taskCategory: getTaskCategory(action.banSource),
        taskComplexity: complexity,
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
        totalQueueSize: this._items.length
      };
      
      attrs.push(obj);
    }
    return attrs;
  }
  
  get isRunning() { return this._pendingPromise; }
  
  clear() {
    this._items = [];
  }

  enqueue(action) {
    return new Promise((resolve, reject) => {
      super.enqueue({ action, resolve, reject });
      this.dequeue();
    });
  }

  async dequeue() {
    if (this._pendingPromise) {
      console.log("Queue: Skipping dequeue - promise already pending");
      return false;
    }
    if (programController && programController.isActive) {
      console.log("Queue: Skipping dequeue - programController is active");
      return false;
    }

    let item = super.dequeue();

    if (!item) {
      console.log("Queue: No item to dequeue");
      return false;
    }

    console.log(`Queue: Processing item, queue size before: ${this._items.length + 1}`);
    
    try {
      this._pendingPromise = true;

      if (item.action && item.action.metadata) {
        this._currentItemMetadata = item.action.metadata;
      } else {
        this._currentItemMetadata = null;
      }

      let payload = await item.action(this);

      this._pendingPromise = false;
      item.resolve(payload);
    } catch (e) {
      this._pendingPromise = false;
      item.reject(e);
    } finally {
      this._currentItemMetadata = null;
      console.log(`Queue: Finished processing item, queue size after: ${this._items.length}, continuing to next item...`);
      
      setTimeout(() => {
        this.dequeue();
      }, 0);
    }

    return true;
  }

  get currentItemMetadata() {
    return this._currentItemMetadata || null;
  }
}

export let processQueue = new AutoQueue();
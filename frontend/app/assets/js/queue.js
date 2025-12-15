// queue implementation
import { programController } from './programController.js';
import * as enums from './enums.js';

class Queue
{
  constructor() { this._items = []; }
  enqueue(item) { this._items.push(item); }
  dequeue()     { return this._items.shift(); }
  get size()    { return this._items.length; }
}

// Helper function to get task category based on banSource
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

// Helper function to get task complexity based on operation type (no hardcoded counts)
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

// Helper function to get task priority based on operation type
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

// Helper function to estimate duration based on task type and complexity (removed hardcoded estimates)
function estimateDuration(banSource, complexity) {
  // Duration estimation removed - no hardcoded predictions
  return 0;
}

// Helper function to get human-readable task description
function getTaskDescription(action) {
  const { banSource, banMode, metadata = {} } = action;
  
  let baseDescription = "";
  let operationType = banMode === enums.BanMode.BAN ? "Engelle" : "Engel Kaldır";
  
  switch (banSource) {
    case enums.BanSource.SINGLE:
      baseDescription = `Tek Kullanıcı ${operationType}`;
      if (metadata.targetTypes && metadata.targetTypes.length > 0) {
        const targets = metadata.targetTypes.map(t => 
          t === enums.TargetType.USER ? "Kullanıcı" : 
          t === enums.TargetType.TITLE ? "Başlık" : "Sessiz"
        ).join(", ");
        baseDescription += ` (${targets})`;
      }
      break;
    case enums.BanSource.FAV:
      baseDescription = `Favori Edenleri ${operationType}`;
      if (metadata.sourceEntry) {
        baseDescription += " (Entry)";
      }
      break;
    case enums.BanSource.FOLLOW:
      baseDescription = `Takipçileri ${operationType}`;
      if (metadata.sourceAuthor) {
        baseDescription += ` (${metadata.sourceAuthor})`;
      }
      break;
    case enums.BanSource.LIST:
      baseDescription = `Listeden ${operationType}`;
      if (metadata.sourceList && metadata.sourceList.length > 0) {
        baseDescription += ` (${metadata.sourceList.length} kullanıcı)`;
      }
      break;
    case enums.BanSource.TITLE:
      baseDescription = `Başlık ${operationType}`;
      if (metadata.sourceTitle) {
        baseDescription += ` (${metadata.sourceTitle})`;
      }
      if (metadata.timeFilter) {
        const timeDesc = metadata.timeFilter === enums.TimeSpecifier.LAST_24_H ? "24s" :
                        metadata.timeFilter === enums.TimeSpecifier.LAST_1_W ? "1h" :
                        metadata.timeFilter === enums.TimeSpecifier.LAST_1_M ? "1a" :
                        metadata.timeFilter === enums.TimeSpecifier.LAST_3_M ? "3a" : "Tümü";
        baseDescription += ` [${timeDesc}]`;
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

// queue implementation that executes promises automatically
class AutoQueue extends Queue 
{
  constructor() 
  {
    super();
    this._pendingPromise = false;
  }
  
  get item() { return this._items; }
  
  get itemAttributes() 
  { 
    let attrs = [];
    for(let i = 0; i < this._items.length; i++)
    {
      const action = this._items[i].action;
      const metadata = action.metadata || {};
      
      // Remove hardcoded user count estimation - use operation type for complexity
      const complexity = getTaskComplexity(action.banSource);
      
      let obj = {
        // Original attributes
        banSource: action.banSource,
        banMode: action.banMode,
        creationDateInStr: action.creationDateInStr,
        actionDescription: action.actionDescription || getTaskDescription(action),
        
        // Enhanced task categorization (no hardcoded estimates)
        taskCategory: getTaskCategory(action.banSource),
        taskComplexity: complexity,
        taskPriority: getTaskPriority(action.banSource),
        
        // Task metadata (no hardcoded predictions)
        sourceEntry: metadata.sourceEntry || null,
        sourceAuthor: metadata.sourceAuthor || null,
        sourceTitle: metadata.sourceTitle || null,
        sourceList: metadata.sourceList || null,
        targetTypes: metadata.targetTypes || [],
        timeFilter: metadata.timeFilter || null,
        
        // Task status (always QUEUED for items in queue)
        taskStatus: enums.TaskStatus.QUEUED,
        
        // Additional context
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
  
  clear()
  {
    this._items = [];
  }

  enqueue(action) 
  {
    return new Promise((resolve, reject) => {
      super.enqueue({ action, resolve, reject });
      this.dequeue();
    });
  }

  async dequeue()
  {
    // If a promise from this queue is already pending, don't start another.
    // If no promise from this queue is pending, but a major programController task is active, also wait.
    if (this._pendingPromise) return false;
    if (programController && programController.isActive) return false;

    let item = super.dequeue();

    if (!item) return false;

    try {
      this._pendingPromise = true;

      // Store metadata for completion callbacks
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
      this._currentItemMetadata = null; // Clear metadata after completion
      this.dequeue();
    }

    return true;
  }

  get currentItemMetadata() {
    return this._currentItemMetadata || null;
  }
}

export let processQueue = new AutoQueue(); 
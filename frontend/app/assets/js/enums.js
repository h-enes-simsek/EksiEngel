export const BanSource = {
  SINGLE:     "1",   /* Ban/Undoban a author */
  FAV:        "2",   /* Ban all authors that favorited a specific entry */
  FOLLOW:     "3",   /* Ban all authors that followed a specific author */
  LIST:       "4",   /* Ban/Undoban authors in the list that will be filled by user */
  UNDOBANALL: "5",   /* Undoban all banned authors */
  TITLE:      "6",   /* Ban all authors that wrote a specific title */
  BLOCKED_MUTED_TITLES: "7", /* Block titles of blocked and muted users */
  MIGRATE_BLOCKED_TO_MUTED: "8", /* Migrate blocked users to muted */
  BLOCK_MUTED_USERS: "9",        /* Block users who are currently muted */
  REFRESH_MUTED_LIST: "10",      /* Refresh the list of muted users from server */
  REFRESH_BLOCKED_LIST: "11"     /* Refresh the list of blocked users from server */
};

export const BanMode = {
  BAN:     "1",
  UNDOBAN: "2"
};

export const TargetType = {
  USER:  "1",
  TITLE: "2",
  MUTE:  "3"
};

export const ClickSource = {
  ENTRY:     "1",
  PROFILE:   "2",
  QUESTION:  "3",
  FOLLOWING: "4",    /* Obsolete due to new Eksi Sozluk design */
  FOLLOWER:  "5",    /* Obsolete due to new Eksi Sozluk design */
  TITLE:     "6"
}

export const ResultType = {
  SUCCESS:  "SUCCESS",
  FAIL:     "FAIL"
};

export const ResultTypeHttpReq = {
  SUCCESS:      "SUCCESS",
  FAIL:         "FAIL",
  TOO_MANY_REQ: "TOO_MANY_REQ",
};

export const ClickType = {
  EXTENSION_ICON:  "EXTENSION_ICON",                          /* user has pressed extension icon */
  EXTENSION_MENU_BAN_LIST: "EXTENSION_MENU_BAN_LIST",         /* user has pressed list ban button in extension menu */
  EXTENSION_MENU_UNDOBANALL: "EXTENSION_MENU_UNDOBANALL",     /* user has pressed undobanall button in extension menu */
  EXTENSION_MENU_FAQ: "EXTENSION_MENU_FAQ",                   /* user has pressed faq button in extension menu */
  FAQ_LINK_ENTRY_LIMIT: "FAQ_LINK_ENTRY_LIMIT",               /* user has pressed the link about entry limit in faq.html */
  WELCOME_LINK_ENTRY_LIMIT: "WELCOME_LINK_ENTRY_LIMIT",       /* user has pressed the link about entry limit in welcome.html */
  INSTALL_OR_UPDATE: "INSTALL_OR_UPDATE",                     /* user has installed or updated the extension */
  WELCOME_PAGE: "WELCOME_PAGE",                               /* user has seen the welcome.html  */
  EXTENSION_MENU_MIGRATE: "EXTENSION_MENU_MIGRATE",           /* user has pressed migrate button in extension menu */
  EXTENSION_MENU_MIGRATE_TITLES: "EXTENSION_MENU_MIGRATE_TITLES", /* user has pressed migrate titles button in extension menu */
};

export const NotificationType = {
  UPDATE_PLANNED_PROCESSES: "UPDATE_PLANNED_PROCESSES",
  ONGOING:                  "ONGOING",
  COOLDOWN:                 "COOLDOWN",
  FINISH:                   "FINISH",
  NOTIFY:                   "NOTIFY",
  MIGRATION_UPDATE:         "MIGRATION_UPDATE",
  UPDATE_COUNTS:            "UPDATE_COUNTS", // New action to trigger count updates
};

export const TimeSpecifier = {
  LAST_24_H: "1",
  LAST_1_W:  "2",
  LAST_1_M:  "3",
  LAST_3_M:  "4",
  ALL:       "5",
};

// Enhanced task type categorization for queue system
export const TaskCategory = {
  BLOCKING: "BLOCKING",         // Core blocking operations
  MIGRATION: "MIGRATION",       // User list migrations
  REFRESH: "REFRESH",           // List refresh operations
  UNBLOCKING: "UNBLOCKING",     // Unblock operations
  ANALYSIS: "ANALYSIS"          // Data analysis operations
};

export const TaskComplexity = {
  SIMPLE: "SIMPLE",           // Single user operations
  MODERATE: "MODERATE",       // List operations with 10-100 users
  COMPLEX: "COMPLEX",         // Mass operations with 100+ users
  HEAVY: "HEAVY"              // Very large operations (1000+ users)
};

export const TaskPriority = {
  LOW: "LOW",                 // Background operations
  NORMAL: "NORMAL",           // Standard operations
  HIGH: "HIGH",               // User-initiated operations
  URGENT: "URGENT"            // Critical operations
};

export const TaskStatus = {
  QUEUED: "QUEUED",           // Waiting in queue
  PROCESSING: "PROCESSING",   // Currently executing
  COMPLETED: "COMPLETED",     // Successfully finished
  FAILED: "FAILED",           // Failed with error
  CANCELLED: "CANCELLED",     // Cancelled by user
  PAUSED: "PAUSED"            // Temporarily paused
};

// Task metadata structure for enhanced queue information
export const TaskMetadata = {
  // Source information
  sourceEntry: null,        // Entry URL for FAV operations
  sourceAuthor: null,       // Author name for FOLLOW operations
  sourceTitle: null,        // Title name for TITLE operations
  sourceList: null,         // User list for LIST operations
  // Operation details
  targetTypes: [],          // Array of target types (USER, TITLE, MUTE)
  timeFilter: null,         // Time specifier for TITLE operations
  // Additional context
  operationNotes: "",       // Additional notes about the operation
  requiresUserInteraction: false  // Whether operation needs user input during execution
};
export const BanSource = {
  SINGLE: "1",
  FAV: "2",
  FOLLOW: "3",
  LIST: "4",
  UNDOBANALL: "5",
  TITLE: "6",
  BLOCKED_MUTED_TITLES: "7",
  MIGRATE_BLOCKED_TO_MUTED: "8",
  BLOCK_MUTED_USERS: "9",
  REFRESH_MUTED_LIST: "10",
  REFRESH_BLOCKED_LIST: "11",
  DATE_BASED_BULK: "12",
  UNMUTEALL: "13"
};

export const BanMode = { BAN: "1", UNDOBAN: "2" };
export const TargetType = { USER: "1", TITLE: "2", MUTE: "3" };

export const ClickSource = {
  ENTRY: "1",
  PROFILE: "2",
  QUESTION: "3",
  FOLLOWING: "4",
  FOLLOWER: "5",
  TITLE: "6"
}

export const ResultType = { SUCCESS: "SUCCESS", FAIL: "FAIL" };
export const ResultTypeHttpReq = { SUCCESS: "SUCCESS", FAIL: "FAIL", TOO_MANY_REQ: "TOO_MANY_REQ" };

export const ClickType = {
  EXTENSION_ICON: "EXTENSION_ICON",
  EXTENSION_MENU_BAN_LIST: "EXTENSION_MENU_BAN_LIST",
  EXTENSION_MENU_UNDOBANALL: "EXTENSION_MENU_UNDOBANALL",
  EXTENSION_MENU_FAQ: "EXTENSION_MENU_FAQ",
  FAQ_LINK_ENTRY_LIMIT: "FAQ_LINK_ENTRY_LIMIT",
  WELCOME_LINK_ENTRY_LIMIT: "WELCOME_LINK_ENTRY_LIMIT",
  INSTALL_OR_UPDATE: "INSTALL_OR_UPDATE",
  WELCOME_PAGE: "WELCOME_PAGE",
  EXTENSION_MENU_MIGRATE: "EXTENSION_MENU_MIGRATE",
  EXTENSION_MENU_MIGRATE_TITLES: "EXTENSION_MENU_MIGRATE_TITLES",
  EXTENSION_MENU_UNMUTEALL: "EXTENSION_MENU_UNMUTEALL"
};

export const NotificationType = {
  UPDATE_PLANNED_PROCESSES: "UPDATE_PLANNED_PROCESSES",
  ONGOING: "ONGOING",
  COOLDOWN: "COOLDOWN",
  FINISH: "FINISH",
  NOTIFY: "NOTIFY",
  MIGRATION_UPDATE: "MIGRATION_UPDATE",
  UPDATE_COUNTS: "UPDATE_COUNTS"
};

export const TimeSpecifier = { LAST_24_H: "1", LAST_1_W: "2", LAST_1_M: "3", LAST_3_M: "4", ALL: "5" };

export const TaskCategory = { BLOCKING: "BLOCKING", MIGRATION: "MIGRATION", REFRESH: "REFRESH", UNBLOCKING: "UNBLOCKING", ANALYSIS: "ANALYSIS" };
export const TaskComplexity = { SIMPLE: "SIMPLE", MODERATE: "MODERATE", COMPLEX: "COMPLEX", HEAVY: "HEAVY" };
export const TaskPriority = { LOW: "LOW", NORMAL: "NORMAL", HIGH: "HIGH", URGENT: "URGENT" };
export const TaskStatus = { QUEUED: "QUEUED", PROCESSING: "PROCESSING", COMPLETED: "COMPLETED", FAILED: "FAILED", CANCELLED: "CANCELLED", PAUSED: "PAUSED" };

// Date-based user filtering enums
export const DateFilterCriteria = {
  NEWER_THAN: "NEWER_THAN",      // Account is newer than X days
  OLDER_THAN: "OLDER_THAN",      // Account is older than X days
  BEFORE_DATE: "BEFORE_DATE",    // Registered before specific date
  AFTER_DATE: "AFTER_DATE"       // Registered after specific date
};

export const DateFilterAction = {
  ENGELLE: "ENGELLE"   // Block users matching criteria
};

// Date-based bulk action enums
export const DateBulkAction = {
  ENGELLE: "ENGELLE",           // Block users
  SESSIZE_AL: "SESSIZE_AL",     // Mute users
  ENGEL_KALDIR: "ENGEL_KALDIR", // Unblock users
  SESSIZDEN_CIKAR: "SESSIZDEN_CIKAR", // Unmute users
  TAKIP_ET: "TAKIP_ET"          // Follow users
};

export const DateBulkSource = {
  BLOCKED_USERS: "BLOCKED_USERS",
  MUTED_USERS: "MUTED_USERS",
  AUTHOR_LIST: "AUTHOR_LIST"
};

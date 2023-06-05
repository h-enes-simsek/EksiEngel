export const BanSource = {
  SINGLE:     "SINGLE",       /* Ban/Undoban a author */
  FAV:  			"FAV",          /* Ban all authors that favorited a specific entry */
  FOLLOW:     "FOLLOW",       /* Ban all authors that followed a specific author */
  LIST: 			"LIST",         /* Ban/Undoban authors in the list that will be filled by user */
	UNDOBANALL: "UNDOBANALL"    /* Undoban all banned authors */
};

export const BanMode = {
  BAN:     "BAN",
  UNDOBAN: "UNDOBAN"
};

export const TargetType = {
  USER:  "USER",
  TITLE: "TITLE",
  MUTE: "MUTE"
};

export const ResultType = {
  SUCCESS:  "SUCCESS",
  FAIL: "FAIL"
};

export const ResultTypeHttpReq = {
  SUCCESS:  "SUCCESS",
  FAIL: "FAIL",
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
  WELCOME_PAGE: "WELCOME_PAGE"                                /* user has seen the welcome.html  */
};         

export const NotificationType = {
  UPDATE_PLANNED_PROCESSES: "UPDATE_PLANNED_PROCESSES",
  ONGOING:                  "ONGOING",
  COOLDOWN:                 "COOLDOWN",
  FINISH:                   "FINISH",
  NOTIFY:                   "NOTIFY",
};
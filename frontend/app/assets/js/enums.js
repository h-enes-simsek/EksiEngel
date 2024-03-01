export const BanSource = {
  SINGLE:     "1",   /* Ban/Undoban a author */
  FAV:        "2",   /* Ban all authors that favorited a specific entry */
  FOLLOW:     "3",   /* Ban all authors that followed a specific author */
  LIST:       "4",   /* Ban/Undoban authors in the list that will be filled by user */
  UNDOBANALL: "5",   /* Undoban all banned authors */
  TITLE:      "6"    /* Ban all authors that wrote a specific title */
};

export const BanMode = {
  BAN:     "1",
  UNDOBAN: "2"
};

export const TargetType = {
  USER:  "1",
  TITLE: "2",
  MUTE: "3"
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
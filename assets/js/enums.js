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
  EXTENSION_ICON:  "EXTENSION_ICON",
  EXTENSION_MENU_BAN_LIST: "EXTENSION_MENU_BAN_LIST",
  EXTENSION_MENU_UNDOBANALL: "EXTENSION_MENU_UNDOBANALL",
  EXTENSION_MENU_FAQ: "EXTENSION_MENU_FAQ",
  FAQ_LINK_ENTRY_LIMIT: "FAQ_LINK_ENTRY_LIMIT",
  WELCOME_LINK_ENTRY_LIMIT: "WELCOME_LINK_ENTRY_LIMIT",
};
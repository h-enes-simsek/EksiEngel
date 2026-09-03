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

export const RuntimeMessageType = {
  ENQUEUE_JOB:        "ENQUEUE_JOB",
  CANCEL_ALL_JOBS:    "CANCEL_ALL_JOBS",
  GET_JOB_SNAPSHOT:   "GET_JOB_SNAPSHOT",
  JOB_SNAPSHOT:       "JOB_SNAPSHOT",
  JOB_NOTIFICATION:   "JOB_NOTIFICATION"
};

export const ProcessFinishReason = {
  NOT_SET:                    "NOT_SET",
  SUCCESS:                    "SUCCESS",
  CANCELLED:                  "CANCELLED",
  UNEXPECTED_ERROR:           "UNEXPECTED_ERROR",
  NOTIFICATION_TAB_CREATION:  "NOTIFICATION_TAB_CREATION",
  CONFIGURATION_LOADING:      "CONFIGURATION_LOADING",
  EKSI_SOZLUK_UNREACHABLE:    "EKSI_SOZLUK_UNREACHABLE",
  CLIENT_NOT_LOGGED_IN:       "CLIENT_NOT_LOGGED_IN",
  USER_LIST_LOADING:          "USER_LIST_LOADING",
  USER_LIST_CLEANING:         "USER_LIST_CLEANING",
  NO_ACCOUNTS_FOUND:          "NO_ACCOUNTS_FOUND",
  NO_ACCOUNTS_AFTER_FILTERING:"NO_ACCOUNTS_AFTER_FILTERING",
};

export const JobPhase = {
  QUEUED:                       "QUEUED",
  PREPARING:                    "PREPARING",
  CHECKING_ACCESS:              "CHECKING_ACCESS",
  CHECKING_LOGIN:               "CHECKING_LOGIN",
  COLLECTING_AUTHORS:           "COLLECTING_AUTHORS",
  COLLECTING_FAVORITERS:        "COLLECTING_FAVORITERS",
  COLLECTING_FOLLOWERS:         "COLLECTING_FOLLOWERS",
  COLLECTING_EXISTING_RELATIONS:"COLLECTING_EXISTING_RELATIONS",
  COLLECTING_TITLE_AUTHORS:     "COLLECTING_TITLE_AUTHORS",
  ANALYSING_PROTECTED_USERS:    "ANALYSING_PROTECTED_USERS",
  ANALYSING_REQUIRED_ACTIONS:   "ANALYSING_REQUIRED_ACTIONS",
  EXECUTING_RELATIONS:          "EXECUTING_RELATIONS",
  COOLDOWN:                     "COOLDOWN",
  CANCELLING:                   "CANCELLING"
};

export const NotificationType = {
  UPDATE_PLANNED_PROCESSES: "UPDATE_PLANNED_PROCESSES",
  ONGOING:                  "ONGOING",
  COOLDOWN:                 "COOLDOWN",
  FINISH:                   "FINISH",
  NOTIFY:                   "NOTIFY",
};

export const TimeSpecifier = {
  LAST_24_H: "1",
  LAST_1_W:  "2",
  LAST_1_M:  "3",
  LAST_3_M:  "4",
  ALL:       "5",
};

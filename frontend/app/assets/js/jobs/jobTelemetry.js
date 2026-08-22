import {
  Action,
  ActionConfig,
  createEksiSozlukEntry,
  createEksiSozlukTitle,
  createEksiSozlukUser
} from '../commHandler.js';

function deepFreeze(value)
{
  if(!value || typeof value !== 'object' || Object.isFrozen(value))
    return value;

  for(const nestedValue of Object.values(value))
    deepFreeze(nestedValue);

  return Object.freeze(value);
}

/**
 * Capture all telemetry data before per-job state and logs are reset.
 * The returned value does not retain mutable job-owned collections.
 */
export function createJobTelemetry({
  request,
  authorList,
  entryMetaData,
  userAgent,
  clientName,
  clientId,
  successfulAction,
  performedAction,
  plannedAction,
  earlyStopped,
  version,
  logLevel,
  logData,
  settings
})
{
  const authorListSnapshot = authorList.map(author =>
    author && typeof author === 'object' ? {...author} : author
  );
  const eksiEngelUser = createEksiSozlukUser(clientName, clientId);
  const favAuthor = createEksiSozlukUser(entryMetaData.authorName, entryMetaData.authorId);
  const favTitle = createEksiSozlukTitle(entryMetaData.titleName, entryMetaData.titleId);
  const favEntry = createEksiSozlukEntry(favTitle, entryMetaData.entryId);

  const action = new Action({
    eksi_engel_user: eksiEngelUser,
    version,
    user_agent: userAgent,
    ban_source: request.banSource,
    ban_mode: request.banMode,
    author_list: authorListSnapshot,
    author_list_size: authorListSnapshot.length,
    planned_action: plannedAction,
    performed_action: performedAction,
    successful_action: successfulAction,
    is_early_stopped: earlyStopped,
    log_level: logLevel,
    log: logData,
    target_type: request.targetType,
    click_source: request.clickSource,
    fav_title: favTitle,
    fav_entry: favEntry,
    fav_author: favAuthor,
    time_specifier: request.timeSpecifier
  });

  const actionConfig = new ActionConfig({
    eksi_sozluk_url: settings.EksiSozlukURL,
    send_data: settings.sendData,
    enable_noob_ban: settings.enableNoobBan,
    enable_mute: settings.enableMute,
    enable_title_ban: settings.enableTitleBan,
    enable_anaylsis_before_operations: settings.enableAnalysisBeforeOperation,
    enable_only_required_actions: settings.enableOnlyRequiredActions,
    enable_protect_followed_users: settings.enableProtectFollowedUsers,
    ban_premium_icons: settings.banPremiumIcons
  });

  return deepFreeze({action, actionConfig});
}

// Best-effort delivery boundary. Submission never becomes part of job completion.
export class JobTelemetryReporter
{
  constructor({isEnabled, send, onError})
  {
    this._isEnabled = isEnabled;
    this._send = send;
    this._onError = onError;
  }

  submit(telemetry)
  {
    try
    {
      if(!this._isEnabled())
        return false;

      void Promise.resolve()
        .then(() => this._send(telemetry))
        .catch(error => this._onError(error));

      return true;
    }
    catch(error)
    {
      this._onError(error);
      return false;
    }
  }
}

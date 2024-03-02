import {log} from './log.js';
import {config} from './config.js';
import * as enums from './enums.js';

function EksiSozlukTitle(eksisozluk_name, eksisozluk_id)
{
  this.eksisozluk_name = eksisozluk_name;
  this.eksisozluk_id = eksisozluk_id;
}

export function createEksiSozlukTitle(eksisozluk_name, eksisozluk_id)
{
  if(!eksisozluk_name || !eksisozluk_id)
    return null;

  return new EksiSozlukTitle(eksisozluk_name, eksisozluk_id);
}

function EksiSozlukEntry(eksisozluk_title, eksisozluk_id)
{
  this.eksisozluk_title = eksisozluk_title;
  this.eksisozluk_id = eksisozluk_id;
}

export function createEksiSozlukEntry(eksisozluk_title, eksisozluk_id)
{
  if(!eksisozluk_title || !eksisozluk_id)
    return null;

  return new EksiSozlukEntry(eksisozluk_title, eksisozluk_id);
}

function EksiSozlukUser(eksisozluk_name, eksisozluk_id)
{
  this.eksisozluk_name = eksisozluk_name;
  this.eksisozluk_id = eksisozluk_id;
}

export function createEksiSozlukUser(eksisozluk_name, eksisozluk_id)
{
  if(!eksisozluk_name || !eksisozluk_id)
    return null;
  
  return new EksiSozlukUser(eksisozluk_name, eksisozluk_id);
}

export function Action({
  eksi_engel_user,
  version,
  user_agent,
  ban_source,
  ban_mode,
  author_list,
  author_list_size,
  planned_action,
  performed_action,
  successful_action,
  is_early_stopped,
  log_level,
  log,
  target_type,
  click_source,
  fav_title,
  fav_entry,
  fav_author,
  time_specifier
  })
{
  this.eksi_engel_user = eksi_engel_user; 
  this.version = version;
  this.user_agent = user_agent;
  this.ban_source = ban_source;
  this.ban_mode = ban_mode;
  this.author_list = author_list;
  this.author_list_size = author_list_size;
  this.planned_action = planned_action;
  this.performed_action = performed_action;
  this.successful_action = successful_action;
  this.is_early_stopped = is_early_stopped;
  this.log_level = log_level;
  this.log = log;
  this.target_type = target_type;
  this.click_source = click_source;
  this.fav_title = fav_title;
  this.fav_entry = fav_entry;
  this.fav_author = fav_author;
  this.time_specifier = time_specifier;
}

export function ActionConfig({
  eksi_sozluk_url,
  send_data,
  enable_noob_ban,
  enable_mute,
  enable_title_ban,
  enable_anaylsis_before_operations,
  enable_only_required_actions,
  enable_protect_followed_users,
  ban_premium_icons})
{
  this.eksi_sozluk_url = eksi_sozluk_url;
  this.send_data = send_data;
  this.enable_noob_ban = enable_noob_ban;
  this.enable_mute = enable_mute;
  this.enable_title_ban = enable_title_ban;
  this.enable_anaylsis_before_operations = enable_anaylsis_before_operations;
  this.enable_only_required_actions = enable_only_required_actions;
  this.enable_protect_followed_users = enable_protect_followed_users;
  this.ban_premium_icons = ban_premium_icons;
}

class CommHandler 
{
	sendData = async (action, action_config) =>
	{
    const actionData = {action, action_config};
    //console.log(actionData);

		try
		{
			const response = await fetch(config.serverURL, {
				method: 'POST',
				headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
				},
				body: JSON.stringify(actionData)
			});
      const responseText = await response.text();
			console.log("commHandler: response status: " + response.status); 
			console.log("commHandler: response : " + responseText); 
		}
		catch(err)
		{
			console.error("commHandler: err: " + err); 
		}
	}

  sendAnalyticsData = async (data) => {
    return;
  }
}

export let commHandler = new CommHandler();
import * as enums from './enums.js';
import * as utils from './utils.js'
import {processQueue} from './queue.js';
import {log} from './log.js';

class ProgramController
{
  constructor() 
  { 
    this._earlyStop = false;
    this._tabId = 0; 
  }
  
  get isActive()
  {
    return processQueue.isRunning;
  }

  set tabId(val)
  {
    this._tabId = val;
  }

  get tabId()
  {
    return this._tabId;
  }
  
  get earlyStop()
  {
    return this._earlyStop;
  }
    
  set earlyStop(val)
  {
    if(!processQueue.isRunning)
    {
      log.info("progctrl", "early stop received, yet program is not running, so it will be ignored.");
      return;
    }
    
    this._earlyStop = val;
    if(val)
    {
      log.info("progctrl", "early stop received, number of waiting processes in the queue: " + processQueue.size);
    }
    else
    {
      log.info("progctrl", "early stop flag cleared.");
    }
  }
}

export let programController = new ProgramController();

// listen notification to detect early stop
chrome.runtime.onMessage.addListener(async function messageListener_Notifications(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
	
	const obj = utils.filterMessage(message, "earlyStop");
	if(obj.resultType === enums.ResultType.FAIL)
    return;
  else if(!programController.isActive)
  {
    log.info("progctrl", "early stop received, yet program is not running, so it will be ignored.");
    return;
  }
		
  programController.earlyStop = true;
});

// this listener fired every time a tab is closed by the user
chrome.tabs.onRemoved.addListener(function(tabid, removed) {
  if(tabid == programController.tabId)
  {
    log.info("progctrl", "user has closed the notification tab, earlyStop will be generated automatically.");
    programController.earlyStop = true;
  }
});
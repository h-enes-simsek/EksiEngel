import {processQueue} from './queue.js';
import {log} from './log.js';

class ProgramController
{
  constructor() 
  {
    this._earlyStop = false;
    this._tabId = 0;
    this._cancelActiveJob = null;
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

  setCancelActiveJobHandler(cancelActiveJob)
  {
    if(typeof cancelActiveJob !== 'function')
      throw new TypeError('cancelActiveJob must be a function');

    this._cancelActiveJob = cancelActiveJob;
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
      this._cancelActiveJob?.();
    }
    else
    {
      log.info("progctrl", "early stop flag cleared.");
    }
  }
}

export let programController = new ProgramController();

// this listener fired every time a tab is closed by the user
chrome.tabs.onRemoved.addListener(function(tabid, removed) {
  if(tabid == programController.tabId)
  {
    log.info("progctrl", "user has closed the notification tab, earlyStop will be generated automatically.");
    programController.earlyStop = true;
  }
});

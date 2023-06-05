import * as enums from './enums.js';
import * as utils from './utils.js'
import {processQueue} from './queue.js';
import {log} from './log.js';

class ProgramController
{
  constructor() 
  { 
    this._earlyStop = false; 
  }
  
  get isActive()
  {
    return processQueue.isRunning;
  }
  
  get earlyStop()
  {
    return this._earlyStop;
  }
    
  set earlyStop(val)
  {
    if(!processQueue.isRunning)
    {
      log.info("progCtrl: early stop received, yet program is not running, so it will be ignored.");
      return;
    }
    
    this._earlyStop = val;
    if(val)
    {
      log.info("progCtrl: early stop received, number of waiting processes in the queue: " + processQueue.size);
    }
    else
    {
      log.info("progCtrl: early stop flag cleared.");
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
    log.info("progCtrl: early stop received, yet program is not running, so it will be ignored.");
    return;
  }
		
  programController.earlyStop = true;
});
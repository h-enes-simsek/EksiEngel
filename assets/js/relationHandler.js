import {log} from './log.js';
import * as enums from './enums.js';
import * as utils from './utils.js'
import {programController} from './programController.js';

// a class to manage relations (ban/undoban users/users' titles)
export class RelationHandler
{
  successfulAction;
  performedAction;
  
  performAction =  async (banMode, id) =>
  {
    // enums.TargetType.USER
    let urlUser = this.#prepareHTTPRequest(banMode, enums.TargetType.USER, id);
    let resUser = await this.#performHTTPRequest(banMode, enums.TargetType.USER, id, urlUser);
    
    // enums.TargetType.TITLE
    let urlTitle = this.#prepareHTTPRequest(banMode, enums.TargetType.TITLE, id);
    let resTitle = await this.#performHTTPRequest(banMode, enums.TargetType.TITLE, id, urlTitle);
    
    // the solution about too many requests
    // TODO: fix this temporary ugly solution
    if(resUser == enums.ResultTypeHttpReq.TOO_MANY_REQ || resTitle == enums.ResultTypeHttpReq.TOO_MANY_REQ)
    {
      // while waiting cooldown, send periodic notifications to user 
      // this also provides that chrome doesn't kill the extension for being idle
      await new Promise(async resolve => 
      {
        // wait 1 minute (+2 sec to ensure)
        for(let i = 1; i <= 62; i++)
        {
          if(programController.earlyStop)
            break;
          
          // send message to notification page
          chrome.runtime.sendMessage(null, {"notification":{status:"cooldown", remainingTimeInSec:62-i}}, function(response) {
            let lastError = chrome.runtime.lastError;
            if (lastError) 
            {
              // 'Could not establish connection. Receiving end does not exist.'
              console.info("relationHandler: (cooldown) notification page is probably closed, early stop will be generated automatically.");
              programController.earlyStop = true;
              return;
            }
          });
          
          // wait 1 sec
          await new Promise(resolve2 => { setTimeout(resolve2, 1000); }); 
        }
          
        resolve();        
      }); 
      
      if(programController.earlyStop)
        return {successfulAction: this.successfulAction, performedAction: this.performedAction};
      
      await this.performAction(banMode, id); // redo the same request
      return {successfulAction: this.successfulAction, performedAction: this.performedAction};
    }
    
    this.performedAction++;
    if(resUser && resTitle)
      this.successfulAction++;
   
    return {successfulAction: this.successfulAction, performedAction: this.performedAction};
  }
  
  // reset the internal variables to reuse
	reset = () =>
	{
		this.successfulAction = 0;
    this.performedAction = 0;
	}
  
	#prepareHTTPRequest = (banMode, targetType, id) =>
	{
		let url = "";
	
    if(targetType === enums.TargetType.USER && banMode === enums.BanMode.BAN)
    {
      url = 'https://eksisozluk.com/userrelation/addrelation/' + id + '?r=m';
    }
    else if(targetType === enums.TargetType.USER && banMode === enums.BanMode.UNDOBAN)
    {
      url = 'https://eksisozluk.com/userrelation/removerelation/' + id + '?r=m';
    }
    else if(targetType === enums.TargetType.TITLE && banMode === enums.BanMode.BAN)
    {
      url = 'https://eksisozluk.com/userrelation/addrelation/' + id + '?r=i';
    }
    else if(targetType === enums.TargetType.TITLE && banMode === enums.BanMode.UNDOBAN)
    {
      url = 'https://eksisozluk.com/userrelation/removerelation/' + id + '?r=i';
    }
    
    return url;
	}
  
  #performHTTPRequest = async (banMode, targetType, id, url) =>
	{
    if(id <= 0)
      return enums.ResultTypeHttpReq.FAIL;
		let res = enums.ResultTypeHttpReq.FAIL;
    try 
    {
      let response = await fetch(url, {
        method: 'POST',
           headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          },
        body: "id=" + id
      });
      if(!response.ok)
      {
        log.err("Relation Handler: http response: " + response.status);
        return enums.ResultTypeHttpReq.TOO_MANY_REQ;
      }
      const responseText = await response.text();
      const responseJson = JSON.parse(responseText);
      
      // for enums.BanMode.BAN result is number. Probably 0 is success, 2 is already banned
      if(banMode === enums.BanMode.BAN && typeof responseJson === "number" && (responseJson === 0 || responseJson === 2))
        res = enums.ResultTypeHttpReq.SUCCESS; 
      // for enums.BanMode.UNDOBAN result is object and it has 'result' key.
      else if(banMode === enums.BanMode.UNDOBAN && typeof responseJson === "object" && responseJson.result === true)
        res = enums.ResultTypeHttpReq.SUCCESS; 
      else
        res = enums.ResultTypeHttpReq.FAIL;
      // log.info("Relation Handler: banMode: " + banMode + ", targetType: " + targetType + ", id: " + id + ", response text: " + responseText);
    }
    catch(err)
    {
      log.err(err);
      res = enums.ResultTypeHttpReq.FAIL; 
    }
    return res;
	}
}
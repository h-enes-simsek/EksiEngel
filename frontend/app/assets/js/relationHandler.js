import {log} from './log.js';
import * as enums from './enums.js';
import * as utils from './utils.js'
import {programController} from './programController.js';
import {config} from './config.js';

// a class to manage relations (ban/undoban users/users' titles)
class RelationHandler
{
  successfulAction;
  performedAction;
  
  async performAction(banMode, id, isTargetUser, isTargetTitle, isTargetMute, isTargetFollow)
  {
    // Returns: { resultType: enums.ResultType, successfulAction: number, performedAction: number, retryAfter?: number }
    if(id == 0 || id === "0" || !id) // Added more robust check for invalid ID
    {
      log.warn("relation", `performAction called with invalid id: ${id}`);
      // action failed, but count it as performed to avoid infinite loops if an ID is consistently invalid
      this.performedAction++;
      // Return SUCCESS to prevent retry logic from triggering on invalid ID, but don't increment successfulAction
      return {resultType: enums.ResultType.SUCCESS, successfulAction: this.successfulAction, performedAction: this.performedAction};
    }

    let resUser = { status: enums.ResultTypeHttpReq.SUCCESS },
        resTitle = { status: enums.ResultTypeHttpReq.SUCCESS },
        resMute = { status: enums.ResultTypeHttpReq.SUCCESS },
        resFollow = { status: enums.ResultTypeHttpReq.SUCCESS };
    let retryAfter = 0; // Store the max retryAfter value

    if(isTargetUser)
    {
      // enums.TargetType.USER
      let urlUser = this.#prepareHTTPRequest(banMode, enums.TargetType.USER, id);
      resUser = await this.#performHTTPRequest(banMode, enums.TargetType.USER, id, urlUser);
      if (resUser.status === enums.ResultTypeHttpReq.TOO_MANY_REQ && resUser.retryAfter) {
        retryAfter = Math.max(retryAfter, resUser.retryAfter);
      }
    }
    if(isTargetTitle)
    {
      // enums.TargetType.TITLE
      let urlTitle = this.#prepareHTTPRequest(banMode, enums.TargetType.TITLE, id);
      resTitle = await this.#performHTTPRequest(banMode, enums.TargetType.TITLE, id, urlTitle);
      if (resTitle.status === enums.ResultTypeHttpReq.TOO_MANY_REQ && resTitle.retryAfter) {
        retryAfter = Math.max(retryAfter, resTitle.retryAfter);
      }
    }
    if(isTargetMute)
    {
      // enums.TargetType.MUTE
      let urlMute = this.#prepareHTTPRequest(banMode, enums.TargetType.MUTE, id);
      resMute = await this.#performHTTPRequest(banMode, enums.TargetType.MUTE, id, urlMute);
      if (resMute.status === enums.ResultTypeHttpReq.TOO_MANY_REQ && resMute.retryAfter) {
        retryAfter = Math.max(retryAfter, resMute.retryAfter);
      }
    }
    if(isTargetFollow)
    {
      // enums.TargetType.FOLLOW
      let urlFollow = this.#prepareHTTPRequest(banMode, enums.TargetType.FOLLOW, id);
      resFollow = await this.#performHTTPRequest(banMode, enums.TargetType.FOLLOW, id, urlFollow);
      if (resFollow.status === enums.ResultTypeHttpReq.TOO_MANY_REQ && resFollow.retryAfter) {
        retryAfter = Math.max(retryAfter, resFollow.retryAfter);
      }
    }

    // Check if any request hit the rate limit
    if((isTargetUser  && resUser.status == enums.ResultTypeHttpReq.TOO_MANY_REQ)  ||
       (isTargetTitle && resTitle.status == enums.ResultTypeHttpReq.TOO_MANY_REQ) ||
       (isTargetMute  && resMute.status == enums.ResultTypeHttpReq.TOO_MANY_REQ)  ||
       (isTargetFollow && resFollow.status == enums.ResultTypeHttpReq.TOO_MANY_REQ) )
    {
      // Rate limit hit, return FAIL and the calculated retryAfter duration
      log.warn("relation", `Rate limit hit for id ${id}. Suggested retryAfter: ${retryAfter} seconds.`);
      // Don't increment performedAction here, let the retry logic handle it
      return {resultType: enums.ResultType.FAIL, successfulAction: this.successfulAction, performedAction: this.performedAction, retryAfter: retryAfter};
    }
    else
    {
      // No rate limit hit, proceed as normal
      this.performedAction++;
      // Check if all *attempted* actions were successful
      let allSucceeded = true;
      if (isTargetUser && resUser.status !== enums.ResultTypeHttpReq.SUCCESS) allSucceeded = false;
      if (isTargetTitle && resTitle.status !== enums.ResultTypeHttpReq.SUCCESS) allSucceeded = false;
      if (isTargetMute && resMute.status !== enums.ResultTypeHttpReq.SUCCESS) allSucceeded = false;
      if (isTargetFollow && resFollow.status !== enums.ResultTypeHttpReq.SUCCESS) allSucceeded = false;

      if (allSucceeded) {
        this.successfulAction++;
      } else {
         log.warn("relation", `One or more actions failed for id ${id} (not rate limit). User: ${resUser.status}, Title: ${resTitle.status}, Mute: ${resMute.status}, Follow: ${resFollow.status}`);
      }

      return {resultType: enums.ResultType.SUCCESS, successfulAction: this.successfulAction, performedAction: this.performedAction};
    }
  }
  
  // reset the internal variables to reuse
	reset = () =>
	{
		this.successfulAction = 0;
    this.performedAction = 0;
	}
  
	#prepareHTTPRequest = (banMode, targetType, id) =>
	{
    let banModeText = "";
    if(banMode === enums.BanMode.BAN)
      banModeText = "addrelation";
    else if(banMode === enums.BanMode.UNDOBAN)
      banModeText = "removerelation";
    
    let targetTypeText = "";
    if(targetType === enums.TargetType.USER)
      targetTypeText = "m";
    else if(targetType === enums.TargetType.TITLE)
      targetTypeText = "i";
    else if(targetType == enums.TargetType.MUTE)
      targetTypeText = "u";
    
    let url = `${config.EksiSozlukURL}/userrelation/${banModeText}/${id}?r=${targetTypeText}`;
    return url;
	}
  
  #performHTTPRequest = async (banMode, targetType, id, url) =>
	{
    // Returns: { status: enums.ResultTypeHttpReq, retryAfter?: number }
    if(id <= 0 || id === "0" || !id) { // Added more robust check
      log.warn("relation", `#performHTTPRequest called with invalid id: ${id}`);
      return { status: enums.ResultTypeHttpReq.FAIL };
    }

    let result = { status: enums.ResultTypeHttpReq.FAIL };
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
        log.err("relation", "http response: " + response.status);
        if(response.status == 429)
        {
          const retryAfterHeader = response.headers.get('Retry-After');
          let retrySeconds = 65; // Default retry time if header is missing or invalid
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            // Check if it's a valid number (HTTP date format is not handled here, assuming seconds)
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              retrySeconds = parsedSeconds + 1; // Add a small buffer
              log.info("relation", `Received Retry-After header: ${retryAfterHeader}. Using delay: ${retrySeconds}s`);
            } else {
               log.warn("relation", `Invalid Retry-After header received: ${retryAfterHeader}. Using default delay: ${retrySeconds}s`);
            }
          } else {
             log.warn("relation", `429 response received without Retry-After header. Using default delay: ${retrySeconds}s`);
          }
          result = { status: enums.ResultTypeHttpReq.TOO_MANY_REQ, retryAfter: retrySeconds };
          return result; // Return immediately on rate limit
        }
        else
        {
          // If status is not 429, yet still erroneous, then something should have gone wrong.
          // dont re-try the operation, assume it was failed.
          const responseText = await response.text();
          log.err("relation", "url: " + url + " response: " + responseText);
          return enums.ResultTypeHttpReq.FAIL; 
        }
          
        
      }
      const responseText = await response.text();
      const responseJson = JSON.parse(responseText);
      
      // for enums.BanMode.BAN result is number. Probably 0 is success, 2 is already banned
      if(banMode === enums.BanMode.BAN && typeof responseJson === "number" && (responseJson === 0 || responseJson === 2))
        result.status = enums.ResultTypeHttpReq.SUCCESS;
      // for enums.BanMode.UNDOBAN result is object and it has 'result' key.
      else if(banMode === enums.BanMode.UNDOBAN && typeof responseJson === "object" && responseJson.result === true)
        result.status = enums.ResultTypeHttpReq.SUCCESS;
      else {
        result.status = enums.ResultTypeHttpReq.FAIL;
        log.warn("relation", `Unexpected response format for id ${id}, banMode ${banMode}. Response: ${responseText}`);
      }
      // log.info("relation", "banMode: " + banMode + ", targetType: " + targetType + ", id: " + id + ", response text: " + responseText);
    }
    catch(err)
    {
      log.err("relation", `#performHTTPRequest error for id ${id}: ${err}`);
      result.status = enums.ResultTypeHttpReq.FAIL;
    }
    return result;
	}
}

export let relationHandler = new RelationHandler();

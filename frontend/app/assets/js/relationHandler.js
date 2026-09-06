import {log} from './log.js';
import * as enums from './enums.js';

export const RelationActionStatus = {
  COMPLETED:      "COMPLETED",
  RETRY_REQUIRED: "RETRY_REQUIRED",
  ABORTED:        "ABORTED",
};

const RelationRequestOutcome = {
  SUCCEEDED:    "SUCCEEDED",
  FAILED:       "FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  ABORTED:      "ABORTED",
};

/**
 * A completed action has been evaluated conclusively and is counted as
 * performed even when it did not require a request, such as an invalid id.
 * Retry-required and aborted actions are not performed, and their success is
 * unknown.
 *
 * @typedef {Object} RelationActionResult
 * @property {string} status
 * @property {boolean} actionPerformed
 * @property {boolean|null} actionSucceeded
 */

function createCompletedResult(actionSucceeded)
{
  return {
    status: RelationActionStatus.COMPLETED,
    actionPerformed: true,
    actionSucceeded
  };
}

function createIncompleteResult(status)
{
  return {
    status,
    actionPerformed: false,
    actionSucceeded: null
  };
}

// a class to manage relations (ban/undoban users/users' titles)
export class RelationHandler
{
  async performAction(banMode, id, isTargetUser, isTargetTitle, isTargetMute, {
    signal,
    baseUrl
  } = {})
  {
    if(typeof baseUrl !== "string" || baseUrl.length === 0)
      throw new TypeError("baseUrl must be a non-empty string");

    if(signal?.aborted)
      return createIncompleteResult(RelationActionStatus.ABORTED);

    // An invalid id still concludes the queued action, but unsuccessfully.
    if(id <= 0)
      return createCompletedResult(false);

    const targets = [];
    if(isTargetUser)
      targets.push(enums.TargetType.USER);
    if(isTargetTitle)
      targets.push(enums.TargetType.TITLE);
    if(isTargetMute)
      targets.push(enums.TargetType.MUTE);

    let actionSucceeded = true;
    for(const targetType of targets)
    {
      if(signal?.aborted)
        return createIncompleteResult(RelationActionStatus.ABORTED);

      const url = this.#prepareHTTPRequest(banMode, targetType, id, baseUrl);
      const outcome = await this.#performHTTPRequest(banMode, targetType, id, url, signal);

      if(outcome === RelationRequestOutcome.ABORTED)
        return createIncompleteResult(RelationActionStatus.ABORTED);

      if(outcome === RelationRequestOutcome.RATE_LIMITED)
      {
        // Do not count this action; it can be retried after cooldown.
        return createIncompleteResult(RelationActionStatus.RETRY_REQUIRED);
      }

      if(outcome !== RelationRequestOutcome.SUCCEEDED)
        actionSucceeded = false;
    }

    return createCompletedResult(actionSucceeded);
  }
  
	#prepareHTTPRequest = (banMode, targetType, id, baseUrl) =>
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
    
    let url = `${baseUrl}/userrelation/${banModeText}/${id}?r=${targetTypeText}`;
    return url;
	}
  
  #performHTTPRequest = async (banMode, targetType, id, url, signal) =>
	{
    if(id <= 0)
      return RelationRequestOutcome.FAILED;

    if(signal?.aborted)
      return RelationRequestOutcome.ABORTED;

		let res = RelationRequestOutcome.FAILED;
    try 
    {
      let response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          },
        body: "id=" + id,
        signal
      });
      if(!response.ok)
      {
        if(response.status == 429)
        {
          return RelationRequestOutcome.RATE_LIMITED;
        }
        else
        {
          // errors other than 429 are considered as failure and no need for retry.
          const responseText = await response.text();
          log.err("relation", "http response code: " + response.status + " response: " + responseText);
          return RelationRequestOutcome.FAILED;
        } 
      }
      const responseText = await response.text();
      const responseJson = JSON.parse(responseText);
      
      // for enums.BanMode.BAN result is number. Probably 0 is success, 2 is already banned
      if(banMode === enums.BanMode.BAN && typeof responseJson === "number" && (responseJson === 0 || responseJson === 2))
        res = RelationRequestOutcome.SUCCEEDED;
      // for enums.BanMode.UNDOBAN result is object and it has 'result' key.
      else if(banMode === enums.BanMode.UNDOBAN && typeof responseJson === "object" && responseJson.result === true)
        res = RelationRequestOutcome.SUCCEEDED;
      else
        res = RelationRequestOutcome.FAILED;
    }
    catch(err)
    {
      if(signal?.aborted || err?.name === "AbortError")
        return RelationRequestOutcome.ABORTED;

      log.err("relation", "unexpected error: " + err);
      res = RelationRequestOutcome.FAILED;
    }
    return res;
	}
}

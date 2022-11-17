import {log} from './log.js';
import * as enums from './enums.js';
import * as utils from './utils.js'

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
      return false;
		let res = false;
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
      const responseText = await response.text();
      const responseJson = JSON.parse(responseText);
      
      // for enums.BanMode.BAN result is number. Probably 0 is success, 2 is already banned
      if(banMode === enums.BanMode.BAN && typeof responseJson === "number" && (responseJson === 0 || responseJson === 2))
        res = true; 
      // for enums.BanMode.UNDOBAN result is object and it has 'result' key.
      else if(banMode === enums.BanMode.UNDOBAN && typeof responseJson === "object" && responseJson.result === true)
        res = true; 
      else
        res = false;
      // log.info("Relation Handler: banMode: " + banMode + ", targetType: " + targetType + ", id: " + id + ", response text: " + responseText);
    }
    catch(err)
    {
      log.err(err);
    }
    return res;
	}
}
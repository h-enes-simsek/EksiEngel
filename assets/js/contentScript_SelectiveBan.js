// this script is to ban/undoban a user/user's titles
{
  // op        -> OpMode.ACTION   or OpMode.CONTROL
  // mode      -> BanMode.BAN     or BanMode.UNDOBAN
  // target    -> TargetType.USER or TargetType.TITLE
  // these enum and config parameters was previously injected by background script
	let OpMode = window.enumEksiEngelOpMode;
	let BanMode = window.enumEksiEngelBanMode;
	let TargetType = window.enumEksiEngelTargetType;
	let ResultType = window.enumEksiEngelResultType;
					
  let op = window.configEksiEngelOp;
  let mode = window.configEksiEngelMode;
  let target = window.configEksiEngelTarget;
  let responseObj = {op: op, mode: mode, target: target, res: ResultType.UNKNOWN};
  console.log(JSON.stringify(responseObj));
  
  let htmlElement = "";
  let htmlElementText = "";
  
  // select target html element
  if(target === TargetType.USER)
  {
    htmlElement = document.getElementById("blocked-link");
    
    // define innerHTML text of the target html element to verify
    if(mode === BanMode.BAN     && op === OpMode.ACTION   ||
       mode === BanMode.UNDOBAN && op === OpMode.CONTROL)
    {
      htmlElementText = "<span>engelle</span>";
    }
    else if(mode === BanMode.BAN     && op === OpMode.CONTROL ||
            mode === BanMode.UNDOBAN && op === OpMode.ACTION)
    {
      htmlElementText = "<span>engellemeyi bırak</span>";
    }
  }
  else if(target === TargetType.TITLE)
  {
    htmlElement = document.getElementById("blocked-index-title-link");
    
    // define innerHTML text of the target html element to verify
    if(mode === BanMode.UNDOBAN && op === OpMode.CONTROL ||
       mode === BanMode.BAN     && op === OpMode.ACTION)
    {
      htmlElementText = "<span>başlıklarını engelle</span>";
    }
    else if(mode === BanMode.UNDOBAN && op === OpMode.ACTION ||
            mode === BanMode.BAN     && op === OpMode.CONTROL)
    {
      htmlElementText = "<span>başlıkları engellenmiş</span>";
    }
  }
   
  // perform algorithm
  if(htmlElement != null    && htmlElement !== ""                       && 
     htmlElementText !== "" && htmlElement.innerHTML === htmlElementText)
    responseObj.res = ResultType.SUCCESS;
  else
    responseObj.res = ResultType.FAIL;
  
  let responseObjText = JSON.stringify(responseObj);
  chrome.runtime.sendMessage(null, responseObjText); // send message back to background script
  if(htmlElement != null)
    console.log("html inner element is: " + htmlElement.innerHTML);
  else
    console.log("html inner element is: " + "null");
  console.log("html inner element should be: " + htmlElementText);
  console.log(responseObjText);
  
  if(op === OpMode.ACTION && responseObj.res === ResultType.SUCCESS)
    htmlElement.click();
}
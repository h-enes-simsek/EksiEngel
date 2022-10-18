// this script is to ban/undoban a user/user's titles
{
  // op        -> op::action   or op::control
  // mode      -> mode::ban    or mode::undoban
  // target    -> target::user or target::title
  // these config parameters was previously injected by background script
  let op = window.configEksiEngelOp;
  let mode = window.configEksiEngelMode;
  let target = window.configEksiEngelTarget;
  let responseObj = {op: op, mode: mode, target: target, res: "unknown"};
  console.log(JSON.stringify(responseObj));
  
  let htmlElement = "";
  let htmlElementText = "";
  
  // select target html element
  if(target === "target::user")
  {
    htmlElement = document.getElementById("blocked-link");
    
    // define innerHTML text of the target html element to verify
    if(mode === "mode::ban"     && op === "op::action"   ||
       mode === "mode::undoban" && op === "op::control")
    {
      htmlElementText = "<span>engelle</span>";
    }
    else if(mode === "mode::ban"     && op === "op::control" ||
            mode === "mode::undoban" && op === "op::action")
    {
      htmlElementText = "<span>engellemeyi bırak</span>";
    }
  }
  else if(target === "target::title")
  {
    htmlElement = document.getElementById("blocked-index-title-link");
    
    // define innerHTML text of the target html element to verify
    if(mode === "mode::undoban" && op === "op::control" ||
      mode === "mode::ban"     && op === "op::action")
    {
      htmlElementText = "<span>başlıklarını engelle</span>";
    }
    else if(mode === "mode::undoban" && op === "op::action" ||
            mode === "mode::ban"     && op === "op::control")
    {
      htmlElementText = "<span>başlıkları engellenmiş</span>";
    }
  }
   
  // perform algorithm
  if(htmlElement != null    && htmlElement !== ""                       && 
     htmlElementText !== "" && htmlElement.innerHTML === htmlElementText)
    responseObj.res = "res::success";
  else
    responseObj.res = "res::fail";
  
  let responseObjText = JSON.stringify(responseObj);
  chrome.runtime.sendMessage(null, responseObjText); // send message back to background script
  if(htmlElement != null)
    console.log("html inner element is: " + htmlElement.innerHTML);
  else
    console.log("html inner element is: " + "null");
  console.log("html inner element should be: " + htmlElementText);
  console.log(responseObjText);
  
  if(op === "op::action" && responseObj.res === "res::success")
    htmlElement.click();
}
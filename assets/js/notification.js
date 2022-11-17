document.addEventListener('DOMContentLoaded', async function () {
  document.getElementById("earlyStop").addEventListener("click", function(element) {
    chrome.runtime.sendMessage(null, {"earlyStop":0});
  });
});

// listen background script
chrome.runtime.onMessage.addListener(async function messageListener_Background(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error

	const obj = filterMessage(message, "notification");
	if(obj.resultType === "FAIL")
		return;
  
  if(obj.notification.status === "error_NoAccount")
  {
    document.getElementById("statusText").innerHTML = "Engellenecek yazar listesi boş.";
    return;
  }
  else if(obj.notification.status === "error_Login")
  {
    document.getElementById("statusText").innerHTML = "Ekşi Sözlük hesabınıza giriş yapmanız gerekiyor.";
    return;
  }
  else if(obj.notification.status === "finished")
    document.getElementById("statusText").innerHTML = "İşlem tamamlandı.";
  else if(obj.notification.status === "ongoing")
    document.getElementById("statusText").innerHTML = "İşlem devam ediyor.";
  
  // update values
  document.getElementById("successfulAction").innerHTML = obj.notification.successfulAction;
  document.getElementById("performedAction").innerHTML = obj.notification.performedAction;
  document.getElementById("plannedAction").innerHTML = obj.notification.plannedAction;
  
  // update bar
  let bar = document.getElementById("bar");   
  let barText = document.getElementById("barText");  
  let percentage = (100 * obj.notification.performedAction) / obj.notification.plannedAction;
  if(obj.notification.plannedAction == 0 || obj.notification.plannedAction == "0")
    percentage = 0;
  percentage = parseInt(percentage);
  barText.innerHTML = '%' + percentage;
  bar.style.width = percentage + '%'; 
});

function filterMessage(message, ...keys)
{
	// message: object
	// ..keys: string(s), keys of object
	// return: object of message + object.resultType
	
	// is message object
	if(typeof message !== 'object' ||
     Array.isArray(message) ||
     message === null)
	{
		// not object
		return {"resultType": "FAIL"};
	}
  
	// has message got required keys
	for(const key of keys)
	{
		if(key in message)
		{
			;
		}
		else
		{
			return {"resultType": "FAIL"};
		}
	}
	
	message.resultType = "SUCCESS";
	return message;
}
document.addEventListener('DOMContentLoaded', async function () {
  document.getElementById("earlyStop").addEventListener("click", function(element) {
    chrome.runtime.sendMessage(null, {"earlyStop":0});
  });
});

// update completed processes table
function updateCompletedProcessesTable(banSource, banMode, successfulAction, performedAction, plannedAction, errorStatus)
{
  let table = document.getElementById("completedProcesses").getElementsByTagName('tbody')[0];
  let row = table.insertRow(0);
  let cell1 = row.insertCell(0);
  let cell2 = row.insertCell(1);
  let cell3 = row.insertCell(2);
  let cell4 = row.insertCell(3);
  let cell5 = row.insertCell(4);
  let cell6 = row.insertCell(5);
  let cell7 = row.insertCell(6);
  let d = new Date();
  cell1.innerHTML = d.getHours() + ":" + d.getMinutes(); 
  cell2.innerHTML = banSource;
  cell3.innerHTML = banMode;
  cell4.innerHTML = successfulAction;
  cell5.innerHTML = performedAction;
  cell6.innerHTML = plannedAction;
  cell7.innerHTML = errorStatus;
}

// listen background script
chrome.runtime.onMessage.addListener(async function messageListener_Background(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error

	const obj = filterMessage(message, "notification");
	if(obj.resultType === "FAIL")
		return;
  
  console.log("incoming message: " + obj.notification.status);
  
  if(obj.notification.status === "error_NoAccount")
  {
    document.getElementById("statusText").innerHTML = "Engellenecek yazar listesi boş.";
    updateCompletedProcessesTable(obj.notification.completedProcess.banSource,
                                  obj.notification.completedProcess.banMode,
                                  0,0,0,
                                  "yazar listesi boş");
    return;
  }
  else if(obj.notification.status === "error_Login")
  {
    document.getElementById("statusText").innerHTML = "Ekşi Sözlük hesabınıza giriş yapmanız gerekiyor.";
    updateCompletedProcessesTable(obj.notification.completedProcess.banSource,
                                  obj.notification.completedProcess.banMode,
                                  0,0,0,
                                  "giriş yapılmadı");
    return;
  }
  else if(obj.notification.status === "update_Planned")
  {
    // update planned processes table
    let rowNumber = document.getElementById("plannedProcesses").tBodies[0].rows.length;
    let table = document.getElementById("plannedProcesses").getElementsByTagName('tbody')[0];
    for(let i = 0; i < rowNumber; i++)
      table.deleteRow(0);
    for(let i = 0; i < obj.notification.plannedProcesses.length; i++)
    {
      let row = table.insertRow(0);
      let cell1 = row.insertCell(0);
      let cell2 = row.insertCell(1);
      let cell3 = row.insertCell(2);
      let d = new Date();
      cell1.innerHTML = d.getHours() + ":" + d.getMinutes(); 
      cell2.innerHTML = obj.notification.plannedProcesses[i].banSource;
      cell3.innerHTML = obj.notification.plannedProcesses[i].banMode;
    }
    
  }
  else if(obj.notification.status === "finished")
  {
    document.getElementById("statusText").innerHTML = "İşlem tamamlandı.";
    let table = document.getElementById("completedProcesses").getElementsByTagName('tbody')[0];
    updateCompletedProcessesTable(obj.notification.completedProcess.banSource,
                                  obj.notification.completedProcess.banMode,
                                  obj.notification.successfulAction,
                                  obj.notification.performedAction,
                                  obj.notification.plannedAction,
                                  "yok");
    return;   
  }
  else if(obj.notification.status === "ongoing")
    document.getElementById("statusText").innerHTML = "İşlem devam ediyor.";
  else if(obj.notification.status === "cooldown")
  {
    document.getElementById("statusText").innerHTML = "İşlem devam ediyor (dakikada 6 engel limiti bekleniyor).";
    document.getElementById("remainingTimeInSec").innerHTML = obj.notification.remainingTimeInSec + " saniye";
    return;
  }
  
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
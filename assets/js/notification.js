import * as enums from './enums.js';
import * as utils from './utils.js';

document.addEventListener('DOMContentLoaded', async function () {
  document.getElementById("earlyStop").addEventListener("click", function(element) {
    chrome.runtime.sendMessage(null, {"earlyStop":0});
  });
});

// insert a row to completed processes table
function insertCompletedProcessesTable(banSource, banMode, successfulAction, performedAction, plannedAction, errorStatus)
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

// recreate the planned processes table
function updatePlannedProcessesTable(plannedProcesses)
{
  let rowNumber = document.getElementById("plannedProcesses").tBodies[0].rows.length;
  let table = document.getElementById("plannedProcesses").getElementsByTagName('tbody')[0];
  for(let i = 0; i < rowNumber; i++)
    table.deleteRow(0);
  for(let i = 0; i < plannedProcesses.length; i++)
  {
    let row = table.insertRow(0);
    let cell1 = row.insertCell(0);
    let cell2 = row.insertCell(1);
    let cell3 = row.insertCell(2);
    cell1.innerHTML = plannedProcesses[i].creationDateInStr; 
    cell2.innerHTML = plannedProcesses[i].banSource;
    cell3.innerHTML = plannedProcesses[i].banMode;
  }
}

// listen background script
chrome.runtime.onMessage.addListener(async function messageListener_Background(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error

	const obj = utils.filterMessage(message, "notification");
	if(obj.resultType === "FAIL")
		return;
  
  console.log("incoming message: " + obj.notification.status);

  if(obj.notification.status === enums.NotificationType.FINISH)
  {
    document.getElementById("statusText").innerHTML = obj.notification.statusText;
    insertCompletedProcessesTable(obj.notification.completedProcess.banSource,
                                  obj.notification.completedProcess.banMode,
                                  obj.notification.successfulAction,
                                  obj.notification.performedAction,
                                  obj.notification.plannedAction,
                                  obj.notification.errorText);
    return;
  }
  if(obj.notification.status === enums.NotificationType.NOTIFY)
  {
    document.getElementById("statusText").innerHTML = obj.notification.statusText;
    return;
  }
  if(obj.notification.status === enums.NotificationType.COOLDOWN)
  {
    document.getElementById("statusText").innerHTML = obj.notification.statusText;
    document.getElementById("remainingTimeInSec").innerHTML = obj.notification.remainingTimeInSec + " saniye";
    return;
  }
  if(obj.notification.status === enums.NotificationType.UPDATE_PLANNED_PROCESSES)
  {
    updatePlannedProcessesTable(obj.notification.plannedProcesses);
    return;
  }
  if(obj.notification.status === enums.NotificationType.ONGOING)
  {
    document.getElementById("statusText").innerHTML = obj.notification.statusText;
  
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
    return;
  }
});

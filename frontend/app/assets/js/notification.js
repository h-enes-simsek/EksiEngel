import * as enums from './enums.js';

document.addEventListener('DOMContentLoaded', async function () {
  document.getElementById("earlyStop").addEventListener("click", function(element) {
    void chrome.runtime.sendMessage({
      type: enums.RuntimeMessageType.CANCEL_ALL_JOBS,
      payload: null
    }).catch(error => console.error("Cancellation request could not be sent", error));
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
  cell1.innerHTML = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
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
chrome.runtime.onMessage.addListener(function messageListener_Background(message, sender, sendResponse) {
  if(message?.type !== enums.RuntimeMessageType.JOB_NOTIFICATION)
    return false;

	const notification = message.payload;
  if(!notification || typeof notification !== "object")
    return false;

  sendResponse({ok: true});
  
  console.log("incoming message: " + notification.status);

  if(notification.status === enums.NotificationType.FINISH)
  {
    document.getElementById("statusText").innerHTML = notification.statusText;
    insertCompletedProcessesTable(notification.completedProcess.banSource,
                                  notification.completedProcess.banMode,
                                  notification.successfulAction,
                                  notification.performedAction,
                                  notification.plannedAction,
                                  notification.errorText);
    return false;
  }
  if(notification.status === enums.NotificationType.NOTIFY)
  {
    document.getElementById("statusText").innerHTML = notification.statusText;
    return false;
  }
  if(notification.status === enums.NotificationType.COOLDOWN)
  {
    document.getElementById("statusText").innerHTML = notification.statusText;
    document.getElementById("remainingTimeInSec").innerHTML = notification.remainingTimeInSec + " saniye";
    return false;
  }
  if(notification.status === enums.NotificationType.UPDATE_PLANNED_PROCESSES)
  {
    updatePlannedProcessesTable(notification.plannedProcesses);
    return false;
  }
  if(notification.status === enums.NotificationType.ONGOING)
  {
    document.getElementById("statusText").innerHTML = notification.statusText;
  
    // update values
    document.getElementById("successfulAction").innerHTML = notification.successfulAction;
    document.getElementById("performedAction").innerHTML = notification.performedAction;
    document.getElementById("plannedAction").innerHTML = notification.plannedAction;
    
    // update bar
    let bar = document.getElementById("bar");   
    let barText = document.getElementById("barText");  
    let percentage = (100 * notification.performedAction) / notification.plannedAction;
    if(notification.plannedAction == 0 || notification.plannedAction == "0")
      percentage = 0;
    percentage = parseInt(percentage);
    barText.innerHTML = '%' + percentage;
    bar.style.width = percentage + '%'; 
    return false;
  }

  return false;
});

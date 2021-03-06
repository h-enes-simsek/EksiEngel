'use strict';

console.log("background.js has been started.");

let isProgramActive = false; // track isProgramActive info to prevent multiple starts from gui
let earlyStopCommand = false; // early stop command recevied from gui to stop program execution

// backgroung.js dont have a html page so cannot alert, istead notifications can be used
function makeNotification(message){
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/eksiengel16.png',
    title: 'Notification',
    message: message,
    priority: 1
  });
}

// special thanks to stackoverflow: Aryan Beezadhur
function isURLValid(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(str);
}

chrome.runtime.onMessage.addListener(async function popupMessageListener(message, sender, sendResponse) {
  sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
  if(message === 'popup::start' && !isProgramActive){ 
    console.log("Program has been started, isProgramActive: " + isProgramActive);
    isProgramActive = true; // this will prevent multiple start from gui
    let userListArray = []; // get saved user list from storage api
    
    chrome.storage.local.get("userList", async function(items){
      if(!chrome.runtime.error){
        if(items != undefined && items.userList != undefined){
          userListArray = items.userList.split("\n");
          
          let userNumber = userListArray.length;
          let successfullBans = 0;
          
          console.log("number of user to ban: " + userNumber);
          if(userNumber < 0){
            makeNotification("Eklenti ayarlarından engellenecek yazarları ekleyin.");
          }
          else if(userNumber == 1 && userListArray[0] == ''){
            makeNotification("Eklenti ayarlarından engellenecek yazarları ekleyin.");
          }
          else{
            // control array 
            for(let i=userNumber-1; i>=0; i--) {
              if(!isURLValid(userListArray[i])){
                if(userListArray[i] == ''){
                  userListArray.splice(i, 1); // remove ith element
                }
                else{
                  // make nickname a url
                  userListArray[i] = "https://eksisozluk.com/biri/" + userListArray[i];
                }
              }
            }
            userNumber = userListArray.length; // update after removing invalid elements
            
            let pageResult;
            for(let i=0; i<userNumber; i++) {
              // navigate to next url
              pageResult = await goToPage(userListArray[i]);
              
              if(pageResult.result === "promise::success"){
                successfullBans++;
              }
              
              // early stop mechanism
              if(earlyStopCommand) {
                earlyStopCommand = false; // clear to reuse this variable
                break;
              }
            }

            // navigation of all pages is finished
            makeNotification(userNumber + ' kisilik listedeki ' + successfullBans + ' kisi engellendi.');
            
            // close last tab
            let isTabExist = false;
            chrome.tabs.query({}, function(tabs) {
              for (let tab of tabs) {
                if(tab.id == pageResult.tabID){
                  isTabExist = true;
                  console.log("last tab will be closed");
                  chrome.tabs.remove(pageResult.tabID); // close last page
                }
              }
              if(!isTabExist){
                console.log("last tab could not be closed");
              }
            }); 
            
            
          }
        }else {
          makeNotification("Eklenti ayarlarından engellenecek yazarları ekleyin.");
        }
      }else {
        makeNotification("chrome.storage.local runtime hatası");
      }
      
      isProgramActive = false; // program can be started again from gui
      console.log("Program has been finished, isProgramActive: " + isProgramActive);
    });
  } else if(message === 'popup::stop' && isProgramActive) {
    earlyStopCommand = true;
    console.log("early stop command has been received.");
  }
});


let tab_id = -1;
async function goToPage(url) {
  return new Promise(async function(resolve, reject) {
    
    // create new tab or update current tab if any
    // active:false means, it will not be focused
    if(tab_id === -1){
      chrome.tabs.create({url: url, active: false}, function(newTab) {
        tab_id = newTab.id;
      });
    }
    else{
      // firsty check are there tab whose is is tab_id, if any then update
      // if the tab is not exist (possibly closed) then create a new one
      let isTabExist = false;
      chrome.tabs.query({}, function(tabs) {
        for (let tab of tabs) {
          if(tab.id == tab_id){
            isTabExist = true;
            chrome.tabs.update(tab_id, {url: url, active: false});
          }
        }
        if(!isTabExist){
          console.log("previous tab is closed, so new tab will be opened.");
          chrome.tabs.create({url: url, active: false}, function(newTab) {
            tab_id = newTab.id;
          });
        }
      }); 
      
    }

    let counter = 0; // number of times the page is loaded
    let contentScriptResult = ""; // current status of the content scripts
    let isBanUserSuccessfull = false;
    let isBanTitleSuccessfull = false;
    
    // this function will be called every time the page is updated (reloaded)
    function PageUpdateListener(tabID, changeInfo) {
      console.log("tab id: "+ tabID + " changeinfo.status: " + changeInfo.status);
      
      if(changeInfo.status === 'complete') {
        counter++;
        console.log("page counter " + counter);
        
        if(counter === 1){
          // execute content script1
          console.log("PageUpdateListener: script1 will be exec");
          chrome.scripting.executeScript({ target: {tabId: tabID}, files: ['script1.js'] }, function() {
            console.log("script1 has been executed.");
          });
        }
        else if(contentScriptResult === "script1::success"){
          // script1::error will be handled by ContentScriptMessageListener
          console.log("PageUpdateListener: script1::success so contentScriptCheckUserBan.js will be exec");
          chrome.scripting.executeScript({ target: {tabId: tabID}, files: ['contentScriptCheckUserBan.js'] }, function() {
          console.log("contentScriptCheckUserBan has been executed.");
          });
        }
        else if(contentScriptResult === "script2::success"){
          // script2::error will be handled by ContentScriptMessageListener
          console.log("PageUpdateListener: script2::success so contentScriptCheckTitleBan.js will be exec");
          chrome.scripting.executeScript({ target: {tabId: tabID}, files: ['contentScriptCheckTitleBan.js'] }, function() {
          console.log("contentScriptCheckTitleBan has been executed.");
          });
        }
        else{
          console.log("PageUpdateListener: unhandled status contentScriptResult: " + contentScriptResult);
        }
        
      }
    }
    
    // register function to call every time the page is updated
    chrome.tabs.onUpdated.addListener(PageUpdateListener);
    
    // fired when content script sends a message
    chrome.runtime.onMessage.addListener(function ContentScriptMessageListener(message, sender, sendResponse) {
      sendResponse({status: 'ok'}); // added to suppress 'message port closed before a response was received' error
      // update status to track (it should be filtered, because popup messages interfere)
      if(message === "script1::success" || message === "script1::error" || 
         message === "script2::success" || message === "script2::error" ||
         message === "checkuserban::error" || message === "checkuserban::success" ||
         message === "checktitleban::error" || message === "checktitleban::success") {
        contentScriptResult = message; 
      }
      console.log("ContentScriptMessageListener:: incoming msg: " + message);
      
      if(message === 'script1::error'){
        // script1::success will be handled by PageUpdateListener
        console.log("contentScriptCheckUserBan will be executed");
        chrome.scripting.executeScript({ target: {tabId: tab_id}, files: ['contentScriptCheckUserBan.js'] }, function() {
          console.log("contentScriptCheckUserBan has been executed.");
        });
        
      }
      else if(message === "checkuserban::error" || message === "checkuserban::success"){
        
        isBanUserSuccessfull = message === "checkuserban::success";
        
        // execute content script2 after script1 and checkuserban
        console.log("script2 will be executed");
        chrome.scripting.executeScript({ target: {tabId: tab_id}, files: ['script2.js'] }, function() {
          console.log("script2 has been executed.");
        });
      }
      else if(message === 'script2::error'){
        // script2::success will be handled by PageUpdateListener
        // execute content script to check if script2 is successfull
        console.log("contentScriptCheckTitleBan will be executed");
        chrome.scripting.executeScript({ target: {tabId: tab_id}, files: ['contentScriptCheckTitleBan.js'] }, function() {
          console.log("contentScriptCheckTitleBan has been executed.");
        });
      }
      
      else if(message === "checktitleban::error" || message === "checktitleban::success"){
        //all actions have been completed.
        
        isBanTitleSuccessfull = message === "checktitleban::success"; 
        
        // remove onMessage event as it may get duplicated
        console.log("ContentScriptMessageListener removed.");
        chrome.runtime.onMessage.removeListener(ContentScriptMessageListener);
        
        // remove tab onUpdate event to prevent duplicated listener
        console.log("PageUpdateListener removed.");
        chrome.tabs.onUpdated.removeListener(PageUpdateListener);
          
        // resolve Promise after content script has executed
        if(isBanUserSuccessfull && isBanTitleSuccessfull){
          resolve({result:"promise::success", tabID: tab_id});
        }
        else{
          resolve({result:"promise::fail", tabID: tab_id});
        }
        
      }
      
      else{
        console.log("ContentScriptMessageListener:: unhandled msg: " + message);
      }

      
    });
    
    
  });
}
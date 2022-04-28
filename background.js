'use strict';

console.log("background.js has been started.");

const rules = [{
    conditions: [
        new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostEquals: 'eksisozluk.com'},
        })
    ],
    actions: [new chrome.declarativeContent.ShowPageAction()]
}];

//activate extension in the page eksisozluk.com
chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules(rules);
  });
});

// backgroung.js dont have a html page so cannot alert, istead notifications can be used
function makeNotification(message){
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/eksiengel16.png',
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

chrome.runtime.onMessage.addListener(async function popupMessageListener(message) {
  
  if(message === 'popup::start'){ 
    
    let userListArray = []; // get saved user list from storage api
    
    chrome.storage.local.get("userList",async function(items){
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
            
          
            for(let i=0; i<userNumber; i++) {
              // navigate to next url
              let result = await goToPage(userListArray[i]);
              
              if(result === "promise::success"){
                successfullBans++;
              }
            }

            // navigation of all pages is finished
            makeNotification(userNumber + ' kisilik listedeki ' + successfullBans + ' kisi engellendi.');
            
          }
        }else {
          makeNotification("Eklenti ayarlarından engellenecek yazarları ekleyin.");
        }
      }else {
        makeNotification("chrome.storage.local runtime hatası");
      }
    });
  }
});


let tab_id = -1;
async function goToPage(url) {
  return new Promise(function(resolve, reject) {
    
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
          console.log("popup.js::contentScriptCheckUserBan has been executed.");
          });
        }
        else if(contentScriptResult === "script2::success"){
          // script2::error will be handled by ContentScriptMessageListener
          console.log("PageUpdateListener: script2::success so contentScriptCheckTitleBan.js will be exec");
          chrome.scripting.executeScript({ target: {tabId: tabID}, files: ['contentScriptCheckTitleBan.js'] }, function() {
          console.log("popup.js::contentScriptCheckTitleBan has been executed.");
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
    chrome.runtime.onMessage.addListener(async function ContentScriptMessageListener(message) {
      contentScriptResult = message; // update status to track
      console.log(message);
      
      if(message === 'script1::error'){
        // script1::success will be handled by PageUpdateListener
        console.log("contentScriptCheckUserBan will be executed");
        chrome.scripting.executeScript({ target: {tabId: tab_id}, files: ['contentScriptCheckUserBan.js'] }, function() {
          console.log("popup.js::contentScriptCheckUserBan has been executed.");
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
          console.log("popup.js::contentScriptCheckTitleBan has been executed.");
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
          resolve("promise::success");
        }
        else{
          resolve("promise::fail");
        }
        
      }
      
      else{
        console.log("ContentScriptMessageListener: unhandled msg " + message);
      }
      
    });
    
    
    
    
  });
}
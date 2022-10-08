'use strict';
console.log("redirectHandler: init");

let CONFIG_REDIRECT_CONTROL_PERIOD_IN_SEC = 5;

class RedirectHandler 
{
  static tab_id = -1;
  static redirectTimer = 0;
  static redirectTimerCounter = 0; 
  
  constructor(){}
  
  static prepareHandler()
  {
    RedirectHandler.tab_id = -1;
    RedirectHandler.redirectTimer = 0;
    RedirectHandler.redirectTimerCounter = 0; 
  }
  
  static startRedirectTimer(url)
  {
    RedirectHandler.redirectTimerCounter += 1;
    if(RedirectHandler.redirectTimer) 
    {
      console.log("bg.js: duplicate attempt to redirect timer, counter: " + RedirectHandler.redirectTimerCounter);
    }
    else
    { 
      RedirectHandler.redirectTimer = setInterval(()=>{
        RedirectHandler.redirectUntilSuccessfull(url);
      }, CONFIG_REDIRECT_CONTROL_PERIOD_IN_SEC*1000);
    }
  }
  
  static stopRedirectTimer() 
  {
    if(RedirectHandler.redirectTimer) 
    {
      clearInterval(RedirectHandler.redirectTimer);
      RedirectHandler.redirectTimer = 0;
      RedirectHandler.redirectTimerCounter = 0;
    }
  }
  
  static async createNewTab(url)
  {
    return new Promise((resolve, reject) => {
      // active:false means, it will not be focused
      chrome.tabs.create({url: url, active: false}, function(newTab) {
        resolve(newTab.id);
      });
    });
  }
  
  static async redirect(url, tab_id)
  {
    return new Promise((resolve, reject) => {
      // active:false means, it will not be focused
      chrome.tabs.update(tab_id, {url: url, active: false}, function(newTab) {
        resolve();
      });
    });
  }
  
  static async redirectUntilSuccessfull(url)
  {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({}, async function(tabs) {
     
        for (let tab of tabs) {
          if(tab.id == RedirectHandler.tab_id){
            let current_url = RedirectHandler.decodeURIComponentForEksi(tab.url);
            if(url !== current_url)
            {
              console.log("bg.js: request url: " + url + " current url " + current_url);
              await RedirectHandler.redirect(url, RedirectHandler.tab_id);
              
              // the tab will be redirected if the redirect was not worked 
              RedirectHandler.startRedirectTimer(url);
              
              return resolve();
            }
            else
            {
              // ideally program should not be here
              console.log("bg.js: multiple redirection attempt, url: " + url);
              return resolve();
            }
          }
        }
                       
        // the tab that was opened by this program not exist (possibly closed by user)
        // it will be handled by page close listener
        return resolve();
      });
    });
  }
      
  static async handleTabOperations(url)
  {
    return new Promise(async (resolve, reject) => {
      if(RedirectHandler.tab_id === -1){
        // create new tab when program started
        RedirectHandler.tab_id = await RedirectHandler.createNewTab(url);
        console.log("bg.js: new tab created, id: " + RedirectHandler.tab_id);
        return resolve(RedirectHandler.tab_id);
      }
      else{
        // redirect the tab to new url
        console.log("bg.js: will redirect to url: " + url);
        await RedirectHandler.redirectUntilSuccessfull(url); 
        return resolve(RedirectHandler.tab_id);
      }
    });
  }
  
  // example input: abc%20def%21gh
  // output: abc-def!gh
  static decodeURIComponentForEksi(url)
  {
    let decodedUrl = decodeURIComponent(url);
    // replace every whitespace with - (eksisozluk.com convention)
    decodedUrl.replace(/ /gi, "-");
    return decodedUrl;
  }
}
// backgroung.js dont have a html page so cannot alert, instead notifications can be used
function makeNotification(message)
{
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../img/eksiengel16.png',
    title: 'Notification',
    message: message,
    priority: 1
  });
}

// clean collected user list by erasing empty inputs 
// convert nicknames to the url
// whitespaces should be - according to ekşisözlük name rules
function cleanUserList(arr)
{
  for(let i = arr.length - 1; i >= 0; i--) 
  {
    // if empty, delete it
    if(arr[i] == ''){
      arr.splice(i, 1); // remove ith element
    }
    else{
      // replace every whitespace with -
      arr[i] = arr[i].replace(/ /gi, "-");
      
      // convert nickname to the url
      arr[i] = "https://eksisozluk.com/biri/" + arr[i];
    }
  }
}

async function closeLastTab(tabid)
{ 
  let isTabExist = await isTargetTabExist(tabid);
  if(isTabExist)
  {
    console.log("last tab will be closed");
    chrome.tabs.remove(tabid);
  }
  else
  {
    console.log("Last tab could not be closed. (may be already closed)");
  }
}

async function isTargetTabExist(tabid)
{
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, function(tabs) {
      // access all the open tabs and compare
      for (let tab of tabs) {
        if(tab.id == tabid){
          return resolve(true);
        }
      }
      return resolve(false);
    }); 
  });
}

// get userList from storage api
// output: array (if fails, returns empty array)
async function getUserList()
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("userList", function(items){
      if(!chrome.runtime.error)
      {
        if(items != undefined && items.userList != undefined)
        {
          resolve(items.userList.split("\n"));  
        }
        else 
        {
          console.log("empty list from storage api");
          resolve([]);
        }
      }
      else 
      {
        console.log("chrome.storage.local runtime err");
        makeNotification("chrome.storage.local runtime hatası");
        resolve([]);
      }
    }); 
  });
}

// example input: abc%20def%21gh
// output: abc-def!gh
function decodeURIComponentForEksi(url)
{
  let decodedUrl = decodeURIComponent(url);
  // replace every whitespace with - (eksisozluk.com convention)
  decodedUrl.replace(/ /gi, "-");
  return decodedUrl;
}
function makeNotification(message)
{
  chrome.notifications.create({
    type: 'basic',
		iconUrl: '../img/eksiengel16.png',
    title: 'Eksi Engel',
    message: message,
    priority: 1
  });
}

// clean collected user list by erasing empty inputs 
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
    }
  }
}

async function closeLastTab(tabid)
{ 
  let isTabExist = await isTargetTabExist(tabid);
  if(isTabExist)
  {
    log.info("last tab will be closed");
    chrome.tabs.remove(tabid);
  }
  else
  {
    log.info("Last tab could not be closed. (may be already closed)");
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

// get meta data for fav ban from storage api
// output: object (if fails, returns empty string)
async function getFavBanMetaData()
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("favBanMetaData", function(items){
      if(!chrome.runtime.error)
      {
        if(items != undefined 														&& items.favBanMetaData != undefined    && 
				   Object.keys(items.favBanMetaData).length !== 0 && "favEntryId" in items.favBanMetaData &&
					 "favTitleName" in items.favBanMetaData 				&& "favTitleId" in items.favBanMetaData && 
					 "favAuthorName" in items.favBanMetaData 				&& "favAuthorId" in items.favBanMetaData)
        {
          resolve(items.favBanMetaData);  
        }
        else 
        {
          log.err("empty object from storage api");
          resolve("");
        }
      }
      else 
      {
        log.err("chrome.storage.local runtime err");
        makeNotification("chrome.storage.local runtime hatası");
        resolve("");
      }
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
        if(items != undefined && items.userList != undefined && items.userList.length != 0)
        {
          resolve(items.userList.split("\n"));  
        }
        else 
        {
          log.err("empty list from storage api");
          resolve([]);
        }
      }
      else 
      {
        log.err("chrome.storage.local runtime err");
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

async function AsyncExecuteScript(tabid, file)
{
	return new Promise((resolve, reject) => {
		chrome.scripting.executeScript(
      {
				target: {tabId: tabid, frameIds: [0]},
				files: [file]
			}, 
			()=>
			{
				if(chrome.runtime.lastError) 
				{
					log.err("content script could not be executed, file: " + file + " err: " + chrome.runtime.lastError.message);
					return resolve(false); 
				} 
				else 
				{
					log.info("content script has been executed, file: " + file);
					return resolve(true); 
				}
			}
		);
	});
}

async function asyncCSSInject(tabid, file)
{
	return new Promise((resolve, reject) => {
		chrome.scripting.insertCSS(
      {
				target: {tabId: tabid, frameIds: [0]},
				files: [file]
			}, 
			()=>
			{
				if(chrome.runtime.lastError) 
				{
					log.err("css script could not be injected, file: " + file + " err: " + chrome.runtime.lastError.message);
					return resolve(false); 
				} 
				else 
				{
					log.info("css script has been injected, file: " + file);
					return resolve(true); 
				}
			}
		);
	});
}

function syncExecuteScript(tabid, file)
{
	chrome.scripting.executeScript(
		{
			target: {tabId: tabid, frameIds: [0]},
			files: [file]
		}, 
		()=>
		{
			if(chrome.runtime.lastError) 
			{
				log.err("content script could not be executed, file: " + file + " err: " + chrome.runtime.lastError.message);
			} 
			else 
			{
				log.info("content script has been executed, file: " + file);
			}
		}
	);
}

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
		return {"resultType":"FAIL"};
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
			return {"resultType":"FAIL"};
		}
	}
	
	message.resultType = "SUCCESS";
	return message;
}

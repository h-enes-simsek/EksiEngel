import * as enums from './enums.js';

// clean collected user list by erasing empty inputs 
// whitespaces will be converted into - according to ekşisözlük name rules
export function cleanUserList(arr)
{
  for(let i = arr.length - 1; i >= 0; i--) 
  {
		// if first char is '@', remove the char
		if(arr[i][0] === "@")
			arr[i] = arr[i].substring(1);
		
    // remove whitespaces from both end
    arr[i] = arr[i].trim();
    
    // if empty, delete it
    if(arr[i] == '')
		{
      arr.splice(i, 1); // remove ith element
    }
    else
		{			
      // replace every whitespace with -
      arr[i] = arr[i].replace(/ /gi, "-");
    }
  }
}

// get userList from storage api
// output: array (if fails, returns empty array)
export async function getUserList()
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
          resolve([]);
        }
      }
      else 
      {
        resolve([]);
      }
    }); 
  });
}

export function filterMessage(message, ...keys)
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
		return {"resultType": enums.ResultType.FAIL};
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
			return {"resultType": enums.ResultType.FAIL};
		}
	}
	
	message.resultType = enums.ResultType.SUCCESS;
	return message;
}
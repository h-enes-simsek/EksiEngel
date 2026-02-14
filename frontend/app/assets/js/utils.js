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
			// Key exists, continue checking
		}
		else
		{
			return {"resultType": enums.ResultType.FAIL};
		}
	}
	
	message.resultType = enums.ResultType.SUCCESS;
	return message;
}

// Simple sleep function
export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parses Turkish date formats into JavaScript Date object
 * Supports formats like: DD.MM.YYYY, DD/MM/YYYY, ISO dates, etc.
 * @param {string} dateStr - The date string to parse
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export function parseTurkishDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try Turkish format: DD.MM.YYYY or DD/MM/YYYY
  const turkishMatch = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (turkishMatch) {
    const day = parseInt(turkishMatch[1]);
    const month = parseInt(turkishMatch[2]) - 1; // JS months are 0-indexed
    const year = parseInt(turkishMatch[3]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try parsing with Date.parse as fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return null;
}

/**
 * Calculates the difference in days between two dates
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date (defaults to now)
 * @returns {number} - Difference in days (positive if date1 is in the past)
 */
export function getDaysDifference(date1, date2 = new Date()) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = d2.getTime() - d1.getTime();
  return Math.floor(diffMs / msPerDay);
}

/**
 * Evaluates a user against a date filter rule
 * @param {string} registrationDate - ISO date string of user's registration
 * @param {Object} rule - Date filter rule object
 * @returns {boolean} - True if user matches the filter criteria
 */
export function evaluateDateFilter(registrationDate, rule) {
  if (!registrationDate || !rule) return false;
  
  const regDate = new Date(registrationDate);
  if (isNaN(regDate.getTime())) return false;
  
  const now = new Date();
  const accountAgeDays = getDaysDifference(regDate, now);
  
  switch (rule.criteria) {
    case enums.DateFilterCriteria.NEWER_THAN:
      // Account is newer than X days (account age < X)
      return accountAgeDays !== null && accountAgeDays < parseInt(rule.value);
      
    case enums.DateFilterCriteria.OLDER_THAN:
      // Account is older than X days (account age > X)
      return accountAgeDays !== null && accountAgeDays > parseInt(rule.value);
      
    case enums.DateFilterCriteria.BEFORE_DATE:
      // Registered before specific date
      const beforeDate = new Date(rule.value);
      return !isNaN(beforeDate.getTime()) && regDate < beforeDate;
      
    case enums.DateFilterCriteria.AFTER_DATE:
      // Registered after specific date
      const afterDate = new Date(rule.value);
      return !isNaN(afterDate.getTime()) && regDate > afterDate;
      
    default:
      return false;
  }
}

/**
 * Applies date filter rules to a list of users
 * @param {Map<string, Object>} users - Map of username to user data (should include registrationDate)
 * @param {Array} rules - Array of date filter rules
 * @returns {Object} - Object with categorized users: block, unknown
 */
export function applyDateFilters(users, rules) {
  const result = {
    block: [],      // Users to block
    unknown: []     // Users with unknown registration date
  };
  
  if (!rules || rules.length === 0 || !users || users.size === 0) {
    for (const [username, userData] of users) {
      result.block.push({ username, ...userData });
    }
    return result;
  }
  
  for (const [username, userData] of users) {
    const regDate = userData.registrationDate;
    
    if (!regDate) {
      result.unknown.push({ username, ...userData });
      continue;
    }
    
    let matched = false;
    for (const rule of rules) {
      if (evaluateDateFilter(regDate, rule)) {
        matched = true;
        const userEntry = { username, rule: rule.id, ...userData };
        
        switch (rule.action) {
          case enums.DateFilterAction.ENGELLE:
            result.block.push(userEntry);
            break;
        }
        break;
      }
    }
    
    if (!matched) {
      result.block.push({ username, ...userData });
    }
  }
  
  return result;
}

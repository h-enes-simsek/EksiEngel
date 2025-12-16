import {log} from './log.js';
import * as enums from './enums.js';
import {JSDOM} from './jsdom.js';
import {config} from './config.js';
import * as utils from './utils.js';
import { programController } from './programController.js'; // Import programController


function Relation(authorName, authorId, isBannedUser, isBannedTitle, isBannedMute, doIFollow, doTheyFollowMe) {
  this.authorId = authorId;               // this author's id
  this.authorName = authorName;           // this author's username
  
  this.isBannedUser = isBannedUser;       // did I ban this author
  this.isBannedTitle = isBannedTitle;     // did I ban this author's titles
  this.isBannedMute = isBannedMute;       // did I mute this author
  
  this.doIFollow = doIFollow;             // do I follow this author
  this.doTheyFollowMe = doTheyFollowMe;   // does this author follow me
}

class ScrapingHandler
{
  #fetchEksiSozluk = async (url) => 
  {
    // fetch with custom headers for eksisozluk website
    // return: response.text()
    // return(err): throw Error

    let responseText = "";
    try
    {
      let response = await fetch(url, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      responseText = await response.text();
      return responseText;
    }
    catch(err)
    {
      throw new Error(err);
    }
  }

  scrapeUserAgent = () =>
  {
    return navigator.userAgent;
  }
  
  scrapeClientNameAndId = async () =>
  {
    // return: {clientName, clientId}
    // return(error): {clientName:"", clientId:""}

    let responseText = "";
    try
    {
      responseText = await this.#fetchEksiSozluk(config.EksiSozlukURL);
    }
    catch(err)
    {
      log.err("scraping", "scrapeClientName: " + err);
      return {clientName:"", clientId:""};
    }
    
    let clientName = "";
    try
    {
      // parse string response as html document
      let dom = new JSDOM(responseText);
      let cName = dom.window.document.querySelector(".mobile-notification-icons").querySelector(".mobile-only a").title;
      if(cName && cName !== null && cName !== undefined)
      {
        cName = cName.replace(/ /gi, "-"); /* whitespace to - char */
        clientName = cName;
      }
      
      log.info("scraping", "clientName: " + clientName);
    }
    catch(err)
    {
      log.err("scraping", "scrapeClientName: " + err);
      return {clientName:"", clientId:""};
    }

    let clientId = await this.scrapeAuthorIdFromAuthorProfilePage(clientName);
    if(clientId == 0)
      return {clientName:"", clientId:""};
    else 
      return {clientName, clientId};
    
  }

  scrapeMetaDataFromEntryPage = async (entryUrl) =>
  {
    // entryUrl: string, entry url. example: https://eksisozluk.com/entry/1
    // return: {entryId:string, authorId:string, authorName:string, titleId:string, titleName:string}
    // return(error): {entryId:"0", authorId:"0", authorName:"", titleId:"0", titleName:""}
    
    let responseText = "";
    try
    {
      let response = await fetch(entryUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      responseText = await response.text();
    }
    catch(err)
    {
      log.err("scraping", "scrapeMetaDataFromEntryPage: " + err);
      return {entryId:"0", authorId:"0", authorName:"", titleId:"0", titleName:""};
    }
    
    try
    {
      // parse string response as html document
      let dom = new JSDOM(responseText);
      let entryElement = dom.window.document.getElementById("entry-item-list").querySelector("li");
      
      // scrape data
      let authorId = entryElement.getAttribute("data-author-id");
      let authorName = entryElement.getAttribute("data-author");
      authorName = authorName.replace(/ /gi, "-"); // replace withspaces with -
      let entryId = entryUrl.match(/(\d+)(?!.*\d)/g).join("");
      let titleId =  dom.window.document.getElementById("title").getAttribute("data-id");
      let titleName =  dom.window.document.getElementById("title").getAttribute("data-title");
      titleName = titleName.replace(/ /gi, "-"); // replace withspaces with -
      
      // log.info(JSON.stringify({entryId:entryId, authorId:authorId, authorName:authorName, titleId:titleId, titleName:titleName}));
      
      return {entryId:entryId, authorId:authorId, authorName:authorName, titleId:titleId, titleName:titleName};
    }
    catch(err)
    {
      log.err("scraping", "scrapeMetaDataFromEntryPage: " + err);
      return {entryId:0, authorId:0, authorName:"", titleId:0, titleName:""};
    }
  }
  
  // this method will access config object, so it is not arrow function
  async scrapeAuthorNamesFromFavs(entryUrl)
  {
    // entryUrl: string, entry url. example: https://eksisozluk.com/entry/1
    // return: Map(authorName, RelationObject)
    // return(err): empty Map()
    
    let scrapedRelations = new Map();
    let responseText = "";
    try
    {
      let entryId = entryUrl.match(/(\d+)(?!.*\d)/g).join("");
      let targetUrl = config.EksiSozlukURL + "/entry/favorileyenler?entryId=" + entryId;
      let response = await fetch(targetUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      responseText = await response.text();
      if(response.status != 200 || !response.ok)
        throw "targetURL: " + targetUrl + ", response status: " + response.status + ", isOk: " + response.ok;
    }
    catch(err)
    {
      log.err("scraping", "scrapeAuthorNamesFromFavs: " + err);
      return new Map();
    }
    
    try
    {
      // parse string response as html document
      let dom = new JSDOM(responseText);
      let authListNodeList = dom.window.document.querySelectorAll("a");

      for(let i = 0; i < authListNodeList.length; i++) 
      {
        let val = authListNodeList[i].innerHTML;
        
        // last element could be exception
        if(val && i == authListNodeList.length-1)
        {
          // if there is a fav from "çaylak" users, last value of list indicates it
          if(val.includes("çaylak"))
            continue
        }
        
        if(val) 
        { 
          // delete '@' char from nicknames
          // "@example_user" --> "example_user"
          val = val.substr(1);
          
          // replace every whitespace with - (eksisozluk.com convention)
          val = val.replace(/ /gi, "-");
          scrapedRelations.set(val, new Relation(val, null, null, null, null, null, null)); 
        }
      }
      
    }
    catch(err)
    {
      log.err("scraping", "scrapeAuthorNamesFromFavs: " + err);
      return new Map();
    }

    if(config.enableNoobBan)
    {
      let responseTextNoob = "";
      try
      {
        let entryId = entryUrl.match(/(\d+)(?!.*\d)/g).join("");
        let targetUrl = config.EksiSozlukURL + "/entry/caylakfavorites?entryId=" + entryId;
        let response = await fetch(targetUrl, {
          method: 'GET',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'x-requested-with': 'XMLHttpRequest'
            }
        });
        responseTextNoob = await response.text();
      }
      catch(err)
      {
        log.err("scraping", "scrapeAuthorNamesFromFavs: " + err);
        return new Map();
      }
      
      try
      {
        // parse string response as html document
        let dom = new JSDOM(responseTextNoob);
        let authListNodeList = dom.window.document.querySelectorAll("a");

        for(let i = 0; i < authListNodeList.length; i++) 
        {
          let val = authListNodeList[i].innerHTML;
          if (val) 
          { 
            // delete '@' char from nicknames
            // "@example_user" --> "example_user"
            val = val.substr(1);
            
            // replace every whitespace with - (eksisozluk.com convention)
            val = val.replace(/ /gi, "-");
            scrapedRelations.set(val, new Relation(val, null, null, null, null, null, null)); 
          }
        }
        
      }
      catch(err)
      {
        log.err("scraping", "(noob) scrapeAuthorNamesFromFavs: " + err);
        return new Map();
      }
      
    }
    
    return scrapedRelations;

  }

  #scrapeAuthorNamesFromBannedAuthorPagePartially = async (targetType, index) =>
  {
    // index: integer(1...n) Scraping must be done with multiple requests, index indicates the number of the page to scrape
    // targetType: enums.TargetType
    // return: {authorIdList: string[], authorNameList: string[], isLast: bool}
    // note: isLast indicates that this is the last page
    // return(err): {authorIdList: [], authorNameList: [], isLast: true}

    let targetTypeTextInURL = "";
    if(targetType == enums.TargetType.USER)
      targetTypeTextInURL = "m";
    else if(targetType == enums.TargetType.TITLE)
      targetTypeTextInURL = "i";
    else if(targetType == enums.TargetType.MUTE)
      targetTypeTextInURL = "u";
    
    let responseJson = "";
    try
    {
      // note: real url is like .../relation-list?relationType=m&pageIndex=1&_=123456789
      // but i couldn't figure out what and where is the query parameter '_'
      // without this query parameter it works anyway at least for now.
      let targetUrl = `${config.EksiSozlukURL}/relation-list?relationType=${targetTypeTextInURL}&pageIndex=${index}`;
      let response = await fetch(targetUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      
      // Check if the request was successful
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText} for URL: ${targetUrl}`);
      }

      // Check content type before parsing JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Attempt to read the response as text to include in the error message
        let responseBody = "";
        try {
          responseBody = await response.text();
        } catch (textError) {
          responseBody = "(Could not read response body)";
        }
        throw new Error(`Expected JSON, but received Content-Type: ${contentType}. Response body: ${responseBody.substring(0, 100)}...`);
      }

      responseJson = await response.json();
      let isLast = responseJson.Relations.IsLast;

      let authorNameList = [];
      let authorIdList = [];
      let authorNumber = responseJson.Relations.Items.length;
      for(let i = 0; i < authorNumber; i++)
      {
        let authName = responseJson.Relations.Items[i].Nick.Value;
        // replace every whitespace with - (eksisozluk.com convention)
        authorNameList[i] = authName.replace(/ /gi, "-");
        authorIdList[i] = String(responseJson.Relations.Items[i].Id);
      }
      
      return {authorIdList: authorIdList, authorNameList: authorNameList, isLast: isLast};
    }
    catch(err)
    {
      // Log the error and re-throw it to ensure the caller knows about the failure
      log.err("scraping", `#scrapeAuthorNamesFromBannedAuthorPagePartially failed for page ${index}, type ${targetTypeTextInURL}: ${err}`);
      // Re-throw the original error or a new one with more context
      throw new Error(`Failed to scrape page ${index} for type ${targetTypeTextInURL}: ${err.message || err}`);
    }

  }
  
  // Simplified version that only fetches the first page of blocked users
  async scrapeBlockedUsersFirstPage() {
    log.info("scraping", "Fetching first page of blocked users only");
    let scrapedRelations = new Map();
    
    try {
      // Only fetch the first page of blocked users
      const partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.USER, 1);
      const partialNameList = partialListObj.authorNameList;
      const partialIdList = partialListObj.authorIdList;
      
      // Create relation objects for each blocked user
      for (let index = 0; index < partialIdList.length; ++index) {
        const id = partialIdList[index];
        const name = partialNameList[index];
        scrapedRelations.set(name, new Relation(name, id, true, false, false));
      }
      
      log.info("scraping", `Found ${scrapedRelations.size} blocked users on first page`);
      return scrapedRelations;
    } catch(err) {
      log.err("scraping", "scrapeBlockedUsersFirstPage: " + err);
      return scrapedRelations; // Return empty map on error
    }
  }
  
  // Simplified version that fetches a specific page of blocked titles
  async scrapeBlockedTitlesFirstPage(pageNumber = 1) {
    log.info("scraping", `Fetching page ${pageNumber} of blocked titles`);
    let scrapedRelations = new Map();
    
    try {
      // Fetch the specified page of blocked titles
      const partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.TITLE, pageNumber);
      const partialNameList = partialListObj.authorNameList;
      const partialIdList = partialListObj.authorIdList;
      
      // Create relation objects for each blocked title
      for (let index = 0; index < partialIdList.length; ++index) {
        const id = partialIdList[index];
        const name = partialNameList[index];
        
        // Skip entries with missing data
        if (!id || !name) {
          log.warn("scraping", `Skipping entry with missing data: id=${id}, name=${name}`);
          continue;
        }
        
        // In the case of title blocking, the title ID is the same as the author ID
        // Create a relation object with both author and title information
        const relation = new Relation(name, id, false, true, false);
        relation.titleId = id;  // Use the author ID as the title ID
        relation.titleName = name;
        scrapedRelations.set(name, relation);
      }
      
      log.info("scraping", `Found ${scrapedRelations.size} blocked titles on page ${pageNumber}`);
      return scrapedRelations;
    } catch(err) {
      log.err("scraping", `scrapeBlockedTitlesFirstPage (page ${pageNumber}): ${err}`);
      return scrapedRelations; // Return empty map on error
    }
  }
  
  // Helper method to get the title ID for an author
  async scrapeTitleIdForAuthor(authorId) {
    try {
      // In the case of title blocking, the title ID is actually the same as the author ID
      // This is because the API uses the author ID as the title ID for title blocking
      log.info("scraping", `Using author ID ${authorId} as title ID`);
      return authorId;
    } catch (error) {
      log.err("scraping", `Error in scrapeTitleIdForAuthor: ${error}`);
      return null;
    }
  }
  
  async scrapeAuthorNamesFromBannedAuthorPage()
  {
    // no args
    // return: Map(authorName, RelationObject)
    // return(err): empty Map()
    
    let scrapedRelations = new Map();
    
    try
    {
      let bannedAuthIdList = [];
      let bannedAuthNameList = [];
      let bannedTitleIdList = [];
      let bannedTitleNameList = [];
      let bannedMuteIdList = [];
      let bannedMuteNameList = [];
      
      // for user list banned
      let isLast = false;
      let index = 0;
      while(!isLast)
      {
        index++;
        let partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.USER, index);
        let partialNameList = partialListObj.authorNameList;
        let partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;
        
        bannedAuthNameList.push(...partialNameList);
        bannedAuthIdList.push(...partialIdList);
      }
      
      // TODO: simplify this solution by refactoring
      for (let index = 0; index < bannedAuthIdList.length; ++index) {
        const id = bannedAuthIdList[index];
        const name = bannedAuthNameList[index];
        scrapedRelations.set(name, new Relation(name, id, true, false, false));        
      }
      
      // for user list whose titles were banned
      isLast = false;
      index = 0;
      while(!isLast)
      {
        index++;
        let partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.TITLE, index);
        let partialNameList = partialListObj.authorNameList;
        let partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;
        
        bannedTitleNameList.push(...partialNameList);
        bannedTitleIdList.push(...partialIdList);
      }
      
      // TODO: simplify this solution by refactoring
      for (let index = 0; index < bannedTitleIdList.length; ++index) {
        const id = bannedTitleIdList[index];
        const name = bannedTitleNameList[index];
        if(scrapedRelations.has(name))
          scrapedRelations.get(name).isBannedTitle = true;
        else
          scrapedRelations.set(name, new Relation(name, id, false, true, false));        
      }
      

      // for user list whose has been muted
      isLast = false;
      index = 0;
      while(!isLast)
      {
        index++;
        let partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.MUTE, index);
        let partialNameList = partialListObj.authorNameList;
        let partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;
        
        bannedMuteNameList.push(...partialNameList);
        bannedMuteIdList.push(...partialIdList);
      }
      
      // TODO: simplify this solution by refactoring
      for (let index = 0; index < bannedMuteIdList.length; ++index) {
        const id = bannedMuteIdList[index];
        const name = bannedMuteNameList[index];
        if(scrapedRelations.has(name))
          scrapedRelations.get(name).isBannedMute = true;
        else
          scrapedRelations.set(name, new Relation(name, id, false, false, true));        
      }
      
      // console.log(scrapedRelations);

      /*
      console.log(bannedAuthNameList);
      console.log(bannedTitleNameList);    
      console.log(bannedMuteNameList);
      
      console.log(bannedAuthIdList);
      console.log(bannedTitleIdList);
      console.log(bannedMuteIdList);
      
      console.log(authorIdList);
      console.log(authorNameList);
      */
      
      return scrapedRelations;
    }
    catch(err)
    {
      log.err("scraping", "scrapeAuthorNamesFromBannedAuthorPage: " + err);
      return scrapedRelations;
    }
  }

  /**
   * Scrapes all pages of muted users from Ekşi Sözlük.
   * Handles pagination and polite delays, reporting progress via callback.
   * @param {function({currentPage: number, currentCount: number}): void} [progressCallback] - Optional callback for progress updates.
   * @param {number} [resumeFromIndex] - Optional page index to resume from (for resume capability)
   * @returns {Promise<{success: boolean, count?: number, usernames?: string[], error?: string, stoppedEarly?: boolean}>}
   */
  async scrapeAllMutedUsers(progressCallback, resumeFromIndex = null) {
    log.info("scraping", "Starting to scrape all muted users...");
    let allMutedUsernames = [];
    let totalCount = 0;
    let index = resumeFromIndex || 0;
    let isLast = false;
    const politeDelayMs = 500; // Delay between page requests in milliseconds
    const maxRetries = 3; // Max retries for errors (excluding 429)
    const retryDelayMs = 1000; // Delay before retrying a failed page fetch
    const rateLimitDelayMs = 65000; // Delay after hitting a 429 error (65 seconds)

    try {
      while (!isLast) {
        // Check for early stop request
        if (programController.earlyStop) {
          log.info("scraping", "Muted user scraping stopped by user.");
          return { success: false, usernames: allMutedUsernames, count: totalCount, stoppedEarly: true, error: 'Process stopped by user' };
        }
        index++;
        let attempt = 0;
        let success = false;

        while (attempt < maxRetries && !success) {
          attempt++;
          log.info("scraping", `Fetching muted users page ${index}, attempt ${attempt}...`);

          try {
            const partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.MUTE, index);

            // Basic check if the response structure is as expected
            if (partialListObj && typeof partialListObj.isLast === 'boolean' && Array.isArray(partialListObj.authorNameList)) {
              if (partialListObj.authorNameList.length > 0) {
                allMutedUsernames.push(...partialListObj.authorNameList);
                // Assuming IDs and Names length match, count based on names found
                totalCount += partialListObj.authorNameList.length;
                log.info("scraping", `Found ${partialListObj.authorNameList.length} users on page ${index}. Total: ${totalCount}`);
              } else {
                log.info("scraping", `Found 0 users on page ${index}.`);
              }
              isLast = partialListObj.isLast;
              success = true; // Mark as successful fetch for this page

              // Report progress if callback is provided
              if (progressCallback && typeof progressCallback === 'function') {
                try {
                  progressCallback({ currentPage: index, currentCount: totalCount });
                } catch (cbError) {
                  log.err("scraping", `Progress callback error: ${cbError}`);
                }
              }

            } else {
              // Handle potential error case where partial function returns unexpected result
              log.warn("scraping", `Unexpected result fetching page ${index}, attempt ${attempt}.`);
              // Don't throw immediately, allow retry
            }
          } catch (err) {
            log.warn("scraping", `Error fetching page ${index}, attempt ${attempt}: ${err.message || err}`);
            // If it was the last attempt, rethrow to exit the main loop
            if (attempt >= maxRetries) {
                 throw new Error(`Failed to fetch page ${index} after ${maxRetries} attempts.`);
            }
            // Wait before retrying
            await utils.sleep(retryDelayMs);
          }
        } // End retry loop

        if (!success) {
            // If all retries failed for a page
            throw new Error(`Failed to fetch page ${index} definitively.`);
        }

        if (!isLast) {
          await utils.sleep(politeDelayMs); // Wait before fetching the next page
        }
      } // End page loop

      log.info("scraping", `Successfully scraped all muted users. Total count: ${totalCount}`);
      return { success: true, count: totalCount, usernames: allMutedUsernames };

    } catch (err) {
      log.err("scraping", `Error scraping all muted users: ${err.message || err}`);
      return { success: false, usernames: allMutedUsernames, count: totalCount, error: err.message || 'Unknown error during scraping' };
    }
  }

  // Scrapes all pages of blocked users
  async scrapeAllBlockedUsers(progressCallback) {
    log.info("scraping", "Starting to scrape all blocked users...");
    let scrapedUsernames = [];
    let scrapedUserIds = []; // Keep track of IDs if needed
    let isLast = false;
    let index = 0;
    let totalCount = 0;

    try {
      while (!isLast) {
        // Check for early stop request before fetching the next page
        if (programController.earlyStop) {
          log.info("scraping", "Blocked user scraping stopped early by user request.");
          // Return the count found so far
          return { success: false, usernames: scrapedUsernames, count: totalCount, stoppedEarly: true, error: "Process stopped by user" };
        }

        index++;
        log.info("scraping", `Fetching page ${index} of blocked users...`);
        let partialListObj;
        try {
          // Use USER target type
          partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.USER, index);
        } catch (pageError) {
          log.err("scraping", `Error fetching page ${index} of blocked users: ${pageError}`);
          // Stop on page error, return count found so far
          throw new Error(`Failed to fetch page ${index} of blocked users: ${pageError.message || pageError}`);
        }

        const partialNameList = partialListObj.authorNameList;
        const partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;

        scrapedUsernames.push(...partialNameList);
        scrapedUserIds.push(...partialIdList); // Store IDs if needed later
        totalCount += partialNameList.length;

        log.info("scraping", `Found ${partialNameList.length} blocked users on page ${index}. Total found: ${totalCount}`);

        // Call the progress callback if provided
        if (progressCallback && typeof progressCallback === 'function') {
          try {
            // Pass the current total count
            await progressCallback({ currentCount: totalCount });
          } catch (callbackError) {
            log.warn("scraping", `Error in progress callback for blocked users: ${callbackError}`);
            // Continue even if callback fails
          }
        }

        // Optional delay can be added here if needed: await utils.delay(config.scrapeDelayMs);
      }

      log.info("scraping", `Successfully scraped all ${totalCount} blocked users.`);
      return { success: true, usernames: scrapedUsernames, count: totalCount };

    } catch (err) {
      log.err("scraping", `Error during scrapeAllBlockedUsers: ${err}`);
      // Check if it was an early stop triggered by an error within the loop/page fetch
      if (programController.earlyStop) {
         // Return count found so far
         return { success: false, usernames: scrapedUsernames, count: totalCount, stoppedEarly: true, error: err.message || "Process stopped due to error" };
      }
      // Return count found so far even on other errors
      return { success: false, usernames: scrapedUsernames, count: totalCount, error: err.message || "Unknown error during scraping" };
    }
  }

  /**
   * Scrapes all pages of users whose titles are blocked from Ekşi Sözlük.
   * Handles pagination and polite delays, reporting progress via callback.
   * @param {function({currentPage: number, currentCount: number}): void} [progressCallback] - Optional callback for progress updates.
   * @returns {Promise<{success: boolean, count?: number, users?: {authorId: string, authorName: string}[], error?: string}>}
   */
  async scrapeAllUsersWithBlockedTitles(progressCallback) {
    log.info("scraping", "Starting to scrape all users with blocked titles...");
    let scrapedUsers = []; // Store objects with authorId and authorName
    let isLast = false;
    let index = 0;
    let totalCount = 0;
    const politeDelayMs = 500; // Delay between page requests in milliseconds

    try {
      while (!isLast) {
        // Check for early stop request before fetching the next page
        if (programController.earlyStop) {
          log.info("scraping", "Scraping users with blocked titles stopped early by user request.");
          // Return the count found so far
          return { success: false, users: scrapedUsers, count: totalCount, stoppedEarly: true, error: "Process stopped by user" };
        }

        index++;
        log.info("scraping", `Fetching page ${index} of users with blocked titles...`);
        let partialListObj;
        try {
          // Use TITLE target type
          partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.TITLE, index);
        } catch (pageError) {
          log.err("scraping", `Error fetching page ${index} of users with blocked titles: ${pageError}`);
          // Stop on page error, return count found so far
          throw new Error(`Failed to fetch page ${index} of users with blocked titles: ${pageError.message || pageError}`);
        }

        const partialNameList = partialListObj.authorNameList;
        const partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;

        // Add users to the list, storing both ID and Name
        for(let i = 0; i < partialIdList.length; i++) {
            scrapedUsers.push({ authorId: partialIdList[i], authorName: partialNameList[i] });
        }
        totalCount += partialIdList.length;


        log.info("scraping", `Found ${partialIdList.length} users with blocked titles on page ${index}. Total found: ${totalCount}`);

        // Call the progress callback if provided
        if (progressCallback && typeof progressCallback === 'function') {
          try {
            // Pass the current total count
            await progressCallback({ currentCount: totalCount });
          } catch (callbackError) {
            log.warn("scraping", `Error in progress callback for users with blocked titles: ${callbackError}`);
            // Continue even if callback fails
          }
        }

        // Optional delay can be added here if needed: await utils.delay(config.scrapeDelayMs);
        if (!isLast) {
           await utils.sleep(politeDelayMs); // Wait before fetching the next page
        }
      }

      log.info("scraping", `Successfully scraped all ${totalCount} users with blocked titles.`);
      return { success: true, users: scrapedUsers, count: totalCount };

    } catch (err) {
      log.err("scraping", `Error during scrapeAllUsersWithBlockedTitles: ${err}`);
      // Check if it was an early stop triggered by an error within the loop/page fetch
      if (programController.earlyStop) {
         // Return count found so far
         return { success: false, users: scrapedUsers, count: totalCount, stoppedEarly: true, error: err.message || "Process stopped due to error" };
      }
      // Return count found so far even on other errors
      return { success: false, users: scrapedUsers, count: totalCount, error: err.message || "Unknown error during scraping" };
    }
  }


  #scrapeFollowerPartially = async (scrapedRelations, authorName, index) =>
  {
    // index: integer(1...n) Scraping must be done with multiple requests, index indicates the number of the page to scrape
    // authorName: the author whose followers will be scraped
    // return: isLast: bool
    // return(err): true
    // note: isLast indicates that this is the last page and has no info
    
    let responseJson = "";
    try
    {
      // note: real url is like .../follower?nick=abcdefg&pageIndex=1&_=123456789
      // but i couldn't figure out what and where is the query parameter '_'
      // without this query parameter it works anyway at least for now.
      let targetUrl = `${config.EksiSozlukURL}/follower?nick=${authorName}&pageIndex=${index}`;
      let response = await fetch(targetUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      responseJson = await response.json();
      
      let authorNameList = [];
      let authorIdList = [];
      let authorNumber = responseJson.length;
      for(let i = 0; i < authorNumber; i++)
      {
        let authName = responseJson[i].Nick.Value;
        // replace every whitespace with - (eksisozluk.com convention)
        authName = authName.replace(/ /gi, "-");
        let authId = String(responseJson[i].Id);
        
        let doTheyFollowMe = responseJson[i].IsFollowCurrentUser;
        let doIFollow = responseJson[i].IsBuddy;
        
        scrapedRelations.set(authName, new Relation(authName, authId, null, null, null, doIFollow, doTheyFollowMe)); 
      }
      
      if(Number.isInteger(authorNumber) && authorNumber > 0)
        return false; // isLast
      else
        return true; // isLast
    }
    catch(err)
    {
      log.err("scraping", "scrapeFollowerPartially: " + err);
      return true; // isLast
    }
    
    
  }

  async scrapeFollower(authorName)
  {
    // authorName: the author whose followers will be scraped
    // return: map(authName, Relation)
    // return(err): map()
    
    // map: authorName - Relation
    let scrapedRelations = new Map();
    
    let isLast = false;
    let index = 0;
    while(!isLast)
    {
      index++;
      isLast = await this.#scrapeFollowerPartially(scrapedRelations, authorName, index);
    }
    
    return scrapedRelations;
  }

  #scrapeFollowingPartially = async (scrapedRelations, authorName, index) =>
  {
    // index: integer(1...n) Scraping must be done with multiple requests, index indicates the number of the page to scrape
    // authorName: the author whose followers will be scraped
    // return: isLast: bool
    // return(err): true
    // note: isLast indicates that this is the last page and has no info
    
    let responseJson = "";
    try
    {
      // note: real url is like .../following?nick=abcdefg&pageIndex=1&_=123456789
      // but i couldn't figure out what and where is the query parameter '_'
      // without this query parameter it works anyway at least for now.
      let targetUrl = `${config.EksiSozlukURL}/following?nick=${authorName}&pageIndex=${index}`;
      let response = await fetch(targetUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      responseJson = await response.json();
      
      let authorNameList = [];
      let authorIdList = [];
      let authorNumber = responseJson.length;
      for(let i = 0; i < authorNumber; i++)
      {
        let authName = responseJson[i].Nick.Value;
        // replace every whitespace with - (eksisozluk.com convention)
        authName = authName.replace(/ /gi, "-");
        let authId = String(responseJson[i].Id);
        
        let doTheyFollowMe = responseJson[i].IsFollowCurrentUser;
        let doIFollow = responseJson[i].IsBuddy;
        
        scrapedRelations.set(authName, new Relation(authName, authId, null, null, null, doIFollow, doTheyFollowMe)); 
      }
      
      if(Number.isInteger(authorNumber) && authorNumber > 0)
        return false; // isLast
      else
        return true; // isLast
    }
    catch(err)
    {
      log.err("scraping", "scrapeFollowingPartially: " + err);
      return true; // isLast
    }
    
    
  }

  async scrapeFollowing(authorName)
  {
    // authorName: the author following the authors to be scraped
    // return: map(authName, Relation)
    // return(err): map()
    
    // map: authorName - Relation
    let scrapedRelations = new Map();
    
    let isLast = false;
    let index = 0;
    while(!isLast)
    {
      index++;
      isLast = await this.#scrapeFollowingPartially(scrapedRelations, authorName, index);
    }
    
    return scrapedRelations;
  }

  scrapeAuthorIdFromAuthorProfilePage = async (authorName) =>
  {
    // authorName: string, name of the author to scrape his/her id
    // return: string, id of the author
    // note: if fails, returned value will be '0'
    
    try
    {
      let targetUrl = config.EksiSozlukURL + "/biri/" + authorName;
      let response = await fetch(targetUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      if(!response.ok)
        throw "fetch ok: " + response.ok + ", status: " + response.status;
      let responseText = await response.text();
      
      // parse string response as html document
      let dom = new JSDOM(responseText);
      let authorId = dom.window.document.getElementById("who").getAttribute("value"); 
      return authorId;
    }
    catch(err)
    {
      log.err("scraping", "scrapeAuthorIdFromAuthorProfilePage: authorName: " + authorName + ", err: " + err);
      return "0";
    }
  }
  
  #scrapeAuthorsFromTitlePartially = async (scrapedRelations, titleName, titleId, timeSpecifier, index) =>
  {
    // index: integer(1...n) Scraping must be done with multiple requests, index indicates the number of the page to scrape
    // titleName: string, name of the title from which users who wrote an entry will be scraped
    // titleId: string,  name of the corresponding title
    // timeSpecifier: enum
    // return: isLast: bool
    // return(err): true
    // note: isLast indicates that this is the last page and has no info
    
    try
    {
      let targetUrl = "";
      if(timeSpecifier == enums.TimeSpecifier.ALL)
        targetUrl = config.EksiSozlukURL + "/" + titleName + "--" + titleId + "?p=" + index;
      else if(timeSpecifier == enums.TimeSpecifier.LAST_24_H)
        targetUrl = config.EksiSozlukURL + "/" + titleName + "--" + titleId + "?a=dailynice&p=" + index;
      let response = await fetch(targetUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      if(!response.ok)
        throw "fetch ok: " + response.ok + ", status: " + response.status;
      let responseText = await response.text();
      
      // parse string response as html document
      let dom = new JSDOM(responseText);
      let contentHTMLCollection = dom.window.document.getElementsByClassName("content");
      for(let i = 0; i < contentHTMLCollection.length; i++)
      {
        let name = contentHTMLCollection[i].parentNode.getAttribute("data-author"); 
        name = name.replace(/ /gi, "-");
        let id = contentHTMLCollection[i].parentNode.getAttribute("data-author-id");
        
        if(!scrapedRelations.has(name))
          scrapedRelations.set(name, new Relation(name, id));    
      }
      
      // this if-else logic copied from other functions, 
      // but eksisozluk returns 404 when there is no record in a page and catch block catches as error
      if(Number.isInteger(contentHTMLCollection.length) && contentHTMLCollection.length > 0)
        return false; // isLast
      else
        return true; // isLast
    }
    catch(err)
    {
      // eksisozluk returns 404 when there is no record in a page and catch block catches as error
      // that is why this is not logged as error, TODO: additional error detecting algorithm may be applied here to distinguish real errors
      log.info("scraping", "scrapeAuthorsFromTitle: title: " + titleName + "--" + titleId + ", err: " + err);
      return true; // isLast
    }
    
  }
  
  async scrapeAuthorsFromTitle(titleName, titleId, timeSpecifier)
  {
    // titleName: string, name of the title from which users who wrote an entry will be scraped
    // titleId: string,  name of the corresponding title
    // timeSpecifier: enum
    // return: map(authName, Relation)
    // return(err): map()
   
    // map: authorName - Relation
    let scrapedRelations = new Map();
    
    let isLast = false;
    let index = 0;
    while(!isLast)
    {
      index++;
      isLast = await this.#scrapeAuthorsFromTitlePartially(scrapedRelations, titleName, titleId, timeSpecifier, index);
    }
    
    return scrapedRelations;   
  }
  
  // Scrape the relationship status of an author (muted, blocked, etc.)
  async scrapeAuthorRelationship(authorId) {
    try {
      // First check if the author is in the muted list
      const mutedUsers = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.MUTE, 1);
      const mutedIds = mutedUsers.authorIdList;
      
      // Check if the author is in the blocked users list
      const blockedUsers = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.USER, 1);
      const blockedIds = blockedUsers.authorIdList;
      
      // Check if the author has blocked titles
      const blockedTitles = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.TITLE, 1);
      const blockedTitleIds = blockedTitles.authorIdList;
      
      // Create a relationship object
      const isMuted = mutedIds.includes(authorId);
      const isBlocked = blockedIds.includes(authorId);
      const hasTitleBlocked = blockedTitleIds.includes(authorId);
      
      // Find the author name from the appropriate list
      let authorName = "";
      if (isMuted) {
        const index = mutedIds.indexOf(authorId);
        if (index !== -1) {
          authorName = mutedUsers.authorNameList[index];
        }
      } else if (isBlocked) {
        const index = blockedIds.indexOf(authorId);
        if (index !== -1) {
          authorName = blockedUsers.authorNameList[index];
        }
      } else if (hasTitleBlocked) {
        const index = blockedTitleIds.indexOf(authorId);
        if (index !== -1) {
          authorName = blockedTitles.authorNameList[index];
        }
      }
      
      return new Relation(
        authorName,
        authorId,
        isBlocked,    // isBannedUser
        hasTitleBlocked, // isBannedTitle
        isMuted,      // isBannedMute
        false,        // doIFollow (not checked)
        false         // doTheyFollowMe (not checked)
      );
    } catch (err) {
      log.err("scraping", `scrapeAuthorRelationship: authorId: ${authorId}, err: ${err}`);
      return null;
    }
  }

  /**
   * Scrapes a single page of muted users from Ekşi Sözlük.
   * @param {number} pageIndex - The index of the page to scrape (1-based).
   * @returns {Promise<{authorIdList: string[], authorNameList: string[], isLast: bool}>}
   * @throws {Error} If the scraping fails.
   */
  async scrapeMutedUsersPage(pageIndex) {
    log.info("scraping", `Scraping muted users page ${pageIndex}...`);
    try {
      // Call the private method with the MUTE target type
      const partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.MUTE, pageIndex);
      return partialListObj;
    } catch (error) {
      log.err("scraping", `Error in scrapeMutedUsersPage for page ${pageIndex}: ${error.message || error}`);
      throw error; // Re-throw the error
    }
  }
}

export let scrapingHandler = new ScrapingHandler();
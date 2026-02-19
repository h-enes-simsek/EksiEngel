import {log} from './log.js';
import * as enums from './enums.js';
import {JSDOM} from './jsdom.js';
import {config} from './config.js';
import * as utils from './utils.js';
import { programController } from './programController.js';
import { resumableOperationRegistry } from './resumableOperation.js';

function Relation(authorName, authorId, isBannedUser, isBannedTitle, isBannedMute, doIFollow, doTheyFollowMe) {
  this.authorId = authorId;
  this.authorName = authorName;
  
  this.isBannedUser = isBannedUser;
  this.isBannedTitle = isBannedTitle;
  this.isBannedMute = isBannedMute;
  
  this.doIFollow = doIFollow;
  this.doTheyFollowMe = doTheyFollowMe;
}

class ScrapingHandler
{
  #fetchEksiSozluk = async (url) => {
    let responseText = "";
    try {
      let response = await fetch(url, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      responseText = await response.text();
      return responseText;
    } catch(err) {
      throw new Error(err);
    }
  }

  scrapeUserAgent = () => navigator.userAgent;
  
  scrapeClientNameAndId = async () => {
    let responseText = "";
    try {
      responseText = await this.#fetchEksiSozluk(config.EksiSozlukURL);
    } catch(err) {
      log.err("scraping", "scrapeClientName: " + err);
      return {clientName:"", clientId:""};
    }
    
    let clientName = "";
    try {
      let dom = new JSDOM(responseText);
      let cName = dom.window.document.querySelector(".mobile-notification-icons").querySelector(".mobile-only a").title;
      if(cName && cName !== null && cName !== undefined) {
        cName = cName.replace(/ /gi, "-");
        clientName = cName;
      }
      
      log.info("scraping", "clientName: " + clientName);
    } catch(err) {
      log.err("scraping", "scrapeClientName: " + err);
      return {clientName:"", clientId:""};
    }

    let clientId = await this.scrapeAuthorIdFromAuthorProfilePage(clientName);
    if(clientId == 0)
      return {clientName:"", clientId:""};
    else 
      return {clientName, clientId};
  }

  scrapeMetaDataFromEntryPage = async (entryUrl) => {
    let responseText = "";
    try {
      let response = await fetch(entryUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      responseText = await response.text();
    } catch(err) {
      log.err("scraping", "scrapeMetaDataFromEntryPage: " + err);
      return {entryId:"0", authorId:"0", authorName:"", titleId:"0", titleName:""};
    }
    
    try {
      let dom = new JSDOM(responseText);
      let entryElement = dom.window.document.getElementById("entry-item-list").querySelector("li");
      
      let authorId = entryElement.getAttribute("data-author-id");
      let authorName = entryElement.getAttribute("data-author");
      authorName = authorName.replace(/ /gi, "-");
      let entryId = entryUrl.match(/(\d+)(?!.*\d)/g).join("");
      let titleId =  dom.window.document.getElementById("title").getAttribute("data-id");
      let titleName =  dom.window.document.getElementById("title").getAttribute("data-title");
      titleName = titleName.replace(/ /gi, "-");
      
      return {entryId:entryId, authorId:authorId, authorName:authorName, titleId:titleId, titleName:titleName};
    } catch(err) {
      log.err("scraping", "scrapeMetaDataFromEntryPage: " + err);
      return {entryId:0, authorId:0, authorName:"", titleId:0, titleName:""};
    }
  }
  
  async scrapeAuthorNamesFromFavs(entryUrl) {
    let scrapedRelations = new Map();
    let responseText = "";
    try {
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
    } catch(err) {
      log.err("scraping", "scrapeAuthorNamesFromFavs: " + err);
      return new Map();
    }
    
    try {
      let dom = new JSDOM(responseText);
      let authListNodeList = dom.window.document.querySelectorAll("a");

      for(let i = 0; i < authListNodeList.length; i++) {
        let val = authListNodeList[i].innerHTML;
        
        if(val && i == authListNodeList.length-1) {
          if(val.includes("çaylak"))
            continue
        }
        
        if(val) { 
          val = val.substr(1);
          val = val.replace(/ /gi, "-");
          scrapedRelations.set(val, new Relation(val, null, null, null, null, null, null)); 
        }
      }
    } catch(err) {
      log.err("scraping", "scrapeAuthorNamesFromFavs: " + err);
      return new Map();
    }

    if(config.enableNoobBan) {
      let responseTextNoob = "";
      try {
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
      } catch(err) {
        log.err("scraping", "scrapeAuthorNamesFromFavs: " + err);
        return new Map();
      }
      
      try {
        let dom = new JSDOM(responseTextNoob);
        let authListNodeList = dom.window.document.querySelectorAll("a");

        for(let i = 0; i < authListNodeList.length; i++) {
          let val = authListNodeList[i].innerHTML;
          if (val) { 
            val = val.substr(1);
            val = val.replace(/ /gi, "-");
            scrapedRelations.set(val, new Relation(val, null, null, null, null, null, null)); 
          }
        }
      } catch(err) {
        log.err("scraping", "(noob) scrapeAuthorNamesFromFavs: " + err);
        return new Map();
      }
    }
    
    return scrapedRelations;
  }

  #scrapeAuthorNamesFromBannedAuthorPagePartially = async (targetType, index) => {
    let targetTypeTextInURL = "";
    if(targetType == enums.TargetType.USER)
      targetTypeTextInURL = "m";
    else if(targetType == enums.TargetType.TITLE)
      targetTypeTextInURL = "i";
    else if(targetType == enums.TargetType.MUTE)
      targetTypeTextInURL = "u";
    
    let responseJson = "";
    try {
      let targetUrl = `${config.EksiSozlukURL}/relation-list?relationType=${targetTypeTextInURL}&pageIndex=${index}`;
      let response = await fetch(targetUrl, {
        method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest'
          }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText} for URL: ${targetUrl}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
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
      for(let i = 0; i < authorNumber; i++) {
        let authName = responseJson.Relations.Items[i].Nick.Value;
        authorNameList[i] = authName.replace(/ /gi, "-");
        authorIdList[i] = String(responseJson.Relations.Items[i].Id);
      }
      
      return {authorIdList: authorIdList, authorNameList: authorNameList, isLast: isLast};
    } catch(err) {
      log.err("scraping", `#scrapeAuthorNamesFromBannedAuthorPagePartially failed for page ${index}, type ${targetTypeTextInURL}: ${err}`);
      throw new Error(`Failed to scrape page ${index} for type ${targetTypeTextInURL}: ${err.message || err}`);
    }
  }
  
  async scrapeBlockedUsersFirstPage() {
    log.info("scraping", "Fetching first page of blocked users only");
    let scrapedRelations = new Map();
    
    try {
      const partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.USER, 1);
      const partialNameList = partialListObj.authorNameList;
      const partialIdList = partialListObj.authorIdList;
      
      for (let index = 0; index < partialIdList.length; ++index) {
        const id = partialIdList[index];
        const name = partialNameList[index];
        scrapedRelations.set(name, new Relation(name, id, true, false, false));
      }
      
      log.info("scraping", `Found ${scrapedRelations.size} blocked users on first page`);
      return scrapedRelations;
    } catch(err) {
      log.err("scraping", "scrapeBlockedUsersFirstPage: " + err);
      return scrapedRelations;
    }
  }
  
  async scrapeBlockedTitlesFirstPage(pageNumber = 1) {
    log.info("scraping", `Fetching page ${pageNumber} of blocked titles`);
    let scrapedRelations = new Map();
    
    try {
      const partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.TITLE, pageNumber);
      const partialNameList = partialListObj.authorNameList;
      const partialIdList = partialListObj.authorIdList;
      
      for (let index = 0; index < partialIdList.length; ++index) {
        const id = partialIdList[index];
        const name = partialNameList[index];
        
        if (!id || !name) {
          log.warn("scraping", `Skipping entry with missing data: id=${id}, name=${name}`);
          continue;
        }
        
        const relation = new Relation(name, id, false, true, false);
        relation.titleId = id;
        relation.titleName = name;
        scrapedRelations.set(name, relation);
      }
      
      log.info("scraping", `Found ${scrapedRelations.size} blocked titles on page ${pageNumber}`);
      return scrapedRelations;
    } catch(err) {
      log.err("scraping", `scrapeBlockedTitlesFirstPage (page ${pageNumber}): ${err}`);
      return scrapedRelations;
    }
  }
  
  async scrapeTitleIdForAuthor(authorId) {
    try {
      log.info("scraping", `Using author ID ${authorId} as title ID`);
      return authorId;
    } catch (error) {
      log.err("scraping", `Error in scrapeTitleIdForAuthor: ${error}`);
      return null;
    }
  }
  
  async scrapeAuthorNamesFromBannedAuthorPage() {
    let scrapedRelations = new Map();
    
    try {
      let bannedAuthIdList = [];
      let bannedAuthNameList = [];
      let bannedTitleIdList = [];
      let bannedTitleNameList = [];
      let bannedMuteIdList = [];
      let bannedMuteNameList = [];
      
      let isLast = false;
      let index = 0;
      while(!isLast) {
        index++;
        let partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.USER, index);
        let partialNameList = partialListObj.authorNameList;
        let partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;
        
        bannedAuthNameList.push(...partialNameList);
        bannedAuthIdList.push(...partialIdList);
      }
      
      for (let index = 0; index < bannedAuthIdList.length; ++index) {
        const id = bannedAuthIdList[index];
        const name = bannedAuthNameList[index];
        scrapedRelations.set(name, new Relation(name, id, true, false, false));        
      }
      
      isLast = false;
      index = 0;
      while(!isLast) {
        index++;
        let partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.TITLE, index);
        let partialNameList = partialListObj.authorNameList;
        let partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;
        
        bannedTitleNameList.push(...partialNameList);
        bannedTitleIdList.push(...partialIdList);
      }
      
      for (let index = 0; index < bannedTitleIdList.length; ++index) {
        const id = bannedTitleIdList[index];
        const name = bannedTitleNameList[index];
        if(scrapedRelations.has(name))
          scrapedRelations.get(name).isBannedTitle = true;
        else
          scrapedRelations.set(name, new Relation(name, id, false, true, false));        
      }
      
      isLast = false;
      index = 0;
      while(!isLast) {
        index++;
        let partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.MUTE, index);
        let partialNameList = partialListObj.authorNameList;
        let partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;
        
        bannedMuteNameList.push(...partialNameList);
        bannedMuteIdList.push(...partialIdList);
      }
      
      for (let index = 0; index < bannedMuteIdList.length; ++index) {
        const id = bannedMuteIdList[index];
        const name = bannedMuteNameList[index];
        if(scrapedRelations.has(name))
          scrapedRelations.get(name).isBannedMute = true;
        else
          scrapedRelations.set(name, new Relation(name, id, false, false, true));        
      }
      
      return scrapedRelations;
    } catch(err) {
      log.err("scraping", "scrapeAuthorNamesFromBannedAuthorPage: " + err);
      return scrapedRelations;
    }
  }

  /**
   * Scrapes all muted users with checkpoint support for pause/resume
   * @param {Function} progressCallback - Callback for progress updates
   * @param {number} resumeFromIndex - Page index to resume from (deprecated, use initialState)
   * @param {Function} shouldStopCallback - Callback to check if should stop
   * @param {Function} checkpointCallback - Callback to save checkpoint state periodically
   * @param {Object} initialState - Initial state for resume (scrapedUsers, currentPage, totalCount)
   * @returns {Promise<Object>} - Result with usernames, count, and state
   */
  async scrapeAllMutedUsers(progressCallback, resumeFromIndex = null, shouldStopCallback = null, checkpointCallback = null, initialState = null) {
    log.info("scraping", "Starting to scrape all muted users...");
    // Support both legacy resumeFromIndex and new initialState
    let allMutedUsernames = initialState?.scrapedUsers || [];
    let totalCount = initialState?.totalCount || 0;
    let index = initialState?.currentPage || (resumeFromIndex || 0);
    let isLast = false;
    const politeDelayMs = 500;
    const maxRetries = 3;
    const retryDelayMs = 1000;
    const rateLimitDelayMs = 65000;

    try {
      while (!isLast) {
        if (programController.earlyStop) {
          log.info("scraping", "Muted user scraping stopped by user.");
          return { success: false, usernames: allMutedUsernames, count: totalCount, stoppedEarly: true, paused: false, error: 'Process stopped by user' };
        }
        
        // Check if pause/stop is requested via callback
        if (shouldStopCallback && typeof shouldStopCallback === 'function') {
          const shouldStop = await shouldStopCallback();
          if (shouldStop) {
            log.info("scraping", "Muted user scraping stopped by pause/stop request.");
            // Distinguish between pause and early stop
            // If earlyStop is true, it's an early stop. Otherwise, it's a pause.
            const isPaused = !programController.earlyStop;
            
            // If paused, call checkpointReached to resolve the pause promise
            if (isPaused) {
              await resumableOperationRegistry.checkpointReached({
                stage: 'FETCH_USERS',
                collectedUsers: allMutedUsernames,
                userCount: totalCount,
                currentPage: index,
                source: 'MUTED_USERS'
              });
            }
            
            return { 
              success: false, 
              usernames: allMutedUsernames, 
              count: totalCount, 
              stoppedEarly: !isPaused, 
              paused: isPaused, 
              error: isPaused ? 'Process paused by user' : 'Process stopped by user',
              // Return state for resume
              state: {
                scrapedUsers: allMutedUsernames,
                currentPage: index,
                totalCount: totalCount
              }
            };
          }
        }
        
        index++;
        let attempt = 0;
        let success = false;

        while (attempt < maxRetries && !success) {
          attempt++;
          log.info("scraping", `Fetching muted users page ${index}, attempt ${attempt}...`);

          try {
            const partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.MUTE, index);

            if (partialListObj && typeof partialListObj.isLast === 'boolean' && Array.isArray(partialListObj.authorNameList)) {
              if (partialListObj.authorNameList.length > 0) {
                allMutedUsernames.push(...partialListObj.authorNameList);
                totalCount += partialListObj.authorNameList.length;
                log.info("scraping", `Found ${partialListObj.authorNameList.length} users on page ${index}. Total: ${totalCount}`);
              } else {
                log.info("scraping", `Found 0 users on page ${index}.`);
              }
              isLast = partialListObj.isLast;
              success = true;

              if (progressCallback && typeof progressCallback === 'function') {
                try {
                  await progressCallback({ currentPage: index, currentCount: totalCount, newUsernames: partialListObj.authorNameList });
                } catch (cbError) {
                  log.err("scraping", `Progress callback error: ${cbError}`);
                }
              }
              
              // Call checkpoint callback after each page for periodic state saving
              if (checkpointCallback && typeof checkpointCallback === 'function') {
                try {
                  await checkpointCallback({
                    scrapedUsers: allMutedUsernames,
                    currentPage: index,
                    totalCount: totalCount
                  });
                } catch (cpError) {
                  log.warn("scraping", `Checkpoint callback error: ${cpError}`);
                }
              }
            } else {
              log.warn("scraping", `Unexpected result fetching page ${index}, attempt ${attempt}.`);
            }
          } catch (err) {
            log.warn("scraping", `Error fetching page ${index}, attempt ${attempt}: ${err.message || err}`);
            if (attempt >= maxRetries) {
                 throw new Error(`Failed to fetch page ${index} after ${maxRetries} attempts.`);
            }
            await utils.sleep(retryDelayMs);
          }
        }

        if (!success) {
            throw new Error(`Failed to fetch page ${index} definitively.`);
        }

        if (!isLast) {
          await utils.sleep(politeDelayMs);
        }
      }

      log.info("scraping", `Successfully scraped all muted users. Total count: ${totalCount}`);
      return { success: true, count: totalCount, usernames: allMutedUsernames };

    } catch (err) {
      log.err("scraping", `Error scraping all muted users: ${err.message || err}`);
      return { success: false, usernames: allMutedUsernames, count: totalCount, error: err.message || 'Unknown error during scraping' };
    }
  }

  /**
   * Scrapes all blocked users with checkpoint support for pause/resume
   * @param {Function} progressCallback - Callback for progress updates
   * @param {number} resumeFromIndex - Page index to resume from (deprecated, use initialState)
   * @param {Function} shouldStopCallback - Callback to check if should stop
   * @param {Function} checkpointCallback - Callback to save checkpoint state periodically
   * @param {Object} initialState - Initial state for resume (scrapedUsers, currentPage, totalCount)
   * @returns {Promise<Object>} - Result with usernames, count, and state
   */
  async scrapeAllBlockedUsers(progressCallback, resumeFromIndex = null, shouldStopCallback = null, checkpointCallback = null, initialState = null) {
    log.info("scraping", "Starting to scrape all blocked users...");
    // Support both legacy resumeFromIndex and new initialState
    let scrapedUsernames = initialState?.scrapedUsers || [];
    let scrapedUserIds = [];
    let isLast = false;
    let index = initialState?.currentPage || (resumeFromIndex || 0);
    let totalCount = initialState?.totalCount || 0;

    try {
      while (!isLast) {
        if (programController.earlyStop) {
          log.info("scraping", "Blocked user scraping stopped early by user request.");
          return { success: false, usernames: scrapedUsernames, count: totalCount, stoppedEarly: true, paused: false, error: "Process stopped by user" };
        }
        
        // Check if pause/stop is requested via callback
        if (shouldStopCallback && typeof shouldStopCallback === 'function') {
          const shouldStop = await shouldStopCallback();
          if (shouldStop) {
            log.info("scraping", "Blocked user scraping stopped by pause/stop request.");
            // Distinguish between pause and early stop
            // If earlyStop is true, it's an early stop. Otherwise, it's a pause.
            const isPaused = !programController.earlyStop;
            
            // If paused, call checkpointReached to resolve the pause promise
            if (isPaused) {
              await resumableOperationRegistry.checkpointReached({
                stage: 'FETCH_USERS',
                collectedUsers: scrapedUsernames,
                userCount: totalCount,
                currentPage: index,
                source: 'BLOCKED_USERS'
              });
            }
            
            return { 
              success: false, 
              usernames: scrapedUsernames, 
              count: totalCount, 
              stoppedEarly: !isPaused, 
              paused: isPaused, 
              error: isPaused ? 'Process paused by user' : 'Process stopped by user',
              // Return state for resume
              state: {
                scrapedUsers: scrapedUsernames,
                currentPage: index,
                totalCount: totalCount
              }
            };
          }
        }

        index++;
        log.info("scraping", `Fetching page ${index} of blocked users...`);
        let partialListObj;
        try {
          partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.USER, index);
        } catch (pageError) {
          log.err("scraping", `Error fetching page ${index} of blocked users: ${pageError}`);
          throw new Error(`Failed to fetch page ${index} of blocked users: ${pageError.message || pageError}`);
        }

        const partialNameList = partialListObj.authorNameList;
        const partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;

        scrapedUsernames.push(...partialNameList);
        scrapedUserIds.push(...partialIdList);
        totalCount += partialNameList.length;

        log.info("scraping", `Found ${partialNameList.length} blocked users on page ${index}. Total found: ${totalCount}`);

        if (progressCallback && typeof progressCallback === 'function') {
          try {
            await progressCallback({ currentCount: totalCount, newUsernames: partialNameList });
          } catch (callbackError) {
            log.warn("scraping", `Error in progress callback for blocked users: ${callbackError}`);
          }
        }
        
        // Call checkpoint callback after each page for periodic state saving
        if (checkpointCallback && typeof checkpointCallback === 'function') {
          try {
            await checkpointCallback({
              scrapedUsers: scrapedUsernames,
              currentPage: index,
              totalCount: totalCount
            });
          } catch (cpError) {
            log.warn("scraping", `Checkpoint callback error: ${cpError}`);
          }
        }
      }

      log.info("scraping", `Successfully scraped all ${totalCount} blocked users.`);
      return { success: true, usernames: scrapedUsernames, count: totalCount };

    } catch (err) {
      log.err("scraping", `Error during scrapeAllBlockedUsers: ${err}`);
      if (programController.earlyStop) {
         return { success: false, usernames: scrapedUsernames, count: totalCount, stoppedEarly: true, error: err.message || "Process stopped due to error" };
      }
      return { success: false, usernames: scrapedUsernames, count: totalCount, error: err.message || "Unknown error during scraping" };
    }
  }

  async scrapeAllUsersWithBlockedTitles(progressCallback) {
    log.info("scraping", "Starting to scrape all users with blocked titles...");
    let scrapedUsers = [];
    let isLast = false;
    let index = 0;
    let totalCount = 0;
    const politeDelayMs = 500;

    try {
      while (!isLast) {
        if (programController.earlyStop) {
          log.info("scraping", "Scraping users with blocked titles stopped early by user request.");
          return { success: false, users: scrapedUsers, count: totalCount, stoppedEarly: true, error: "Process stopped by user" };
        }

        index++;
        log.info("scraping", `Fetching page ${index} of users with blocked titles...`);
        let partialListObj;
        try {
          partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.TITLE, index);
        } catch (pageError) {
          log.err("scraping", `Error fetching page ${index} of users with blocked titles: ${pageError}`);
          throw new Error(`Failed to fetch page ${index} of users with blocked titles: ${pageError.message || pageError}`);
        }

        const partialNameList = partialListObj.authorNameList;
        const partialIdList = partialListObj.authorIdList;
        isLast = partialListObj.isLast;

        for(let i = 0; i < partialIdList.length; i++) {
            scrapedUsers.push({ authorId: partialIdList[i], authorName: partialNameList[i] });
        }
        totalCount += partialIdList.length;

        log.info("scraping", `Found ${partialIdList.length} users with blocked titles on page ${index}. Total found: ${totalCount}`);

        if (progressCallback && typeof progressCallback === 'function') {
          try {
            await progressCallback({ currentCount: totalCount, newUsernames: partialNameList });
          } catch (callbackError) {
            log.warn("scraping", `Error in progress callback for users with blocked titles: ${callbackError}`);
          }
        }

        if (!isLast) {
           await utils.sleep(politeDelayMs);
        }
      }

      log.info("scraping", `Successfully scraped all ${totalCount} users with blocked titles.`);
      return { success: true, users: scrapedUsers, count: totalCount };

    } catch (err) {
      log.err("scraping", `Error during scrapeAllUsersWithBlockedTitles: ${err}`);
      if (programController.earlyStop) {
         return { success: false, users: scrapedUsers, count: totalCount, stoppedEarly: true, error: err.message || "Process stopped due to error" };
      }
      return { success: false, users: scrapedUsers, count: totalCount, error: err.message || "Unknown error during scraping" };
    }
  }

  #scrapeFollowerPartially = async (scrapedRelations, authorName, index) => {
    let responseJson = "";
    try {
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
      for(let i = 0; i < authorNumber; i++) {
        let authName = responseJson[i].Nick.Value;
        authName = authName.replace(/ /gi, "-");
        let authId = String(responseJson[i].Id);
        
        let doTheyFollowMe = responseJson[i].IsFollowCurrentUser;
        let doIFollow = responseJson[i].IsBuddy;
        
        scrapedRelations.set(authName, new Relation(authName, authId, null, null, null, doIFollow, doTheyFollowMe)); 
      }
      
      if(Number.isInteger(authorNumber) && authorNumber > 0)
        return false;
      else
        return true;
    } catch(err) {
      log.err("scraping", "scrapeFollowerPartially: " + err);
      return true;
    }
  }

  async scrapeFollower(authorName) {
    let scrapedRelations = new Map();
    
    let isLast = false;
    let index = 0;
    while(!isLast) {
      index++;
      isLast = await this.#scrapeFollowerPartially(scrapedRelations, authorName, index);
    }
    
    return scrapedRelations;
  }

  #scrapeFollowingPartially = async (scrapedRelations, authorName, index) => {
    let responseJson = "";
    try {
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
      for(let i = 0; i < authorNumber; i++) {
        let authName = responseJson[i].Nick.Value;
        authName = authName.replace(/ /gi, "-");
        let authId = String(responseJson[i].Id);
        
        let doTheyFollowMe = responseJson[i].IsFollowCurrentUser;
        let doIFollow = responseJson[i].IsBuddy;
        
        scrapedRelations.set(authName, new Relation(authName, authId, null, null, null, doIFollow, doTheyFollowMe)); 
      }
      
      if(Number.isInteger(authorNumber) && authorNumber > 0)
        return false;
      else
        return true;
    } catch(err) {
      log.err("scraping", "scrapeFollowingPartially: " + err);
      return true;
    }
  }

  async scrapeFollowing(authorName) {
    let scrapedRelations = new Map();
    
    let isLast = false;
    let index = 0;
    while(!isLast) {
      index++;
      isLast = await this.#scrapeFollowingPartially(scrapedRelations, authorName, index);
    }
    
    return scrapedRelations;
  }

  scrapeAuthorIdFromAuthorProfilePage = async (authorName) => {
    try {
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
      
      let dom = new JSDOM(responseText);
      let authorId = dom.window.document.getElementById("who").getAttribute("value"); 
      return authorId;
    } catch(err) {
      log.err("scraping", "scrapeAuthorIdFromAuthorProfilePage: authorName: " + authorName + ", err: " + err);
      return "0";
    }
  }

  /**
   * Scrapes the registration date from a user's profile page
   * @param {string} authorName - The username to look up
   * @returns {Promise<string|null>} - ISO date string of registration date, or null if not found
   */
  scrapeRegistrationDate = async (authorName) => {
    try {
      let targetUrl = config.EksiSozlukURL + "/biri/" + authorName;
      let response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest'
        }
      });
      if (!response.ok) {
        throw new Error(`fetch ok: ${response.ok}, status: ${response.status}`);
      }
      let responseText = await response.text();
      
      let dom = new JSDOM(responseText);
      
      // Try multiple selectors to find the registration date
      // Common patterns on Ekşi Sözlük profile pages
      let regDateElement = null;
      
      // Try to find by common patterns
      const possibleSelectors = [
        '.recorddate',  // Ekşi Sözlük profile page registration date
        '[data-registration-date]',
        '.registration-date',
        '.user-registration-date',
        '.profile-info .date',
        '.user-info [title*="kayıt"]',
        '.user-info [title*="katılım"]'
      ];
      
      for (const selector of possibleSelectors) {
        try {
          regDateElement = dom.window.document.querySelector(selector);
          if (regDateElement) break;
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // If not found by attribute, try to find by text content patterns
      if (!regDateElement) {
        const allElements = dom.window.document.querySelectorAll('*');
        for (const el of allElements) {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('kayıt tarihi') || text.includes('katılım tarihi')) {
            // Look for a sibling or parent that contains the date
            const parent = el.parentElement;
            if (parent) {
              const dateEl = parent.querySelector('time, .date, [datetime]');
              if (dateEl) {
                regDateElement = dateEl;
                break;
              }
            }
          }
        }
      }
      
      if (regDateElement) {
        // Try to get date from datetime attribute or text content
        const dateStr = regDateElement.getAttribute('datetime') || 
                       regDateElement.getAttribute('data-date') || 
                       regDateElement.textContent?.trim();
        
        if (dateStr) {
          // Parse Turkish date format (DD.MM.YYYY or similar)
          const parsedDate = utils.parseTurkishDate(dateStr);
          if (parsedDate) {
            log.info("scraping", `Registration date for ${authorName}: ${parsedDate.toISOString()}`);
            return parsedDate.toISOString();
          }
        }
      }
      
      log.warn("scraping", `Could not find registration date for ${authorName}`);
      return null;
    } catch (err) {
      log.err("scraping", `scrapeRegistrationDate: authorName: ${authorName}, err: ${err}`);
      return null;
    }
  }

  /**
   * Scrapes registration dates for multiple users in batches
   * @param {string[]} authorNames - Array of usernames
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Map<string, string|null>>} - Map of username to registration date
   */
  scrapeRegistrationDatesBatch = async (authorNames, progressCallback = null) => {
    const results = new Map();
    const delayBetweenRequests = 100; // ms to be polite
    
    log.info("scraping", `Starting batch registration date scrape for ${authorNames.length} users`);
    
    for (let i = 0; i < authorNames.length; i++) {
      const authorName = authorNames[i];
      
      if (programController.earlyStop) {
        log.info("scraping", "Batch registration date scraping stopped early");
        break;
      }
      
      try {
        const regDate = await this.scrapeRegistrationDate(authorName);
        results.set(authorName, regDate);
        
        if (progressCallback && typeof progressCallback === 'function') {
          progressCallback({
            current: i + 1,
            total: authorNames.length,
            currentUser: authorName,
            date: regDate
          });
        }
        
        // Add delay between requests to avoid rate limiting
        if (i < authorNames.length - 1) {
          await utils.sleep(delayBetweenRequests);
        }
      } catch (err) {
        log.err("scraping", `Error scraping registration date for ${authorName}: ${err}`);
        results.set(authorName, null);
      }
    }
    
    log.info("scraping", `Batch registration date scrape complete. Found dates for ${
      Array.from(results.values()).filter(d => d !== null).length
    }/${authorNames.length} users`);
    
    return results;
  }
  
  #scrapeAuthorsFromTitlePartially = async (scrapedRelations, titleName, titleId, timeSpecifier, index) => {
    try {
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
      
      let dom = new JSDOM(responseText);
      let contentHTMLCollection = dom.window.document.getElementsByClassName("content");
      for(let i = 0; i < contentHTMLCollection.length; i++) {
        let name = contentHTMLCollection[i].parentNode.getAttribute("data-author"); 
        name = name.replace(/ /gi, "-");
        let id = contentHTMLCollection[i].parentNode.getAttribute("data-author-id");
        
        if(!scrapedRelations.has(name))
          scrapedRelations.set(name, new Relation(name, id));    
      }
      
      if(Number.isInteger(contentHTMLCollection.length) && contentHTMLCollection.length > 0)
        return false;
      else
        return true;
    } catch(err) {
      log.info("scraping", "scrapeAuthorsFromTitle: title: " + titleName + "--" + titleId + ", err: " + err);
      return true;
    }
  }
  
  async scrapeAuthorsFromTitle(titleName, titleId, timeSpecifier) {
    let scrapedRelations = new Map();
    
    let isLast = false;
    let index = 0;
    while(!isLast) {
      index++;
      isLast = await this.#scrapeAuthorsFromTitlePartially(scrapedRelations, titleName, titleId, timeSpecifier, index);
    }
    
    return scrapedRelations;   
  }
  
  async scrapeAuthorRelationship(authorId) {
    try {
      const mutedUsers = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.MUTE, 1);
      const mutedIds = mutedUsers.authorIdList;
      
      const blockedUsers = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.USER, 1);
      const blockedIds = blockedUsers.authorIdList;
      
      const blockedTitles = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.TITLE, 1);
      const blockedTitleIds = blockedTitles.authorIdList;
      
      const isMuted = mutedIds.includes(authorId);
      const isBlocked = blockedIds.includes(authorId);
      const hasTitleBlocked = blockedTitleIds.includes(authorId);
      
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
        isBlocked,
        hasTitleBlocked,
        isMuted,
        false,
        false
      );
    } catch (err) {
      log.err("scraping", `scrapeAuthorRelationship: authorId: ${authorId}, err: ${err}`);
      return null;
    }
  }

  async scrapeMutedUsersPage(pageIndex) {
    log.info("scraping", `Scraping muted users page ${pageIndex}...`);
    try {
      const partialListObj = await this.#scrapeAuthorNamesFromBannedAuthorPagePartially(enums.TargetType.MUTE, pageIndex);
      return partialListObj;
    } catch (error) {
      log.err("scraping", `Error in scrapeMutedUsersPage for page ${pageIndex}: ${error.message || error}`);
      throw error;
    }
  }
}

export let scrapingHandler = new ScrapingHandler();
import {log} from './log.js';
import * as enums from './enums.js';
import {JSDOM} from './jsdom.js';
import {config} from './config.js';

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
  scrapeUserAgent = () =>
  {
    return navigator.userAgent;
  }
  
  scrapeClientName = async () =>
  {
    let responseText = "";
    try
    {
      let response = await fetch(config.EksiSozlukURL, {
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
      log.err("scrapingHandler: scrapeClientName: " + err);
      return "";
    }
    
    try
    {
      let clientName = "";
      
      // parse string response as html document
      let dom = new JSDOM(responseText);
      let cName = dom.window.document.querySelector(".mobile-notification-icons").querySelector(".mobile-only a").title;
      if(cName && cName !== null && cName !== undefined)
      {
        cName = cName.replace(/ /gi, "-"); /* whitespace to - char */
        clientName = cName;
      }
      
      log.info("scrapingHandler: clientName: " + clientName);
      return clientName;
    }
    catch(err)
    {
      log.err("scrapingHandler: scrapeClientName: " + err);
      return "";
    }
    
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
      log.err("scrapingHandler: scrapeMetaDataFromEntryPage: " + err);
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
      log.err("scrapingHandler: scrapeMetaDataFromEntryPage: " + err);
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
      log.err("scrapingHandler: scrapeAuthorNamesFromFavs: " + err);
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
      log.err("scrapingHandler: scrapeAuthorNamesFromFavs: " + err);
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
        log.err("scrapingHandler: scrapeAuthorNamesFromFavs: " + err);
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
        log.err("scrapingHandler: (noob) scrapeAuthorNamesFromFavs: " + err);
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
      log.err("scrapingHandler: scrapeAuthorNamesFromBannedAuthorPagePartially: " + err);
      return {authorIdList: [], authorNameList: [], isLast: true};
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
      log.err("scrapingHandler: scrapeAuthorNamesFromBannedAuthorPage: " + err);
      return scrapedRelations;
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
      log.err("scrapingHandler: scrapeFollowerPartially: " + err);
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
      log.err("scrapingHandler: scrapeFollowingPartially: " + err);
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
      log.err("scrapingHandler: scrapeAuthorIdFromAuthorProfilePage: authorName: " + authorName + ", err: " + err);
      return "0";
    }
  }
}

export let scrapingHandler = new ScrapingHandler();
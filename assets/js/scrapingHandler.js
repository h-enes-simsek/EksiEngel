import {log} from './log.js';
import * as enums from './enums.js';
import {JSDOM} from './jsdom.js';
import {config} from './config.js';

export class ScrapingHandler
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
      let response = await fetch("https://eksisozluk.com/", {
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
  
  #arrayUnique = (arr) =>
  {
    // arr: array, an array that might hold duplicated values 
    // return: array, unique elements of the input array
    // O(n^2)
    let a = arr.concat();
    for(let i=0; i<a.length; ++i) {
      for(let j=i+1; j<a.length; ++j) {
        if(a[i] === a[j])
          a.splice(j--, 1);
      }
    }
    return a;
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
      let entryId = entryUrl.match(/\d/g).join("");
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
    // return: string[], only author names
    // return(error): [] 
    
    let authorList = [];
    let responseText = "";
    try
    {
      let entryId = entryUrl.match(/\d/g).join("");
      let targetUrl = "https://eksisozluk.com/entry/favorileyenler?entryId=" + entryId;
      let response = await fetch(targetUrl, {
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
      log.err("scrapingHandler: scrapeAuthorNamesFromFavs: " + err);
      return [];
    }
    
    try
    {
      // parse string response as html document
      let dom = new JSDOM(responseText);
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
          authorList.push(val); 
        }
      }
      
      if(authorList.length > 0)
      {
        // if there is a fav from "çaylak" users, last value of list indicates it
        if(authorList[authorList.length-1].includes("çaylak"))
          authorList.pop()
      } 
      
      //log.info(JSON.stringify(authorList));
    }
    catch(err)
    {
      log.err("scrapingHandler: scrapeAuthorNamesFromFavs: " + err);
      return [];
    }

    if(config.enableNoobBan)
    {
      let responseTextNoob = "";
      try
      {
        let entryId = entryUrl.match(/\d/g).join("");
        let targetUrl = "https://eksisozluk.com/entry/caylakfavorites?entryId=" + entryId;
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
        return [];
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
            authorList.push(val); 
          }
        }
        
        //log.info(JSON.stringify(authorList));
        
      }
      catch(err)
      {
        log.err("scrapingHandler: (noob) scrapeAuthorNamesFromFavs: " + err);
        return [];
      }
      
    }
    
    return authorList;

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
      let targetUrl = `https://eksisozluk.com/relation-list?relationType=${targetTypeTextInURL}&pageIndex=${index}`;
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
  
  // this method will access config object, so it is not arrow function
  async scrapeAuthorNamesFromBannedAuthorPage()
  {
    // no args
    // return: {authorIdList: string[], authorNameList: string[]}
    // note: user, title and mute lists are merged into one list
    // return(err): {authorIdList: [], authorNameList: []}
    
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
      
      if(config.enableMute)
      {
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
      }

      
      // Merges all arrays (remove duplicate)
      let authorIdList = this.#arrayUnique(bannedAuthIdList.concat(bannedTitleIdList));
      let authorNameList = this.#arrayUnique(bannedAuthNameList.concat(bannedTitleNameList));
      
      if(config.enableMute)
      {
        let authorIdList = this.#arrayUnique(authorIdList.concat(bannedMuteIdList));
        let authorNameList = this.#arrayUnique(authorNameList.concat(bannedMuteNameList));
      }

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
      
      return {authorIdList: authorIdList, authorNameList: authorNameList};
    }
    catch(err)
    {
      log.err("scrapingHandler: scrapeAuthorNamesFromBannedAuthorPage: " + err);
      return {authorIdList: [], authorNameList: []};
    }
  }

  scrapeAuthorIdFromAuthorProfilePage = async (authorName) =>
  {
    // authorName: string, name of the author to scrape his/her id
    // return: string, id of the author
    // note: if fails, returned value will be '0'
    
    try
    {
      let targetUrl = "https://eksisozluk.com/biri/" + authorName;
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
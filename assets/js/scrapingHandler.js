import {log} from './log.js';
import * as enums from './enums.js';
import {JSDOM} from './jsdom.js';

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
  
  scrapeAuthorNamesFromFavs = async (entryUrl) =>
  {
    // entryUrl: string, entry url. example: https://eksisozluk.com/entry/1
    // return: string[], only author names
    // return(error): [] 
    
    let responseText = "";
    try
    {
      let entryId = entryUrl.match(/\d/g).join("");
      let targetUrl = "https://eksisozluk.com/entry/favorileyenler?entryId=" + entryId;
      // targetUrl = "https://eksisozluk.com/entry/caylakfavorites?entryId=" + entryId;
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
      let authorList = [];

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
        // 'çaylak' authors are not wanted (in the future it can be considered)		
        // if there is fav from "çaylak" users, last value of list indicates it
        if(authorList[authorList.length-1].includes("çaylak"))
          authorList.pop()
      }
      
      // log.info(JSON.stringify(authorList));
      
      return authorList;
    }
    catch(err)
    {
      log.err("scrapingHandler: scrapeAuthorNamesFromFavs: " + err);
      return [];
    }

  }

  scrapeAuthorNamesFromBannedAuthorPage = async () =>
  {
    // no args
    // return: {authorIdList: string[], authorNameList: string[]}
    // note: banned authors and banned titles are merged into one list
    // return(err): {authorIdList: [], authorNameList: []}
    
    let responseText = "";
    try
    {
      let targetUrl = "https://eksisozluk.com/takip-engellenmis";
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
      log.err("scrapingHandler: scrapeAuthorNamesFromBannedAuthorPage: " + err);
      return {authorIdList: [], authorNameList: []};
    }
    
    try
    {
      // parse string response as html document
      let dom = new JSDOM(responseText);
      let bannedAuthNodeList_ = dom.window.document.querySelectorAll(".relation-block")[1].querySelectorAll("li span a");
      let bannedTitleNodeList_ = dom.window.document.querySelectorAll(".relation-block")[2].querySelectorAll("li span a");
      let bannedAuthNodeList = [];
      let bannedTitleNodeList = [];
      
      // jsdom doesn't support nth-child(2), so odd numbered matches will be selected manualy.
      for (var i = 1; i < bannedAuthNodeList_.length; i += 2) 
      {
        bannedAuthNodeList_[i] && bannedAuthNodeList.push(bannedAuthNodeList_[i]);
      }
      
      for (var i = 1; i < bannedTitleNodeList_.length; i += 2) 
      {
        bannedTitleNodeList_[i] && bannedTitleNodeList.push(bannedTitleNodeList_[i]);
      }
      
      let bannedAuthIdList = [];
      let bannedAuthNameList = [];
      let bannedTitleIdList = [];
      let bannedTitleNameList = [];
      
      for(let i = 0; i < bannedAuthNodeList.length; i++)
      {
        let authId = bannedAuthNodeList[i].getAttribute("data-userid");
        let authName = bannedAuthNodeList[i].getAttribute("data-nick");
        // replace every whitespace with - (eksisozluk.com convention)
        authName = authName.replace(/ /gi, "-");
        bannedAuthIdList.push(authId);
        bannedAuthNameList.push(authName);
      }
      
      for(let i = 0; i < bannedTitleNodeList.length; i++)
      {
        let titleId = bannedTitleNodeList[i].getAttribute("data-userid");
        let titleName = bannedTitleNodeList[i].getAttribute("data-nick");
        // replace every whitespace with - (eksisozluk.com convention)
        titleName = titleName.replace(/ /gi, "-");
        bannedTitleIdList.push(titleId);
        bannedTitleNameList.push(titleName);
      }
      
      // Merges both arrays (remove duplicate)
      var authorIdList = this.#arrayUnique(bannedAuthIdList.concat(bannedTitleIdList));
      var authorNameList = this.#arrayUnique(bannedAuthNameList.concat(bannedTitleNameList));
      
      // console.log(authorIdList);
      // console.log(authorNameList);
      
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
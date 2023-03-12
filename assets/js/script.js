let EksiEngel_sendMessage = (banSource, banMode, entryUrl, authorName, authorId) =>
{
  chrome.runtime.sendMessage(
    null, 
    {
      banSource:banSource, 
      banMode:banMode,
      entryUrl:entryUrl,
      authorName:authorName,
      authorId:authorId
    }, 
    function(response) 
    {
      let lastError = chrome.runtime.lastError;
      if(lastError)
        console.log("could not establish a connection with a page");
      else
        console.log("established a connection with a page");
    }
  );
}

// select all dropdown menus for each entry in the page
let entryMenus = document.querySelectorAll(".other.dropdown > :last-child");

// select all meta tags for each entry in the page
let entryMetas = document.querySelectorAll("[data-author-id]");

for (let i = 0; i < entryMenus.length; i++) 
{
  let entryMenu = entryMenus[i];
  let entryMeta = entryMetas[i];
  
  // extract some info from meta tag
  let authorName = entryMeta.getAttribute("data-author");
  let authorId = entryMeta.getAttribute("data-author-id");
  let entryId = entryMeta.getAttribute("data-id");
  let entryUrl = `https://eksisozluk.com/entry/${entryId}`;
  
  // replace every whitespace with - (ekşi naming convention)
  authorName = authorName.replace(/ /gi, "-");
  
  // remove old user ban button
  let oldButtonBanUser = entryMenu.childNodes[3];
  entryMenu.removeChild(oldButtonBanUser); 
  
  // create new buttons ('a' tag is for css reasons)
  let newButtonBanUser = document.createElement("li"); 
  newButtonBanUser.innerHTML = "<a>yazarı engelle</a>";
  let newButtonBanFav = document.createElement("li"); 
  newButtonBanFav.innerHTML = "<a>favlayanları engelle</a>";
  let newButtonBanFollow = document.createElement("li"); 
  newButtonBanFollow.innerHTML = "<a>takipçilerini engelle</a>";
  
  // append new buttons
  entryMenu.style.minWidth = "max-content"; // allocate enough space for long texts
  entryMenu.appendChild(newButtonBanUser);
  entryMenu.appendChild(newButtonBanFav);
  entryMenu.appendChild(newButtonBanFollow);
  
  // add listeners to appended buttons
  newButtonBanUser.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "BAN", entryUrl, authorName, authorId) });
  newButtonBanFav.addEventListener("click", function(){ EksiEngel_sendMessage("FAV", "BAN", entryUrl, authorName, authorId) });
  newButtonBanFollow.addEventListener("click", function(){ EksiEngel_sendMessage("FOLLOW", "BAN", entryUrl, authorName, authorId) });
}
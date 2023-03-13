let EksiEngel_sendMessage = (banSource, banMode, entryUrl, authorName, authorId, isTargetUser, isTargetTitle, isTargetMute) =>
{
  chrome.runtime.sendMessage(
    null, 
    {
      banSource:banSource, 
      banMode:banMode,
      entryUrl:entryUrl,
      authorName:authorName,
      authorId:authorId,
      isTargetUser:isTargetUser, 
      isTargetTitle:isTargetTitle, 
      isTargetMute:isTargetMute
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

function waitForElm(selector) 
{
  return new Promise(resolve => 
  {
    if (document.querySelectorAll(selector).length) 
    {
      console.log("observation stopped immediately for: " + selector);
      return resolve(document.querySelectorAll(selector));
    }

    console.log("observation started for: " + selector);
    
    const observer = new MutationObserver(mutations => 
    {
      if (document.querySelectorAll(selector).length) 
      {
        console.log("observation stopped for: " + selector);
        resolve(document.querySelectorAll(selector));
        observer.disconnect();
      }
    });

    observer.observe(
      document.body, 
      {
        childList: true,
        subtree: true
      }
    );
  });
}

(async function handleEntryMenus () {
    
// select all dropdown menus for each entry in the page
let entryMenus = await waitForElm(".other.dropdown > :last-child");

// select all meta tags for each entry in the page
let entryMetas = await waitForElm("[data-author-id]");

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
  
  // get old user ban button
  let oldButtonBanUser;
  
  try 
  {
    oldButtonBanUser = entryMenu.childNodes[3];
    if(!oldButtonBanUser)
      break;
    let oldButtonBanUserText = oldButtonBanUser.firstChild.innerHTML;
    if(oldButtonBanUserText != 'engelle')
      break;
  }
  catch(e) 
  {
    break;
  }

  // remove old user ban button
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
  newButtonBanUser.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "BAN", entryUrl, authorName, authorId, true, false, false) });
  newButtonBanFav.addEventListener("click", function(){ EksiEngel_sendMessage("FAV", "BAN", entryUrl, authorName, authorId) });
  newButtonBanFollow.addEventListener("click", function(){ EksiEngel_sendMessage("FOLLOW", "BAN", entryUrl, authorName, authorId) });
}

console.log("handleEntryMenus: done");

})();

(async function handleRelationButtons () {

let buttonsRelation = await waitForElm(".relation-link");

let authorName = document.querySelector("[data-nick]").getAttribute("data-nick");
let authorId = String(document.getElementById("who").value); // String is in case

for (let i = 0; i < buttonsRelation.length; i++) 
{
  let buttonRelation = buttonsRelation[i];
  let nameOfTheButton = buttonRelation.getAttribute("data-add-caption");
  let idOfTheButton = buttonRelation.id;
  let isBanned = buttonRelation.getAttribute("data-added");
  
  // inject new buttons instead of old ones ('span' tag is for css reasons)
  if(nameOfTheButton == "engelle")
  {
    if(idOfTheButton == "button-blocked-link")
    {
      // big red button (dropdown menu is enough, so skip modifying it)
      buttonRelation.remove();
    }
    else
    {
      
      let newButton = document.createElement("a"); 
      if(isBanned == "true")
      {
        newButton.innerHTML = "<span>engellemeyi bırak</span>";
        newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "UNDOBAN", null, authorName, authorId, true, false, false) });
      }
      else
      {
        newButton.innerHTML = "<span>engelle</span>";
        newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "BAN", null, authorName, authorId, true, false, false) });
      }
      buttonRelation.replaceWith(newButton);
      
    }
  
  }
  else if(nameOfTheButton == "başlıklarını engelle")
  {
    let newButton = document.createElement("a"); 
    if(isBanned == "true")
    {
      newButton.innerHTML = "<span>başlıkları engellemeyi kaldır</span>";
      newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "UNDOBAN", null, authorName, authorId, false, true, false) });
    }
    else
    {
      newButton.innerHTML = "<span>başlıklarını engelle</span>";
      newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "BAN", null, authorName, authorId, false, true, false) });
    }
    buttonRelation.replaceWith(newButton);
    
  }
  else if(nameOfTheButton == "sessize al")
  {
    let newButton = document.createElement("a"); 
    if(isBanned == "true")
    {
      newButton.innerHTML = "<span>sessizden çıkar</span>";
      newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "UNDOBAN", null, authorName, authorId, false, false, true) }); 
    }
      
    else
    {
      newButton.innerHTML = "<span>sessize al</span>";
      newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "BAN", null, authorName, authorId, false, false, true) });
    }
      
    buttonRelation.replaceWith(newButton);
  }
   
}
  
console.log("handleRelationButtons: done"); 
 
})();
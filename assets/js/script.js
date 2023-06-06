let eksiEngelIconURL = chrome.runtime.getURL('assets/img/eksiengel16.png');

async function getConfig()
{
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("config", function(items){
      if(!chrome.runtime.error)
      {
        if(items != undefined && items.config != undefined && Object.keys(items.config).length !== 0)
        {
          resolve(items.config);  
        }
        else 
        {
          resolve(false);
        }
      }
      else 
      {
        resolve(false);
      }
    }); 
  });
}

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
      {
        console.log("established a connection with a page");
        
        // notify the user about their action with using eksisozluk notification API, known classes: class="success" and class="error"
        let ul = document.createElement("ul"); 
        ul.innerHTML = `<ul><li class="success" style=""><img src=${eksiEngelIconURL}> Ekşi Engel, istediğiniz işlemi sıraya ekledi.<a class="close">×</a></li></ul>`;
        document.getElementById('user-notifications').appendChild(ul);
      
        // close the notifications after a while automatically
        setTimeout(() => ul.remove(), 3000);
      }
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

async function handleYellowIcons (config) {

  // info: source code has invalid html because there are multiple components that have the same ID
  // <div id="subscriber-badge-entry">
  //   <svg class="eksico subscriber-badge" id="svg-subscriber-badge">
  //     <use xlink:href="#eksico-status-badge"></use>
  //   </svg>
  // </div>

  // select all icons in the page
  let icons = await waitForElm(".eksico.subscriber-badge");
  
  for (let i = 0; i < icons.length; i++) 
  {
    try 
    {
      let parentNode = icons[i].parentNode;
      if(parentNode.id === "subscriber-badge-entry")
        parentNode.style.display = "none";
    }
    catch (err)
    {
      console.log("handleYellowIcons: " + err);
    }
  }

  console.log("handleYellowIcons: done");
}

async function handleGreenIcons (config) {

  // info: source code has invalid html because there are multiple components that have the same ID
  // <div id="verified-badge-entry">
  //   <svg class="eksico verified-badge" id="svg-verified-badge">
  //     <use xlink:href="#eksico-status-badge"></use>
  //   </svg>
  // </div>

  // select all icons in the page
  let icons = await waitForElm(".eksico.verified-badge");
  
  for (let i = 0; i < icons.length; i++) 
  {
    try 
    {
      let parentNode = icons[i].parentNode;
      if(parentNode.id === "verified-badge-entry")
        parentNode.style.display = "none";
    }
    catch (err)
    {
      console.log("handleGreenIcons: " + err);
    }
  }

  console.log("handleGreenIcons: done");
}

(async function handleIcons () {
  const config = await getConfig();
  if(config && config.banPremiumIcons)
  {
    handleYellowIcons(config); // without await
    handleGreenIcons(config); // without await
  }
  else
  {
    // config could not be read maybe not exist, do nothing
    return;
  }
})();

(async function handleEntryMenus () {
    
// select all dropdown menus for each entry in the page
let entryMenus = await waitForElm(".other.dropdown .dropdown-menu.right.toggles-menu");

// select all meta tags for each entry in the page
let entryMetas = await waitForElm("[data-author-id]");

let eksiSozlukURL = window.location.origin;

for (let i = 0; i < entryMenus.length; i++) 
{
  let entryMenu = entryMenus[i];
  let entryMeta = entryMetas[i];
  
  // extract some info from meta tag
  let authorName = entryMeta.getAttribute("data-author");
  let authorId = entryMeta.getAttribute("data-author-id");
  let entryId = entryMeta.getAttribute("data-id");
  let entryUrl = `${eksiSozlukURL}/entry/${entryId}`;
  
  // replace every whitespace with - (ekşi naming convention)
  authorName = authorName.replace(/ /gi, "-");

  // create new buttons ('a' tag is for css reasons)
  let newButtonBanUser = document.createElement("li"); 
  newButtonBanUser.innerHTML = `<a><img src=${eksiEngelIconURL}> yazarı engelle</a>`;
  let newButtonBanFav = document.createElement("li"); 
  newButtonBanFav.innerHTML = `<a><img src=${eksiEngelIconURL}> favlayanları engelle</a>`;
  let newButtonBanFollow = document.createElement("li"); 
  newButtonBanFollow.innerHTML = `<a><img src=${eksiEngelIconURL}> takipçilerini engelle</a>`;
  
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

// target url: https://website.com/biri/example-user
let page = window.location.pathname.split('/')[1];
if(page != "biri")
  return
// TODO: handleRelationButtons should be implemented in these pages as well
//if(page == "takip" || page == "takipci" )
//  return;

try
{
  // css fix
  document.querySelectorAll(".profile-buttons .dropdown-menu")[1].style.width = '210px';
}
catch(e)
{
  // dont do anything
}

let buttonsRelation = await waitForElm(".relation-link");

let authorName = document.querySelector("[data-nick]").getAttribute("data-nick");
let authorId = String(document.getElementById("who").value); // String is in case

let buttonRelationTitleBan; // TODO fix this mess

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
      // remove big red button (dropdown menu is enough)
      buttonRelation.remove();
    }
    else
    {
      
      let newButton = document.createElement("li"); 
      if(isBanned == "true")
      {
        newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> engellemeyi bırak</span></a>`;
        newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "UNDOBAN", null, authorName, authorId, true, false, false) });
      }
      else
      {
        newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> engelle</span></a>`;
        newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "BAN", null, authorName, authorId, true, false, false) });
      }
      buttonRelation.parentNode.parentNode.append(newButton);
      
    }
  
  }
  else if(nameOfTheButton == "başlıklarını engelle")
  {
    let newButton = document.createElement("li"); 
    if(isBanned == "true")
    {
      newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> başlıkları engellemeyi kaldır</span></a>`;
      newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "UNDOBAN", null, authorName, authorId, false, true, false) });
    }
    else
    {
      newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> başlıklarını engelle</span></a>`;
      newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "BAN", null, authorName, authorId, false, true, false) });
    }
    buttonRelation.parentNode.parentNode.append(newButton);
    
    buttonRelationTitleBan = buttonRelation; // TODO: fix this mess
    
  }
  else if(nameOfTheButton == "sessize al")
  {
    let newButton = document.createElement("li"); 
    if(isBanned == "true")
    {
      newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> sessizden çıkar</span></a>`;
      newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "UNDOBAN", null, authorName, authorId, false, false, true) }); 
    }
      
    else
    {
      newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> sessize al</span></a>`;
      newButton.addEventListener("click", function(){ EksiEngel_sendMessage("SINGLE", "BAN", null, authorName, authorId, false, false, true) });
    }
      
    buttonRelation.parentNode.parentNode.append(newButton);
  }
   
}

// TODO: fix later, find better place to do it
// add 'follow ban' button
let newButtonFollow = document.createElement("li"); 
newButtonFollow.innerHTML = `<a><span><img src=${eksiEngelIconURL}> takipçilerini engelle</span></a>`;
newButtonFollow.addEventListener("click", function(){ EksiEngel_sendMessage("FOLLOW", "BAN", null, authorName, authorId) });
buttonRelationTitleBan.parentNode.parentNode.append(newButtonFollow);


console.log("handleRelationButtons: done"); 
 
})();
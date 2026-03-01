(async () => {
  let eksiEngelIconURL = chrome.runtime.getURL('assets/img/eksiengel16.png');
  const src = chrome.runtime.getURL("assets/js/enums.js");
  const enums = await import(src);
  console.log("Eksi Engel: Enums loaded", enums);

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

  let EksiEngel_sendMessage = (banSource, banMode, entryUrl, authorName, authorId, targetType, clickSource, titleName, titleId, timeSpecifier) =>
  {
    chrome.runtime.sendMessage(
      null, 
      {
        banSource:banSource, 
        banMode:banMode,
        entryUrl:entryUrl,
        authorName:authorName,
        authorId:authorId,
        targetType:targetType,
        clickSource:clickSource,
        titleName: titleName,
        titleId: titleId,
        timeSpecifier: timeSpecifier
      }, 
      function(response)
      {
        if (chrome.runtime.lastError) {
          // Check if the error is due to context invalidation
          if (chrome.runtime.lastError.message?.includes("Extension context invalidated")) {
            console.warn("Eksi Engel: Connection to background script lost (Extension updated/reloaded?). Please reload the page.");
            // Optionally, display a user-friendly message on the page itself
          } else {
            // Log other potential errors
            console.error("Eksi Engel: Error sending message:", chrome.runtime.lastError.message);
          }
        }
        else if (response && response.status === 'ok')
        {
          //console.log("Eksi Engel: established a connection with a page");
          //console.log("Eksi Engel: established a connection with a page");
          
          // notify the user about their action with using eksisozluk notification API, known classes: class="success" and class="error"
          let ul = document.createElement("ul"); 
          ul.innerHTML = `<ul><li class="success" style=""><img src=${eksiEngelIconURL}> EksiEngelPlus, istediğiniz işlemi sıraya ekledi.<a class="close">×</a></li></ul>`;
          document.getElementById('user-notifications').appendChild(ul);
        
          // close the notifications after a while automatically
          setTimeout(() => ul.remove(), 3000);
        }
      }
    );
  }

  function waitForElm(selector, debugComment) 
  {
    return new Promise(resolve => 
    {
      if (document.querySelectorAll(selector).length) 
      {
        //console.log("Eksi Engel: observation stopped immediately for: " + debugComment);
        return resolve(document.querySelectorAll(selector));
      }

      //console.log("Eksi Engel: observation started for: " + debugComment);
      
      const observer = new MutationObserver(mutations => 
      {
        if (document.querySelectorAll(selector).length) 
        {
          //console.log("Eksi Engel: observation stopped for: " + debugComment);
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
    let icons = await waitForElm(".eksico.subscriber-badge", "yellow icons");
    
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
        //console.log("Eksi Engel: handleYellowIcons: " + err);
      }
    }

    //console.log("Eksi Engel: handleYellowIcons: done");
  }

  async function handleGreenIcons (config) {

    // info: source code has invalid html because there are multiple components that have the same ID
    // <div id="verified-badge-entry">
    //   <svg class="eksico verified-badge" id="svg-verified-badge">
    //     <use xlink:href="#eksico-status-badge"></use>
    //   </svg>
    // </div>

    // select all icons in the page
    let icons = await waitForElm(".eksico.verified-badge", "green icons");
    
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
        //console.log("Eksi Engel: handleGreenIcons: " + err);
      }
    }

    //console.log("Eksi Engel: handleGreenIcons: done");
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

  // --- Refactored Handlers with MutationObserver ---

  const processedMark = 'eksiengelProcessed'; // Attribute to mark processed elements (must be camelCase for dataset)

  // Function to process a single Title Menu (#in-topic-search-options)
  const processTitleMenu = (menuElement) => {
    if (menuElement.dataset[processedMark]) return; // Already processed

    try {
      console.log("Eksi Engel: Processing title menu:", menuElement);
      
      // Check if the necessary child elements exist before proceeding
      if (menuElement.children.length === 0) {
        console.log("Eksi Engel: Title menu has no children, skipping");
        return;
      }

      // create new buttons
      let li1 = document.createElement("li");
      let li2 = document.createElement("li");
      li1.innerHTML = `<a><img src=${eksiEngelIconURL}> başlıktakileri engelle (son 24 saatte)</a>`;
      li2.innerHTML = `<a><img src=${eksiEngelIconURL}> başlıktakileri engelle (tümü)</a>`;

      // append the created buttons to before last element or at the end if not enough children
      console.log("Eksi Engel: Title menu children count:", menuElement.childElementCount);
      
      if (menuElement.childElementCount > 1) {
        // If there are at least 2 children, insert before the last one
        menuElement.insertBefore(li1, menuElement.children[menuElement.childElementCount-1]);
        menuElement.insertBefore(li2, menuElement.children[menuElement.childElementCount-1]);
      } else {
        // Otherwise just append to the end
        menuElement.appendChild(li1);
        menuElement.appendChild(li2);
      }

      // get title name and id (assuming #title is available when the menu is)
      let titleElement = document.querySelector("#title");
      if (!titleElement) {
          console.error("Eksi Engel: #title element not found when processing title menu.");
          return; // Cannot get title info
      }
      let titleName = titleElement.getAttribute("data-slug");
      let titleId = titleElement.getAttribute("data-id");

      if (!titleName || !titleId) {
          console.error("Eksi Engel: Missing data attributes on #title element.");
          return; // Cannot get title info
      }

      // add listener to appended button
      li1.addEventListener("click", function(){
        EksiEngel_sendMessage(enums.BanSource.TITLE, enums.BanMode.BAN, null, null, null, null, enums.ClickSource.TITLE, titleName, titleId, enums.TimeSpecifier.LAST_24_H);
      });
      li2.addEventListener("click", function(){
        EksiEngel_sendMessage(enums.BanSource.TITLE, enums.BanMode.BAN, null, null, null, null, enums.ClickSource.TITLE, titleName, titleId, enums.TimeSpecifier.ALL);
      });

      menuElement.dataset[processedMark] = "true"; // Mark as processed
      //console.log("Eksi Engel: Processed title menu.");

    } catch (error) {
      console.error("Eksi Engel: Error processing title menu:", error);
      console.log("Eksi Engel: Menu element that caused the error:", menuElement);
      
      // Try to get more information about the error
      try {
        console.log("Eksi Engel: Menu element HTML:", menuElement.outerHTML);
        console.log("Eksi Engel: Menu element children count:", menuElement.childElementCount);
        
        // Check if title element exists
        const titleElement = document.querySelector("#title");
        if (titleElement) {
          console.log("Eksi Engel: Title element found:", titleElement.outerHTML);
          console.log("Eksi Engel: Title data-slug:", titleElement.getAttribute("data-slug"));
          console.log("Eksi Engel: Title data-id:", titleElement.getAttribute("data-id"));
        } else {
          console.log("Eksi Engel: Title element (#title) not found");
        }
      } catch (debugError) {
        console.error("Eksi Engel: Error while trying to debug title menu error:", debugError);
      }
      
      // Mark as processed even if error occurs to prevent retrying on the same broken element
      menuElement.dataset[processedMark] = "true";
    }
  };

  // Function to add buttons to a single entry menu
  // Function to process a single Entry Menu (dropdown)
  const processEntryMenu = (dropdownMenu) => {
    if (dropdownMenu.dataset[processedMark]) return; // Already processed

    try {
      console.debug("Eksi Engel: Processing dropdown menu");
      
      // Find the parent entry element
      const entryElement = dropdownMenu.closest('li[data-id]') ||
                          dropdownMenu.closest('article[data-id]') ||
                          dropdownMenu.closest('[data-id]');
      
      if (!entryElement) {
        // Instead of error, just log at debug level and skip silently
        console.debug("Eksi Engel: Skipping dropdown menu - no parent entry element found.");
        dropdownMenu.dataset[processedMark] = "true"; // Mark as processed to avoid repeated attempts
        return; // Cannot find parent, skip
      }

      // Extract info from the entry element
      const authorName = entryElement.getAttribute("data-author")?.replace(/ /gi, "-");
      const authorId = entryElement.getAttribute("data-author-id");
      const entryId = entryElement.getAttribute("data-id");
      const eksiSozlukURL = window.location.origin;
      const entryUrl = `${eksiSozlukURL}/entry/${entryId}`;

      if (!authorName || !authorId || !entryId) {
        console.debug("Eksi Engel: Missing data attributes on entry element - skipping");
        dropdownMenu.dataset[processedMark] = "true"; // Mark as processed to avoid repeated attempts
        return; // Missing data, skip
      }

      // Determine click source
      let clickSource = enums.ClickSource.ENTRY;
      let page = window.location.pathname.split('/')[1];
      if (page == "sorunsal") {
        clickSource = enums.ClickSource.QUESTION;
      }

      // Find the last button in the dropdown menu to insert our buttons after it
      const menuItems = dropdownMenu.querySelectorAll('li');
      console.log("Eksi Engel: Found", menuItems.length, "menu items in dropdown");
      
      // Check if this is actually the dropdown menu we want
      // Look for specific buttons that should be in the entry menu
      let isEntryMenu = false;
      let lastRelevantItem = null;
      const targetButtonTexts = ['engelle', 'modlog', 'şikayet', 'mesaj'];
      
      for (const item of menuItems) {
        const itemText = item.textContent.trim().toLowerCase();
        
        for (const targetText of targetButtonTexts) {
          if (itemText.includes(targetText)) {
            lastRelevantItem = item;
            isEntryMenu = true;
            console.debug("Eksi Engel: Found target button:", targetText);
            break;
          }
        }
      }
      
      // Skip if this isn't the dropdown menu we're looking for
      if (!isEntryMenu) {
        console.debug("Eksi Engel: This doesn't appear to be an entry menu, skipping");
        dropdownMenu.dataset[processedMark] = "true"; // Mark as processed to avoid repeated attempts
        return;
      }

      // Create new buttons as list items
      let newButtonBanUser = document.createElement("li");
      newButtonBanUser.innerHTML = `<a href="javascript:void(0);"><img src=${eksiEngelIconURL} style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;"> yazarı engelle</a>`;

      // Update button label based on enableMute config (after buttons are created)
      getConfig().then(config => {
        const banLabel = config?.enableMute ? "yazarı sessize al" : "yazarı engelle";
        newButtonBanUser.innerHTML = `<a href="javascript:void(0);"><img src=${eksiEngelIconURL} style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;"> ${banLabel}</a>`;
      });

      let newButtonBanFav = document.createElement("li");
      newButtonBanFav.innerHTML = `<a href="javascript:void(0);"><img src=${eksiEngelIconURL} style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;"> favlayanları engelle</a>`;
      
      let newButtonBanFollow = document.createElement("li");
      // Set initial label, then update based on config
      newButtonBanFollow.innerHTML = `<a href="javascript:void(0);"><img src=${eksiEngelIconURL} style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;"> takipçilerini engelle</a>`;
      getConfig().then(config => {
        const followLabel = config?.enableMute ? "takipçilerini sessize al" : "takipçilerini engelle";
        newButtonBanFollow.innerHTML = `<a href="javascript:void(0);"><img src=${eksiEngelIconURL} style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;"> ${followLabel}</a>`;
      });

      // Insert buttons in the dropdown menu
      if (lastRelevantItem) {
        // Insert after the last relevant item
        if (lastRelevantItem.nextSibling) {
          dropdownMenu.insertBefore(newButtonBanUser, lastRelevantItem.nextSibling);
          dropdownMenu.insertBefore(newButtonBanFav, lastRelevantItem.nextSibling.nextSibling);
          dropdownMenu.insertBefore(newButtonBanFollow, lastRelevantItem.nextSibling.nextSibling.nextSibling);
        } else {
          // If it's the last element, just append
          dropdownMenu.appendChild(newButtonBanUser);
          dropdownMenu.appendChild(newButtonBanFav);
          dropdownMenu.appendChild(newButtonBanFollow);
        }
      } else {
        // If no relevant item found, just append at the end
        dropdownMenu.appendChild(newButtonBanUser);
        dropdownMenu.appendChild(newButtonBanFav);
        dropdownMenu.appendChild(newButtonBanFollow);
      }

      // Add event listeners
      newButtonBanUser.addEventListener("click", async function(e){
        e.preventDefault();
        const config = await getConfig();
        
        // Check if title ban is enabled in config
        if (config?.enableTitleBan) {
          console.log("Eksi Engel: Title ban is enabled, blocking both user and titles");
          // First block the user
          const targetType = config?.enableMute ? enums.TargetType.MUTE : enums.TargetType.USER;
          EksiEngel_sendMessage(enums.BanSource.SINGLE, enums.BanMode.BAN, entryUrl, authorName, authorId, targetType, clickSource);
          
          // Then block their titles
          setTimeout(() => {
            EksiEngel_sendMessage(enums.BanSource.SINGLE, enums.BanMode.BAN, entryUrl, authorName, authorId, enums.TargetType.TITLE, clickSource);
          }, 500); // Small delay to ensure both actions are processed
        } else {
          // Just block the user without titles
          console.log("Eksi Engel: Title ban is disabled, only blocking user");
          const targetType = config?.enableMute ? enums.TargetType.MUTE : enums.TargetType.USER;
          EksiEngel_sendMessage(enums.BanSource.SINGLE, enums.BanMode.BAN, entryUrl, authorName, authorId, targetType, clickSource);
        }
      });
      
      newButtonBanFav.addEventListener("click", function(e){
        e.preventDefault();
        EksiEngel_sendMessage(enums.BanSource.FAV, enums.BanMode.BAN, entryUrl, authorName, authorId, null, clickSource);
      });
      
      newButtonBanFollow.addEventListener("click", function(e){
        e.preventDefault();
        EksiEngel_sendMessage(enums.BanSource.FOLLOW, enums.BanMode.BAN, entryUrl, authorName, authorId, null, clickSource);
      });

      dropdownMenu.dataset[processedMark] = "true"; // Mark as processed

    } catch (error) {
      // Only log serious errors, not expected conditions
      if (!(error instanceof TypeError) && !(error instanceof ReferenceError)) {
        console.error("Eksi Engel: Unexpected error processing dropdown menu:", error);
      }
      
      dropdownMenu.dataset[processedMark] = "true"; // Mark as processed even on error
    }
  };

  // Function to process Relation Buttons (on profile pages)
  const processRelationButtons = async (profileButtonsContainer) => {
      // Profile pages might reload content differently. We target a container.
      // Let's assume the container is '.profile-buttons' or similar.
      // We need to re-run the logic if the *content* of this container changes significantly.
      // A simple check: has the number of direct children changed? Or use a version marker.
      const currentButtonCount = profileButtonsContainer.querySelectorAll('.relation-link').length;
      const processedButtonCount = parseInt(profileButtonsContainer.dataset.eksiengelProcessedButtons || '0');

      // If the number of relation links hasn't changed, assume it's already processed or stable.
      // This is imperfect but avoids constant reprocessing on minor style changes.
      // A more robust check might involve hashing the innerHTML or checking specific button states.
      // if (currentButtonCount === processedButtonCount && profileButtonsContainer.dataset[processedMark]) return;

      // Let's try reprocessing more aggressively for profile pages, marking the container
      if (profileButtonsContainer.dataset[processedMark]) return;


      try {
          // Check if we are actually on a profile page ('/biri/')
          let page = window.location.pathname.split('/')[1];
          if (page !== "biri") return; // Only run on profile pages

          // Get config for dynamic button labels
          const config = await getConfig();

          // Attempt CSS fix (might fail if element doesn't exist yet)
          try {
              const dropdownMenu = profileButtonsContainer.querySelector(".dropdown-menu");
              if (dropdownMenu) dropdownMenu.style.width = '210px';
          } catch (e) { /* ignore */ }

          const authorNameElement = document.querySelector("[data-nick]");
          const authorIdElement = document.getElementById("who");

          if (!authorNameElement || !authorIdElement) {
              // console.error("Eksi Engel: Could not find author name/ID elements on profile page.");
              return; // Essential elements not found yet
          }
          const authorName = authorNameElement.getAttribute("data-nick");
          const authorId = String(authorIdElement.value); // String is in case

          let buttonRelationTitleBan = null; // Track the title ban button to append "block followers" after it

          // Find existing relation links within this container
          const buttonsRelation = profileButtonsContainer.querySelectorAll(".relation-link");
          if (buttonsRelation.length === 0) return; // No buttons found yet

          // Clear existing injected buttons to prevent duplicates if reprocessing
          profileButtonsContainer.querySelectorAll('.eksiengel-injected-button').forEach(btn => btn.remove());

          buttonsRelation.forEach(buttonRelation => {
              let nameOfTheButton = buttonRelation.getAttribute("data-add-caption");
              let idOfTheButton = buttonRelation.id;
              let isBanned = buttonRelation.getAttribute("data-added");
              let parentListItem = buttonRelation.closest('li'); // Find the parent <li>

              if (!parentListItem) return; // Skip if structure is unexpected

              let newButton = document.createElement("li");
              newButton.classList.add('eksiengel-injected-button'); // Mark for potential removal later

              if (nameOfTheButton == "engelle") {
                  if (idOfTheButton == "button-blocked-link") {
                      // remove big red button (dropdown menu is enough)
                      buttonRelation.remove();
                  } else {
                      if (isBanned == "true") { // Handle UNDOBAN case (always TargetType.USER for unblocking)
                           const undoLabel = config?.enableMute ? "sessizden çıkar" : "engellemeyi bırak";
                           newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> ${undoLabel}</span></a>`;
                           newButton.addEventListener("click", function(){ EksiEngel_sendMessage(enums.BanSource.SINGLE, enums.BanMode.UNDOBAN, null, authorName, authorId, enums.TargetType.USER, enums.ClickSource.PROFILE) });
                       } else { // Handle BAN case (check config for MUTE vs USER)
                           const banLabel = config?.enableMute ? "sessize al" : "engelle";
                           newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> ${banLabel}</span></a>`;
                           newButton.addEventListener("click", function(){
                               const targetType = config?.enableMute ? enums.TargetType.MUTE : enums.TargetType.USER;
                               EksiEngel_sendMessage(enums.BanSource.SINGLE, enums.BanMode.BAN, null, authorName, authorId, targetType, enums.ClickSource.PROFILE);
                           });
                       }
                      parentListItem.parentNode.append(newButton);
                  }
              } else if (nameOfTheButton == "başlıklarını engelle") {
                  if (isBanned == "true") {
                      newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> başlıkları engellemeyi kaldır</span></a>`;
                      newButton.addEventListener("click", function(){ EksiEngel_sendMessage(enums.BanSource.SINGLE, enums.BanMode.UNDOBAN, null, authorName, authorId, enums.TargetType.TITLE, enums.ClickSource.PROFILE) });
                  } else {
                      newButton.innerHTML = `<a><span><img src=${eksiEngelIconURL}> başlıklarını engelle</span></a>`;
                      newButton.addEventListener("click", function(){ EksiEngel_sendMessage(enums.BanSource.SINGLE, enums.BanMode.BAN, null, authorName, authorId, enums.TargetType.TITLE, enums.ClickSource.PROFILE) });
                  }
                  parentListItem.parentNode.append(newButton);
                  buttonRelationTitleBan = newButton; // Mark where to add "block followers"
              }
          });

          // Add 'block followers' button after the title ban button, if found
          if (buttonRelationTitleBan) {
              let newButtonFollow = document.createElement("li");
              newButtonFollow.classList.add('eksiengel-injected-button');
              const followLabel = config?.enableMute ? "takipçilerini sessize al" : "takipçilerini engelle";
              newButtonFollow.innerHTML = `<a><span><img src=${eksiEngelIconURL}> ${followLabel}</span></a>`;
              newButtonFollow.addEventListener("click", function(){ EksiEngel_sendMessage(enums.BanSource.FOLLOW, enums.BanMode.BAN, null, authorName, authorId, null, enums.ClickSource.PROFILE) });
              buttonRelationTitleBan.parentNode.insertBefore(newButtonFollow, buttonRelationTitleBan.nextSibling); // Insert after
          }

          profileButtonsContainer.dataset[processedMark] = "true"; // Mark container as processed
          // profileButtonsContainer.dataset.eksiengelProcessedButtons = currentButtonCount; // Store count for comparison
          //console.log("Eksi Engel: Processed relation buttons.");

      } catch (error) {
          console.error("Eksi Engel: Error processing relation buttons:", error);
          console.log("Eksi Engel: Profile buttons container that caused the error:", profileButtonsContainer);
          
          // Try to get more information about the error
          try {
              console.log("Eksi Engel: Profile buttons container HTML:", profileButtonsContainer.outerHTML);
              
              // Check if author elements exist
              const authorNameElement = document.querySelector("[data-nick]");
              const authorIdElement = document.getElementById("who");
              
              if (authorNameElement) {
                  console.log("Eksi Engel: Author name element found:", authorNameElement.outerHTML);
                  console.log("Eksi Engel: Author data-nick:", authorNameElement.getAttribute("data-nick"));
              } else {
                  console.log("Eksi Engel: Author name element ([data-nick]) not found");
              }
              
              if (authorIdElement) {
                  console.log("Eksi Engel: Author ID element found:", authorIdElement.outerHTML);
                  console.log("Eksi Engel: Author ID value:", authorIdElement.value);
              } else {
                  console.log("Eksi Engel: Author ID element (#who) not found");
              }
              
              // Check relation links
              const relationLinks = profileButtonsContainer.querySelectorAll(".relation-link");
              console.log("Eksi Engel: Number of relation links found:", relationLinks.length);
              relationLinks.forEach((link, index) => {
                  console.log(`Eksi Engel: Relation link ${index}:`, link.outerHTML);
                  console.log(`Eksi Engel: data-add-caption:`, link.getAttribute("data-add-caption"));
                  console.log(`Eksi Engel: id:`, link.id);
                  console.log(`Eksi Engel: data-added:`, link.getAttribute("data-added"));
              });
          } catch (debugError) {
              console.error("Eksi Engel: Error while trying to debug relation buttons error:", debugError);
          }
          
          profileButtonsContainer.dataset[processedMark] = "true"; // Mark as processed even on error
      }
  };

  // --- Main Observer ---

  const observeDOMChanges = () => {
    console.log("Eksi Engel: Setting up MutationObserver");
    
    if (!document.body) {
      console.error("Eksi Engel: document.body not available yet, retrying in 100ms");
      setTimeout(observeDOMChanges, 100);
      return;
    }
    
    const observer = new MutationObserver((mutationsList) => {
      // Use requestAnimationFrame to batch processing and avoid layout thrashing
      window.requestAnimationFrame(() => {
        let processedSomething = false;
        console.log("Eksi Engel: Processing", mutationsList.length, "mutations");
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check for Title Menu
                if (node.matches('#in-topic-search-options')) {
                  processTitleMenu(node);
                  processedSomething = true;
                } else {
                  node.querySelectorAll('#in-topic-search-options:not([data-eksiengelProcessed="true"])').forEach(processTitleMenu);
                  if (node.querySelector('#in-topic-search-options:not([data-eksiengelProcessed="true"])')) processedSomething = true;
                }

                // Check for Entry Menus - targeting the three-dot dropdown menu
                // This is the menu that contains 'mesaj gönder', 'şikayet', 'modlog', and 'engelle' buttons
                const entryMenuSelector = ".dropdown-menu, ul.toggles-menu, .other .dropdown-menu";
                if (node.matches(entryMenuSelector)) {
                  console.log("Eksi Engel: Direct match for entry menu found");
                  processEntryMenu(node);
                  processedSomething = true;
                } else {
                  const foundMenus = node.querySelectorAll(`${entryMenuSelector}:not([data-eksiengelProcessed="true"])`);
                  if (foundMenus.length > 0) {
                    console.log("Eksi Engel: Found", foundMenus.length, "entry menus within added node");
                    foundMenus.forEach(processEntryMenu);
                    processedSomething = true;
                  } else {
                    // Try a fallback selector if the primary one doesn't find anything
                    const fallbackSelector = ".dropdown-menu:has(li a[href*='mesaj'])";
                    const fallbackMenus = node.querySelectorAll(`${fallbackSelector}:not([data-eksiengelProcessed="true"])`);
                    
                    if (fallbackMenus.length > 0) {
                      console.log("Eksi Engel: Found", fallbackMenus.length, "menus with fallback selector in added node");
                      fallbackMenus.forEach(processEntryMenu);
                      processedSomething = true;
                    }
                  }
                }

                // Check for Relation Button Containers (adjust selector if needed)
                const relationContainerSelector = ".profile-buttons"; // Example selector
                 if (node.matches(relationContainerSelector)) {
                  processRelationButtons(node);
                   processedSomething = true;
                } else {
                  // Check if added node *contains* the container
                  const container = node.querySelector(`${relationContainerSelector}:not([data-eksiengelProcessed="true"])`);
                  if(container) {
                      processRelationButtons(container);
                      processedSomething = true;
                  }
                  // Also check if the node *is within* a container that might need reprocessing
                  const parentContainer = node.closest(`${relationContainerSelector}`);
                  if(parentContainer && !parentContainer.dataset[processedMark]) {
                      // console.log("Reprocessing relation buttons due to child change", node);
                      // parentContainer.removeAttribute('data-eksiengel-processed'); // Allow reprocessing
                      // processRelationButtons(parentContainer);
                      // Be cautious with reprocessing containers - might cause infinite loops if not careful
                  }
                }
              }
            });
          }
          // Optional: Handle attribute changes if needed, e.g., if 'data-added' changes on relation buttons
          // else if (mutation.type === 'attributes') {
          //    if (mutation.target.matches('.relation-link') && mutation.attributeName === 'data-added') {
          //        const container = mutation.target.closest('.profile-buttons');
          //        if (container) {
          //            container.removeAttribute('data-eksiengel-processed'); // Allow reprocessing
          //            processRelationButtons(container);
          //        }
          //    }
          // }
        }
        // if (processedSomething) console.log("Eksi Engel: Processed elements after mutation.");
      });
    });

    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        // attributes: true, // Uncomment if observing attribute changes is necessary
        // attributeFilter: ['data-added'] // Example: only observe changes to 'data-added'
      });
      console.log("Eksi Engel: MutationObserver successfully attached to document.body");
    } catch (error) {
      console.error("Eksi Engel: Error attaching MutationObserver:", error);
    }

    //console.log("Eksi Engel: Main DOM observer started.");
  };

  // Add a message listener to handle requests from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "hideTitlesByAuthorId") {
          console.log(`Eksi Engel: Received request to hide titles by author ID: ${request.authorId}`);
          let hiddenCount = 0;
          try {
              // Find all elements that represent entries or titles by this author ID
              // This might need refinement based on the actual DOM structure of Eksi Sozluk
              // Common selectors might target entry containers or title links with author data attributes
              const elementsToHide = document.querySelectorAll(`[data-author-id="${request.authorId}"]`);

              elementsToHide.forEach(element => {
                  // Decide which elements to hide. This might be the entry itself, or the title link.
                  // For hiding titles, we likely want to hide the entire entry container or the title link in a list.
                  // Let's try hiding the closest entry container or the element itself if it's a title link.
                  const entryContainer = element.closest('li[data-id]') || element.closest('article[data-id]');
                  if (entryContainer) {
                      entryContainer.style.display = 'none';
                      hiddenCount++;
                      console.debug(`Eksi Engel: Hidden entry by author ID ${request.authorId}`);
                  } else if (element.matches('a.topic-link, a.title')) { // Example selectors for title links
                       element.style.display = 'none';
                       hiddenCount++;
                       console.debug(`Eksi Engel: Hidden title link by author ID ${request.authorId}`);
                  }
                  // Add other selectors if needed based on where author IDs appear near titles/entries
              });

              console.log(`Eksi Engel: Hid ${hiddenCount} elements for author ID: ${request.authorId}`);
              sendResponse({ success: true, hiddenCount: hiddenCount });

          } catch (error) {
              console.error(`Eksi Engel: Error hiding titles for author ID ${request.authorId}:`, error);
              sendResponse({ success: false, error: error.message });
          }
          return true; // Indicate that the response will be sent asynchronously
      }
      // Add other message handlers here if needed
  });


  // --- Initial Scan and Observer Start ---

  // Perform an initial scan for elements present on load
  try {
    console.log("Eksi Engel: Starting initial scan for elements");
    const titleMenus = document.querySelectorAll('#in-topic-search-options:not([data-eksiengelProcessed="true"])');
    console.log("Eksi Engel: Found", titleMenus.length, "title menus");
    titleMenus.forEach(processTitleMenu);
    
    // Updated selector to target the three-dot dropdown menu
    const entryMenuSelector = ".dropdown-menu, ul.toggles-menu, .other .dropdown-menu";
    const entryMenus = document.querySelectorAll(`${entryMenuSelector}:not([data-eksiengelProcessed="true"])`);
    console.log("Eksi Engel: Found", entryMenus.length, "entry menus");
    console.log("Eksi Engel: Entry menu selector used:", entryMenuSelector);
    
    // Log some sample menus if found
    if (entryMenus.length > 0) {
      console.log("Eksi Engel: Sample entry menu HTML:", entryMenus[0].outerHTML);
    } else {
      // Try a fallback selector if the primary one doesn't find anything
      console.log("Eksi Engel: Primary selector found no menus, trying fallback selector");
      const fallbackSelector = ".dropdown-menu:has(li a[href*='mesaj'])";
      const fallbackMenus = document.querySelectorAll(`${fallbackSelector}:not([data-eksiengelProcessed="true"])`);
      console.log("Eksi Engel: Found", fallbackMenus.length, "menus with fallback selector");
      
      if (fallbackMenus.length > 0) {
        console.log("Eksi Engel: Sample fallback menu HTML:", fallbackMenus[0].outerHTML);
        console.log("Eksi Engel: Processing menus found with fallback selector");
        fallbackMenus.forEach(processEntryMenu);
      } else {
        // If still no menus found, try to find any dropdown menus for debugging
        const anyDropdowns = document.querySelectorAll('.dropdown-menu');
        console.log("Eksi Engel: Found", anyDropdowns.length, "general dropdown menus");
        if (anyDropdowns.length > 0) {
          console.log("Eksi Engel: Sample dropdown HTML:", anyDropdowns[0].outerHTML);
        }
      }
    }
    
    entryMenus.forEach(processEntryMenu);
    
    const profileButtons = document.querySelectorAll('.profile-buttons:not([data-eksiengelProcessed="true"])');
    console.log("Eksi Engel: Found", profileButtons.length, "profile button containers");
    profileButtons.forEach(processRelationButtons);
    
    console.log("Eksi Engel: Initial element scan complete.");
  } catch(error) {
      console.error("Eksi Engel: Error during initial scan:", error);
  }

  // Start observing for dynamic changes
  observeDOMChanges();
  console.log("Eksi Engel: MutationObserver initialized");

  // Note: The previous setTimeout wrappers are removed.
  // The initial scan and the main observer handle the execution now.

})();

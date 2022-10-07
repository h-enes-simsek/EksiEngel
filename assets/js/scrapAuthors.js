{
	let readyToScraping = window.isEksiEngelReadyToScraping;
	if(typeof readyToScraping === 'undefined' || readyToScraping === true)
	{
		startScraping();
	}
	else
	{
		console.log("scrapAuthors.js: a timer already exist");
	}
}

function getAuthorListHTMLCollection()
{
	// return type: HTML Collection
	try
	{
		return document.getElementsByClassName("favorite-list-popup toggles-menu open")[0].firstChild.firstChild.getElementsByTagName("li");
	}
	catch(e){
		return undefined;
	}
}

function startScraping()
{
	window.isEksiEngelReadyToScraping = false;
	
	let TIMER_PERIOD_IN_MSEC = 100; // in milisecond
	let TIMER_TIMEOUT_IN_SEC = 15; // in second
	let TIMER_COUNTER_LIMIT = (TIMER_TIMEOUT_IN_SEC*1000)/TIMER_PERIOD_IN_MSEC;
	
	// click to open the list of authors
	let showFavsButton = document.getElementsByClassName("favorite-count")[1];
	if(!showFavsButton)
	{
		window.isEksiEngelReadyToScraping = true;
		alert("Ekşisözlük hesabınıza giriş yapmış olmanız gerekiyor.");
		return;
	}
	else
	{
		showFavsButton.click();
	}
	
	
	let counter = 0;
    
	// after clicking, a new html element will appear, however it is time consuming
	// in case the author list is too long, program should wait to see it
	let scrapingTimer = setInterval(function()	
	{
		counter++;
		
		let authorListHTMLCollection = getAuthorListHTMLCollection();
		
	  if (authorListHTMLCollection && authorListHTMLCollection.length !== 0) 
	  {
			clearInterval(scrapingTimer);
			window.isEksiEngelReadyToScraping = true;
			console.log("scrapAuthors.js: the timer has been cleared.");
			
			let authorList = [];		
			
			// get list of authors from html collection
			for(var i=0; i < authorListHTMLCollection.length; i++) 
			{
				let val = authorListHTMLCollection[i].innerText;
				// just in case
				if (val.length) 
				{ 
					authorList.push((val)); 
				}
			}
			
			// click to close the list of authors
			showFavsButton.click();
			
			// delete '@' char from nicknames
			// "@example_user" --> "example_user"
			for(var i=0;i < authorList.length; i++) {
				authorList[i] = authorList[i].substr(1)
			}
			
			if(authorList.length > 0)
			{
				// 'çaylak' authors are not wanted (in the future it can be considered)		
				// if there is fav from "çaylak" users, last value of list indicates it
				if(authorList[authorList.length-1].substr(-6,6) === "çaylak")
					authorList.pop()
			}
			
			console.log("scrapAuthors.js: number of authors obtained: " + authorList.length);
			
			if(authorList.length > 0)
			{
				let authorListString = authorList.join("\n");
			
				// save the list to local storage api
				chrome.storage.local.set({"userList": authorListString }, function(){
					if(!chrome.runtime.error){
						console.log("scrapAuthors.js: Author list saved into local storage");
						// send start msg to background.js
						chrome.runtime.sendMessage(null, "scrapAuthors::start");
					}else{
						console.log("scrapAuthors.js: chrome.storage.local.set runtime error");
						alert("chrome.storage.local.set runtime error");
					}
				});
			}
		
	  }
	  else
	  {
		  console.log("scrapAuthors.js: html element of author list could not be read");
		  if(this.counter > TIMER_COUNTER_LIMIT)
      {
       clearInterval(scrapingTimer); // clear interval after TIMER_TIMEOUT_IN_SEC
			 window.isEksiEngelReadyToScraping = true;
       console.log("scrapAuthors.js: html element of author list could not be read (timer stopped)");
      }
	  }
	}, TIMER_PERIOD_IN_MSEC);

}

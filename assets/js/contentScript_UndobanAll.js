// these enum and config parameters was previously injected by background script
let BanSource = window.enumEksiEngelBanSource;
let OpMode = window.enumEksiEngelOpMode;
let BanMode = window.enumEksiEngelBanMode;
let TargetType = window.enumEksiEngelTargetType;
let ResultType = window.enumEksiEngelResultType;

{
	let readyToScraping = window.isEksiEngelReadyToScraping;
	if(typeof readyToScraping === 'undefined' || readyToScraping === true)
	{
		let clientName = getClientName();
		if(clientName)
		{
			startScraping();
		}
		else
		{
			// inject html code to display popup
			let HTMLElement_Popup = document.createElement("div"); 
			document.body.appendChild(HTMLElement_Popup); 
			HTMLElement_Popup.className = "customPopup";
			HTMLElement_Popup.innerText = "Ekşi Sözlük hesabınıza giriş yapmanız gerekiyor."
			
			let responseObj = {source: BanSource.UNDOBANALL, 
												 res: ResultType.FAIL, 
												 totalUser: 0, 
												 totalTitle: 0, 
												 clientName: ""};
			chrome.runtime.sendMessage(null, JSON.stringify(responseObj));
		}
	}
	else
	{
		console.log("undobanAll: a timer already exist");
	}
}

function isBannedAuthorListEmpty()
{
	let text = document.getElementsByClassName("relation-block")[1].getElementsByTagName("p")[0].innerHTML;
	return (text === 'yok engellenmiş pek.')
}

function isBannedTitleListEmpty()
{
	let text = document.getElementsByClassName("relation-block")[2].getElementsByTagName("p")[0].innerHTML;
	return (text === 'yok başlıkları engellenmiş pek.')
}

function getBannedAuthorListNodeList()
{
	// return type: NodeList
	try
	{
		return document.getElementsByClassName("relation-block")[1].querySelectorAll("li span a[data-nick]");
	}
	
	catch(e)
	{
		return undefined;
	}
}

function getBannedTitleListNodeList()
{
	// return type: NodeList
	try
	{
		return document.getElementsByClassName("relation-block")[2].querySelectorAll("li span a[data-nick]");
	}
	catch(e){
		return undefined;
	}
}

function getClientName()
{
	let clientName = "";
	let selector = ".mobile-notification-icons > ul > li > a";
	try
	{
		let element = document.querySelectorAll(selector)[0].title;
		if(element && element != null && element != undefined)
			clientName = element;
	}
	catch(err)
	{
		// may be not logged in
		console.log(err);
	}
	
	return clientName;
}

async function undoban(userId, target)
{
	return new Promise(async function(resolve, reject) {
		let url;
		if(target===TargetType.TITLE)
			url = 'https://eksisozluk.com/userrelation/removerelation/' + userId + '?r=i';
		else if(target===TargetType.USER)
			url = 'https://eksisozluk.com/userrelation/removerelation/' + userId + '?r=m';
	
		try {
			let response = await fetch(url, {
				method: 'POST',
					 headers: {
						'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
						'x-requested-with': 'XMLHttpRequest'
					},
				body: "id=" + userId
			});
			let responseText = await response.text();
			const responseJson = JSON.parse(responseText);
			return resolve(responseJson);
		}
		catch(err)
		{
			return resolve({"result":false, "count":-1});
			console.log(err);
		}
	});
}

async function undobanUser(userId)
{
	return new Promise(async function(resolve, reject) {
		let responseJson = await undoban(userId, TargetType.USER);
		resolve(responseJson);
	});
}

async function undobanTitle(userId)
{
	return new Promise(async function(resolve, reject) {
		let responseJson = await undoban(userId, TargetType.TITLE);
		resolve(responseJson);
	});
}

function setPopupText(element, unbannedAuthor, unbannedTitle, isOngoing)
{
	let text = "";
	if(isOngoing)
		text = "Tüm yazarların engeli kaldırılıyor.";
	else
		text = "Engel kaldırma işlemi tamamlandı.";
	
	element.innerText = text +
											"\n\nEngeli kaldırılan" +
											"\n yazar: " + unbannedAuthor + " başlık: " + unbannedTitle;
}

function startScraping()
{
	window.isEksiEngelReadyToScraping = false;
	
	let TIMER_PERIOD_IN_MSEC = 100; // in milisecond
	let TIMER_TIMEOUT_IN_SEC = 15; // in second
	let TIMER_COUNTER_LIMIT = (TIMER_TIMEOUT_IN_SEC*1000)/TIMER_PERIOD_IN_MSEC;
	
	let counter = 0;
    
	// in case the author list is too long, program should wait to see it
	let scrapingTimer = setInterval(async function()	
	{
		counter++;
		
		let bannedAuthorListNodeList = getBannedAuthorListNodeList();
		let bannedTitleListNodeList = getBannedTitleListNodeList();
		let isBannedAuthorListEmptyBool = isBannedAuthorListEmpty();
		let isBannedTitleListEmptyBool = isBannedTitleListEmpty();
		
		// each list must be empty or they must be obtained
		let cond1 = isBannedAuthorListEmptyBool || (bannedAuthorListNodeList  && bannedAuthorListNodeList.length !== 0);
		let cond2 = isBannedTitleListEmptyBool || (bannedTitleListNodeList  && bannedTitleListNodeList.length !== 0);
		
	  if (cond1 && cond2) 
	  {
			clearInterval(scrapingTimer);
			window.isEksiEngelReadyToScraping = true;
			console.log("undobanAll: the timer has been cleared.");
			console.log("undobanAll: total user: " + bannedAuthorListNodeList.length +
																	 "title: " + bannedTitleListNodeList.length);
																		 
			let clientName = getClientName();
			
			let scrapeRes = await scrapingProcess(bannedAuthorListNodeList, bannedTitleListNodeList);

			let responseObj = {source: BanSource.UNDOBANALL, 
												 res: ResultType.SUCCESS, 
												 totalUser: scrapeRes.successfulAuthor, 
												 totalTitle: scrapeRes.successfulTitle, 
												 clientName: clientName};
			chrome.runtime.sendMessage(null, JSON.stringify(responseObj));
	  }
		else if(isBannedAuthorListEmptyBool && isBannedTitleListEmptyBool)
		{
			console.log("undobanAll: there is no banned author. timer stopped.");
			clearInterval(scrapingTimer); // clear interval after TIMER_TIMEOUT_IN_SEC
			window.isEksiEngelReadyToScraping = true;
		}
	  else
	  {
		  console.log("undobanAll: html element of author list could not be read");
		  if(counter > TIMER_COUNTER_LIMIT)
      {
       clearInterval(scrapingTimer); // clear interval after TIMER_TIMEOUT_IN_SEC
			 window.isEksiEngelReadyToScraping = true;
       console.log("undobanAll: html element of author list could not be read (timer stopped)");
      }
	  }
	}, TIMER_PERIOD_IN_MSEC);

}

async function scrapingProcess(bannedAuthorListNodeList, bannedTitleListNodeList)
{
	return new Promise(async function(resolve, reject) {
		
		// inject html code to display popup
		let HTMLElement_Popup = document.createElement("div"); 
		document.body.appendChild(HTMLElement_Popup); 
		HTMLElement_Popup.className = "customPopup";
		HTMLElement_Popup.innerText = "Tüm yazarların engeli kaldırılıyor."
		
		let i = 0;
		let j = 0;
		
		for(i = 0; i < bannedAuthorListNodeList.length;)
		{
			let userId = bannedAuthorListNodeList[i].getAttribute("data-userid");
			let responseJson = await undobanUser(userId);
			let left = responseJson["count"];
			let isSuccessfull = responseJson["result"];
			console.log(left + " " +  isSuccessfull);
			if(isSuccessfull)
			{
				i++;
				setPopupText(HTMLElement_Popup, i, j, true);
			}
		}
		
		for(j = 0; j < bannedTitleListNodeList.length;)
		{
			let userId = bannedTitleListNodeList[j].getAttribute("data-userid");
			let responseJson = await undobanTitle(userId);
			let left = responseJson["count"];
			let isSuccessfull = responseJson["result"];
			console.log(left + " " +  isSuccessfull);
			if(isSuccessfull)
			{
				j++;
				setPopupText(HTMLElement_Popup, i, j, true);
			}
		}
		
		setPopupText(HTMLElement_Popup, i, j, false);			
		console.log("undobanAll: number of undobanned user: " + i +
								" undobanned title: " + j);
		
		resolve({successfulAuthor: i, successfulTitle: j});		
	});
}


/*
- Ekşisözlük.com's onclick event listener of the 'remove ban links'
- Reserve engineered to make the correct POST request instead of clicking the links
  Because every link triggers a confirm() function and confirm() cannot be overriden by an extension.
(function(n) {
    function t(t) {
        const i = window.confirm(`"${t.data("nick")}" çıksın mı listeden?`);
        i && n.post(t.attr("href"), {
            id: t.data("userid")
        }, function(n) {
            if (n.result) {
                const i = t.parents("ul").prev("p"),
                    r = t.parents("li");
                r.remove();
                i.html(n.count ? `${n.count} adet.` : "kalmadı hiç.");
                ek$i.success(`"${t.data("nick")}" listeden çıkartıldı.`)
            } else ek$i.error("silemedim")
        })
    }
    ek$i.relations = ek$i.relations || {};
    n(document).ready(function() {
        n(".relation-list li span a:last-child").on("click", function(i) {
            i.preventDefault();
            t(n(this))
        })
    })
})(jQuery)
*/

{
	let readyToScraping = window.isEksiEngelReadyToScraping;
	if(typeof readyToScraping === 'undefined' || readyToScraping === true)
	{
		startScraping();
	}
	else
	{
		console.log("undobanAll: a timer already exist");
	}
}

function getBannedAuthorListNodeList()
{
	// return type: NodeList
	try
	{
		return document.getElementsByClassName("relation-list")[1].querySelectorAll("li span a[data-nick]");
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
		return document.getElementsByClassName("relation-list")[2].querySelectorAll("li span a[data-nick]");
	}
	catch(e){
		return undefined;
	}
}

async function undoban(userId, target)
{
	return new Promise(async function(resolve, reject) {
		let url;
		if(target==="target::title")
			url = 'https://eksisozluk.com/userrelation/removerelation/' + userId + '?r=i';
		else if(target==="target::user")
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
		let responseJson = await undoban(userId, "target::user");
		resolve(responseJson);
	});
}

async function undobanTitle(userId)
{
	return new Promise(async function(resolve, reject) {
		let responseJson = await undoban(userId, "target::title");
		resolve(responseJson);
	});
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
		
	  if (bannedTitleListNodeList  && bannedTitleListNodeList.length  !== 0 &&
				bannedAuthorListNodeList && bannedAuthorListNodeList.length !== 0   ) 
	  {
			clearInterval(scrapingTimer);
			window.isEksiEngelReadyToScraping = true;
			console.log("undobanAll: the timer has been cleared.");
			
			for(let i = 0; i < bannedAuthorListNodeList.length;)
			{
				let userId = bannedAuthorListNodeList[i].getAttribute("data-userid");
				let responseJson = await undobanUser(userId);
				let left = responseJson["count"];
				let isSuccessfull = responseJson["result"];
				console.log(left + " " +  isSuccessfull);
				if(isSuccessfull)
					i++;
				
				if(i>5)
					break;
			}
			
			for(let i = 0; i < bannedTitleListNodeList.length;)
			{
				let userId = bannedTitleListNodeList[i].getAttribute("data-userid");
				let responseJson = await undobanTitle(userId);
				let left = responseJson["count"];
				let isSuccessfull = responseJson["result"];
				console.log(left + " " +  isSuccessfull);
				if(isSuccessfull)
					i++;
			
				if(i>5)
					break;
			}
			
			console.log("undobanAll: number of undobanned user: " + bannedAuthorListNodeList.length +
									"undobanAll: number of undobanned title: " + bannedTitleListNodeList.length);
			let responseObj = {source: "source::undobanAll", 
												 res: "res::success", 
												 totalUser: bannedAuthorListNodeList.length, 
												 totalTitle: bannedTitleListNodeList.length, 
												 clientName: "not implemented"};
			chrome.runtime.sendMessage(null, JSON.stringify(responseObj));
	  }
	  else
	  {
		  console.log("undobanAll: html element of author list could not be read");
		  if(this.counter > TIMER_COUNTER_LIMIT)
      {
       clearInterval(scrapingTimer); // clear interval after TIMER_TIMEOUT_IN_SEC
			 window.isEksiEngelReadyToScraping = true;
       console.log("undobanAll: html element of author list could not be read (timer stopped)");
      }
	  }
	}, TIMER_PERIOD_IN_MSEC);

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

// this script is to ban/undoban a user/a user's title

// these enum and config parameters was previously injected by background script
let BanMode = window.enumEksiEngelBanMode;
let BanSource = window.enumEksiEngelBanSource;
let TargetType = window.enumEksiEngelTargetType;
let ResultType = window.enumEksiEngelResultType;

start();

async function start(){
  // these enum and config parameters was previously injected by background script			
  let banMode = window.configEksiEngelMode;
	let banSource = window.configEksiEngelBanSource;
  let responseObj = {banSource: banSource, banMode: banMode, resultType: ResultType.UNKNOWN};

  // get user id by scraping
	let userId = getUserId();
	if(userId > 0)
	{
		// send http request to perform ban/undoban
		let resUserBan = await doRequest(userId, TargetType.USER, banMode);
		let resTitleBan = await doRequest(userId, TargetType.TITLE, banMode);
		if(resUserBan && resTitleBan)
		{
			responseObj.resultType = ResultType.SUCCESS;
		}
		else
		{
			responseObj.resultType = ResultType.FAIL;
		}
	}
	else
	{
		responseObj.resultType = ResultType.FAIL;
	}
	
  let responseObjText = JSON.stringify(responseObj);
  chrome.runtime.sendMessage(null, responseObjText); // send message back to background script
}

// get user id by scraping
function getUserId()
{
	try
	{
		// example str: /userrelation/addrelation/123456?r=m
		// example id: 123456
		let str = document.getElementsByClassName("relation-link")[1].getAttribute("data-add-url");
		let id = str.match(/\d/g).join("");
		return id;
	}
	catch(err)
	{
		return 0;
	}
}

// send http request to ban/undoban
async function sendRequest(id, url, banMode)
{
	let res = false;
	try 
	{
		let response = await fetch(url, {
			method: 'POST',
				 headers: {
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
					'x-requested-with': 'XMLHttpRequest'
				},
			body: "id=" + id
		});
		const responseText = await response.text();
		const responseJson = JSON.parse(responseText);
		
		// for BanMode.BAN result is number. Probably 0 is success, 2 is already banned
		if(typeof responseJson === "number" && (responseJson === 0 || responseJson === 2))
			res = true; 
		// for BanMode.UNDOBAN result is object.
		else if(typeof responseJson === "object" && responseJson.result === true)
			res = true; 
		else
			res = false;
	}
	catch(err)
	{
		console.log(err);
	}
	return res;
}

// prepare http request with given arguments
async function doRequest(id, targetType, banMode)
{
	let url = "";
	
	if(targetType === TargetType.USER && banMode === BanMode.BAN)
	{
		url = 'https://eksisozluk.com/userrelation/addrelation/' + id + '?r=m';
	}
	else if(targetType === TargetType.USER && banMode === BanMode.UNDOBAN)
	{
		url = 'https://eksisozluk.com/userrelation/removerelation/' + id + '?r=m';
	}
	else if(targetType === TargetType.TITLE && banMode === BanMode.BAN)
	{
		url = 'https://eksisozluk.com/userrelation/addrelation/' + id + '?r=i';
	}
	else if(targetType === TargetType.TITLE && banMode === BanMode.UNDOBAN)
	{
		url = 'https://eksisozluk.com/userrelation/removerelation/' + id + '?r=i';
	}
	else
		return false;
	
	let res = await sendRequest(id, url, banMode);
	return res;
}
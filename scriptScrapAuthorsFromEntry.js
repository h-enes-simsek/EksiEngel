function getAuthorListHTMLElement()
{
	try
	{
		return document.getElementsByClassName("favorite-list-popup toggles-menu open")[0].firstChild.firstChild.getElementsByTagName("li");
	}
	catch(e){
		return undefined;
	}
}

programflow: try
{
  // prevent duplicated timers
  if(typeof this.existCondition != 'undefined') {
    console.log("a timer already exist to find author list");
    break programflow; // break the try block
  }
  
	// click to open the list of authors
	let dropDownListElement = document.getElementsByClassName("favorite-count")[1];
	if(!dropDownListElement)
		alert("Ekşisözlük hesabınıza giriş yapmış olmanız gerekiyor.");
	
	dropDownListElement.click();
    
	// after clicking, a new html element will appear, however it is time consuming
	let existCondition = setInterval(function()	
	{
		if(typeof this.counter == 'undefined') {
        this.counter = 0;
    }
		this.counter++;
	 if (getAuthorListHTMLElement() && getAuthorListHTMLElement().length != 0) 
	 {
		  console.log("timer cleared");
			clearInterval(existCondition);
			
			let dropDownList;
			let values = [];		
			
			// get list of authors
			dropDownList = getAuthorListHTMLElement();
			for(var i=0;i < dropDownList.length; i++) {
				if (dropDownList[i].innerText.length) { values.push((dropDownList[i].innerText)); }
			}
			
			// click to close the list of authors
			dropDownListElement.click();
			
			// delete '@' char from nicknames
			for(var i=0;i < values.length; i++) {
				values[i] = values[i].substr(1)
			}
			
			if(values.length > 0)
			{
				// 'çaylak' authors are not wanted
				if(values[values.length-1].substr(-6,6) === "çaylak")
					values.pop()
			}
			
			console.log("number of authors obtained: " + values.length);
			
			if(values.length > 0)
			{
				let authorListString = values.join("\n");
			
				// save the list to local storage api
				chrome.storage.local.set({"userList": authorListString }, function(){
					if(!chrome.runtime.error){
						console.log("Author list saved into local storage");
						// send start msg to background.js
						chrome.runtime.sendMessage(null, "scriptScrapAuthorsFromEntry::start");
					}else{
						console.log("chrome.storage.local.set runtime error");
						alert("chrome.storage.local.set runtime error");
					}
				});
			}
	 }
	 else
	 {
		 console.log("html element holding author list could not be read");
		 if(this.counter > 10)
     {
      clearInterval(existCondition); // clear interval after 100ms*10=1sec
      console.log("html element holding author list could not be read (timer stopped)");
     }
			 
	 }
	}, 100); // check every 100ms

}
catch
{
	console.log("scriptScrapAuthorsFromEntry: Author list could not be obtained.");
}

class CommHandler 
{
	constructor(logger)
	{
		this.log = logger;
	}
	
	sendData = async (config, clientName, banSource, banMode, authList) =>
	{
		let dataToServerObj = {};
		
    // name
		if(config.sendClientName)
		{
			if(clientName)
				dataToServerObj.name = clientName;
			else
				dataToServerObj.name = config.erroneousClientName;
		}
		else
		{
			dataToServerObj.name = config.anonymouseClientName;
		}
    
    // ban_source
    dataToServerObj.banSource = banSource;
    
    // ban_mode
    dataToServerObj.banMode = banMode;
    
    // fav_entry
    dataToServerObj.favEntry = "Not implemented";
    
    // fav_title
    dataToServerObj.favTitle = "Not implemented";
    
    // fav_author
		dataToServerObj.favAuthor = "Not implemented";
    
    // author_list
		if(config.sendAuthorList)
		{
			dataToServerObj.authList = authList;
		}
		else
		{
			dataToServerObj.authList = [];
		}
		
    // log_level and log
		if(config.sendLog)
		{
			dataToServerObj.logLevel = this.log.getLevel();
			dataToServerObj.log = this.log.getData();
		}
		else
		{
      dataToServerObj.logLevel = "DISABLED";
			dataToServerObj.log = [];
		}
		
		const response = await fetch(config.serverURL, {
			method: 'POST',
			headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
			},
			body: JSON.stringify(dataToServerObj)
		});
		this.log.info("commHandler: response status: " + response.status); 
	}
}
class CommHandler 
{
	constructor(logger)
	{
		this.log = logger;
	}
	
	sendData = async (config, clientName, banSource, banMode, authList, favAuthorName, favAuthorId, favTitleName, favTitleId, favEntryId) =>
	{
		let dataToServerObj = {};
		
    // name
		if(config.sendClientName)
		{
			if(clientName)
				dataToServerObj.name = clientName;
			else
				dataToServerObj.name = config.erroneousText;
		}
		else
		{
			dataToServerObj.name = config.anonymouseClientName;
		}
    
    // ban_source
    dataToServerObj.banSource = banSource;
    
    // ban_mode
    dataToServerObj.banMode = banMode;
    
    // fav_author
		if(favAuthorName)
			dataToServerObj.favAuthorName = favAuthorName;
		else
			dataToServerObj.favAuthorName = config.erroneousText;
		
		if(favAuthorId)
			dataToServerObj.favAuthorId = favAuthorId;
		else
			dataToServerObj.favAuthorId = config.erroneousInt;
    
    // fav_title
		if(favTitleName)
			dataToServerObj.favTitleName = favTitleName;
		else
			dataToServerObj.favTitleName = config.erroneousText;

		if(favTitleId)
			dataToServerObj.favTitleId = favTitleId;
		else
			dataToServerObj.favTitleId = config.erroneousInt;
    
    // fav_entry
		if(favEntryId)
			dataToServerObj.favEntryId = favEntryId;
		else
			dataToServerObj.favEntryId = config.erroneousInt;
    
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
		
		try
		{
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
		catch(err)
		{
			this.log.err("commHandler: err: " + err); 
		}
	}
}
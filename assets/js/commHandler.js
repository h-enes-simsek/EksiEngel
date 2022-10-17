class CommHandler 
{
	constructor(logger)
	{
		this.log = logger;
	}
	
	sendData = async (config, authList, clientName) =>
	{
		let dataToServerObj = {};
			
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
		
		if(config.sendAuthorList)
		{
			dataToServerObj.authList = authList;
		}
		else
		{
			dataToServerObj.authList = [];
		}
		
		if(config.sendLog)
		{
			dataToServerObj.log = this.log.getData();
		}
		else
		{
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
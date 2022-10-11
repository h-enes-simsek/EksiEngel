// custom logger

class Log
{
  constructor()
  {
    this.g_LoggedData = [];
		this.level = Log.Levels.INFO;
  }
	
	setLevel = (level) =>
	{
		this.level = level;
	}
  
	info = (data) =>
  {
		if(config.enableLog)
			this.logData("INF " + this.getDateString() + data, Log.Levels.INFO);
  }
  
	warn = (data) =>
  {
		if(config.enableLog)
			this.logData("WRN " + this.getDateString() + data, Log.Levels.WRN);
  }
  
	err = (data) =>
  {
		if(config.enableLog)
			this.logData("ERR " + this.getDateString() + data, Log.Levels.ERR);
  }
  
	useful = (data) =>
  {
		if(config.enableLog)
			this.logData("USF " + this.getDateString() + data, Log.Levels.USEFUL);
  }
	
	logData = (logMsg, level) =>
	{
		if(config.logConsole)
			console.log(logMsg);
		
		if(level >= this.level)
			this.g_LoggedData.push(logMsg);
	}
  
	getData = () =>
  {
    return this.g_LoggedData;
  }
  
	resetData = () =>
  {
    // memory leak?
    this.g_LoggedData = 0;
    this.g_LoggedData = []; 
  }
	
	getDateString = () =>
	{
		let date = new Date;

		let miliseconds = date.getMilliseconds();
		let seconds = date.getSeconds();
		let minutes = date.getMinutes();
		let hour = date.getHours();

		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let day = date.getDate();
		
		let d = year + "_" + month + "_" + day+  "_" + hour + "_" + minutes + "_" + seconds + "_" + miliseconds + " ";
		return d;
	}
	
  static Levels = 
  {
    INFO:   0,
    WARN:   1,
    ERR:    2,
    USEFUL: 3,
  }
	
}
// custom logger

class Log
{
  constructor()
  {
    this.g_LoggedData = [];					/* logged data */
		this.level = Log.Levels.INFO;		/* minimum log level that will be logged */
		this.isEnabled = true;					/* on-off logger */
		this.logConsole = true;					/* log to console as well */
  }
	
	setLevel = (level) =>
	{
		this.level = level;
	}
  
  getLevel = () => 
  {
    return Object.keys(Log.Levels)[this.level];
  }
	 
	setEnableStatus = (isEnabled) =>
	{
		this.isEnabled = isEnabled;
	}
  
  getEnableStatus = () => 
  {
    return this.isEnabled;
  }
	
	setLogConsole = (logConsole) =>
	{
		this.logConsole = logConsole;
	}
  
	info = (data) =>
  {
		if(this.isEnabled)
			this.logData("INF " + this.getDateString() + data, Log.Levels.INFO);
  }
  
	warn = (data) =>
  {
		if(this.isEnabled)
			this.logData("WRN " + this.getDateString() + data, Log.Levels.WRN);
  }
  
	err = (data) =>
  {
		if(this.isEnabled)
			this.logData("ERR " + this.getDateString() + data, Log.Levels.ERR);
  }
  
	useful = (data) =>
  {
		if(this.isEnabled)
			this.logData("USF " + this.getDateString() + data, Log.Levels.USEFUL);
  }
	
	logData = (logMsg, level) =>
	{
		if(this.logConsole)
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
    DISABLED: 0,
    INFO:     1,
    WARN:     2,
    ERR:      3,
    USEFUL:   4
  }
	
}
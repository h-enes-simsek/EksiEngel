// custom logger
class Log
{
  constructor()
  {
		this.g_LoggedData = [];					      /* logged data */
		this.level = Log.Levels.INFO;		      /* minimum log level that will be logged */
		this.isEnabled = true;	  						/* on-off logger */
		this.logConsole = true;  							/* log to console as well */
  }
  
	info = (data) =>
  {
		if(this.isEnabled)
			this.logData("INFO " + this.getDateString() + data, Log.Levels.INFO);
  }
  
	warn = (data) =>
  {
		if(this.isEnabled)
			this.logData("WARN " + this.getDateString() + data, Log.Levels.WARN);
  }
  
	err = (data) =>
  {
		if(this.isEnabled)
			this.logData("ERR " + this.getDateString() + data, Log.Levels.ERR);
  }
	
	logData = (logMsg, level) =>
	{
		if(this.logConsole)
			console.log(logMsg);
		
		if(parseInt(level) >= parseInt(this.level))
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
    DISABLED: "1",
    INFO:     "2",
    WARN:     "3",
    ERR:      "4"
  }
	
}

export let log = new Log();
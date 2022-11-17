import {config} from './config.js';

// custom logger
class Log
{
  constructor()
  {
    this.g_LoggedData = [];					      /* logged data */
		this.level = Log.Levels.INFO;		      /* minimum log level that will be logged */
		this._isEnabled = config.enableLog;	  /* on-off logger */
		this._logConsole = config.logConsole;  /* log to console as well */
  }
	
	setLevel = (level) =>
	{
		this.level = level;
	}
  
  getLevel = () => 
  {
    // string key of the enum, not the integer value
    return Object.keys(Log.Levels)[this.level];
  }
	 
	set isEnabled(isEnabled)
	{
		this._isEnabled = isEnabled;
	}
  
  get isEnabled()
  {
    return this._isEnabled;
  }
	
	set logConsole(logConsole)
	{
		this._logConsole = logConsole;
	}
  
  get logConsole()
  {
    return this._logConsole;
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
		if(this._logConsole)
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
    ERR:      3
  }
	
}

export let log = new Log();
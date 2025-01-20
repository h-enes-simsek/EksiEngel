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
  
	info = (source, data) =>
  {
		if(this.isEnabled)
      this.logData(`${this.getDateString()} INF [${source}] ${data}`, Log.Levels.INFO);
  }
  
	warn = (source, data) =>
  {
		if(this.isEnabled)
      this.logData(`${this.getDateString()} WRN [${source}] ${data}`, Log.Levels.WARN);
  }
  
	err = (source, data) =>
  {
		if(this.isEnabled)
      this.logData(`${this.getDateString()} ERR [${source}] ${data}`, Log.Levels.ERR);
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
    const padZero = (num, length = 2) => String(num).padStart(length, '0');

    const date = new Date();
    
    const miliseconds = padZero(date.getMilliseconds(), 3);
    const seconds = padZero(date.getSeconds());
    const minutes = padZero(date.getMinutes());
    const hour = padZero(date.getHours());
    
    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1);
    const day = padZero(date.getDate());

    const dateString = `${year}_${month}_${day}_${hour}_${minutes}_${seconds}_${miliseconds}`;
    return dateString;
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
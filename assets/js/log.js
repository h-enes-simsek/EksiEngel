// custom logger

class Log
{
  constructor()
  {
    this.g_LoggedData = createArray(4, 0); // dimension: 4x0
		this.level = Log.Levels.INFO;
  }
	
	setLevel(level)
	{
		this.level = level;
	}
  
  info(data)
  {
		if(this.level >= Log.Levels.INFO)
			this.g_LoggedData[Log.Levels.INFO].push("INF " + this.getDateString() + data);
  }
  
  warn(data)
  {
		if(this.level >= Log.Levels.WARN)
			this.g_LoggedData[Log.Levels.WARN].push("WRN " + this.getDateString() + data);
  }
  
  err(data)
  {
		if(this.level >= Log.Levels.ERR)
			this.g_LoggedData[Log.Levels.ERR].push("ERR " + this.getDateString() + data);
  }
  
  useful(data)
  {
		// always log
    this.g_LoggedData[Log.Levels.USEFUL].push("USF " + this.getDateString() + data);
  }
  
  getData(level)
  {
    return this.g_LoggedData[level];
  }
  
  resetData()
  {
    // memory leak?
    this.g_LoggedData = 0;
    this.g_LoggedData = createArray(4, 0); // dimension: 4x0
  }
	
	getDateString()
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

// thanks to stackoverflow:@Matthew Crumley
function createArray(length) 
{
	let arr = new Array(length || 0);
	let i = length;
	if(arguments.length > 1) 
	{
		let args = Array.prototype.slice.call(arguments, 1);
		while(i--) arr[length-1 - i] = createArray.apply(this, args);
	}
	return arr;
}
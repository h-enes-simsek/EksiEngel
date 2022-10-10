// custom logger

class Log
{
  constructor()
  {
    this.g_LoggedData = createArray(4, 0); // dimension: 4x0
  }
  
  info(data)
  {
    this.g_LoggedData[0].push("INF " + data);
  }
  
  warn(data)
  {
    this.g_LoggedData[1].push("WRN " + data);
  }
  
  err(data)
  {
    this.g_LoggedData[2].push("ERR " + data);
  }
  
  useful()
  {
    this.g_LoggedData[3].push("USF " + data);
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
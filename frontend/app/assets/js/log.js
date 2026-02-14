class Log {
  constructor() {
    this.g_LoggedData = [];
    this.level = Log.Levels.INFO;
    this.isEnabled = true;
    this.logConsole = true;
  }

  info = (source, data) => this.isEnabled && this.logData(`${this.getDateString()} INF [${source}] ${data}`, Log.Levels.INFO);
  warn = (source, data) => this.isEnabled && this.logData(`${this.getDateString()} WRN [${source}] ${data}`, Log.Levels.WARN);
  err = (source, data) => this.isEnabled && this.logData(`${this.getDateString()} ERR [${source}] ${data}`, Log.Levels.ERR);
  debug = (source, data) => this.isEnabled && this.logData(`${this.getDateString()} DBG [${source}] ${data}`, Log.Levels.INFO);

  logData = (logMsg, level) => {
    if (this.logConsole) console.log(logMsg);
    if (parseInt(level) >= parseInt(this.level)) this.g_LoggedData.push(logMsg);
  }

  getData = () => this.g_LoggedData;
  resetData = () => { this.g_LoggedData = []; }

  getDateString = () => {
    const padZero = (num, length = 2) => String(num).padStart(length, '0');
    const date = new Date();
    const miliseconds = padZero(date.getMilliseconds(), 3);
    const seconds = padZero(date.getSeconds());
    const minutes = padZero(date.getMinutes());
    const hour = padZero(date.getHours());
    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1);
    const day = padZero(date.getDate());
    return `${year}_${month}_${day}_${hour}_${minutes}_${seconds}_${miliseconds}`;
  }

  static Levels = { DISABLED: "1", INFO: "2", WARN: "3", ERR: "4" }
}

export let log = new Log();
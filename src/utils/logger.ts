const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

type Level = typeof LogLevel[keyof typeof LogLevel];

class Logger {
  public level: Level;

  constructor() {
    this.level = LogLevel.INFO;
  }

  setLevel(level: Level) {
    this.level = level;
  }

  shouldLog(level: Level) {
    const levelsMap: Record<Level, number> = { 
      [LogLevel.DEBUG]: 0, 
      [LogLevel.INFO]: 1, 
      [LogLevel.WARN]: 2, 
      [LogLevel.ERROR]: 3 
    };
    return levelsMap[level] >= levelsMap[this.level];
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`%c[DEBUG] ${new Date().toISOString()} | ${message}`, 'color: gray', ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`%c[INFO] ${new Date().toISOString()} | ${message}`, 'color: #007bff', ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`%c[WARN] ${new Date().toISOString()} | ${message}`, 'color: #ffc107', ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`%c[ERROR] ${new Date().toISOString()} | ${message}`, 'color: #dc3545', ...args);
    }
  }
}

export const logger = new Logger();

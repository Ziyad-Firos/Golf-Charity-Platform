export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
  requestId?: string;
  userId?: string;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, meta, requestId, userId } = entry;
    const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
    const contextStr = requestId || userId ? ` | Context: ${requestId || userId}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}${contextStr}`;
  }

  private log(level: LogLevel, message: string, meta?: any, requestId?: string, userId?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
      requestId,
      userId
    };

    this.logs.push(entry);
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console
    const formattedLog = this.formatLog(entry);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedLog);
        break;
    }
  }

  error(message: string, meta?: any, requestId?: string, userId?: string): void {
    this.log(LogLevel.ERROR, message, meta, requestId, userId);
  }

  warn(message: string, meta?: any, requestId?: string, userId?: string): void {
    this.log(LogLevel.WARN, message, meta, requestId, userId);
  }

  info(message: string, meta?: any, requestId?: string, userId?: string): void {
    this.log(LogLevel.INFO, message, meta, requestId, userId);
  }

  debug(message: string, meta?: any, requestId?: string, userId?: string): void {
    this.log(LogLevel.DEBUG, message, meta, requestId, userId);
  }

  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    
    return filteredLogs;
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = Logger.getInstance();

// Request ID middleware
export const requestIdMiddleware = (req: any, res: any, next: any) => {
  req.requestId = Math.random().toString(36).substring(2, 15);
  next();
};

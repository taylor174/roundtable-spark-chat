/**
 * Production-ready logging utility
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  component?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, data?: any, component?: string): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      component
    };
  }

  debug(message: string, data?: any, component?: string) {
    if (this.isDevelopment) {
      const entry = this.formatMessage('debug', message, data, component);
      console.log(`[DEBUG] ${entry.component ? `[${entry.component}] ` : ''}${message}`, data);
    }
  }

  info(message: string, data?: any, component?: string) {
    const entry = this.formatMessage('info', message, data, component);
    console.info(`[INFO] ${entry.component ? `[${entry.component}] ` : ''}${message}`, data);
  }

  warn(message: string, data?: any, component?: string) {
    const entry = this.formatMessage('warn', message, data, component);
    console.warn(`[WARN] ${entry.component ? `[${entry.component}] ` : ''}${message}`, data);
  }

  error(message: string, data?: any, component?: string) {
    const entry = this.formatMessage('error', message, data, component);
    console.error(`[ERROR] ${entry.component ? `[${entry.component}] ` : ''}${message}`, data);
  }
}

export const logger = new Logger();
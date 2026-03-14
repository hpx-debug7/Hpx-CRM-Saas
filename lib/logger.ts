export type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  service?: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  userId?: string;
  companyId?: string;
  message?: string;
  stack?: string;
  [key: string]: any;
}

const redactSensitiveData = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redactSensitiveData);

  const redacted = { ...data };
  const sensitiveKeys = ['password', 'token', 'authorization', 'secret', 'key', 'accesstoken', 'refreshtoken'];

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((k) => lowerKey.includes(k))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }
  return redacted;
};

class Logger {
  private baseContext: LogContext;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = {
      service: 'hpx-crm-saas',
      ...baseContext,
    };
  }

  private log(level: LogLevel, msg: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const safeContext = redactSensitiveData(context || {});

    const logEntry = {
      level,
      timestamp,
      message: msg,
      ...this.baseContext,
      ...safeContext,
    };

    const jsonString = JSON.stringify(logEntry);

    switch (level) {
      case 'info':
        console.info(jsonString);
        break;
      case 'warn':
        console.warn(jsonString);
        break;
      case 'error':
        console.error(jsonString);
        break;
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();

/**
 * Storage Error Logger
 * Centralized logging for storage-related errors
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  STORAGE = 'storage',
  ENCRYPTION = 'encryption',
  VALIDATION = 'validation',
  QUOTA = 'quota',
  CORRUPTION = 'corruption'
}

export interface StorageError {
  timestamp: number;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  error?: Error;
  context?: Record<string, any>;
}

class StorageErrorLogger {
  private errors: StorageError[] = [];
  private maxErrors = 1000;

  logStorageError(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      timestamp: Date.now(),
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.STORAGE,
      message,
      error,
      context
    });
  }

  logQuotaExceeded(message: string, context?: Record<string, any>): void {
    this.logError({
      timestamp: Date.now(),
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.QUOTA,
      message,
      context
    });
  }

  logEncryptionError(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      timestamp: Date.now(),
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.ENCRYPTION,
      message,
      error,
      context
    });
  }

  logDecryptionError(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      timestamp: Date.now(),
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.ENCRYPTION,
      message,
      error,
      context
    });
  }

  logValidationError(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      timestamp: Date.now(),
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.VALIDATION,
      message,
      error,
      context
    });
  }

  private logError(error: StorageError): void {
    this.errors.push(error);
    
    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${error.category.toUpperCase()}] ${error.message}`, error.error);
    }
  }

  getErrors(): StorageError[] {
    return [...this.errors];
  }

  getErrorsByCategory(category: ErrorCategory): StorageError[] {
    return this.errors.filter(error => error.category === category);
  }

  getErrorsBySeverity(severity: ErrorSeverity): StorageError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  clearErrors(): void {
    this.errors = [];
  }

  getErrorCount(): number {
    return this.errors.length;
  }
}

export const storageErrorLogger = new StorageErrorLogger();

// Export individual functions for backward compatibility
export const logStorageError = (message: string, error?: Error, context?: Record<string, any>) => 
  storageErrorLogger.logStorageError(message, error, context);

export const logQuotaExceeded = (message: string, context?: Record<string, any>) => 
  storageErrorLogger.logQuotaExceeded(message, context);

export const logEncryptionError = (message: string, error?: Error, context?: Record<string, any>) => 
  storageErrorLogger.logEncryptionError(message, error, context);

export const logDecryptionError = (message: string, error?: Error, context?: Record<string, any>) => 
  storageErrorLogger.logDecryptionError(message, error, context);

export const logValidationError = (message: string, error?: Error, context?: Record<string, any>) => 
  storageErrorLogger.logValidationError(message, error, context);

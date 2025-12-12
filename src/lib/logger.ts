export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  request_id: string;
  session_id?: string;
  operation: string;
  message: string;
  duration_ms?: number;

  // Context fields
  path?: string;
  method?: string;
  status_code?: number;
  tool?: string;
  source_id?: string;
  source_type?: string;
  entanglement_id?: string;
  zoku_id?: string;

  // Error details
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };

  // Additional metadata
  metadata?: Record<string, any>;
}

export class Logger {
  private context: Partial<LogEntry>;
  private startTime: number;
  private minLevel: LogLevel;

  constructor(context: Partial<LogEntry>, minLevel: LogLevel = 'info') {
    this.context = context;
    this.startTime = Date.now();
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['info', 'warn', 'error', 'fatal'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private emit(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;
    console.log(JSON.stringify(entry));
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.emit({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      metadata,
      ...this.context,
    } as LogEntry);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.emit({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      metadata,
      ...this.context,
    } as LogEntry);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.emit({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      error: error ? {
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
      } : undefined,
      metadata,
      ...this.context,
    } as LogEntry);
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.emit({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      message,
      error: error ? {
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
      } : undefined,
      metadata,
      ...this.context,
    } as LogEntry);
  }

  child(additionalContext: Partial<LogEntry>): Logger {
    return new Logger(
      { ...this.context, ...additionalContext },
      this.minLevel
    );
  }

  withDuration(): Partial<LogEntry> {
    return {
      duration_ms: Date.now() - this.startTime,
    };
  }
}

import { Injectable, LoggerService as NestLoggerService, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface OperationLogInput {
  event: string;
  level?: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
  trace?: string;
}

export interface StructuredLogPayload {
  level: LogLevel;
  message: string;
  service: string;
  event?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERN = /(authorization|token|password|secret|access[_-]?key|private[_-]?key|credential|vault|pgpassword|aws_secret_access_key)/i;
const SENSITIVE_VALUE_PATTERN = /(password|token|secret|authorization|access[_-]?key)=([^\s]+)/gi;
const REDACTED = '[redacted]';

function redactString(value: string): string {
  return value.replace(SENSITIVE_VALUE_PATTERN, '$1=[redacted]');
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (value && typeof value === 'object') return sanitizeMetadata(value as Record<string, unknown>);
  return value;
}

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeValue(value);
  }
  return sanitized;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private logDir: string;
  private loggingServiceUrl: string | undefined;
  private loggingServiceApiPath: string;
  private readonly serviceName = process.env.SERVICE_NAME || 'backups-microservice';

  constructor(@Inject(HttpService) private readonly httpService: HttpService) {
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
    this.loggingServiceUrl = process.env.LOGGING_SERVICE_URL;
    this.loggingServiceApiPath = process.env.LOGGING_SERVICE_API_PATH || '/api/logs';
  }

  private async sendToLoggingService(payload: StructuredLogPayload): Promise<void> {
    if (!this.loggingServiceUrl) return;
    firstValueFrom(
      this.httpService.post(`${this.loggingServiceUrl}${this.loggingServiceApiPath}`, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      }),
    ).catch(() => {});
  }

  private writeLog(payload: StructuredLogPayload, context?: string, trace?: string) {
    const metadata = payload.metadata && Object.keys(payload.metadata).length > 0
      ? ` ${JSON.stringify(payload.metadata)}`
      : '';
    const event = payload.event ? ` event=${payload.event}` : '';
    const traceLine = trace ? `\n${redactString(trace)}` : '';
    const line = `[${payload.timestamp}] [${payload.level.toUpperCase()}]${context ? ` [${context}]` : ''}${event} ${payload.message}${metadata}${traceLine}\n`;
    try {
      fs.appendFileSync(path.join(this.logDir, `${payload.level}.log`), line, 'utf8');
      fs.appendFileSync(path.join(this.logDir, 'all.log'), line, 'utf8');
    } catch {}
  }

  operation(input: OperationLogInput): void {
    const level = input.level || 'info';
    const metadata = sanitizeMetadata({
      ...(input.context ? { context: input.context } : {}),
      ...(input.trace ? { trace: input.trace } : {}),
      ...(input.metadata || {}),
    });
    const payload: StructuredLogPayload = {
      level,
      event: input.event,
      message: redactString(input.message),
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    };
    this.sendToLoggingService(payload).catch(() => {});
    this.writeLog(payload, input.context, input.trace);
  }

  log(message: string, context?: string) {
    this.operation({ event: 'application.log', level: 'info', message, context });
  }

  error(message: string, trace?: string, context?: string) {
    this.operation({ event: 'application.error', level: 'error', message, context, trace });
  }

  warn(message: string, context?: string) {
    this.operation({ event: 'application.warn', level: 'warn', message, context });
  }

  debug(message: string, context?: string) {
    this.operation({ event: 'application.debug', level: 'debug', message, context });
  }

  verbose(message: string, context?: string) { this.debug(message, context); }
}

import { Injectable, LoggerService as NestLoggerService, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logDir: string;
  private loggingServiceUrl: string | undefined;
  private readonly serviceName = 'backups-microservice';

  constructor(@Inject(HttpService) private readonly httpService: HttpService) {
    this.logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
    this.loggingServiceUrl = process.env.LOGGING_SERVICE_URL;
  }

  private async sendToLoggingService(level: string, message: string, context?: string, trace?: string): Promise<void> {
    if (!this.loggingServiceUrl) return;
    const payload = {
      level, message,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      ...(context || trace ? { metadata: { context, trace } } : {}),
    };
    firstValueFrom(
      this.httpService.post(`${this.loggingServiceUrl}/api/logs`, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      }),
    ).catch(() => {});
  }

  private writeLog(level: string, message: string, context?: string) {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}]${context ? ` [${context}]` : ''} ${message}\n`;
    try {
      fs.appendFileSync(path.join(this.logDir, `${level}.log`), line, 'utf8');
      fs.appendFileSync(path.join(this.logDir, 'all.log'), line, 'utf8');
    } catch {}
  }

  log(message: string, context?: string) {
    this.sendToLoggingService('info', message, context).catch(() => {});
    this.writeLog('info', message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.sendToLoggingService('error', message, context, trace).catch(() => {});
    this.writeLog('error', `${message}${trace ? '\n' + trace : ''}`, context);
  }

  warn(message: string, context?: string) {
    this.sendToLoggingService('warn', message, context).catch(() => {});
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: string) {
    this.sendToLoggingService('debug', message, context).catch(() => {});
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: string) { this.debug(message, context); }
}

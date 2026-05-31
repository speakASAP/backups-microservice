import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../../shared/logger/logger.service';

@Injectable()
export class NotificationsService {
  private readonly url: string;
  private readonly token: string;

  constructor(private httpService: HttpService, private logger: LoggerService) {
    this.url = process.env.NOTIFICATIONS_SERVICE_URL || process.env.NOTIFICATION_SERVICE_URL || '';
    this.token = process.env.NOTIFICATIONS_SERVICE_TOKEN || '';
  }

  async send(event: string, message: string, details?: Record<string, unknown>): Promise<void> {
    if (!this.url || !this.token) return;
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.url}/notify`,
          { event, message, service: 'backups-microservice', details },
          { headers: { Authorization: `Bearer ${this.token}` }, timeout: 5000 },
        ),
      );
    } catch (err) {
      this.logger.warn(`Failed to send notification event=${event}: ${err}`, 'NotificationsService');
    }
  }
}

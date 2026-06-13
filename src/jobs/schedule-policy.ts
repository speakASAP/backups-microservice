import { BadRequestException } from '@nestjs/common';

export enum SchedulePolicyType {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  CUSTOM_CRON = 'custom_cron',
}

export type SchedulePolicyInput = {
  schedule_cron?: string;
  schedule_policy?: SchedulePolicyType | string;
  schedule_hour_utc?: number;
  schedule_minute_utc?: number;
  schedule_day_of_week?: number;
};

const CRON_PART = /^[0-9*,/-]+$/;

function assertRange(name: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function validateCronExpression(cron: string): string {
  const normalized = cron.trim().replace(/\s+/g, ' ');
  const parts = normalized.split(' ');
  if (parts.length !== 5 || parts.some((part) => !CRON_PART.test(part))) {
    throw new BadRequestException('schedule_cron must be a five-field cron expression using minute hour day month weekday.');
  }
  return normalized;
}

export function resolveSchedulePolicy(input: SchedulePolicyInput): {
  schedule_policy: SchedulePolicyType;
  schedule_cron: string;
  schedule_hour_utc: number | null;
  schedule_minute_utc: number | null;
  schedule_day_of_week: number | null;
} {
  const policy = (input.schedule_policy || (input.schedule_cron ? SchedulePolicyType.CUSTOM_CRON : SchedulePolicyType.DAILY)) as SchedulePolicyType;
  const minute = assertRange('schedule_minute_utc', input.schedule_minute_utc ?? 0, 0, 59);

  if (policy === SchedulePolicyType.HOURLY) {
    return {
      schedule_policy: policy,
      schedule_cron: `${minute} * * * *`,
      schedule_hour_utc: null,
      schedule_minute_utc: minute,
      schedule_day_of_week: null,
    };
  }

  if (policy === SchedulePolicyType.DAILY) {
    const hour = assertRange('schedule_hour_utc', input.schedule_hour_utc ?? 2, 0, 23);
    return {
      schedule_policy: policy,
      schedule_cron: `${minute} ${hour} * * *`,
      schedule_hour_utc: hour,
      schedule_minute_utc: minute,
      schedule_day_of_week: null,
    };
  }

  if (policy === SchedulePolicyType.WEEKLY) {
    const hour = assertRange('schedule_hour_utc', input.schedule_hour_utc ?? 2, 0, 23);
    const day = assertRange('schedule_day_of_week', input.schedule_day_of_week ?? 0, 0, 6);
    return {
      schedule_policy: policy,
      schedule_cron: `${minute} ${hour} * * ${day}`,
      schedule_hour_utc: hour,
      schedule_minute_utc: minute,
      schedule_day_of_week: day,
    };
  }

  if (policy === SchedulePolicyType.CUSTOM_CRON) {
    if (!input.schedule_cron) throw new BadRequestException('schedule_cron is required for custom_cron schedule policy.');
    return {
      schedule_policy: policy,
      schedule_cron: validateCronExpression(input.schedule_cron),
      schedule_hour_utc: input.schedule_hour_utc ?? null,
      schedule_minute_utc: input.schedule_minute_utc ?? null,
      schedule_day_of_week: input.schedule_day_of_week ?? null,
    };
  }

  throw new BadRequestException(`Unsupported schedule_policy: ${policy}`);
}

import { BadRequestException } from '@nestjs/common';
import { resolveSchedulePolicy, SchedulePolicyType, validateCronExpression } from '../src/jobs/schedule-policy';

describe('schedule policies', () => {
  it('builds daily cron policy by default', () => {
    expect(resolveSchedulePolicy({})).toEqual({
      schedule_policy: SchedulePolicyType.DAILY,
      schedule_cron: '0 2 * * *',
      schedule_hour_utc: 2,
      schedule_minute_utc: 0,
      schedule_day_of_week: null,
    });
  });

  it('builds hourly and weekly cron expressions', () => {
    expect(resolveSchedulePolicy({ schedule_policy: SchedulePolicyType.HOURLY, schedule_minute_utc: 15 }).schedule_cron).toBe('15 * * * *');
    expect(resolveSchedulePolicy({ schedule_policy: SchedulePolicyType.WEEKLY, schedule_day_of_week: 1, schedule_hour_utc: 3 }).schedule_cron).toBe('0 3 * * 1');
  });

  it('normalizes custom cron expressions', () => {
    expect(validateCronExpression(' 5   4 * * 1 ')).toBe('5 4 * * 1');
    expect(resolveSchedulePolicy({ schedule_policy: SchedulePolicyType.CUSTOM_CRON, schedule_cron: '5 4 * * 1' }).schedule_cron).toBe('5 4 * * 1');
  });

  it('rejects invalid policy values and cron expressions', () => {
    expect(() => resolveSchedulePolicy({ schedule_policy: 'monthly' })).toThrow(BadRequestException);
    expect(() => resolveSchedulePolicy({ schedule_policy: SchedulePolicyType.DAILY, schedule_hour_utc: 25 })).toThrow(BadRequestException);
    expect(() => validateCronExpression('* * *')).toThrow(BadRequestException);
  });
});

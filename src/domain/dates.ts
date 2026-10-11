import { CosmosError } from '../errors.js';
export interface Schedule { date?: string; time?: string; timeZone: string; relativeDays?: number; baseDate?: string }
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CosmosError('INVALID_DATE', '日期需要 YYYY-MM-DD。');
  const d = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new CosmosError('INVALID_DATE', '日期不存在。');
  return value;
}
export function todayIn(timeZone: string, now = new Date()) {
  let formatter;
  try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { throw new CosmosError('INVALID_TIMEZONE', '需要有效 IANA 时区。'); }
  const p = Object.fromEntries(formatter.formatToParts(now).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function schedule(value: Schedule, now = new Date()): string {
  todayIn(value.timeZone, now);
  if (value.date && value.relativeDays !== undefined) throw new CosmosError('INVALID_DATE', '绝对日期与相对日期不能同时填写。');
  let date = value.date;
  if (value.relativeDays !== undefined) {
    if (!Number.isInteger(value.relativeDays) || !value.baseDate) throw new CosmosError('INVALID_DATE', '相对日期需要整数天数和明确基准日期。');
    const base = new Date(validDate(value.baseDate) + 'T00:00:00Z'); base.setUTCDate(base.getUTCDate() + value.relativeDays); date = base.toISOString().slice(0, 10);
  }
  if (!date) throw new CosmosError('NEEDS_INPUT', '需要具体日期或带基准的相对日期。');
  validDate(date);
  if (!value.time) return date;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) throw new CosmosError('INVALID_TIME', '时间需要 HH:mm。');
  // TaskNotes stores wall times. The preview retains its zone and converts only once.
  return date + 'T' + value.time;
}

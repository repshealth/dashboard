/**
 * When each launch email goes out, counted in days from the app's launch date.
 * Both lists follow the same shape: 2 warm-ups before launch, then 4 emails with the
 * website link while the launch offer is open.
 */
export type EmailStage = 'warmup' | 'launch';

export interface Slot {
  n: number; // 1 to 6
  stage: EmailStage;
  offset: number; // days from launch day (negative = before)
  time: string; // "09:00", UK time
  purpose: string; // what this email is for, used in the brief for Claude and shown to the team
}

/** The six send slots, given how many days the launch offer stays open (4, 5 or 7). */
export function sequenceSlots(offerDays: number | string): Slot[] {
  const d = Math.max(4, Number(offerDays) || 5);
  return [
    { n: 1, stage: 'warmup', offset: -7, time: '09:00', purpose: 'Warm-up: the story behind the app and the problem it solves' },
    { n: 2, stage: 'warmup', offset: -3, time: '09:00', purpose: 'Warm-up: what is inside the app and what launch day looks like' },
    { n: 3, stage: 'launch', offset: 0, time: '08:00', purpose: 'Launch day: the app is live, here is the link' },
    { n: 4, stage: 'launch', offset: 1, time: '12:00', purpose: 'Day two: answer the main doubt and show how it fits a busy week' },
    { n: 5, stage: 'launch', offset: d - 2, time: '18:00', purpose: 'Results and proof: what members get from it' },
    { n: 6, stage: 'launch', offset: d - 1, time: '09:00', purpose: 'Last call: the launch window closes tonight' },
  ];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-02" + offset + "09:00" -> "2026-10-26T09:00" (local, no time zone). */
export function sendAt(launchDate: string, offset: number, time: string) {
  const [y, m, day] = launchDate.split('-').map(Number);
  if (!y || !m || !day) return '';
  const dt = new Date(Date.UTC(y, m - 1, day + offset));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}T${time}`;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-26T09:00" -> "Mon 26 Oct, 9:00am". */
export function fmtSend(local: string) {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return 'Date to be set';
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const day = `${DOW[dt.getUTCDay()]} ${+m[3]} ${MON[+m[2] - 1]}`;
  if (!m[4]) return day;
  const h = +m[4];
  return `${day}, ${h % 12 || 12}${m[5] === '00' ? '' : `:${m[5]}`}${h < 12 ? 'am' : 'pm'}`;
}

/** "2026-11-02" -> "Monday 2 November". */
export function fmtLaunch(date: string) {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getUTCDay()];
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m[2] - 1];
  return `${long} ${+m[3]} ${month}`;
}

/** "-7" -> "7 days before launch", "0" -> "Launch day". */
export function offsetLabel(offset: number) {
  if (offset === 0) return 'Launch day';
  const n = Math.abs(offset);
  return `${n} day${n === 1 ? '' : 's'} ${offset < 0 ? 'before' : 'after'} launch`;
}

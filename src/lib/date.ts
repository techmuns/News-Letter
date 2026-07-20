/* Small date helpers — mock timestamps stay fresh relative to "now",
   and the email schedule always lands on the current week's Mon/Wed/Fri. */

export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3600_000).toISOString()
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

/** "2h ago" · "3d ago" · "just now" — friendly relative time. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const min = Math.round(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  return `${weeks}w ago`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "Mon 20 Jul" from an ISO date (yyyy-mm-dd) or full ISO. */
export function formatDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** "Jul 20, 2026" from a full ISO or yyyy-mm-dd date. */
export function formatAbsolute(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function weekdayName(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso)
  const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return full[d.getDay()]
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Monday of the current week (week starts Monday), at local noon. */
function currentMonday(): Date {
  const d = new Date()
  const mon0 = (d.getDay() + 6) % 7 // Monday = 0
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - mon0)
  return d
}

/**
 * Date (yyyy-mm-dd) for a weekday in a given week.
 * weekOffset: 0 = this week, 1 = next week.
 * weekdayMon0: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4.
 */
export function weekdayIn(weekOffset: number, weekdayMon0: number): string {
  const mon = currentMonday()
  mon.setDate(mon.getDate() + weekOffset * 7 + weekdayMon0)
  return isoDate(mon)
}

/** Which week bucket a date falls in relative to now: this / next / later / past. */
export function weekBucket(iso: string): 'this' | 'next' | 'later' | 'past' {
  const mon = currentMonday()
  const target = new Date(`${iso.slice(0, 10)}T12:00:00`)
  const diffDays = Math.floor((target.getTime() - mon.getTime()) / 86_400_000)
  if (diffDays < 0) return 'past'
  if (diffDays < 7) return 'this'
  if (diffDays < 14) return 'next'
  return 'later'
}

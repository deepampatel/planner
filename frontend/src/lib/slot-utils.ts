import { DAY_PERIODS, TIME_SLOT_MINUTES } from './constants'

export interface TimeSlot {
  start: string // RFC3339 UTC
  end: string   // RFC3339 UTC
}

export interface DayBlock {
  start: string // RFC3339 UTC
  end: string   // RFC3339 UTC
  label: string
  period: 'Morning' | 'Afternoon' | 'Evening'
}

/**
 * Format a Date to RFC3339 UTC string without milliseconds.
 * Matches Go's time.RFC3339 format: "2026-03-14T02:30:00Z"
 */
function toRFC3339(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z')
}

/**
 * Get the UTC offset in minutes for a given IANA timezone on a specific date.
 * Positive = ahead of UTC (e.g., IST = +330), Negative = behind (e.g., EST = -300).
 * Handles DST transitions correctly via Intl.
 */
function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  // Format the date in the target timezone to extract the local time
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
  const localDate = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') === 24 ? 0 : get('hour'), get('minute'), get('second')))

  // Offset = local time - UTC time (in minutes)
  return Math.round((localDate.getTime() - date.getTime()) / 60000)
}

/**
 * Create a Date representing "hour:minute in planTimezone on the given date",
 * returned as a UTC Date object.
 *
 * Example: localToUtc(2026, 2, 14, 8, 0, 'Asia/Kolkata')
 *   → 8:00 AM IST = 02:30 AM UTC → Date(2026-03-14T02:30:00Z)
 */
function localToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
  // Start with a rough UTC estimate
  const roughUtc = new Date(Date.UTC(year, month, day, hour, minute, 0, 0))
  // Get the offset for this timezone at this approximate time
  const offsetMin = getTimezoneOffsetMinutes(roughUtc, timezone)
  // Subtract offset to get actual UTC time
  // If timezone is IST (+330 min), 8:00 local = 8:00 - 5:30 = 02:30 UTC
  return new Date(Date.UTC(year, month, day, hour, minute, 0, 0) - offsetMin * 60000)
}

/**
 * Generate 30-minute time slots for each date in the range.
 * Slots represent 8:00 AM – 10:00 PM in the PLAN'S timezone,
 * stored as UTC RFC3339 strings.
 */
export function generateTimeSlots(dateStart: string, dateEnd: string, planTimezone?: string): TimeSlot[] {
  const tz = planTimezone || 'UTC'
  const slots: TimeSlot[] = []
  const start = new Date(dateStart + 'T00:00:00Z')
  const end = new Date(dateEnd + 'T00:00:00Z')

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const day = d.getUTCDate()

    for (let hour = 0; hour < 24; hour++) {
      for (const min of [0, 30]) {
        const slotStart = localToUtc(year, month, day, hour, min, tz)
        const slotEnd = new Date(slotStart.getTime() + TIME_SLOT_MINUTES * 60 * 1000)

        slots.push({
          start: toRFC3339(slotStart),
          end: toRFC3339(slotEnd),
        })
      }
    }
  }

  return slots
}

/**
 * Generate day blocks (Morning/Afternoon/Evening) for each date.
 * Periods are in the PLAN'S timezone, stored as UTC.
 */
export function generateDayBlocks(dateStart: string, dateEnd: string, planTimezone?: string): DayBlock[] {
  const tz = planTimezone || 'UTC'
  const blocks: DayBlock[] = []
  const start = new Date(dateStart + 'T00:00:00Z')
  const end = new Date(dateEnd + 'T00:00:00Z')

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const day = d.getUTCDate()

    for (const period of DAY_PERIODS) {
      const slotStart = localToUtc(year, month, day, period.startHour, 0, tz)
      const slotEnd = localToUtc(year, month, day, period.endHour, 0, tz)

      blocks.push({
        start: toRFC3339(slotStart),
        end: toRFC3339(slotEnd),
        label: period.label,
        period: period.label as DayBlock['period'],
      })
    }
  }

  return blocks
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export function getDatesInRange(start: string, end: string): Date[] {
  const dates: Date[] = []
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(new Date(d))
  }
  return dates
}

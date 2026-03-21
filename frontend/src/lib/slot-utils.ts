import { DAY_PERIODS, TIME_SLOT_MINUTES } from './constants'

export interface TimeSlot {
  start: string
  end: string
  label: string
}

export interface DayBlock {
  start: string
  end: string
  label: string
  period: 'Morning' | 'Afternoon' | 'Evening'
}

/**
 * Format a Date to RFC3339 UTC string without milliseconds.
 * Matches Go's time.RFC3339 format: "2026-03-14T08:00:00Z"
 */
function toRFC3339(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z')
}

/**
 * Create a UTC date for a specific date + UTC hour/minute.
 * Uses Date.UTC to avoid local timezone interference.
 */
function utcDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute, 0, 0))
}

export function generateTimeSlots(dateStart: string, dateEnd: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  const start = new Date(dateStart + 'T00:00:00Z')
  const end = new Date(dateEnd + 'T00:00:00Z')

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const day = d.getUTCDate()

    for (let hour = 8; hour < 22; hour++) {
      for (const min of [0, 30]) {
        const slotStart = utcDate(year, month, day, hour, min)
        const slotEnd = new Date(slotStart.getTime() + TIME_SLOT_MINUTES * 60 * 1000)

        const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const label = `${h}:${min === 0 ? '00' : '30'} ${ampm}`

        slots.push({
          start: toRFC3339(slotStart),
          end: toRFC3339(slotEnd),
          label,
        })
      }
    }
  }

  return slots
}

export function generateDayBlocks(dateStart: string, dateEnd: string): DayBlock[] {
  const blocks: DayBlock[] = []
  const start = new Date(dateStart + 'T00:00:00Z')
  const end = new Date(dateEnd + 'T00:00:00Z')

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const day = d.getUTCDate()

    for (const period of DAY_PERIODS) {
      const slotStart = utcDate(year, month, day, period.startHour, 0)
      const slotEnd = utcDate(year, month, day, period.endHour, 0)

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

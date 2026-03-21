export const APP_NAME = 'plan.fast'
export const APP_TAGLINE = 'Stop planning. Start going.'

export const MAX_DATE_RANGE_DAYS = 28
export const DEFAULT_DURATION_MINUTES = 60

export const TIME_SLOT_MINUTES = 30
export const DAY_PERIODS = [
  { label: 'Morning', startHour: 8, endHour: 12 },
  { label: 'Afternoon', startHour: 12, endHour: 17 },
  { label: 'Evening', startHour: 17, endHour: 22 },
] as const

export const PLAN_EXPIRY_DAYS = 14

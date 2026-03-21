export type PlanStatus = 'active' | 'locked' | 'expired'
export type Granularity = 'time' | 'day' | 'options'

export interface CustomOption {
  label: string
  description?: string
}
export type AvailabilityStatus = 'free' | 'maybe'
export type CellState = 'free' | 'maybe' | 'clear'

export interface Plan {
  id: number
  slug: string
  customSlug?: string
  title: string
  location: string
  dateRangeStart: string
  dateRangeEnd: string
  durationMinutes: number
  granularity: Granularity
  status: PlanStatus
  timezone: string
  customOptions?: CustomOption[]
  participantCount: number
  participants: Participant[]
  myParticipantId?: number
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export interface Participant {
  id: number
  planId: number
  displayName: string
  email?: string
  timezone: string
  hasResponded: boolean
  availability: AvailabilitySlot[]
  createdAt: string
}

export interface AvailabilitySlot {
  slotStart: string
  slotEnd: string
  status: AvailabilityStatus
}

export interface AvailabilityUpdate {
  slotStart: string
  slotEnd: string
  status: CellState
}

export interface HeatmapCell {
  slotStart: string
  slotEnd: string
  freeCount: number
  maybeCount: number
  totalParticipants: number
  score: number
}

export interface BestSlot {
  start: string
  end: string
  score: number
  freeParticipants: string[]
  maybeParticipants: string[]
}

export interface HeatmapResponse {
  cells: HeatmapCell[]
  bestSlot?: BestSlot
}

export interface PlanWithTokens {
  plan: Plan
  hostToken: string
  editToken: string
}

export interface JoinResult {
  participant: Participant
  editToken: string
}

export interface CreatePlanInput {
  title: string
  location?: string
  dateRangeStart: string
  dateRangeEnd: string
  durationMinutes: number
  granularity: Granularity
  timezone: string
  customSlug?: string
  hostName: string
  customOptions?: CustomOption[]
}

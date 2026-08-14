import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Plan, HeatmapResponse } from '@/lib/types'
import { PlanView } from '@/components/plan/plan-view'
import { formatDateRange } from '@/lib/timezone'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080'

async function getPlan(slug: string): Promise<Plan | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/plans/${slug}`, {
      cache: 'no-store',
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getHeatmap(slug: string): Promise<HeatmapResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/plans/${slug}/heatmap`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const plan = await getPlan(slug)
  if (!plan) return {}

  const respondedCount = plan.participants.filter(p => p.hasResponded).length
  let description: string

  if (plan.status === 'locked') {
    // Prefer the host-picked slot; fall back to heatmap best for legacy locks
    let slotStart = plan.finalizedSlotStart
    if (!slotStart) {
      const heatmap = await getHeatmap(slug)
      slotStart = heatmap?.bestSlot?.start
    }
    if (slotStart) {
      const bestDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        ...(plan.granularity !== 'day' ? { hour: 'numeric', minute: '2-digit' } : {}),
        timeZone: plan.timezone || 'UTC',
      }).format(new Date(slotStart))
      description = `It's happening: ${bestDate}. ${plan.participantCount} people planned.`
    } else {
      description = `Plan locked. ${plan.participantCount} people planned.`
    }
  } else {
    const deadline = plan.respondBy
      ? ` Respond by ${new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(plan.respondBy + 'T00:00:00Z'))}.`
      : ''
    description = `${respondedCount} of ${plan.participantCount} responded.${deadline} Tap to mark your availability — takes 20 seconds.`
  }

  const dateRange = plan.granularity !== 'options'
    ? ` ${formatDateRange(plan.dateRangeStart, plan.dateRangeEnd)}`
    : ''

  return {
    title: `${plan.title} | plann.fast`,
    description: `${description}${dateRange}`,
    openGraph: {
      title: `${plan.title} — plann.fast`,
      description,
      type: 'website',
      siteName: 'plann.fast',
    },
    twitter: {
      card: 'summary',
      title: `${plan.title} — plann.fast`,
      description,
    },
  }
}

export default async function PlanPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const plan = await getPlan(slug)
  if (!plan) notFound()

  return <PlanView initialData={plan} slug={slug} />
}

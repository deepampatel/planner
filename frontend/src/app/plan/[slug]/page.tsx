import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Plan } from '@/lib/types'
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

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const plan = await getPlan(slug)
  if (!plan) return {}

  const dateRange = formatDateRange(plan.dateRangeStart, plan.dateRangeEnd)

  return {
    title: `${plan.title} | plann.fast`,
    description: `${plan.participantCount} people planning ${plan.title}. ${dateRange}`,
    openGraph: {
      title: plan.title,
      description: `${plan.participantCount} people planning. Join and mark your availability!`,
      type: 'website',
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

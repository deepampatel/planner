import { ImageResponse } from 'next/og'
import type { Plan } from '@/lib/types'
import { formatDateRange } from '@/lib/timezone'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'plann.fast — group plan'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080'

export default async function Image({ params }: { params: { slug: string } }) {
  let plan: Plan | null = null
  try {
    const res = await fetch(`${BACKEND_URL}/api/plans/${params.slug}`, { cache: 'no-store' })
    if (res.ok) plan = await res.json()
  } catch { /* fall through to generic card */ }

  const title = plan?.title || 'Group plan'
  const isLocked = plan?.status === 'locked'
  const dateRange = plan && plan.granularity !== 'options'
    ? formatDateRange(plan.dateRangeStart, plan.dateRangeEnd)
    : null
  const people = plan
    ? `${plan.participants.filter(p => p.hasResponded).length} of ${plan.participantCount} responded`
    : null
  const cta = isLocked ? "It's locked in 🎉" : 'Tap to mark when you’re free'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#faf9f7',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: '#b45332' }}>
          plann.fast
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 78,
              fontWeight: 700,
              color: '#1c1917',
              lineHeight: 1.1,
              maxWidth: 1050,
            }}
          >
            {title.length > 46 ? title.slice(0, 45) + '…' : title}
          </div>
          {dateRange && (
            <div style={{ display: 'flex', fontSize: 40, color: '#57534e' }}>
              📅 {dateRange}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 34,
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: isLocked ? '#4a7c59' : '#b45332',
              padding: '18px 36px',
              borderRadius: 14,
            }}
          >
            {cta}
          </div>
          {people && (
            <div style={{ display: 'flex', fontSize: 30, color: '#78716c' }}>
              {people}
            </div>
          )}
        </div>
      </div>
    ),
    size
  )
}

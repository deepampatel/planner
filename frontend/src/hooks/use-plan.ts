'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Plan } from '@/lib/types'

interface UsePlanOptions {
  slug: string
  initialData: Plan
  editToken: string | null
}

export function usePlan({ slug, initialData, editToken }: UsePlanOptions) {
  const [plan, setPlan] = useState<Plan>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const editTokenRef = useRef(editToken)
  editTokenRef.current = editToken

  const fetchPlan = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const headers: Record<string, string> = {}
      const token = editTokenRef.current
      if (token) {
        headers['X-Edit-Token'] = token
      }

      const res = await fetch(`/api/plans/${slug}`, { headers })

      if (res.ok) {
        const data: Plan = await res.json()
        setPlan(data)
      }
    } catch {
      // silent fail on refresh
    } finally {
      setIsRefreshing(false)
    }
  }, [slug])

  // Initial fetch with edit token (SSR data won't have myParticipantId)
  useEffect(() => {
    if (editTokenRef.current) {
      fetchPlan()
    }
  }, [fetchPlan, editToken])

  return { plan, isRefreshing, refetch: fetchPlan }
}

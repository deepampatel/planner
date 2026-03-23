'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { apiClient } from '@/lib/api'
import { setToken } from '@/lib/token-store'
import { detectTimezone } from '@/lib/timezone'
import { useAuth } from '@/hooks/use-auth'
import { APP_NAME, APP_TAGLINE } from '@/lib/constants'
import { daysBetween } from '@/lib/slot-utils'
import type { PlanWithTokens, CustomOption } from '@/lib/types'

export function CreateForm() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [title, setTitle] = useState('')
  const [hostName, setHostName] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [isOptions, setIsOptions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Custom options state
  const [customOptions, setCustomOptions] = useState<CustomOption[]>([])
  const [newOption, setNewOption] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const addOption = () => {
    const label = newOption.trim().replace(/\|/g, '')
    if (!label) return
    if (customOptions.some(o => o.label === label)) return
    if (customOptions.length >= 10) return
    setCustomOptions(prev => [...prev, { label }])
    setNewOption('')
  }

  const removeOption = (idx: number) => {
    setCustomOptions(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('What are you planning?'); return }

    const name = hostName.trim() || user?.displayName || ''
    if (!name) { setError('What should we call you?'); return }

    if (isOptions) {
      if (customOptions.length < 2) { setError('Add at least 2 options'); return }
    } else {
      if (!dateStart || !dateEnd) { setError('Pick a date range'); return }
    }

    // Auto-detect granularity from date range
    const granularity = isOptions
      ? 'options'
      : daysBetween(dateStart, dateEnd) <= 3
        ? 'time'
        : 'day'

    setIsSubmitting(true)

    try {
      const result = await apiClient<PlanWithTokens>('/plans', {
        method: 'POST',
        body: {
          title: title.trim(),
          hostName: name,
          location: '',
          dateRangeStart: isOptions ? today : dateStart,
          dateRangeEnd: isOptions ? today : dateEnd,
          durationMinutes: 60,
          granularity,
          timezone: detectTimezone(),
          ...(isOptions ? { customOptions } : {}),
        },
      })

      setToken(`planfast_token_${result.plan.slug}`, result.editToken)
      setToken(`planfast_host_${result.plan.slug}`, result.hostToken)

      router.push(`/plan/${result.plan.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Header />

      <motion.div
        className="max-w-md mx-auto px-4 pt-8 pb-12"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="mb-8 text-center">
          <h1 className="text-title text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-body text-muted-foreground">{APP_TAGLINE}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6">
          {/* Title */}
          <Input
            placeholder="What's the plan?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-heading"
            autoFocus
          />

          {/* Name — only for guests, auto-filled for signed-in users */}
          {user ? (
            <p className="text-small text-muted-foreground">
              Creating as <span className="font-medium text-foreground">{user.displayName}</span>
              {' · '}
              <button type="button" onClick={() => signOut()} className="text-tertiary hover:text-foreground transition-colors underline">switch</button>
            </p>
          ) : (
            <Input
              placeholder="Your name"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
            />
          )}

          {/* Date range or custom options */}
          {!isOptions ? (
            <div>
              <p className="text-tiny font-medium text-tertiary uppercase tracking-wider mb-3">When</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-tiny text-tertiary mb-1 block">From</label>
                  <input
                    type="date"
                    value={dateStart}
                    min={today}
                    onChange={e => setDateStart(e.target.value)}
                    className="w-full bg-transparent text-body text-foreground border-b border-border/60 focus:border-foreground/30 py-2.5 outline-none transition-colors duration-fast"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-tiny text-tertiary mb-1 block">To</label>
                  <input
                    type="date"
                    value={dateEnd}
                    min={dateStart || today}
                    onChange={e => setDateEnd(e.target.value)}
                    className="w-full bg-transparent text-body text-foreground border-b border-border/60 focus:border-foreground/30 py-2.5 outline-none transition-colors duration-fast"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOptions(true)}
                className="mt-4 text-tiny text-muted-foreground hover:text-foreground transition-colors"
              >
                Or <span className="underline">vote on options instead</span>
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-tiny font-medium text-tertiary uppercase tracking-wider">Options</p>
                <button
                  type="button"
                  onClick={() => setIsOptions(false)}
                  className="text-tiny text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="underline">Pick dates instead</span>
                </button>
              </div>

              {/* Add option input */}
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add an option..."
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addOption()
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addOption}
                  disabled={!newOption.trim() || customOptions.length >= 10}
                >
                  Add
                </Button>
              </div>

              {/* Option list */}
              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {customOptions.map((opt, idx) => (
                    <motion.div
                      key={opt.label}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted"
                    >
                      <span className="text-tiny font-medium text-muted-foreground w-5">{idx + 1}</span>
                      <span className="text-small text-foreground flex-1">{opt.label}</span>
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="text-tertiary hover:text-foreground transition-colors p-0.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {customOptions.length > 0 && customOptions.length < 2 && (
                <p className="text-tiny text-tertiary mt-2">Add at least one more option</p>
              )}
            </motion.div>
          )}

          {error && (
            <p className="text-small text-red-500">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create plan'}
          </Button>
        </form>

        <p className="text-tiny text-tertiary text-center mt-4">
          Free &middot; No sign-up required
        </p>
      </motion.div>
    </div>
  )
}

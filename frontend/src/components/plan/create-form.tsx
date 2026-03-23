'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { apiClient } from '@/lib/api'
import { detectTimezone } from '@/lib/timezone'
import { APP_NAME, APP_TAGLINE } from '@/lib/constants'
import type { PlanWithTokens, Granularity, CustomOption } from '@/lib/types'

export function CreateForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [hostName, setHostName] = useState('')
  const [location, setLocation] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [duration, setDuration] = useState(60)
  const [granularity, setGranularity] = useState<Granularity>('time')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Custom options state
  const [customOptions, setCustomOptions] = useState<CustomOption[]>([])
  const [newOption, setNewOption] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const addOption = () => {
    const label = newOption.trim().replace(/\|/g, '') // strip pipes
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
    if (!hostName.trim()) { setError('What should we call you?'); return }

    if (granularity === 'options') {
      if (customOptions.length < 2) { setError('Add at least 2 options'); return }
    } else {
      if (!dateStart || !dateEnd) { setError('Pick a date range'); return }
    }

    setIsSubmitting(true)

    try {
      const result = await apiClient<PlanWithTokens>('/plans', {
        method: 'POST',
        body: {
          title: title.trim(),
          hostName: hostName.trim(),
          location: location.trim(),
          dateRangeStart: granularity === 'options' ? today : dateStart,
          dateRangeEnd: granularity === 'options' ? today : dateEnd,
          durationMinutes: granularity === 'options' ? 0 : duration,
          granularity,
          timezone: detectTimezone(),
          ...(granularity === 'options' ? { customOptions } : {}),
        },
      })

      // Store tokens
      localStorage.setItem(`planfast_token_${result.plan.slug}`, result.editToken)
      localStorage.setItem(`planfast_host_${result.plan.slug}`, result.hostToken)

      router.push(`/plan/${result.plan.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  const granularityCards: { value: Granularity; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'time',
      label: 'Pick times',
      desc: '30-min slots throughout the day',
      icon: (
        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      value: 'day',
      label: 'Pick days',
      desc: 'Morning, afternoon, or evening',
      icon: (
        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      value: 'options',
      label: 'Custom options',
      desc: 'Vote on specific choices',
      icon: (
        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
    },
  ]

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
          {/* Plan details */}
          <div className="space-y-4">
            <Input
              placeholder="What's the plan?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="text-heading"
              autoFocus
            />
            <Input
              placeholder="Your name"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
            />
            <Input
              placeholder="Location (optional)"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          {/* How should people respond? */}
          <div>
            <p className="text-tiny font-medium text-tertiary uppercase tracking-wider mb-3">How should people respond?</p>
            <div className="grid grid-cols-3 gap-2">
              {granularityCards.map(card => (
                <button
                  key={card.value}
                  type="button"
                  onClick={() => setGranularity(card.value)}
                  className={`relative rounded-lg border p-3 text-left transition-all duration-fast ${
                    granularity === card.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {card.icon}
                    <span className="text-small font-medium text-foreground">{card.label}</span>
                  </div>
                  <p className="text-tiny text-muted-foreground">{card.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* When — only for time/day modes */}
          {granularity !== 'options' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
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
            </motion.div>
          )}

          {/* Duration — only relevant for time-based plans */}
          {granularity === 'time' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label className="text-tiny text-tertiary mb-1 block">How long is the event?</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full bg-card text-body text-foreground border border-border/60 rounded-lg px-3 py-2.5 outline-none cursor-pointer transition-colors duration-fast focus:border-foreground/30"
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
                <option value={240}>Half day</option>
              </select>
            </motion.div>
          )}

          {/* Custom options builder — only for options mode */}
          {granularity === 'options' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-tiny font-medium text-tertiary uppercase tracking-wider mb-3">Options</p>

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
              {customOptions.length >= 10 && (
                <p className="text-tiny text-tertiary mt-2">Maximum 10 options</p>
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

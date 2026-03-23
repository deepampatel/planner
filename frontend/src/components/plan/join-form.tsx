'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { setToken } from '@/lib/token-store'
import { Input } from '@/components/ui/input'
import { SignInButtons } from '@/components/auth/sign-in-buttons'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api'
import { detectTimezone } from '@/lib/timezone'
import type { JoinResult } from '@/lib/types'

interface JoinFormProps {
  slug: string
  onJoined: () => void
}

export function JoinForm({ slug, onJoined }: JoinFormProps) {
  const { user, isLoading: authLoading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const joinPlan = async (displayName: string, contactEmail?: string) => {
    setIsJoining(true)
    try {
      const result = await apiClient<JoinResult>(`/plans/${slug}/join`, {
        method: 'POST',
        body: {
          displayName,
          email: contactEmail || '',
          timezone: detectTimezone(),
        },
      })

      setToken(`planfast_token_${slug}`, result.editToken)
      onJoined()
    } catch {
      setIsJoining(false)
    }
  }

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await joinPlan(name.trim(), email.trim())
  }

  const handleAuthJoin = async () => {
    if (!user) return
    await joinPlan(user.displayName, user.email)
  }

  if (authLoading) return null

  // User is signed in — show quick join
  if (user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-body text-muted-foreground mb-4">
          Join as <span className="font-medium text-foreground">{user.displayName}</span>
        </p>
        <Button
          variant="primary"
          onClick={handleAuthJoin}
          loading={isJoining}
        >
          {isJoining ? 'Joining...' : 'Join this plan'}
        </Button>
      </motion.div>
    )
  }

  // Guest-first flow — name + optional email
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <form onSubmit={handleGuestSubmit} className="mb-6">
        <p className="text-body text-muted-foreground mb-3">
          Enter your name to join this plan.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <Input
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="flex-1"
            />
            <Button type="submit" variant="primary" loading={isJoining} disabled={!name.trim()}>
              Join
            </Button>
          </div>
          {name.trim() && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              <Input
                type="email"
                placeholder="Email — get notified when everyone responds"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <p className="text-tiny text-tertiary mt-1.5">
                Optional — we&apos;ll only text you about this plan.
              </p>
            </motion.div>
          )}
        </div>
      </form>

      {/* Secondary: sign in */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-tiny text-tertiary">or sign in</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <SignInButtons
        onSuccess={() => {
          // After sign-in, component re-renders with user set
          // and shows the auto-join UI above
        }}
      />
    </motion.div>
  )
}

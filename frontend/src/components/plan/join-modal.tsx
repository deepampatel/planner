'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SignInButtons } from '@/components/auth/sign-in-buttons'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api'
import { setToken } from '@/lib/token-store'
import { detectTimezone } from '@/lib/timezone'
import type { JoinResult } from '@/lib/types'

interface JoinModalProps {
  slug: string
  onJoined: () => void
  onClose: () => void
}

export function JoinModal({ slug, onJoined, onClose }: JoinModalProps) {
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
      toast.success("You're in! Tap where you're free.")
      onJoined()
    } catch {
      toast.error('Failed to join. Please try again.')
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

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/20 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-xl p-6 pb-8 max-w-lg mx-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="w-9 h-1 rounded-full bg-border mx-auto mb-5" />

        <h3 className="text-heading text-foreground mb-4">Join this plan</h3>

        {authLoading ? null : user ? (
          <div>
            <p className="text-body text-muted-foreground mb-4">
              Join as <span className="font-medium text-foreground">{user.displayName}</span>
            </p>
            <Button variant="primary" className="w-full" onClick={handleAuthJoin} loading={isJoining}>
              {isJoining ? 'Joining...' : 'Join & mark availability'}
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleGuestSubmit}>
              <div className="space-y-3 mb-4">
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
                {name.trim() && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                  >
                    <Input
                      type="email"
                      placeholder="Email (optional) — get notified"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </motion.div>
                )}
              </div>
              <Button type="submit" variant="primary" className="w-full" loading={isJoining} disabled={!name.trim()}>
                {isJoining ? 'Joining...' : 'Join & mark availability'}
              </Button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-tiny text-tertiary">or sign in</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <SignInButtons compact onSuccess={() => {}} />
          </>
        )}
      </motion.div>
    </>
  )
}

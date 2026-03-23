'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { SignInButtons } from '@/components/auth/sign-in-buttons'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import type { Plan } from '@/lib/types'
import confetti from 'canvas-confetti'

interface PlanHeaderProps {
  plan: Plan
  isHost: boolean
  onShare: () => void
  onRefetch: () => void
}

export function PlanHeader({ plan, isHost, onShare, onRefetch }: PlanHeaderProps) {
  const { user, signOut, isLoading: authLoading } = useAuth()
  const [isLocking, setIsLocking] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(plan.title)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditing])

  const handleTitleSave = async () => {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === plan.title) {
      setEditTitle(plan.title)
      setIsEditing(false)
      return
    }
    try {
      const hostToken = localStorage.getItem(`planfast_host_${plan.slug}`)
      await apiClient(`/plans/${plan.slug}`, {
        method: 'PATCH',
        body: { title: trimmed },
        editToken: hostToken || '',
      })
      setIsEditing(false)
      onRefetch()
    } catch {
      setEditTitle(plan.title)
      setIsEditing(false)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setEditTitle(plan.title)
      setIsEditing(false)
    }
  }

  const handleLock = async () => {
    if (!confirm('Lock this plan? No more changes after this.')) return

    setIsLocking(true)
    try {
      const hostToken = localStorage.getItem(`planfast_host_${plan.slug}`)
      await apiClient(`/plans/${plan.slug}/lock`, {
        method: 'POST',
        editToken: hostToken || '',
      })

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      })

      onRefetch()
    } catch {
      // Handle error
    } finally {
      setIsLocking(false)
    }
  }

  return (
    <div className="pt-4">
      {/* Title */}
      {isEditing ? (
        <input
          ref={titleInputRef}
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleTitleKeyDown}
          className="text-title text-foreground bg-transparent border-b-2 border-primary outline-none w-full"
        />
      ) : (
        <div className="flex items-center gap-2">
          <h1 className="text-title text-foreground">{plan.title}</h1>
          {isHost && plan.status === 'active' && (
            <button
              onClick={() => { setEditTitle(plan.title); setIsEditing(true) }}
              className="text-tertiary hover:text-muted-foreground transition-colors shrink-0"
              title="Rename plan"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 mt-3">
        {/* Auth state */}
        {!authLoading && (
          user ? (
            <div className="flex items-center gap-1.5">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.displayName}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-tiny font-medium text-muted-foreground">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-small text-muted-foreground">{user.displayName}</span>
              <button
                onClick={signOut}
                className="text-tiny text-tertiary hover:text-muted-foreground transition-colors ml-0.5"
                title="Sign out"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSignIn(prev => !prev)}
              className="flex items-center gap-1.5 text-small text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Sign in
            </button>
          )
        )}

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={onShare}>
          Share
        </Button>
        {isHost && plan.status === 'active' && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleLock}
            loading={isLocking}
          >
            Lock plan
          </Button>
        )}
      </div>

      {/* Expandable sign-in panel */}
      {showSignIn && !user && (
        <div className="mt-3 p-4 rounded-lg border border-border bg-card">
          <p className="text-small text-muted-foreground mb-3">
            Sign in to sync your identity across plans.
          </p>
          <SignInButtons
            compact
            onSuccess={() => {
              setShowSignIn(false)
              onRefetch()
            }}
          />
        </div>
      )}
    </div>
  )
}

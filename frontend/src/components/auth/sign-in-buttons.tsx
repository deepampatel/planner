'use client'

import { useState, lazy, Suspense } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

interface SignInButtonsProps {
  onSuccess?: () => void
  compact?: boolean
  className?: string
}

// Lazy-load the Google OAuth component so it only loads when needed
const GoogleOAuthButton = lazy(() => import('./google-oauth-button'))

export function SignInButtons({ onSuccess, compact, className }: SignInButtonsProps) {
  const { hasGoogleAuth } = useAuth()

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {hasGoogleAuth ? (
        <Suspense fallback={<GoogleButtonShell compact={compact} disabled />}>
          <GoogleOAuthButton onSuccess={onSuccess} compact={compact} />
        </Suspense>
      ) : (
        <GoogleButtonShell compact={compact} disabled />
      )}
      <AppleSignInButton onSuccess={onSuccess} compact={compact} />
    </div>
  )
}

/** Shell button used for fallback/disabled state */
export function GoogleButtonShell({ compact, disabled, onClick }: {
  compact?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-2 w-full rounded-md border border-border bg-background px-4 py-2.5 text-small font-medium transition-colors',
        disabled ? 'text-muted-foreground opacity-50 cursor-not-allowed' : 'text-foreground hover:bg-accent',
        compact && 'py-2'
      )}
    >
      <GoogleIcon />
      Continue with Google
    </button>
  )
}

function AppleSignInButton({ onSuccess, compact }: { onSuccess?: () => void; compact?: boolean }) {
  const { signInWithApple } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line
      const appleID = (window as any).AppleID
      if (!appleID) {
        setError('Apple sign-in not available.')
        setLoading(false)
        return
      }
      const response = await appleID.auth.signIn()
      if (response?.authorization?.id_token) {
        const userName = response.user
          ? `${response.user.name?.firstName || ''} ${response.user.name?.lastName || ''}`.trim()
          : ''
        await signInWithApple(response.authorization.id_token, userName)
        onSuccess?.()
      }
    } catch {
      setError('Apple sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'flex items-center justify-center gap-2 w-full rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2.5 text-small font-medium transition-colors hover:opacity-90 disabled:opacity-50',
          compact && 'py-2'
        )}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        {loading ? 'Signing in...' : 'Continue with Apple'}
      </button>
      {error && <p className="text-tiny text-red-500 text-center">{error}</p>}
    </>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

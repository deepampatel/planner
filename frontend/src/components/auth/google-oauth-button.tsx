'use client'

import { useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/hooks/use-auth'
import { GoogleButtonShell } from './sign-in-buttons'

interface GoogleOAuthButtonProps {
  onSuccess?: () => void
  compact?: boolean
}

export default function GoogleOAuthButton({ onSuccess, compact }: GoogleOAuthButtonProps) {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      setError(null)
      try {
        await signInWithGoogle(tokenResponse.access_token)
        onSuccess?.()
      } catch {
        setError('Google sign-in failed. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled.')
    },
    flow: 'implicit',
  })

  return (
    <>
      <GoogleButtonShell onClick={() => googleLogin()} compact={compact} />
      {loading && <p className="text-tiny text-tertiary text-center">Signing in with Google...</p>}
      {error && <p className="text-tiny text-red-500 text-center">{error}</p>}
    </>
  )
}

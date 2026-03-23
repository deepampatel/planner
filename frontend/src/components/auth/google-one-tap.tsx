'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'

/**
 * Google One Tap — auto-prompts signed-in Google users with a
 * one-click sign-in popup. No button needed, just mount this component.
 * Only shows if user is not already signed in.
 */
export function GoogleOneTap() {
  const { user, isLoading, hasGoogleAuth, signInWithGoogle } = useAuth()
  const prompted = useRef(false)

  useEffect(() => {
    // Don't prompt if: already signed in, still loading, no client ID, or already prompted
    if (isLoading || user || !hasGoogleAuth || prompted.current) return

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return

    prompted.current = true

    // Load the Google Identity Services script
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      const google = (window as unknown as { google: { accounts: { id: {
        initialize: (config: Record<string, unknown>) => void
        prompt: (cb?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void
      }}}}).google

      if (!google?.accounts?.id) return

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            // One Tap returns a credential (JWT ID token)
            await signInWithGoogle(response.credential)
          } catch {
            // Silently fail — user can still use manual sign-in
          }
        },
        auto_select: true, // Auto-sign-in if only one Google account
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
      })

      google.accounts.id.prompt()
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [isLoading, user, hasGoogleAuth, signInWithGoogle])

  return null // No visible UI — One Tap shows as a browser-level popup
}

'use client'

import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { apiClient } from '@/lib/api'

export interface AuthUser {
  id: number
  email: string
  displayName: string
  avatarUrl: string
  provider: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  hasGoogleAuth: boolean
  signInWithGoogle: (accessToken: string) => Promise<void>
  signInWithApple: (idToken: string, userName?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  hasGoogleAuth: false,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
})

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await apiClient<AuthUser>('/auth/me')
        setUser(data)
      } catch {
        // Not authenticated — that's fine
      } finally {
        setIsLoading(false)
      }
    }
    checkSession()
  }, [])

  const signInWithGoogle = useCallback(async (accessToken: string) => {
    const data = await apiClient<AuthUser>('/auth/google', {
      method: 'POST',
      body: { idToken: accessToken },
    })
    setUser(data)
  }, [])

  const signInWithApple = useCallback(async (idToken: string, userName?: string) => {
    const data = await apiClient<AuthUser>('/auth/apple', {
      method: 'POST',
      body: { idToken, userName },
    })
    setUser(data)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      hasGoogleAuth: !!GOOGLE_CLIENT_ID,
      signInWithGoogle,
      signInWithApple,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // If no Google client ID configured, skip GoogleOAuthProvider wrapper
  if (!GOOGLE_CLIENT_ID) {
    return <AuthProviderInner>{children}</AuthProviderInner>
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </GoogleOAuthProvider>
  )
}

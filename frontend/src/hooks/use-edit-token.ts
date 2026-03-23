'use client'

import { useState, useEffect, useCallback } from 'react'
import { getToken, setToken } from '@/lib/token-store'

const TOKEN_PREFIX = 'planfast_token_'
const HOST_PREFIX = 'planfast_host_'

export function useEditToken(slug: string) {
  const [editToken, setEditTokenState] = useState<string | null>(null)
  const [hostToken, setHostTokenState] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const token = getToken(TOKEN_PREFIX + slug)
    const host = getToken(HOST_PREFIX + slug)
    setEditTokenState(token)
    setHostTokenState(host)
    setLoaded(true)
  }, [slug])

  const setEditToken = useCallback((token: string) => {
    setToken(TOKEN_PREFIX + slug, token)
    setEditTokenState(token)
  }, [slug])

  const setHostToken = useCallback((token: string) => {
    setToken(HOST_PREFIX + slug, token)
    setHostTokenState(token)
  }, [slug])

  const isHost = hostToken !== null

  return { editToken, hostToken, isHost, loaded, setEditToken, setHostToken }
}

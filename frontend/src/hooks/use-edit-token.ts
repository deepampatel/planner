'use client'

import { useState, useEffect, useCallback } from 'react'

const TOKEN_PREFIX = 'planfast_token_'
const HOST_PREFIX = 'planfast_host_'

export function useEditToken(slug: string) {
  const [editToken, setEditTokenState] = useState<string | null>(null)
  const [hostToken, setHostTokenState] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_PREFIX + slug)
    const host = localStorage.getItem(HOST_PREFIX + slug)
    setEditTokenState(token)
    setHostTokenState(host)
    setLoaded(true)
  }, [slug])

  const setEditToken = useCallback((token: string) => {
    localStorage.setItem(TOKEN_PREFIX + slug, token)
    setEditTokenState(token)
  }, [slug])

  const setHostToken = useCallback((token: string) => {
    localStorage.setItem(HOST_PREFIX + slug, token)
    setHostTokenState(token)
  }, [slug])

  const isHost = hostToken !== null

  return { editToken, hostToken, isHost, loaded, setEditToken, setHostToken }
}

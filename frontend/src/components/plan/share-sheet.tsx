'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { Participant } from '@/lib/types'

interface ShareSheetProps {
  slug: string
  title: string
  participants?: Participant[]
  onClose: () => void
}

export function ShareSheet({ slug, title, participants, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/plan/${slug}` : ''
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const nonResponders = participants?.filter(p => !p.hasResponded) ?? []

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title,
        text: `${title} — mark when you're free`,
        url,
      })
    } catch {
      // User cancelled or share failed — ignore
    }
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`${title} — mark when you're free: ${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleNudgeAll = () => {
    const names = nonResponders.map(p => p.displayName).join(', ')
    const text = encodeURIComponent(
      `Hey ${names} — we're waiting on you! Mark when you're free for "${title}": ${url}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
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
        {/* Drag handle */}
        <div className="w-9 h-1 rounded-full bg-border mx-auto mb-5" />

        <h3 className="text-heading text-foreground mb-4">Share this plan</h3>

        {/* URL + Copy */}
        <div className="flex items-center gap-2 bg-muted rounded-lg p-3 mb-5">
          <span className="text-small text-foreground flex-1 truncate font-mono">{url}</span>
          <button
            onClick={handleCopy}
            className={`text-small font-medium px-2 py-1 rounded-md transition-colors duration-fast ${
              copied
                ? 'text-cell-free'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {copied ? (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Copied
              </span>
            ) : (
              'Copy'
            )}
          </button>
        </div>

        {/* Share buttons */}
        <div className="flex flex-col gap-2">
          {canNativeShare && (
            <Button variant="primary" className="w-full" onClick={handleNativeShare}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              Share...
            </Button>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-[#25D366] text-white px-4 h-10 text-small font-medium hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </button>
            <Button variant="ghost" onClick={onClose} className="shrink-0">
              Done
            </Button>
          </div>
        </div>

        {/* Nudge non-responders — only show if there are people who haven't responded */}
        {nonResponders.length > 0 && (
          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-small font-medium text-foreground">
                Waiting on {nonResponders.length} {nonResponders.length === 1 ? 'person' : 'people'}
              </p>
              <button
                onClick={handleNudgeAll}
                className="text-small font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Nudge all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {nonResponders.map(p => (
                <span
                  key={p.id}
                  className="text-tiny px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                >
                  {p.displayName}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}

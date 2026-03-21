'use client'

import { APP_NAME } from '@/lib/constants'
import { ThemeToggle } from './theme-toggle'

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6 mb-2">
      <a href="/" className="text-small font-semibold text-foreground hover:opacity-80 transition-opacity duration-fast">
        {APP_NAME}
      </a>
      <ThemeToggle />
    </header>
  )
}

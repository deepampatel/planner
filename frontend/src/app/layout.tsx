import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/providers/theme-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'plann.fast — Stop planning. Start going.',
  description: 'The fastest way to find when your group is free. Share a link, mark availability, done.',
  openGraph: {
    title: 'plann.fast — Stop planning. Start going.',
    description: 'The fastest way to find when your group is free. Share a link, mark availability, done.',
    type: 'website',
    siteName: 'plann.fast',
  },
  twitter: {
    card: 'summary',
    title: 'plann.fast',
    description: 'The fastest way to find when your group is free.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
          <main className="min-h-screen">
            {children}
          </main>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

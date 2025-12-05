import type React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { ToastProviderStore } from '@/lib/use-toast'
import { Analytics } from '@vercel/analytics/next'
import DesignInit from '@/components/ui/design-init'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Jira Clone',
  description: 'A Jira clone with Kanban board and advanced filtering',
  generator: 'v0.dev',
  icons: {
    icon: [{ url: '/favicon.ico' }],
    apple: [{ url: '/apple-icon.png' }]
  }
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${inter.className} dark`} data-ui='v2'>
        <DesignInit />
        <ToastProviderStore>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </ToastProviderStore>
        <Analytics />
      </body>
    </html>
  )
}

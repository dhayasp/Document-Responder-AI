import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Document Responder AI',
  description: 'A production-level MULTI AI AGENT using Next.js and Supabase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

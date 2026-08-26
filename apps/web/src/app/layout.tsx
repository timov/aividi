import type { Metadata } from 'next'
import './reset.css'

export const metadata: Metadata = {
  title: 'aividi.mk',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mk">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next'
import './reset.css'

export const metadata: Metadata = {
  title: 'aividi.mk',
  verification: {
    google: 'sQAnHP4oeByJ4vnL8CYB2DVQV4360XYC5EqlC4DrEbw',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mk">
      <body>{children}</body>
    </html>
  )
}

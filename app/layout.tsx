import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SuperNetworkAI — Find Your Perfect Cofounder',
  description:
    'AI-powered professional matching based on your Ikigai, skills, and goals. Find cofounders, teammates, and clients.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-slate-900 antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}

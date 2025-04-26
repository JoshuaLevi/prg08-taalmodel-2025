import type React from "react"
import type { Metadata } from "next"
// import { GeistSans } from "geist/font/sans"
import { Poppins } from 'next/font/google'
import { Toaster } from "@/components/ui/toaster"

import "../styles/globals.css"

// Configure Poppins font
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700'] // Regular, Semi-bold, Bold
});

export const metadata: Metadata = {
  title: "HyroCoach - Your AI Hyrox Trainer",
  description: "Get personalized Hyrox training plans and advice.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}



import './globals.css'
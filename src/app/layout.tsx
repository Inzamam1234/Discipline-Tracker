import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Discipline Tracker',
    description: 'Build habits. Beat your streak. Win.',
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
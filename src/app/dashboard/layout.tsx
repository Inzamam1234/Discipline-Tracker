'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [username, setUsername] = useState('')
    const supabase = createClient()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) { router.push('/login'); return }
            supabase.from('profiles').select('username').eq('id', user.id).single()
                .then(({ data }) => { if (data) setUsername(data.username) })
        })
    }, [])

    async function handleSignOut() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const navItems = [
        { href: '/dashboard', label: '🏠 Home' },
        { href: '/habits', label: '⚡ Habits' },
        { href: '/groups', label: '👥 Groups' },
    ]

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Top navbar */}
            <nav className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <span className="text-xl font-bold text-indigo-400">🏆 DisciplineTracker</span>
                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map(item => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition
                  ${pathname === item.href
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm hidden md:block">@{username}</span>
                    <button
                        onClick={handleSignOut}
                        className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition"
                    >
                        Sign out
                    </button>
                </div>
            </nav>

            {/* Mobile nav */}
            <div className="md:hidden flex border-b border-gray-800 bg-gray-900 px-4 pb-3 gap-1">
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex-1 text-center px-2 py-2 rounded-lg text-xs font-medium transition
              ${pathname === item.href
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>

            <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<any>(null)
    const supabase = createClient()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) { router.push('/login'); return }
            const { data } = await supabase
                .from('profiles').select('*').eq('id', user.id).single()
            if (data) {
                setProfile(data)
            } else {
                // Profile missing — create it
                const emailName = user.email?.split('@')[0] ?? 'User'
                const { data: newProf } = await supabase
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        username: user.user_metadata?.preferred_username ?? emailName,
                        xp: 0,
                        level: 1,
                    })
                    .select()
                    .single()
                if (newProf) setProfile(newProf)
            }
        })
    }, [pathname])

    async function handleSignOut() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const navItems = [
        { href: '/dashboard', label: 'Home', emoji: '🏠' },
        { href: '/habits', label: 'Habits', emoji: '⚡' },
        { href: '/groups', label: 'Groups', emoji: '👥' },
    ]

    return (
        <div className="min-h-screen bg-[#f0f4f8]">
            <nav className="bg-white border-b-2 border-gray-100 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <span className="text-2xl">🏆</span>
                        <span className="font-black text-green-500 text-xl tracking-tight">Discipline</span>
                    </Link>
                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map(item => (
                            <Link key={item.href} href={item.href}
                                className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-sm transition-all
                  ${pathname === item.href
                                        ? 'bg-green-500 text-white shadow-[0_3px_0_#16a34a]'
                                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
                                <span>{item.emoji}</span>{item.label}
                            </Link>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        {profile && (
                            <div className="hidden md:flex items-center gap-2 bg-orange-50 border-2 border-orange-200 px-3 py-1.5 rounded-2xl">
                                <span className="text-base">🔥</span>
                                <span className="font-black text-orange-600 text-sm">{profile.username}</span>
                            </div>
                        )}
                        <button onClick={handleSignOut}
                            className="text-sm font-bold text-gray-400 hover:text-red-400 transition">
                            Sign out
                        </button>
                    </div>
                </div>
            </nav>
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 z-50 flex">
                {navItems.map(item => (
                    <Link key={item.href} href={item.href}
                        className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-bold transition-all
              ${pathname === item.href ? 'text-green-500' : 'text-gray-400'}`}>
                        <span className="text-xl">{item.emoji}</span>
                        {item.label}
                    </Link>
                ))}
            </div>
            <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8">
                {children}
            </main>
        </div>
    )
}
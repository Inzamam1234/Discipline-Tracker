'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type DaySummary = {
    date: string
    total: number
    completed: number
    pct: number
    hitStreak: boolean // >= 60%
}

export default function WeeklySummary() {
    const [days, setDays] = useState<DaySummary[]>([])
    const [weekStats, setWeekStats] = useState({ streakDays: 0, avgPct: 0, totalDone: 0 })
    const supabase = createClient()

    useEffect(() => { loadWeek() }, [])

    async function loadWeek() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const today = new Date()
        const monday = new Date(today)
        const day = today.getDay()
        monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))

        const dates: string[] = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday)
            d.setDate(monday.getDate() + i)
            dates.push(d.toISOString().split('T')[0])
        }

        const startDate = dates[0]
        const endDate = dates[6]

        const [{ data: habits }, { data: logs }] = await Promise.all([
            supabase.from('habits').select('id').eq('user_id', user.id).eq('is_active', true),
            supabase.from('habit_logs').select('log_date, completed')
                .eq('user_id', user.id).gte('log_date', startDate).lte('log_date', endDate),
        ])

        const total = habits?.length ?? 0
        const todayStr = today.toISOString().split('T')[0]

        const summaries: DaySummary[] = dates.map(date => {
            if (date > todayStr) return { date, total, completed: 0, pct: 0, hitStreak: false }
            const completed = logs?.filter(l => l.log_date === date && l.completed).length ?? 0
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0
            return { date, total, completed, pct, hitStreak: pct >= 60 }
        })

        const pastDays = summaries.filter(d => d.date <= todayStr)
        const streakDays = pastDays.filter(d => d.hitStreak).length
        const avgPct = pastDays.length > 0
            ? Math.round(pastDays.reduce((sum, d) => sum + d.pct, 0) / pastDays.length)
            : 0
        const totalDone = pastDays.reduce((sum, d) => sum + d.completed, 0)

        setDays(summaries)
        setWeekStats({ streakDays, avgPct, totalDone })
    }

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    const todayStr = new Date().toISOString().split('T')[0]

    return (
        <div className="card">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-base text-gray-700">This week</h2>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400">
                        Avg: <span className={weekStats.avgPct >= 60 ? 'text-green-500' : 'text-yellow-500'}>
                            {weekStats.avgPct}%
                        </span>
                    </span>
                    <span className="text-xs font-bold text-gray-400">
                        🔥 <span className="text-orange-500">{weekStats.streakDays}/7 days</span>
                    </span>
                </div>
            </div>

            {/* Day bars */}
            <div className="grid grid-cols-7 gap-2">
                {days.map((d, i) => {
                    const isFuture = d.date > todayStr
                    const isToday = d.date === todayStr
                    const barHeight = isFuture ? 0 : d.pct

                    return (
                        <div key={d.date} className="flex flex-col items-center gap-1.5">
                            {/* Bar */}
                            <div className="w-full h-16 bg-gray-100 rounded-xl overflow-hidden flex flex-col-reverse relative">
                                {!isFuture && (
                                    <div
                                        className="w-full rounded-xl transition-all duration-700"
                                        style={{
                                            height: `${Math.max(barHeight, d.pct > 0 ? 8 : 0)}%`,
                                            backgroundColor: d.hitStreak ? '#4ade80' : d.pct > 0 ? '#fbbf24' : '#e5e7eb',
                                        }}
                                    />
                                )}
                                {/* 60% line */}
                                <div className="absolute w-full border-t border-dashed border-orange-300" style={{ bottom: '60%' }} />
                            </div>

                            {/* Pct label */}
                            <span className={`text-xs font-bold ${isFuture ? 'text-gray-300' :
                                    d.hitStreak ? 'text-green-500' :
                                        d.pct > 0 ? 'text-yellow-500' : 'text-gray-300'
                                }`}>
                                {isFuture ? '—' : d.pct > 0 ? `${d.pct}%` : '0%'}
                            </span>

                            {/* Day label */}
                            <span className={`text-xs font-black ${isToday ? 'text-green-500' : 'text-gray-400'}`}>
                                {dayLabels[i]}
                            </span>

                            {/* Today dot */}
                            {isToday && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                        </div>
                    )
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-400" />
                    <span className="text-xs font-semibold text-gray-400">Streak (60%+)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-yellow-400" />
                    <span className="text-xs font-semibold text-gray-400">Partial</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-gray-200" />
                    <span className="text-xs font-semibold text-gray-400">None / future</span>
                </div>
            </div>

            {/* Summary sentence */}
            <div className="mt-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-sm font-bold text-gray-600 text-center">
                    {weekStats.streakDays === 7
                        ? '🏆 Perfect week! You hit streak every day!'
                        : weekStats.streakDays >= 5
                            ? `💪 Strong week — ${weekStats.streakDays} streak days!`
                            : weekStats.streakDays >= 3
                                ? `🎯 Halfway there — ${weekStats.streakDays} streak days this week`
                                : weekStats.streakDays === 0
                                    ? '🌱 Start today — no streak days yet this week'
                                    : `🔥 ${weekStats.streakDays} streak day${weekStats.streakDays > 1 ? 's' : ''} — keep going!`}
                </p>
            </div>
        </div>
    )
}
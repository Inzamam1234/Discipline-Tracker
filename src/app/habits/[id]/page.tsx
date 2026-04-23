'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import type { Habit } from '@/types/database'

type LogMap = Record<string, boolean>

export default function HabitDetailPage() {
    const { id } = useParams()
    const router = useRouter()
    const [habit, setHabit] = useState<Habit | null>(null)
    const [logs, setLogs] = useState<LogMap>({})
    const [streak, setStreak] = useState({ current: 0, longest: 0 })
    const [viewMonth, setViewMonth] = useState(new Date())
    const supabase = createClient()

    useEffect(() => { loadHabit() }, [])

    async function loadHabit() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: h }, { data: l }, { data: s }] = await Promise.all([
            supabase.from('habits').select('*').eq('id', id).single(),
            supabase.from('habit_logs').select('log_date, completed').eq('habit_id', id).eq('user_id', user.id),
            supabase.from('streaks').select('*').eq('habit_id', id).eq('user_id', user.id).single(),
        ])

        if (h) setHabit(h)
        if (l) {
            const map: LogMap = {}
            l.forEach(log => { if (log.completed) map[log.log_date] = true })
            setLogs(map)
        }
        if (s) setStreak({ current: s.current_streak, longest: s.longest_streak })
    }

    function getDaysInMonth(year: number, month: number) {
        return new Date(year, month + 1, 0).getDate()
    }

    function getFirstDayOfMonth(year: number, month: number) {
        const d = new Date(year, month, 1).getDay()
        return d === 0 ? 6 : d - 1 // Mon=0
    }

    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    const today = new Date().toISOString().split('T')[0]

    // Completion rate this month
    const monthLogs = Object.keys(logs).filter(d => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    const completedDays = monthLogs.length
    const daysSoFar = month === new Date().getMonth() && year === new Date().getFullYear()
        ? new Date().getDate() : daysInMonth
    const completionRate = daysSoFar > 0 ? Math.round((completedDays / daysSoFar) * 100) : 0

    const habitColor = habit?.color ?? '#4ade80'

    if (!habit) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()}
                    className="w-10 h-10 rounded-2xl bg-white border-2 border-gray-200 flex items-center justify-center font-bold text-gray-500 hover:border-gray-300 transition">
                    ←
                </button>
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md"
                        style={{ backgroundColor: habitColor }}>
                        {habit.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="font-black text-xl">{habit.icon} {habit.name}</h1>
                        {habit.target_value && (
                            <p className="text-sm font-semibold text-gray-400">
                                Target: {habit.target_value} {habit.unit} daily
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Streak cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="card text-center py-5">
                    <div className="text-4xl font-black mb-1" style={{ color: habitColor }}>{streak.current}</div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Current streak</div>
                    <div className="text-2xl mt-1">🔥</div>
                </div>
                <div className="card text-center py-5">
                    <div className="text-4xl font-black text-purple-500 mb-1">{streak.longest}</div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Best streak</div>
                    <div className="text-2xl mt-1">🏆</div>
                </div>
            </div>

            {/* Completion stats */}
            <div className="card">
                <h2 className="font-black text-base mb-4">Habit strength</h2>
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-sm font-bold mb-1">
                            <span className="text-gray-500">This month</span>
                            <span style={{ color: habitColor }}>{completionRate}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${completionRate}%`, backgroundColor: habitColor }} />
                        </div>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-gray-400 pt-1">
                        <span>{completedDays} days completed</span>
                        <span>{daysSoFar} days tracked</span>
                    </div>
                </div>
            </div>

            {/* Monthly calendar heatmap */}
            <div className="card">
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold transition">
                        ‹
                    </button>
                    <span className="font-black text-base">
                        {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold transition">
                        ›
                    </button>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 mb-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} className="text-center text-xs font-bold text-gray-400">{d}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for offset */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const dayNum = i + 1
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                        const done = logs[dateStr]
                        const isToday = dateStr === today
                        const isFuture = dateStr > today

                        return (
                            <div
                                key={dayNum}
                                className={`aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all
      ${isToday ? 'ring-2 ring-offset-1' : ''}
      ${isFuture ? 'text-gray-200' : done ? 'text-white' : 'text-gray-400 bg-gray-100'}`}
                                style={{
                                    backgroundColor: done ? habitColor : undefined,
                                    boxShadow: isToday ? `0 0 0 2px ${habitColor}` : undefined,
                                }}
                            >
                                {dayNum}
                            </div>
                        )
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: habitColor }} />
                        <span className="text-xs font-semibold text-gray-500">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-gray-100" />
                        <span className="text-xs font-semibold text-gray-500">Missed</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
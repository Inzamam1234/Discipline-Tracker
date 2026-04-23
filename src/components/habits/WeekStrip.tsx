'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type DayData = {
    date: string
    label: string
    dayNum: number
    isToday: boolean
    isPast: boolean
    completedCount: number
    totalCount: number
}

export default function WeekStrip({ onDateChange }: { onDateChange?: (date: string) => void }) {
    const [days, setDays] = useState<DayData[]>([])
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const supabase = createClient()

    useEffect(() => { buildWeek() }, [])

    async function buildWeek() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const today = new Date()
        const weekDays: DayData[] = []

        // Get Mon–Sun of current week
        const monday = new Date(today)
        const day = today.getDay()
        const diff = day === 0 ? -6 : 1 - day
        monday.setDate(today.getDate() + diff)

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday)
            d.setDate(monday.getDate() + i)
            const dateStr = d.toISOString().split('T')[0]
            weekDays.push({
                date: dateStr,
                label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
                dayNum: d.getDate(),
                isToday: dateStr === today.toISOString().split('T')[0],
                isPast: d < today,
                completedCount: 0,
                totalCount: 0,
            })
        }

        // Get log data for the whole week
        const startDate = weekDays[0].date
        const endDate = weekDays[6].date

        const [{ data: logs }, { data: habits }] = await Promise.all([
            supabase.from('habit_logs').select('log_date, completed')
                .eq('user_id', user.id).gte('log_date', startDate).lte('log_date', endDate),
            supabase.from('habits').select('id').eq('user_id', user.id).eq('is_active', true),
        ])

        const total = habits?.length ?? 0
        const filled = weekDays.map(d => ({
            ...d,
            totalCount: total,
            completedCount: logs?.filter(l => l.log_date === d.date && l.completed).length ?? 0,
        }))

        setDays(filled)
    }

    function selectDay(date: string) {
        setSelectedDate(date)
        onDateChange?.(date)
    }

    return (
        <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="font-black text-sm text-gray-500">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <span className="text-xs font-bold text-green-500">This week</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(d => {
                    const isSelected = d.date === selectedDate
                    const pct = d.totalCount > 0 ? d.completedCount / d.totalCount : 0
                    const allDone = pct === 1 && d.totalCount > 0
                    const someDone = pct > 0 && pct < 1

                    return (
                        <button key={d.date} onClick={() => selectDay(d.date)}
                            className="flex flex-col items-center gap-1.5 py-2 rounded-2xl transition-all duration-200"
                            style={{ background: isSelected ? '#22c55e' : 'transparent' }}>
                            <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                {d.label}
                            </span>
                            <span className={`text-base font-black ${isSelected ? 'text-white' : d.isToday ? 'text-green-500' : 'text-gray-700'}`}>
                                {d.dayNum}
                            </span>
                            {/* Completion dots */}
                            <div className="flex gap-0.5 h-2 items-center justify-center">
                                {d.totalCount > 0 && d.isPast || d.isToday ? (
                                    allDone ? (
                                        <div className="w-2 h-2 rounded-full bg-green-400" />
                                    ) : someDone ? (
                                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-gray-200" />
                                    )
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-gray-100" />
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
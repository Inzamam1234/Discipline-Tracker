'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Habit, HabitLog } from '@/types/database'

type HabitWithLog = Habit & { log?: HabitLog; streak: number }

export default function DashboardPage() {
    const [habits, setHabits] = useState<HabitWithLog[]>([])
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [today] = useState(new Date().toISOString().split('T')[0])
    const supabase = createClient()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Load profile
        const { data: prof } = await supabase
            .from('profiles').select('*').eq('id', user.id).single()
        setProfile(prof)

        // Load habits with today's logs
        const { data: habitsData } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at')

        if (!habitsData) { setLoading(false); return }

        const { data: logsData } = await supabase
            .from('habit_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('log_date', today)

        const { data: streaksData } = await supabase
            .from('streaks')
            .select('*')
            .eq('user_id', user.id)

        const combined = habitsData.map(habit => ({
            ...habit,
            log: logsData?.find(l => l.habit_id === habit.id),
            streak: streaksData?.find(s => s.habit_id === habit.id)?.current_streak ?? 0,
        }))

        setHabits(combined)
        setLoading(false)
    }

    async function toggleHabit(habit: HabitWithLog) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const newCompleted = !habit.log?.completed

        if (habit.log) {
            await supabase.from('habit_logs')
                .update({ completed: newCompleted })
                .eq('id', habit.log.id)
        } else {
            await supabase.from('habit_logs').insert({
                habit_id: habit.id,
                user_id: user.id,
                log_date: today,
                completed: true,
            })
        }

        // Update streak
        await updateStreak(habit.id, user.id, newCompleted)
        // Award XP
        if (newCompleted) await awardXP(user.id, 10)

        loadData()
    }

    async function updateStreak(habitId: string, userId: string, completed: boolean) {
        const { data: existing } = await supabase
            .from('streaks')
            .select('*')
            .eq('habit_id', habitId)
            .eq('user_id', userId)
            .single()

        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        if (existing) {
            const wasYesterday = existing.last_logged_date === yesterdayStr
            const newStreak = completed
                ? (wasYesterday || existing.last_logged_date === today ? existing.current_streak + 1 : 1)
                : Math.max(0, existing.current_streak - 1)
            await supabase.from('streaks').update({
                current_streak: newStreak,
                longest_streak: Math.max(newStreak, existing.longest_streak),
                last_logged_date: completed ? today : existing.last_logged_date,
            }).eq('id', existing.id)
        } else if (completed) {
            await supabase.from('streaks').insert({
                habit_id: habitId, user_id: userId,
                current_streak: 1, longest_streak: 1, last_logged_date: today,
            })
        }
    }

    async function awardXP(userId: string, xp: number) {
        const { data: prof } = await supabase
            .from('profiles').select('xp, level').eq('id', userId).single()
        if (!prof) return
        const newXP = prof.xp + xp
        const newLevel = Math.floor(newXP / 100) + 1
        await supabase.from('profiles')
            .update({ xp: newXP, level: newLevel })
            .eq('id', userId)
    }

    const completedCount = habits.filter(h => h.log?.completed).length
    const completionPct = habits.length > 0
        ? Math.round((completedCount / habits.length) * 100) : 0

    const xpToNextLevel = profile ? (profile.level * 100) - profile.xp : 0

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 animate-pulse text-lg">Loading your dashboard...</div>
        </div>
    )

    return (
        <div className="space-y-8">

            {/* Header + XP bar */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Good {getTimeOfDay()}, {profile?.username}! 👋
                        </h1>
                        <p className="text-gray-400 mt-1">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-indigo-400">Lv.{profile?.level}</div>
                        <div className="text-gray-400 text-sm">{profile?.xp} XP total</div>
                    </div>
                </div>

                {/* XP progress bar */}
                <div className="mb-1 flex justify-between text-sm text-gray-400">
                    <span>Progress to Level {(profile?.level ?? 0) + 1}</span>
                    <span>{xpToNextLevel} XP to go</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3">
                    <div
                        className="bg-indigo-500 h-3 rounded-full transition-all duration-700"
                        style={{ width: `${((profile?.xp ?? 0) % 100)}%` }}
                    />
                </div>
            </div>

            {/* Daily progress summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
                    <div className="text-3xl font-bold text-green-400">{completedCount}</div>
                    <div className="text-gray-400 text-sm mt-1">Done today</div>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
                    <div className="text-3xl font-bold text-yellow-400">{completionPct}%</div>
                    <div className="text-gray-400 text-sm mt-1">Completion</div>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
                    <div className="text-3xl font-bold text-orange-400">
                        {Math.max(...habits.map(h => h.streak), 0)}🔥
                    </div>
                    <div className="text-gray-400 text-sm mt-1">Best streak</div>
                </div>
            </div>

            {/* Daily completion ring */}
            {habits.length > 0 && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Today's Habits</h2>
                        <span className="text-sm text-gray-400">{completedCount}/{habits.length} completed</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-6">
                        <div
                            className="bg-gradient-to-r from-indigo-500 to-green-500 h-2 rounded-full transition-all duration-700"
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>

                    {/* Habit cards */}
                    <div className="space-y-3">
                        {habits.map(habit => (
                            <div
                                key={habit.id}
                                onClick={() => toggleHabit(habit)}
                                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200
                  ${habit.log?.completed
                                        ? 'bg-green-900/20 border-green-700/50 hover:bg-green-900/30'
                                        : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'}`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Checkbox */}
                                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${habit.log?.completed
                                            ? 'bg-green-500 border-green-500'
                                            : 'border-gray-600'}`}>
                                        {habit.log?.completed && (
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>

                                    <div>
                                        <div className={`font-medium ${habit.log?.completed ? 'line-through text-gray-400' : 'text-white'}`}>
                                            {habit.icon} {habit.name}
                                        </div>
                                        {habit.target_value && (
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                Target: {habit.target_value} {habit.unit}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {habit.streak > 0 && (
                                        <div className="flex items-center gap-1 bg-orange-900/40 px-2.5 py-1 rounded-lg">
                                            <span className="text-orange-400 text-sm font-bold">{habit.streak}</span>
                                            <span className="text-sm">🔥</span>
                                        </div>
                                    )}
                                    {habit.log?.completed && (
                                        <span className="text-xs text-green-400 font-medium">+10 XP</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {habits.length === 0 && (
                <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 border-dashed text-center">
                    <div className="text-5xl mb-4">🎯</div>
                    <h3 className="text-xl font-semibold mb-2">No habits yet</h3>
                    <p className="text-gray-400 mb-6">Add your first habit to start tracking your discipline</p>
                    <a
                        href="/habits"
                        className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition"
                    >
                        Add your first habit →
                    </a>
                </div>
            )
            }
        </div >
    )
}

function getTimeOfDay() {
    const h = new Date().getHours()
    if (h < 12) return 'morning'
    if (h < 17) return 'afternoon'
    return 'evening'
}
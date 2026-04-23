'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import WeekStrip from '@/components/habits/WeekStrip'
import LogHabitModal from '@/components/habits/LogHabitModal'
import WeeklySummary from '@/components/habits/WeeklySummary'

type HabitWithLog = {
  id: string; name: string; icon: string; color: string
  habit_type: string; unit: string | null; target_value: number | null
  log?: { id: string; completed: boolean; value: number | null; notes: string | null }
  streak: number
  lastLoggedDate: string | null
  is_group_habit: boolean
}

const HABIT_COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399', '#fbbf24', '#f87171']

export default function DashboardPage() {
  const [habits, setHabits] = useState<HabitWithLog[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [celebrating, setCelebrating] = useState<string | null>(null)
  const [dayBonusAwarded, setDayBonusAwarded] = useState(false)
  const [activeModal, setActiveModal] = useState<HabitWithLog | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const today = new Date().toISOString().split('T')[0]
  const supabase = createClient()

  useEffect(() => { loadData(selectedDate) }, [selectedDate])

  async function loadData(date: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: prof }, { data: habitsData }, { data: logsData }, { data: streaksData }, { data: ghRows }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('habits').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at'),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('log_date', date),
        supabase.from('streaks').select('*').eq('user_id', user.id),
        supabase.from('group_habits').select('habit_id'),
      ])

    if (!prof) {
      const emailName = user.email?.split('@')[0] ?? 'User'
      const { data: newProf } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: user.user_metadata?.preferred_username ?? emailName, xp: 0, level: 1 })
        .select().single()
      setProfile(newProf)
    } else {
      setProfile(prof)
    }

    const groupHabitIds = new Set((ghRows ?? []).map((r: any) => r.habit_id))

    const mapped = (habitsData ?? []).map((h: any, idx: number) => ({
      ...h,
      color: h.color ?? HABIT_COLORS[idx % HABIT_COLORS.length],
      log: logsData?.find((l: any) => l.habit_id === h.id),
      streak: streaksData?.find((s: any) => s.habit_id === h.id)?.current_streak ?? 0,
      lastLoggedDate: streaksData?.find((s: any) => s.habit_id === h.id)?.last_logged_date ?? null,
      is_group_habit: groupHabitIds.has(h.id),
    }))

    setHabits(mapped)

    const completedToday = logsData?.filter((l: any) => l.completed).length ?? 0
    const totalHabits = habitsData?.length ?? 0
    if (totalHabits > 0 && completedToday / totalHabits >= 0.6) setDayBonusAwarded(true)
    setLoading(false)
  }

  // Determine visual state for each habit
  function getHabitState(habit: HabitWithLog): 'done' | 'failed' | 'pending' {
    const isToday = selectedDate === today
    if (habit.log?.completed) return 'done'
    // If today and there's a log but not completed = explicitly marked not done
    if (isToday && habit.log && !habit.log.completed) return 'failed'
    // Past day with no log = missed/yellow
    if (!isToday && !habit.log?.completed) return 'failed'
    // Today, no log yet = pending (yellow)
    return 'pending'
  }

  function getStateStyle(state: 'done' | 'failed' | 'pending', color: string) {
    if (state === 'done') return {
      border: `2px solid ${color}`,
      background: `${color}18`,
    }
    if (state === 'failed') return {
      border: '2px solid #fca5a5',
      background: '#fef2f2',
    }
    return {
      border: '2px solid #fde68a',
      background: '#fffbeb',
    }
  }

  function handleHabitClick(habit: HabitWithLog) {
    if (selectedDate !== today) return
    if (habit.log?.completed) {
      markUndone(habit)
    } else {
      setActiveModal(habit)
    }
  }

  async function markUndone(habit: HabitWithLog) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (habit.log) {
      await supabase.from('habit_logs').update({ completed: false }).eq('id', habit.log.id)
      // Decrease streak only if it was logged today
      if (habit.lastLoggedDate === today) {
        const { data: s } = await supabase.from('streaks').select('*')
          .eq('habit_id', habit.id).eq('user_id', user.id).single()
        if (s && s.current_streak > 0) {
          await supabase.from('streaks').update({
            current_streak: s.current_streak - 1,
          }).eq('id', s.id)
        }
      }
    }
    loadData(selectedDate)
  }
  async function markFailed(habit: HabitWithLog) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (habit.log) {
      await supabase.from('habit_logs')
        .update({ completed: false, notes: 'marked as not done' })
        .eq('id', habit.log.id)
    } else {
      await supabase.from('habit_logs').insert({
        habit_id: habit.id,
        user_id: user.id,
        log_date: today,
        completed: false,
        notes: 'marked as not done',
      })
    }

    loadData(selectedDate)
  }

  async function completeHabit(habit: HabitWithLog, value?: number, photoUrl?: string, notes?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setActiveModal(null)

    // For photo habits, store the compressed base64 in notes
    // For others, store text notes
    const notesValue = habit.habit_type === 'photo' && photoUrl
      ? photoUrl
      : (notes ?? null)

    const logPayload = {
      completed: true,
      value: value ?? null,
      notes: notesValue,
    }

    let logError: any = null

    if (habit.log) {
      const { error } = await supabase
        .from('habit_logs')
        .update(logPayload)
        .eq('id', habit.log.id)
      logError = error
    } else {
      const { error } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habit.id,
          user_id: user.id,
          log_date: today,
          ...logPayload,
        })
      logError = error
    }

    if (logError) {
      console.error('Failed to save habit log:', logError)
      alert(`Failed to save: ${logError.message}`)
      return
    }

    setCelebrating(habit.id)
    setTimeout(() => setCelebrating(null), 800)
    await updateHabitStreak(habit.id, user.id)
    await checkDayBonus(user.id)
    loadData(selectedDate)
  }

  async function checkDayBonus(userId: string) {
    if (dayBonusAwarded) return
    const { data: allHabits } = await supabase
      .from('habits').select('id').eq('user_id', userId).eq('is_active', true)
    const { data: doneLogs } = await supabase
      .from('habit_logs').select('id')
      .eq('user_id', userId).eq('log_date', today).eq('completed', true)
    const total = allHabits?.length ?? 0
    const done = (doneLogs?.length ?? 0) + 1
    if (total > 0 && done / total >= 0.6) {
      setDayBonusAwarded(true)
    }
  }

  async function updateHabitStreak(habitId: string, userId: string) {
    const { data: existing } = await supabase.from('streaks').select('*')
      .eq('habit_id', habitId).eq('user_id', userId).single()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    if (existing) {
      // Only increment if not already logged today
      if (existing.last_logged_date === today) return
      const cont = existing.last_logged_date === yesterdayStr
      const newStreak = cont ? existing.current_streak + 1 : 1
      await supabase.from('streaks').update({
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, existing.longest_streak),
        last_logged_date: today,
      }).eq('id', existing.id)
    } else {
      await supabase.from('streaks').insert({
        habit_id: habitId, user_id: userId,
        current_streak: 1, longest_streak: 1, last_logged_date: today,
      })
    }
  }

  const done = habits.filter(h => h.log?.completed).length
  const total = habits.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total
  const isToday = selectedDate === today
  const threshold = total > 0 ? Math.ceil(total * 0.6) : 0
  const bestStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0

  const selectedDateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 font-bold">Loading your journey...</p>
    </div>
  )

  return (
    <div className="space-y-4">

      {activeModal && (
        <LogHabitModal
          habit={activeModal}
          onConfirm={(value, photoUrl, notes) => completeHabit(activeModal, value, photoUrl, notes)}
          onCancel={() => setActiveModal(null)}
        />
      )}

      {/* Greeting — always at top */}
      <div className="card py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-xl">
              {isToday
                ? `${getGreeting()}, ${profile?.username}! ${getGreetingEmoji()}`
                : `Viewing ${selectedDateLabel} 👀`}
            </h1>
            <p className="text-gray-400 font-semibold text-sm mt-0.5">
              {isToday
                ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'Past day — tap today to log'}
            </p>
          </div>
          {bestStreak > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 border-2 border-orange-200 px-3 py-2 rounded-2xl">
              <span className="text-xl">🔥</span>
              <div className="text-right">
                <div className="font-black text-orange-600 text-lg leading-none">{bestStreak}</div>
                <div className="text-xs font-bold text-orange-400">streak</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weekly summary — NEW */}
      <WeeklySummary />

      {/* Week strip */}
      <WeekStrip onDateChange={date => setSelectedDate(date)} />

      {/* Banners */}
      {allDone && isToday && (
        <div className="card bg-gradient-to-r from-green-400 to-emerald-500 border-green-300 text-white text-center py-5">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-black text-xl">Perfect day! All done!</div>
          <div className="font-semibold opacity-90 mt-1">You're on fire. See you tomorrow!</div>
        </div>
      )}

      {dayBonusAwarded && isToday && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <p className="font-black text-green-700 text-sm">Streak milestone hit! 60%+ done today!</p>
        </div>
      )}

      {isToday && !dayBonusAwarded && total > 0 && done < threshold && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="font-black text-yellow-700 text-sm">
              {threshold - done} more to hit your streak today!
            </p>
            <p className="text-yellow-600 text-xs font-semibold">Complete 60% of habits to keep your streak 🔥</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border-2 p-3 text-center bg-green-50 border-green-200">
          <div className="font-black text-xl text-green-600">{done}/{total}</div>
          <div className="text-gray-500 font-semibold text-xs mt-0.5">Done</div>
        </div>
        <div className="rounded-2xl border-2 p-3 text-center bg-blue-50 border-blue-200">
          <div className="font-black text-xl text-blue-600">{pct}%</div>
          <div className="text-gray-500 font-semibold text-xs mt-0.5">Completion</div>
        </div>
        <div className="rounded-2xl border-2 p-3 text-center bg-orange-50 border-orange-200">
          <div className="font-black text-xl text-orange-600">{bestStreak}🔥</div>
          <div className="text-gray-500 font-semibold text-xs mt-0.5">Best streak</div>
        </div>
      </div>

      {/* Habits */}
      {total > 0 ? (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-lg">
              {isToday ? "Today's Habits" : selectedDateLabel}
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />Done</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-300 inline-block" />Pending</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" />Missed</span>
            </div>
          </div>

          {/* Progress bar with 60% marker */}
          <div className="relative mb-5">
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: pct >= 60 ? 'linear-gradient(to right, #4ade80, #10b981)' : 'linear-gradient(to right, #fbbf24, #f59e0b)',
                }} />
            </div>
            {/* 60% marker line */}
            <div className="absolute top-0 h-3 w-0.5 bg-orange-400" style={{ left: '60%' }} />
            <div className="absolute top-4 text-xs font-bold text-orange-400" style={{ left: '58%' }}>
              60%🔥
            </div>
          </div>

          <div className="space-y-3 mt-6">
            {habits.map(habit => {
              const state = getHabitState(habit)
              const stateStyle = getStateStyle(state, habit.color)
              const isCelebrating = celebrating === habit.id
              const logValue = habit.log?.value
              const logNote = habit.log?.notes

              return (
                <div key={habit.id} className="flex items-center gap-2">
                  {/* Icon */}
                  <Link href={`/habits/${habit.id}`}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm hover:scale-105 transition-transform"
                    style={{ backgroundColor: habit.color }}>
                    {habit.icon}
                  </Link>

                  {/* Habit card */}
                  <button
                    onClick={() => isToday && handleHabitClick(habit)}
                    className={`flex-1 flex items-center justify-between p-3 rounded-2xl transition-all duration-200 text-left
                      ${isCelebrating ? 'scale-95' : 'scale-100'}
                      ${!isToday ? 'cursor-default' : 'cursor-pointer'}`}
                    style={stateStyle}>

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Status dot */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${state === 'done' ? 'border-0' : state === 'failed' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}`}
                        style={state === 'done' ? { backgroundColor: habit.color } : {}}>
                        {state === 'done' && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {state === 'failed' && <span className="text-red-400 text-xs font-black">✕</span>}
                        {state === 'pending' && <span className="text-yellow-400 text-xs font-black">?</span>}
                      </div>

                      <div className="min-w-0">
                        <span className={`font-bold text-sm block ${state === 'done' ? 'line-through text-gray-400' : state === 'failed' ? 'text-red-500' : 'text-gray-800'}`}>
                          {habit.name}
                          {habit.is_group_habit && (
                            <span className="ml-2 text-xs font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-lg border border-purple-200 not-italic">
                              👥
                            </span>
                          )}
                        </span>
                        {/* Logged value */}
                        {state === 'done' && logValue != null && (
                          <span className="text-xs font-semibold" style={{ color: habit.color }}>
                            {habit.habit_type === 'range' ? `Rated ${logValue}/10` :
                              habit.habit_type === 'timer' ? `${logValue} min` :
                                `${logValue} ${habit.unit ?? ''}`}
                          </span>
                        )}
                        {/* Notes display */}
                        {state === 'done' && logNote && habit.habit_type !== 'photo' && (
                          <span className="text-xs font-semibold text-gray-400 italic block truncate max-w-[160px]">
                            "{logNote}"
                          </span>
                        )}

                        {state === 'done' && logNote && habit.habit_type === 'photo' && (
                          <span className="text-xs font-semibold text-green-500">📸 Photo submitted</span>
                        )}
                        {state === 'pending' && (
                          <span className="text-xs font-semibold text-yellow-500">
                            {habit.habit_type === 'photo' ? 'Tap to upload photo' :
                              habit.habit_type === 'timer' ? `Target: ${habit.target_value}min` :
                                habit.habit_type === 'range' ? 'Tap to rate' :
                                  habit.target_value ? `Target: ${habit.target_value} ${habit.unit}` : 'Tap to mark done'}
                          </span>
                        )}
                        {state === 'failed' && (
                          <span className="text-xs font-semibold text-red-400">
                            {isToday ? 'Marked as not done' : 'Not completed'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {habit.streak > 0 && (
                        <span className="text-xs font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                          {habit.streak}🔥
                        </span>
                      )}
                      {state === 'done'
                        ? <span className="text-xs font-black text-green-500">✓</span>
                        : state === 'failed'
                          ? <span className="text-xs font-black text-red-400">✕</span>
                          : isToday && <span className="text-xs font-bold text-yellow-400">···</span>
                      }
                    </div>
                  </button>
                  {/* ❌ Fail button — only for pending + today */}
                  {state === 'pending' && isToday && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        markFailed(habit)
                      }}
                      className="w-9 h-9 rounded-xl bg-red-50 border-2 border-red-200 hover:bg-red-100 flex items-center justify-center flex-shrink-0 transition-all"
                      title="Mark as missed"
                    >
                      <span className="text-red-400 font-black">✕</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {!isToday && (
            <p className="text-center text-xs text-gray-400 font-semibold mt-4 pt-4 border-t border-gray-100">
              Past day view — tap today on the calendar to log
            </p>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="font-black text-xl mb-2">No habits yet!</h3>
          <p className="text-gray-400 font-semibold mb-6">Add your first habit and start your streak</p>
          <Link href="/habits" className="btn-primary inline-block">Add habits →</Link>
        </div>
      )}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
function getGreetingEmoji() {
  const h = new Date().getHours()
  return h < 12 ? '☀️' : h < 17 ? '👋' : '🌙'
}
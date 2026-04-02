'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Habit } from '@/types/database'

const PRESET_HABITS = [
    { name: 'Gym workout', icon: '💪', unit: 'minutes', target_value: 60, habit_type: 'numeric' },
    { name: 'Protein intake', icon: '🥩', unit: 'grams', target_value: 150, habit_type: 'numeric' },
    { name: 'Sleep', icon: '😴', unit: 'hours', target_value: 8, habit_type: 'numeric' },
    { name: 'Screen time limit', icon: '📵', unit: 'hours', target_value: 2, habit_type: 'numeric' },
    { name: 'Reading', icon: '📚', unit: 'pages', target_value: 20, habit_type: 'numeric' },
    { name: 'Meditation', icon: '🧘', unit: 'minutes', target_value: 10, habit_type: 'numeric' },
    { name: 'Water intake', icon: '💧', unit: 'liters', target_value: 3, habit_type: 'numeric' },
    { name: 'No junk food', icon: '🥗', unit: null, target_value: null, habit_type: 'boolean' },
]

export default function HabitsPage() {
    const [habits, setHabits] = useState<Habit[]>([])
    const [showForm, setShowForm] = useState(false)
    const [name, setName] = useState('')
    const [icon, setIcon] = useState('⚡')
    const [unit, setUnit] = useState('')
    const [targetValue, setTargetValue] = useState('')
    const [habitType, setHabitType] = useState<'boolean' | 'numeric'>('boolean')
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => { loadHabits() }, [])

    async function loadHabits() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
            .from('habits').select('*').eq('user_id', user.id).order('created_at')
        if (data) setHabits(data)
    }

    async function addHabit(e?: React.FormEvent) {
        e?.preventDefault()
        if (!name.trim()) return
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('habits').insert({
            user_id: user.id,
            name: name.trim(),
            icon,
            unit: unit || null,
            target_value: targetValue ? parseFloat(targetValue) : null,
            habit_type: habitType,
        })
        setName(''); setIcon('⚡'); setUnit(''); setTargetValue(''); setHabitType('boolean')
        setShowForm(false)
        setLoading(false)
        loadHabits()
    }

    async function addPreset(preset: typeof PRESET_HABITS[0]) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('habits').insert({ user_id: user.id, ...preset })
        loadHabits()
    }

    async function toggleActive(habit: Habit) {
        await supabase.from('habits')
            .update({ is_active: !habit.is_active })
            .eq('id', habit.id)
        loadHabits()
    }

    async function deleteHabit(id: string) {
        if (!confirm('Delete this habit? All logs will be lost.')) return
        await supabase.from('habits').delete().eq('id', id)
        loadHabits()
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">My Habits</h1>
                    <p className="text-gray-400 mt-1">Manage the habits you want to track daily</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl transition"
                >
                    {showForm ? 'Cancel' : '+ Add Custom'}
                </button>
            </div>

            {/* Custom habit form */}
            {showForm && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-indigo-800">
                    <h2 className="text-lg font-semibold mb-4">Create custom habit</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex gap-2">
                            <input
                                value={icon}
                                onChange={e => setIcon(e.target.value)}
                                className="w-14 bg-gray-800 text-white border border-gray-700 rounded-xl px-3 py-2.5 text-center text-xl"
                                maxLength={2}
                            />
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Habit name"
                                className="flex-1 bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <select
                            value={habitType}
                            onChange={e => setHabitType(e.target.value as 'boolean' | 'numeric')}
                            className="bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2.5"
                        >
                            <option value="boolean">Yes/No (did you do it?)</option>
                            <option value="numeric">Numeric (track a value)</option>
                        </select>
                        {habitType === 'numeric' && (
                            <>
                                <input
                                    value={targetValue}
                                    onChange={e => setTargetValue(e.target.value)}
                                    placeholder="Target amount (e.g. 150)"
                                    type="number"
                                    className="bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500"
                                />
                                <input
                                    value={unit}
                                    onChange={e => setUnit(e.target.value)}
                                    placeholder="Unit (e.g. grams, hours)"
                                    className="bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500"
                                />
                            </>
                        )}
                    </div>
                    <button
                        onClick={addHabit}
                        disabled={loading || !name.trim()}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition"
                    >
                        {loading ? 'Adding...' : 'Add Habit'}
                    </button>
                </div>
            )}

            {/* Quick-add presets */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Quick add popular habits</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PRESET_HABITS.map(preset => {
                        const already = habits.some(h => h.name === preset.name)
                        return (
                            <button
                                key={preset.name}
                                onClick={() => !already && addPreset(preset)}
                                disabled={already}
                                className={`p-3 rounded-xl border text-left transition
                  ${already
                                        ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                                        : 'bg-gray-900 border-gray-700 hover:border-indigo-500 hover:bg-gray-800 cursor-pointer'}`}
                            >
                                <div className="text-2xl mb-1">{preset.icon}</div>
                                <div className="text-sm font-medium text-white">{preset.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {already ? '✓ Added' : preset.target_value ? `${preset.target_value} ${preset.unit}` : 'Yes/No'}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Active habits list */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Your habits ({habits.length})</h2>
                {habits.length === 0 ? (
                    <div className="text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-2xl">
                        No habits yet — add some above!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {habits.map(habit => (
                            <div key={habit.id}
                                className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-800">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{habit.icon}</span>
                                    <div>
                                        <div className="font-medium">{habit.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {habit.habit_type === 'numeric' && habit.target_value
                                                ? `Target: ${habit.target_value} ${habit.unit}`
                                                : 'Yes / No'}
                                            {' · '}{habit.is_active ? '🟢 Active' : '⏸️ Paused'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleActive(habit)}
                                        className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition"
                                    >
                                        {habit.is_active ? 'Pause' : 'Resume'}
                                    </button>
                                    <button
                                        onClick={() => deleteHabit(habit.id)}
                                        className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 px-3 py-1.5 rounded-lg transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
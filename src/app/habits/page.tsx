'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import type { Habit } from '@/types/database'

const PRESETS = [
    { name: 'Gym workout', icon: '💪', unit: 'minutes', target_value: 60, habit_type: 'numeric', color: '#4ade80' },
    { name: 'Protein intake', icon: '🥩', unit: 'grams', target_value: 150, habit_type: 'numeric', color: '#fb923c' },
    { name: 'Sleep', icon: '😴', unit: 'hours', target_value: 8, habit_type: 'numeric', color: '#60a5fa' },
    { name: 'Screen time limit', icon: '📵', unit: 'hours', target_value: 2, habit_type: 'numeric', color: '#f87171' },
    { name: 'Reading', icon: '📚', unit: 'pages', target_value: 20, habit_type: 'numeric', color: '#a78bfa' },
    { name: 'Meditation', icon: '🧘', unit: 'minutes', target_value: 10, habit_type: 'numeric', color: '#34d399' },
    { name: 'Water intake', icon: '💧', unit: 'liters', target_value: 3, habit_type: 'numeric', color: '#38bdf8' },
    { name: 'No junk food', icon: '🥗', unit: null, target_value: null, habit_type: 'boolean', color: '#fbbf24' },
]

const COLOR_OPTIONS = [
    '#4ade80', '#60a5fa', '#f472b6', '#fb923c',
    '#a78bfa', '#34d399', '#fbbf24', '#f87171',
    '#38bdf8', '#e879f9', '#2dd4bf', '#facc15',
]

const EMOJI_OPTIONS = [
    '💪', '🏃', '🧘', '😴', '🥗', '🥩', '💧', '📚',
    '🎯', '⚡', '🔥', '🏋️', '🚴', '🧠', '✍️', '🎨',
    '🎵', '📵', '☀️', '🌙', '🍎', '🥤', '🏊', '⏰',
    '💊', '🧹', '💰', '🤸', '🛌', '📖', '🚶', '🌿',
]

const HABIT_TYPE_OPTIONS = [
    { value: 'boolean', label: '✅ Yes / No', desc: 'Did you do it today?' },
    { value: 'numeric', label: '🔢 Numeric', desc: 'Track a measurable amount' },
    { value: 'range', label: '🎚️ Range (1–10)', desc: 'Rate your performance' },
    { value: 'timer', label: '⏱️ Timer', desc: 'Track time spent' },
    { value: 'photo', label: '📸 Photo proof', desc: 'Upload a photo as proof' },
]

export default function HabitsPage() {
    const [habits, setHabits] = useState<Habit[]>([])
    const [showForm, setShowForm] = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [name, setName] = useState('')
    const [icon, setIcon] = useState('⚡')
    const [unit, setUnit] = useState('')
    const [targetValue, setTargetValue] = useState('')
    const [habitType, setHabitType] = useState('boolean')
    const [color, setColor] = useState('#4ade80')
    const [saving, setSaving] = useState(false)
    const supabase = createClient()

    useEffect(() => { loadHabits() }, [])

    async function loadHabits() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('habits').select('*').eq('user_id', user.id).order('created_at')
        if (data) setHabits(data)
    }

    async function addHabit() {
        if (!name.trim()) return
        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('habits').insert({
            user_id: user.id, name: name.trim(), icon, color,
            unit: unit || null,
            target_value: targetValue ? parseFloat(targetValue) : null,
            habit_type: habitType,
        })
        setName(''); setIcon('⚡'); setUnit(''); setTargetValue('')
        setColor('#4ade80'); setHabitType('boolean')
        setShowForm(false); setSaving(false); loadHabits()
    }

    async function addPreset(preset: typeof PRESETS[0]) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('habits').insert({ user_id: user.id, ...preset })
        loadHabits()
    }

    async function deleteHabit(id: string) {
        if (!confirm('Delete this habit and all its logs?')) return
        await supabase.from('habits').delete().eq('id', id)
        loadHabits()
    }

    const selectedTypeInfo = HABIT_TYPE_OPTIONS.find(t => t.value === habitType)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-black text-2xl">My Habits ⚡</h1>
                    <p className="text-gray-400 font-semibold text-sm mt-1">Tap any habit to see its history</p>
                </div>
                <button onClick={() => { setShowForm(!showForm); setShowEmojiPicker(false) }}
                    className="btn-primary text-sm py-2.5 px-5">
                    {showForm ? '✕ Cancel' : '+ Custom'}
                </button>
            </div>

            {/* Custom habit form */}
            {showForm && (
                <div className="card border-green-200 bg-green-50/50">
                    <h2 className="font-black text-lg mb-4">Create custom habit</h2>
                    <div className="space-y-4">

                        {/* Emoji + Name row */}
                        <div className="flex gap-2 items-start">
                            <div className="relative">
                                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="w-14 h-14 bg-white border-2 border-gray-200 rounded-2xl flex items-center justify-center text-2xl hover:border-green-400 transition text-3xl">
                                    {icon}
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute top-16 left-0 z-50 bg-white border-2 border-gray-200 rounded-2xl p-3 shadow-xl w-64">
                                        <p className="text-xs font-bold text-gray-400 mb-2">Pick an emoji icon</p>
                                        <div className="grid grid-cols-8 gap-1">
                                            {EMOJI_OPTIONS.map(e => (
                                                <button key={e} onClick={() => { setIcon(e); setShowEmojiPicker(false) }}
                                                    className={`w-8 h-8 rounded-lg text-lg hover:bg-green-100 transition flex items-center justify-center
                            ${icon === e ? 'bg-green-100 ring-2 ring-green-400' : ''}`}>
                                                    {e}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <input value={name} onChange={e => setName(e.target.value)}
                                placeholder="Habit name (e.g. Morning run)"
                                className="flex-1 input-field h-14" />
                        </div>

                        {/* Color picker */}
                        <div>
                            <p className="text-sm font-bold text-gray-500 mb-2">Pick a color</p>
                            <div className="flex gap-2 flex-wrap">
                                {COLOR_OPTIONS.map(c => (
                                    <button key={c} onClick={() => setColor(c)}
                                        className={`w-8 h-8 rounded-xl transition-all ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>

                        {/* Habit type selector */}
                        <div>
                            <p className="text-sm font-bold text-gray-500 mb-2">Tracking type</p>
                            <div className="grid grid-cols-1 gap-2">
                                {HABIT_TYPE_OPTIONS.map(t => (
                                    <button key={t.value} onClick={() => setHabitType(t.value)}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left
                      ${habitType === t.value
                                                ? 'border-green-400 bg-green-50'
                                                : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                        <span className="text-xl">{t.label.split(' ')[0]}</span>
                                        <div>
                                            <div className="font-bold text-sm text-gray-800">{t.label.split(' ').slice(1).join(' ')}</div>
                                            <div className="text-xs text-gray-400 font-semibold">{t.desc}</div>
                                        </div>
                                        {habitType === t.value && (
                                            <div className="ml-auto w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Conditional fields */}
                        {habitType === 'numeric' && (
                            <div className="grid grid-cols-2 gap-3">
                                <input value={targetValue} onChange={e => setTargetValue(e.target.value)}
                                    placeholder="Target (e.g. 150)" type="number" className="input-field" />
                                <input value={unit} onChange={e => setUnit(e.target.value)}
                                    placeholder="Unit (e.g. grams)" className="input-field" />
                            </div>
                        )}
                        {habitType === 'range' && (
                            <div className="bg-white border-2 border-gray-200 rounded-2xl p-4">
                                <p className="font-bold text-sm text-gray-600 mb-2">Scale: 1 to 10</p>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                        <div key={n} className="flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400"
                                            style={{ backgroundColor: `${color}${Math.round(n * 25).toString(16)}` }}>
                                            {n}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 font-semibold mt-2">User will rate 1–10 each day</p>
                            </div>
                        )}
                        {habitType === 'timer' && (
                            <div className="grid grid-cols-2 gap-3">
                                <input value={targetValue} onChange={e => setTargetValue(e.target.value)}
                                    placeholder="Target minutes (e.g. 30)" type="number" className="input-field" />
                                <div className="input-field bg-gray-50 text-gray-400 flex items-center">⏱️ minutes</div>
                            </div>
                        )}
                        {habitType === 'photo' && (
                            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center">
                                <div className="text-3xl mb-2">📸</div>
                                <p className="font-bold text-sm text-gray-600">Photo proof habit</p>
                                <p className="text-xs text-gray-400 mt-1">User uploads a photo to mark as complete</p>
                            </div>
                        )}

                        {/* Preview */}
                        <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border-2 border-gray-100">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm"
                                style={{ backgroundColor: color }}>
                                {icon}
                            </div>
                            <div>
                                <span className="font-bold text-gray-700">{name || 'Habit name'}</span>
                                <div className="text-xs text-gray-400 font-semibold mt-0.5">{selectedTypeInfo?.label}</div>
                            </div>
                        </div>

                        <button onClick={addHabit} disabled={saving || !name.trim()} className="btn-primary w-full">
                            {saving ? 'Adding...' : 'Add Habit ✓'}
                        </button>
                    </div>
                </div>
            )}

            {/* Quick add presets */}
            <div>
                <h2 className="font-black text-sm text-gray-500 mb-3">⚡ Quick add</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PRESETS.map(p => {
                        const added = habits.some(h => h.name === p.name)
                        return (
                            <button key={p.name} onClick={() => !added && addPreset(p)} disabled={added}
                                className={`p-3 rounded-2xl border-2 text-left transition-all duration-200
                  ${added ? 'bg-green-50 border-green-200 opacity-70 cursor-default'
                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer'}`}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2"
                                    style={{ backgroundColor: p.color }}>
                                    {p.icon}
                                </div>
                                <div className="font-bold text-sm text-gray-800">{p.name}</div>
                                <div className="text-xs font-semibold mt-0.5">
                                    {added
                                        ? <span className="text-green-500">✓ Added</span>
                                        : <span className="text-gray-400">{p.target_value ? `${p.target_value} ${p.unit}` : 'Yes/No'}</span>
                                    }
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Habit list — no Pause, only Delete */}
            <div>
                <h2 className="font-black text-sm text-gray-500 mb-3">Your habits ({habits.length})</h2>
                {habits.length === 0 ? (
                    <div className="card text-center py-10 border-dashed">
                        <div className="text-4xl mb-3">🎯</div>
                        <p className="font-bold text-gray-400">No habits yet — add some above!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {habits.map(h => (
                            <div key={h.id} className="bg-white rounded-2xl border-2 border-gray-100 p-3 flex items-center gap-3">
                                <Link href={`/habits/${h.id}`}
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 hover:scale-105 transition-transform shadow-sm"
                                    style={{ backgroundColor: h.color ?? '#4ade80' }}>
                                    {h.icon}
                                </Link>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/habits/${h.id}`} className="font-bold text-gray-800 hover:text-green-600 transition">
                                        {h.name}
                                    </Link>
                                    <div className="text-xs text-gray-400 font-semibold mt-0.5">
                                        {HABIT_TYPE_OPTIONS.find(t => t.value === h.habit_type)?.label ?? h.habit_type}
                                        {h.target_value ? ` · ${h.target_value} ${h.unit}` : ''}
                                        {' · '}
                                        <span className="text-green-500">● Active</span>
                                    </div>
                                </div>
                                <button onClick={() => deleteHabit(h.id)} className="btn-danger text-xs py-2 px-4 flex-shrink-0">
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
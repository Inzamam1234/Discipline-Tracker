'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import type { LeaderboardEntry } from '@/types/database'

type GroupInfo = {
    id: string; name: string; description: string | null
    invite_code: string; created_by: string; my_role: string; my_user_id: string
}
type MemberHabit = {
    user_id: string; username: string; habit_name: string
    habit_icon: string; habit_color: string; completed: boolean
    value: number | null; is_group_habit: boolean
}
type GroupHabit = {
    id: string; name: string; icon: string; color: string
    habit_type: string; target_value: number | null; unit: string | null
}

const EMOJI_OPTIONS = [
    '💪', '🏃', '🧘', '😴', '🥗', '🥩', '💧', '📚',
    '🎯', '⚡', '🔥', '🏋️', '🚴', '🧠', '✍️', '🎨',
    '🎵', '📵', '☀️', '🌙', '🍎', '🥤', '🏊', '⏰',
]
const COLOR_OPTIONS = [
    '#4ade80', '#60a5fa', '#f472b6', '#fb923c',
    '#a78bfa', '#34d399', '#fbbf24', '#f87171',
]
const HABIT_TYPES = [
    { value: 'boolean', label: '✅ Yes / No' },
    { value: 'numeric', label: '🔢 Numeric' },
    { value: 'range', label: '🎚️ Range (1–10)' },
    { value: 'timer', label: '⏱️ Timer' },
]

export default function GroupDetailPage() {
    const { id } = useParams() as { id: string }
    const router = useRouter()
    const [group, setGroup] = useState<GroupInfo | null>(null)
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [memberHabits, setMemberHabits] = useState<MemberHabit[]>([])
    const [groupHabits, setGroupHabits] = useState<GroupHabit[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'leaderboard' | 'habits' | 'challenges' | 'settings'>('leaderboard')
    const [copiedCode, setCopiedCode] = useState(false)
    const [showAddHabit, setShowAddHabit] = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [today] = useState(new Date().toISOString().split('T')[0])

    const [habitName, setHabitName] = useState('')
    const [habitIcon, setHabitIcon] = useState('🎯')
    const [habitColor, setHabitColor] = useState('#4ade80')
    const [habitType, setHabitType] = useState('boolean')
    const [habitTarget, setHabitTarget] = useState('')
    const [habitUnit, setHabitUnit] = useState('')
    const [savingHabit, setSavingHabit] = useState(false)
    const [habitError, setHabitError] = useState('')

    const supabase = createClient()

    const loadData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: membership } = await supabase
            .from('group_members').select('role')
            .eq('group_id', id).eq('user_id', user.id).single()
        if (!membership) { router.push('/groups'); return }

        const { data: groupData } = await supabase
            .from('groups').select('*').eq('id', id).single()
        if (groupData) setGroup({ ...groupData, my_role: membership.role, my_user_id: user.id })

        const { data: lb } = await supabase
            .rpc('get_group_leaderboard', { p_group_id: id, p_date: today })
        if (lb) setLeaderboard(lb)

        const { data: members } = await supabase
            .from('group_members').select('user_id').eq('group_id', id)

        if (members) {
            const memberIds = members.map((m: any) => m.user_id)
            const [{ data: profiles }, { data: habits }, { data: logs }, { data: ghRows }] =
                await Promise.all([
                    supabase.from('profiles').select('id, username').in('id', memberIds),
                    supabase.from('habits').select('*').in('user_id', memberIds).eq('is_active', true),
                    supabase.from('habit_logs').select('*').in('user_id', memberIds).eq('log_date', today),
                    supabase.from('group_habits').select('habit_id').eq('group_id', id),
                ])

            const groupHabitIds = new Set((ghRows ?? []).map((r: any) => r.habit_id))

            setMemberHabits((habits ?? []).map((h: any) => ({
                user_id: h.user_id,
                username: profiles?.find((p: any) => p.id === h.user_id)?.username ?? 'Unknown',
                habit_name: h.name,
                habit_icon: h.icon,
                habit_color: h.color ?? '#4ade80',
                completed: !!(logs?.find((l: any) => l.habit_id === h.id && l.completed)),
                value: logs?.find((l: any) => l.habit_id === h.id)?.value ?? null,
                is_group_habit: groupHabitIds.has(h.id),
            })))

            if (ghRows && ghRows.length > 0) {
                const ghIds = ghRows.map((r: any) => r.habit_id)
                const { data: ghDetails } = await supabase
                    .from('habits').select('*').in('id', ghIds).eq('is_active', true)
                const seen = new Set<string>()
                const unique: GroupHabit[] = []
                for (const h of (ghDetails ?? [])) {
                    if (!seen.has(h.name)) {
                        seen.add(h.name)
                        unique.push({
                            id: h.id, name: h.name, icon: h.icon,
                            color: h.color ?? '#4ade80', habit_type: h.habit_type,
                            target_value: h.target_value, unit: h.unit,
                        })
                    }
                }
                setGroupHabits(unique)
            } else {
                setGroupHabits([])
            }
        }
        setLoading(false)
    }, [id, today])

    useEffect(() => {
        loadData()
        const interval = setInterval(loadData, 30000)
        return () => clearInterval(interval)
    }, [loadData])

    async function addGroupHabit() {
        if (!habitName.trim() || !group) return
        setSavingHabit(true); setHabitError('')

        const { data: members } = await supabase
            .from('group_members').select('user_id').eq('group_id', id)
        if (!members?.length) { setSavingHabit(false); return }

        let successCount = 0
        for (const m of members) {
            const { error } = await supabase.rpc('create_group_habit_for_member', {
                p_group_id: id,
                p_user_id: m.user_id,
                p_name: habitName.trim(),
                p_icon: habitIcon,
                p_color: habitColor,
                p_habit_type: habitType,
                p_target_value: habitTarget ? parseFloat(habitTarget) : null,
                p_unit: habitUnit || null,
            })
            if (error) setHabitError(`Error: ${error.message}`)
            else successCount++
        }

        if (successCount === members.length) {
            setHabitName(''); setHabitIcon('🎯'); setHabitColor('#4ade80')
            setHabitType('boolean'); setHabitTarget(''); setHabitUnit('')
            setShowAddHabit(false); setShowEmojiPicker(false)
        }
        setSavingHabit(false)
        loadData()
    }

    async function removeGroupHabit(habitName: string) {
        if (!confirm(`Remove "${habitName}" from all members?`)) return
        const { error } = await supabase.rpc('remove_group_habit', {
            p_group_id: id,
            p_habit_name: habitName,
        })
        if (error) alert('Error: ' + error.message)
        else loadData()
    }

    async function leaveGroup() {
        if (!confirm('Leave this group?')) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('group_members').delete().eq('group_id', id).eq('user_id', user.id)
        router.push('/groups')
    }

    async function deleteGroup() {
        if (!confirm('Delete this group? Cannot be undone.')) return
        await supabase.from('groups').update({ is_active: false }).eq('id', id)
        router.push('/groups')
    }

    async function copyCode() {
        if (!group) return
        await navigator.clipboard.writeText(group.invite_code)
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2000)
    }

    function getRankEmoji(rank: number) {
        return rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`
    }
    function getColor(pct: number) {
        return pct >= 100 ? '#4ade80' : pct >= 60 ? '#86efac' : pct > 0 ? '#fbbf24' : '#e5e7eb'
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 font-bold">Loading group...</p>
        </div>
    )
    if (!group) return null

    const memberIds = [...new Set(memberHabits.map(h => h.user_id))]
    const isAdmin = group.my_role === 'admin'

    return (
        <div className="space-y-4">

            {/* Group header */}
            <div className="card">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-black text-2xl flex-shrink-0 shadow-md">
                        {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-black text-xl truncate">{group.name}</h1>
                        {group.description && <p className="text-sm font-semibold text-gray-400 mt-0.5">{group.description}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-bold text-gray-400">👥 {leaderboard.length} members</span>
                            {isAdmin && <span className="text-xs font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">Admin</span>}
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                🎯 {groupHabits.length} challenge{groupHabits.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-2xl p-3">
                    <span className="text-xs font-bold text-gray-400 flex-shrink-0">Invite:</span>
                    <span className="font-black text-gray-700 tracking-widest flex-1">{group.invite_code}</span>
                    <button onClick={copyCode} className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
                        {copiedCode ? '✓ Copied!' : '📋 Copy'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-white rounded-2xl p-1 border-2 border-gray-100">
                {([
                    { key: 'leaderboard', label: '🏆 Board' },
                    { key: 'habits', label: '⚡ Members' },
                    { key: 'challenges', label: '🎯 Challenges' },
                    { key: 'settings', label: '⚙️ Settings' },
                ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`py-2 rounded-xl font-bold text-xs transition-all
              ${activeTab === tab.key
                                ? 'bg-green-500 text-white shadow-[0_2px_0_#16a34a]'
                                : 'text-gray-500 hover:bg-gray-50'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── LEADERBOARD TAB ── */}
            {activeTab === 'leaderboard' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <p className="font-bold text-sm text-gray-500">
                            Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                        <button onClick={loadData} className="text-xs font-bold text-green-500 hover:text-green-600">↻ Refresh</button>
                    </div>

                    {groupHabits.length === 0 ? (
                        <div className="card text-center py-8">
                            <div className="text-4xl mb-3">🎯</div>
                            <p className="font-black text-gray-600 mb-1">No challenge habits yet</p>
                            <p className="font-semibold text-gray-400 text-sm">
                                {isAdmin ? 'Go to Challenges tab to add shared habits' : 'Waiting for admin to add challenges'}
                            </p>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="card text-center py-8">
                            <p className="font-bold text-gray-400">No data yet — complete some habits!</p>
                        </div>
                    ) : (
                        leaderboard.map((entry, idx) => (
                            <div key={entry.user_id}
                                className={`card transition-all ${entry.is_you ? 'border-green-300 bg-green-50/30' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl font-black w-10 text-center flex-shrink-0">{getRankEmoji(idx)}</div>
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                                        style={{ backgroundColor: `hsl(${(entry.username.charCodeAt(0) * 37) % 360}, 65%, 55%)` }}>
                                        {entry.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-gray-800 truncate">{entry.username}</span>
                                            {entry.is_you && (
                                                <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 flex-shrink-0">You</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-semibold text-gray-400">{entry.completed_today}/{entry.total_habits} habits</span>
                                            {entry.best_streak > 0 && <span className="text-xs font-bold text-orange-500">{entry.best_streak}🔥</span>}
                                        </div>
                                        <div className="mt-2 w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${entry.completion_pct}%`, backgroundColor: getColor(Number(entry.completion_pct)) }} />
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="font-black text-2xl" style={{ color: getColor(Number(entry.completion_pct)) }}>
                                            {entry.completion_pct}%
                                        </div>
                                        <div className="text-xs font-bold text-gray-400">today</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    <div className="flex items-center gap-4 justify-center pt-1">
                        {[{ c: '#4ade80', l: '100%' }, { c: '#86efac', l: '60%+' }, { c: '#fbbf24', l: '<60%' }].map(i => (
                            <div key={i.l} className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i.c }} />
                                <span className="text-xs font-semibold text-gray-400">{i.l}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── MEMBERS HABITS TAB ── */}
            {activeTab === 'habits' && (
                <div className="space-y-4">
                    <p className="text-sm font-bold text-gray-400 px-1">
                        All members' habits today — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    {memberIds.length === 0 ? (
                        <div className="card text-center py-8"><p className="font-bold text-gray-400">No habits yet</p></div>
                    ) : memberIds.map(uid => {
                        const userHabits = memberHabits.filter(h => h.user_id === uid)
                        const username = userHabits[0]?.username ?? 'Unknown'
                        const completedCount = userHabits.filter(h => h.completed).length
                        const pct = userHabits.length > 0 ? Math.round((completedCount / userHabits.length) * 100) : 0
                        const isYou = leaderboard.find(l => l.user_id === uid)?.is_you
                        return (
                            <div key={uid} className={`card ${isYou ? 'border-green-300 bg-green-50/20' : ''}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black"
                                        style={{ backgroundColor: `hsl(${(username.charCodeAt(0) * 37) % 360}, 65%, 55%)` }}>
                                        {username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-gray-800">{username}</span>
                                            {isYou && <span className="text-xs font-bold text-green-500">You</span>}
                                        </div>
                                        <span className="text-xs font-semibold text-gray-400">{completedCount}/{userHabits.length} · {pct}%</span>
                                    </div>
                                    <div className="font-black text-lg">{pct >= 100 ? '🎉' : pct >= 60 ? '🔥' : pct > 0 ? '⚡' : '😴'}</div>
                                </div>
                                <div className="space-y-2">
                                    {userHabits.map((h, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border transition-all"
                                            style={{
                                                borderColor: h.completed ? h.habit_color : '#e5e7eb',
                                                backgroundColor: h.completed ? `${h.habit_color}15` : '#f9fafb',
                                            }}>
                                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                                                style={{ backgroundColor: h.habit_color }}>
                                                {h.habit_icon}
                                            </div>
                                            <span className={`flex-1 font-bold text-sm ${h.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                                {h.habit_name}
                                            </span>
                                            {h.is_group_habit && (
                                                <span className="text-xs font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-lg border border-purple-200 flex-shrink-0">👥</span>
                                            )}
                                            {h.completed
                                                ? <span className="text-green-500 font-black text-sm flex-shrink-0">✓</span>
                                                : <span className="text-gray-300 font-bold text-sm flex-shrink-0">···</span>
                                            }
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── CHALLENGES TAB ── */}
            {activeTab === 'challenges' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-black text-lg">Challenge Habits 🎯</h2>
                            <p className="text-sm font-semibold text-gray-400 mt-0.5">
                                {isAdmin
                                    ? 'Create habits that all members track together'
                                    : 'Shared habits set by the group admin'}
                            </p>
                        </div>
                        {/* Only admin sees Add button */}
                        {isAdmin && (
                            <button
                                onClick={() => { setShowAddHabit(!showAddHabit); setShowEmojiPicker(false); setHabitError('') }}
                                className="btn-primary text-sm py-2 px-4">
                                {showAddHabit ? '✕ Cancel' : '+ Add'}
                            </button>
                        )}
                    </div>

                    {/* Add habit form — ADMIN ONLY */}
                    {showAddHabit && isAdmin && (
                        <div className="card border-green-200 bg-green-50/30">
                            <h3 className="font-black text-base mb-1">Create challenge for all {leaderboard.length} members</h3>
                            <p className="text-xs font-semibold text-gray-400 mb-4">
                                This habit will automatically appear on everyone's Home dashboard
                            </p>
                            <div className="space-y-4">

                                {/* Emoji picker + Name */}
                                <div className="flex gap-2 items-start">
                                    <div className="relative flex-shrink-0">
                                        <button
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="w-14 h-14 bg-white border-2 border-gray-200 rounded-2xl flex items-center justify-center text-2xl hover:border-green-400 transition">
                                            {habitIcon}
                                        </button>
                                        {showEmojiPicker && (
                                            <div className="absolute top-16 left-0 z-50 bg-white border-2 border-gray-200 rounded-2xl p-3 shadow-xl w-56">
                                                <p className="text-xs font-bold text-gray-400 mb-2">Pick emoji icon</p>
                                                <div className="grid grid-cols-8 gap-1">
                                                    {EMOJI_OPTIONS.map(e => (
                                                        <button key={e}
                                                            onClick={() => { setHabitIcon(e); setShowEmojiPicker(false) }}
                                                            className={`w-7 h-7 rounded-lg text-base flex items-center justify-center hover:bg-green-100 transition
                                ${habitIcon === e ? 'bg-green-100 ring-2 ring-green-400' : ''}`}>
                                                            {e}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        value={habitName}
                                        onChange={e => setHabitName(e.target.value)}
                                        placeholder="Challenge name (e.g. Morning Run)"
                                        className="flex-1 input-field h-14"
                                        onKeyDown={e => e.key === 'Enter' && !savingHabit && habitName.trim() && addGroupHabit()}
                                    />
                                </div>

                                {/* Color picker */}
                                <div>
                                    <p className="text-xs font-bold text-gray-500 mb-2">Pick a color</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {COLOR_OPTIONS.map(c => (
                                            <button key={c} onClick={() => setHabitColor(c)}
                                                className={`w-8 h-8 rounded-xl transition-all ${habitColor === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`}
                                                style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                </div>

                                {/* Tracking type */}
                                <div>
                                    <p className="text-xs font-bold text-gray-500 mb-2">Tracking type</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {HABIT_TYPES.map(t => (
                                            <button key={t.value} onClick={() => setHabitType(t.value)}
                                                className={`p-2.5 rounded-xl border-2 text-left transition-all
                          ${habitType === t.value
                                                        ? 'border-green-400 bg-green-50'
                                                        : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                                <span className="font-bold text-sm text-gray-700">{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Target fields for numeric/timer */}
                                {(habitType === 'numeric' || habitType === 'timer') && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <input value={habitTarget} onChange={e => setHabitTarget(e.target.value)}
                                            placeholder="Target (e.g. 30)" type="number" className="input-field" />
                                        <input value={habitUnit} onChange={e => setHabitUnit(e.target.value)}
                                            placeholder="Unit (e.g. minutes)" className="input-field" />
                                    </div>
                                )}

                                {/* Live preview */}
                                <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border-2 border-gray-100">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                        style={{ backgroundColor: habitColor }}>
                                        {habitIcon}
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-700">{habitName || 'Habit name preview'}</span>
                                        <div className="text-xs text-gray-400 font-semibold mt-0.5">
                                            👥 Will appear on all {leaderboard.length} members' Home dashboards
                                        </div>
                                    </div>
                                </div>

                                {habitError && (
                                    <div className="p-3 bg-red-50 border-2 border-red-200 rounded-2xl">
                                        <p className="text-red-500 font-bold text-sm">⚠️ {habitError}</p>
                                    </div>
                                )}

                                <button
                                    onClick={addGroupHabit}
                                    disabled={savingHabit || !habitName.trim()}
                                    className="btn-primary w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                                    {savingHabit
                                        ? `Adding to ${leaderboard.length} members...`
                                        : `🎯 Add challenge to all ${leaderboard.length} members`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* List of group challenge habits */}
                    {groupHabits.length === 0 ? (
                        <div className="card text-center py-10 border-dashed">
                            <div className="text-5xl mb-3">🎯</div>
                            <h3 className="font-black text-lg mb-2">No challenge habits yet</h3>
                            <p className="text-gray-400 font-semibold text-sm mb-4">
                                {isAdmin
                                    ? 'Create a challenge habit that all members track and compete on'
                                    : 'Waiting for the group admin to add challenge habits'}
                            </p>
                            {isAdmin && (
                                <button onClick={() => setShowAddHabit(true)} className="btn-primary">
                                    + Create first challenge
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-400 px-1">
                                ✅ These habits appear on every member's Home dashboard automatically
                            </p>
                            {groupHabits.map(habit => (
                                <div key={habit.id}
                                    className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
                                        style={{ backgroundColor: habit.color }}>
                                        {habit.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-gray-800">{habit.name}</span>
                                            <span className="text-xs font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-lg border border-purple-200">
                                                👥 Group
                                            </span>
                                        </div>
                                        <div className="text-xs font-semibold text-gray-400 mt-0.5">
                                            {HABIT_TYPES.find(t => t.value === habit.habit_type)?.label}
                                            {habit.target_value ? ` · ${habit.target_value} ${habit.unit}` : ''}
                                        </div>
                                    </div>
                                    {/* Only admin can remove */}
                                    {isAdmin && (
                                        <button
                                            onClick={() => removeGroupHabit(habit.name)}
                                            className="btn-danger text-xs py-1.5 px-3 flex-shrink-0">
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Non-admin info message */}
                    {!isAdmin && groupHabits.length > 0 && (
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 flex items-center gap-3">
                            <span className="text-xl">💡</span>
                            <p className="text-sm font-semibold text-blue-700">
                                Complete these challenges from your <strong>Home</strong> dashboard to climb the leaderboard!
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab === 'settings' && (
                <div className="space-y-4">
                    <div className="card">
                        <h3 className="font-black text-base mb-3">Invite friends</h3>
                        <p className="text-sm font-semibold text-gray-500 mb-3">
                            Share this code with anyone you want in the group:
                        </p>
                        <div className="flex items-center justify-center p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl mb-3">
                            <span className="font-black text-3xl tracking-widest text-gray-800">{group.invite_code}</span>
                        </div>
                        <button onClick={copyCode} className="btn-primary w-full">
                            {copiedCode ? '✓ Copied to clipboard!' : '📋 Copy invite code'}
                        </button>
                    </div>

                    <div className="card">
                        <h3 className="font-black text-base mb-3">Members ({leaderboard.length})</h3>
                        <div className="space-y-2">
                            {leaderboard.map(entry => (
                                <div key={entry.user_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black"
                                        style={{ backgroundColor: `hsl(${(entry.username.charCodeAt(0) * 37) % 360}, 65%, 55%)` }}>
                                        {entry.username.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="flex-1 font-bold text-gray-700">{entry.username}</span>
                                    {entry.is_you && (
                                        <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-xl border border-green-200">You</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card border-red-200 bg-red-50/20">
                        <h3 className="font-black text-base text-red-600 mb-3">Danger zone</h3>
                        <div className="space-y-3">
                            <button onClick={leaveGroup}
                                className="w-full btn-secondary border-red-200 text-red-500 hover:bg-red-50 py-3">
                                Leave this group
                            </button>
                            {isAdmin && (
                                <button onClick={deleteGroup} className="w-full btn-danger py-3">
                                    Delete group (admin only)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
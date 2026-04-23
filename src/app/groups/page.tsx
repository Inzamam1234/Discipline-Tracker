'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

type GroupCard = {
  id: string
  name: string
  description: string | null
  invite_code: string
  created_by: string
  member_count: number
  my_role: string
  my_streak: number
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { loadGroups() }, [])

  async function loadGroups() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', user.id)

    if (!memberships?.length) { setLoading(false); return }

    const groupIds = memberships.map(m => m.group_id)

    const { data: groupsData } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .eq('is_active', true)

    if (!groupsData) { setLoading(false); return }

    // Get member counts
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', groupIds)

    // Get my best streak
    const { data: myStreaks } = await supabase
      .from('streaks')
      .select('current_streak')
      .eq('user_id', user.id)
      .order('current_streak', { ascending: false })
      .limit(1)

    const myBestStreak = myStreaks?.[0]?.current_streak ?? 0

    const cards: GroupCard[] = groupsData.map(g => ({
      ...g,
      member_count: allMembers?.filter(m => m.group_id === g.id).length ?? 0,
      my_role: memberships.find(m => m.group_id === g.id)?.role ?? 'member',
      my_streak: myBestStreak,
    }))

    setGroups(cards)
    setLoading(false)
  }

  async function createGroup() {
    if (!groupName.trim()) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const code = Array.from({ length: 6 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('')

    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .insert({
        name: groupName.trim(),
        description: groupDesc.trim() || null,
        invite_code: code,
        created_by: user.id,
      })
      .select()
      .single()

    if (groupErr || !group) {
      console.error('Group creation error:', groupErr)
      setError(`Error: ${groupErr?.message ?? 'Unknown error'}`)
      setSaving(false)
      return
    }

    const { error: memberErr } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
        role: 'admin',
      })

    if (memberErr) {
      console.error('Member insert error:', memberErr)
      setError(`Created group but failed to join: ${memberErr.message}`)
      setSaving(false)
      return
    }

    setGroupName(''); setGroupDesc('')
    setShowCreate(false); setSaving(false)
    loadGroups()
  }

  async function joinGroup() {
    if (!inviteCode.trim()) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: group } = await supabase
      .from('groups')
      .select('id, name')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .eq('is_active', true)
      .single()

    if (!group) { setError('Invalid invite code. Check and try again.'); setSaving(false); return }

    // Check not already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .single()

    if (existing) { setError("You're already in this group!"); setSaving(false); return }

    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      role: 'member',
    })

    setInviteCode(''); setShowJoin(false); setSaving(false)
    loadGroups()
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 font-bold">Loading groups...</p>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-black text-2xl">Challenge Groups 👥</h1>
          <p className="text-gray-400 font-semibold text-sm mt-1">
            Compete with friends, stay accountable
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowJoin(!showJoin); setShowCreate(false); setError('') }}
            className="btn-secondary text-sm py-2.5 px-4">
            Join
          </button>
          <button onClick={() => { setShowCreate(!showCreate); setShowJoin(false); setError('') }}
            className="btn-primary text-sm py-2.5 px-4">
            + Create
          </button>
        </div>
      </div>

      {/* Create group form */}
      {showCreate && (
        <div className="card border-green-200 bg-green-50/40">
          <h2 className="font-black text-lg mb-4">Create a challenge group</h2>
          <div className="space-y-3">
            <input value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Morning Warriors)"
              className="input-field" />
            <textarea value={groupDesc} onChange={e => setGroupDesc(e.target.value)}
              placeholder="Description (optional) — what's the challenge?"
              rows={2}
              className="w-full bg-white border-2 border-gray-200 focus:border-green-400 rounded-2xl px-4 py-3 font-semibold outline-none transition-all text-sm placeholder:text-gray-400 placeholder:font-normal resize-none" />
            {error && <p className="text-red-500 font-bold text-sm">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1 py-2.5">
                Cancel
              </button>
              <button onClick={createGroup} disabled={saving || !groupName.trim()}
                className="btn-primary flex-1 py-2.5 disabled:opacity-40">
                {saving ? 'Creating...' : 'Create Group 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join group form */}
      {showJoin && (
        <div className="card border-blue-200 bg-blue-50/40">
          <h2 className="font-black text-lg mb-4">Join a group</h2>
          <div className="space-y-3">
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-character invite code (e.g. ABC123)"
              className="input-field tracking-widest text-center text-xl font-black uppercase"
              maxLength={6} />
            {error && <p className="text-red-500 font-bold text-sm">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowJoin(false)} className="btn-secondary flex-1 py-2.5">
                Cancel
              </button>
              <button onClick={joinGroup} disabled={saving || inviteCode.length < 6}
                className="btn-primary flex-1 py-2.5 disabled:opacity-40">
                {saving ? 'Joining...' : 'Join Group →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className="card text-center py-14">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="font-black text-xl mb-2">No groups yet</h3>
          <p className="text-gray-400 font-semibold mb-6">
            Create a group or join one with an invite code
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              + Create group
            </button>
            <button onClick={() => setShowJoin(true)} className="btn-secondary">
              Join with code
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <div key={group.id} className="card hover:border-green-300 transition-all duration-200">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/groups/${group.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-black text-xl flex-shrink-0">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-lg text-gray-800 truncate">{group.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">
                          👥 {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                        </span>
                        {group.my_role === 'admin' && (
                          <span className="text-xs font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {group.description && (
                    <p className="text-sm font-semibold text-gray-500 mb-3 line-clamp-2">
                      {group.description}
                    </p>
                  )}
                </Link>
              </div>

              {/* Invite code + open button */}
              <div className="flex items-center gap-2 mt-2 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex-1">
                  <span className="text-xs font-bold text-gray-400">Code:</span>
                  <span className="font-black text-gray-700 tracking-widest">{group.invite_code}</span>
                </div>
                <button onClick={() => copyCode(group.invite_code)}
                  className="btn-secondary text-xs py-2 px-3">
                  {copiedCode === group.invite_code ? '✓ Copied!' : '📋 Copy'}
                </button>
                <Link href={`/groups/${group.id}`} className="btn-primary text-xs py-2 px-4">
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
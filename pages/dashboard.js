import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { supabase } from '../lib/supabase'
import { IconGlobe, IconLock, IconClipboard, IconAlertTriangle, IconSearch, IconStar } from '../components/Icons'

function VisibilityBadge({ isPublic }) {
  if (isPublic !== false) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
        <IconGlobe size={10} />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      <IconLock size={10} />
    </span>
  )
}

const PRIORITY_DOT = {
  low: 'bg-gray-400',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

function InstructionsPreview({ userId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const { data } = await supabase
        .from('instructions')
        .select('id, title, priority, due_date, is_complete, assigned_to_profile:profiles!instructions_assigned_to_fkey(full_name)')
        .eq('is_complete', false)
        .or(`assigned_to.eq.${userId},assigned_to.is.null`)
        .order('created_at', { ascending: false })
        .limit(5)
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [userId])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><IconClipboard size={13} /> Instructions & To-Do</h2>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">{items.length} pending task{items.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <Link href="/instructions">
          <span className="text-xs font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors cursor-pointer">
            View All →
          </span>
        </Link>
      </div>
      <div className="divide-y divide-gray-50">
        {loading && <div className="px-4 py-4 text-xs text-gray-400">Loading...</div>}
        {!loading && items.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-400">No pending tasks.</p>
            <Link href="/instructions">
              <span className="text-xs text-blue-600 hover:underline cursor-pointer mt-1 block">View board</span>
            </Link>
          </div>
        )}
        {items.map(item => {
          const isOverdue = item.due_date && new Date(item.due_date) < new Date()
          return (
            <Link key={item.id} href="/instructions">
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[item.priority] || PRIORITY_DOT.normal}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.assigned_to_profile ? (
                      <span className="text-xs text-gray-400">→ {item.assigned_to_profile.full_name}</span>
                    ) : (
                      <span className="text-xs text-gray-400">→ All Associates</span>
                    )}
                    {item.due_date && (
                      <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {isOverdue && <IconAlertTriangle size={10} className="inline mr-0.5" />}Due {new Date(item.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      {items.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50">
          <Link href="/instructions">
            <span className="text-xs text-blue-700 hover:underline cursor-pointer font-medium">Open full board →</span>
          </Link>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [cases, setCases] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [search, setSearch] = useState('')
  const [togglingStarId, setTogglingStarId] = useState(null)
  const [myCaseIds, setMyCaseIds] = useState(new Set())

  useEffect(() => {
    async function load() {
      const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user
      if (!user) { router.push('/'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .single()

      if (prof?.role === 'partner') { router.push('/admin'); return }
      setProfile(prof)
      setUserId(user.id)

      const [casesRes, myCasesRes] = await Promise.all([
        supabase.from('cases').select('id, client_name, case_type, status, file_number, court_case_number, is_starred, is_public, assigned_to, updated_at').order('updated_at', { ascending: false }),
        supabase.from('user_cases').select('case_id').eq('user_id', user.id),
      ])

      setCases(casesRes.data || [])
      const myIds = new Set((myCasesRes.data || []).map(r => r.case_id))
      // Also include cases assigned to this user
      const allCases = casesRes.data || []
      const myCasesList = allCases.filter(c => myIds.has(c.id) || c.assigned_to === user.id)
      setMyCaseIds(myIds)
      setLoading(false)
    }
    load()
  }, [])

  async function toggleStar(e, caseId, currentVal) {
    e.preventDefault()
    e.stopPropagation()
    if (togglingStarId) return
    setTogglingStarId(caseId)
    const { data } = await supabase
      .from('cases')
      .update({ is_starred: !currentVal })
      .eq('id', caseId)
      .select()
      .single()
    if (data) {
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, is_starred: data.is_starred } : c))
    }
    setTogglingStarId(null)
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading your cases...</div>
      </div>
    </Layout>
  )

  const myCases = cases.filter(c => myCaseIds.has(c.id) || c.assigned_to === userId)
  const openCases = myCases.filter(c => c.status === 'open')
  const pendingCases = myCases.filter(c => c.status === 'pending')
  const starredCases = cases.filter(c => c.is_starred)
  const recentCases = cases.slice(0, 8)

  const q = search.trim().toLowerCase()
  const searchResults = q
    ? cases.filter(c =>
        (c.client_name || '').toLowerCase().includes(q) ||
        (c.case_type || '').toLowerCase().includes(q) ||
        (c.court_case_number || '').toLowerCase().includes(q) ||
        (c.file_number || '').toLowerCase().includes(q)
      )
    : []

  const stats = [
    { label: 'My Cases', value: myCases.length, color: 'bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200', href: '/cases?assigned=me' },
    { label: 'Open', value: openCases.length, color: 'bg-green-50 text-green-800 hover:bg-green-100 border-green-200', href: '/cases?assigned=me&status=open' },
    { label: 'Pending', value: pendingCases.length, color: 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200', href: '/cases?assigned=me' },
    { label: 'All Cases', value: cases.length, color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300', href: '/cases' },
  ]

  function CaseCard({ c }) {
    return (
      <Link key={c.id} href={`/cases/${c.id}`}>
        <div className="bg-white border border-gray-200 hover:border-blue-400 hover:shadow-sm rounded-xl p-4 cursor-pointer transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.client_name}</p>
                <StatusBadge status={c.status} />
                <VisibilityBadge isPublic={c.is_public} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.case_type}
                {c.court_case_number && <span className="text-gray-400"> · {c.court_case_number}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={e => toggleStar(e, c.id, c.is_starred)}
                disabled={togglingStarId === c.id}
                title={c.is_starred ? 'Remove star' : 'Star this case'}
                className={`p-1.5 rounded-lg transition-all ${
                  c.is_starred
                    ? 'text-yellow-500 hover:text-yellow-600'
                    : 'text-gray-300 hover:text-yellow-400'
                }`}
              >
                <IconStar size={13} filled={c.is_starred} />
              </button>
              <p className="text-xs text-gray-400">
                {new Date(c.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{profile?.full_name} · Associate</p>
        </div>
        <Link href="/cases/new">
          <button className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> Open New Case
          </button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <IconSearch size={15} className="text-gray-400" />
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search cases by client, type, court number, or file number…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search Results */}
      {q && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">
              Search Results <span className="text-gray-400 font-normal text-sm">({searchResults.length} found)</span>
            </h2>
          </div>
          {searchResults.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
              No cases match your search.
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map(c => <CaseCard key={c.id} c={c} />)}
            </div>
          )}
        </div>
      )}

      {/* Stats + Main Layout */}
      {!q && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {stats.map(s => (
              <Link key={s.label} href={s.href}>
                <div className={`rounded-xl p-4 border cursor-pointer transition-all ${s.color}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Main layout: Left sidebar + Right (Starred + Recent) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* LEFT SIDEBAR: Instructions */}
            <div className="lg:col-span-1 space-y-5">
              <InstructionsPreview userId={userId} />
            </div>

            {/* RIGHT: Starred Cases + Recent Cases */}
            <div className="lg:col-span-3 space-y-6">

              {/* Starred / Important Cases */}
              {starredCases.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-gray-800 flex items-center gap-1.5">
                      <IconStar size={14} filled className="text-yellow-500" /> Starred Cases
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {starredCases.map(c => <CaseCard key={c.id} c={c} />)}
                  </div>
                </div>
              )}

              {/* Recent Cases */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-800">Recent Cases</h2>
                  <Link href="/cases">
                    <span className="text-xs font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors cursor-pointer">
                      View All →
                    </span>
                  </Link>
                </div>
                {recentCases.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                    <p className="text-gray-400 text-sm">No cases yet. Open your first case to get started.</p>
                    <Link href="/cases/new">
                      <span className="text-blue-600 text-sm hover:underline cursor-pointer mt-2 block">+ Open New Case</span>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentCases.map(c => <CaseCard key={c.id} c={c} />)}
                  </div>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

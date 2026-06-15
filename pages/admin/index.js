import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { IconGlobe, IconLock, IconClipboard, IconAlertTriangle, IconSearch, IconStar } from '../../components/Icons'

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
  low: 'bg-gray-300',
  normal: 'bg-gray-500',
  high: 'bg-gray-700',
  urgent: 'bg-gray-900',
}

function InstructionsPreview() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('instructions')
        .select('id, title, priority, due_date, is_complete, assigned_to_profile:profiles!instructions_assigned_to_fkey(full_name)')
        .eq('is_complete', false)
        .order('created_at', { ascending: false })
        .limit(5)
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><IconClipboard size={13} /> Instructions & To-Do</h2>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">{items.length} pending task{items.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <Link href="/instructions">
          <span className="text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors cursor-pointer">
            View All →
          </span>
        </Link>
      </div>

      {/* Preview list */}
      <div className="divide-y divide-gray-50">
        {loading && (
          <div className="px-4 py-4 text-xs text-gray-400">Loading...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-400">No pending tasks.</p>
            <Link href="/instructions">
              <span className="text-xs text-gray-600 hover:underline cursor-pointer mt-1 block">+ Add a task</span>
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

      {/* Footer CTA */}
      {items.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50">
          <Link href="/instructions">
            <span className="text-xs text-gray-700 hover:underline cursor-pointer font-medium">
              Open full board →
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const { profile, authLoading } = useAuth({ requiredRole: 'partner' })
  const [associates, setAssociates] = useState([])
  const [cases, setCases] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [togglingStarId, setTogglingStarId] = useState(null)

  useEffect(() => {
    if (!profile) return
    async function loadData() {
      const [assocRes, casesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role').eq('role', 'associate'),
        supabase.from('cases').select('id, client_name, case_type, status, file_number, court_case_number, is_starred, is_public, assigned_to, updated_at, profiles!cases_assigned_to_fkey(full_name)').order('updated_at', { ascending: false }),
      ])
      setAssociates(assocRes.data || [])
      setCases(casesRes.data || [])
      setDataLoading(false)
    }
    loadData()
  }, [profile])

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

  const loading = authLoading || dataLoading

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading dashboard...</div>
      </div>
    </Layout>
  )

  const openCases = cases.filter(c => c.status === 'open')
  const pendingCases = cases.filter(c => c.status === 'pending')
  const closedCases = cases.filter(c => c.status === 'closed')
  const starredCases = cases.filter(c => c.is_starred)

  // Search filter
  const q = search.trim().toLowerCase()
  const searchResults = q
    ? cases.filter(c =>
        (c.client_name || '').toLowerCase().includes(q) ||
        (c.case_type || '').toLowerCase().includes(q) ||
        (c.court_case_number || '').toLowerCase().includes(q) ||
        (c.file_number || '').toLowerCase().includes(q) ||
        (c.profiles?.full_name || '').toLowerCase().includes(q)
      )
    : []

  const recentCases = cases.slice(0, 8)

  const associateStats = associates.map(a => ({
    ...a,
    total: cases.filter(c => c.assigned_to === a.id).length,
    open: cases.filter(c => c.assigned_to === a.id && c.status === 'open').length,
  }))

  const stats = [
    { label: 'Total Cases', value: cases.length, color: 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200', href: '/admin/all-cases' },
    { label: 'Open', value: openCases.length, color: 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200', href: '/admin/all-cases?status=open' },
    { label: 'Pending', value: pendingCases.length, color: 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200', href: '/admin/all-cases?status=pending' },
    { label: 'Closed', value: closedCases.length, color: 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200', href: '/admin/all-cases?status=closed' },
  ]

  function CaseCard({ c }) {
    return (
      <Link key={c.id} href={`/cases/${c.id}`}>
        <div className="bg-white border border-gray-200 hover:border-gray-400 hover:shadow-sm rounded-xl p-4 cursor-pointer transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.client_name}</p>
                <StatusBadge status={c.status} />
                <VisibilityBadge isPublic={c.is_public} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.case_type}
                {c.profiles?.full_name && <span className="text-gray-400"> · {c.profiles.full_name}</span>}
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
          <h1 className="text-2xl font-bold text-gray-900">Partner Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">{profile?.full_name} · Partner</p>
        </div>
        <Link href="/cases/new">
          <button className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
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
          placeholder="Search cases by client, type, court number, file number, or associate…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent shadow-sm"
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

      {/* Clickable Stats — 4 cards */}
      {!q && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {stats.map(s => (
              <Link key={s.label} href={s.href}>
                <div className={`rounded-xl p-4 border cursor-pointer transition-all ${s.color}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                  <p className="text-xs mt-1 opacity-60">Click to view →</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Main layout: Left sidebar + Right (Starred + Recent Cases) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* LEFT SIDEBAR: Associates + Instructions */}
            <div className="lg:col-span-1 space-y-5">

              {/* Associates Widget */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-800">Associates</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{associates.length} team member{associates.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {associateStats.length === 0 && (
                    <p className="text-xs text-gray-400 px-4 py-4">No associates yet.</p>
                  )}
                  {associateStats.map(a => (
                    <Link key={a.id} href={`/admin/associate/${a.id}`}>
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#1f2937' }}>
                          {a.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.full_name}</p>
                          <p className="text-xs text-gray-400">{a.total} cases · {a.open} open</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Instructions Preview Widget */}
              <InstructionsPreview />

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
                  <Link href="/admin/all-cases">
                    <span className="text-sm text-gray-600 hover:underline cursor-pointer">View all →</span>
                  </Link>
                </div>
                <div className="space-y-2">
                  {recentCases.map(c => <CaseCard key={c.id} c={c} />)}
                </div>
              </div>

            </div>

          </div>
        </>
      )}
    </Layout>
  )
}

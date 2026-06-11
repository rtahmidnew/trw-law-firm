import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'
import { IconGlobe, IconLock, IconFolder, IconSearch, IconStar } from '../../components/Icons'

function VisibilityBadge({ isPublic }) {
  if (isPublic !== false) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
        <IconGlobe size={10} /> Public
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      <IconLock size={10} /> Private
    </span>
  )
}

export default function AllCasesPage() {
  const router = useRouter()
  const [cases, setCases] = useState([])
  const [profile, setProfile] = useState(null)
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('all') // 'all' or 'mine'
  const [search, setSearch] = useState('')
  const [myCaseIds, setMyCaseIds] = useState(new Set())

  // Read query params on mount
  useEffect(() => {
    if (router.isReady) {
      const s = router.query.status
      if (s === 'open' || s === 'closed') {
        setFilter(s)
      } else {
        setFilter('all')
      }
      if (router.query.assigned === 'me') {
        setViewMode('mine')
      }
    }
  }, [router.isReady, router.query.status, router.query.assigned])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .single()

      setProfile(prof)
      setUserId(user.id)

      // Partners see all cases; associates only see public cases (enforced by RLS)
      const [casesRes, myCasesRes] = await Promise.all([
        supabase.from('cases').select('id, client_name, case_type, status, file_number, court_case_number, is_starred, is_public, assigned_to, updated_at, profiles!cases_assigned_to_fkey(full_name)').order('updated_at', { ascending: false }),
        supabase.from('user_cases').select('case_id').eq('user_id', user.id),
      ])

      setCases(casesRes.data || [])
      setMyCaseIds(new Set((myCasesRes.data || []).map(r => r.case_id)))
      setLoading(false)
    }
    load()
  }, [])

  const isPartner = profile?.role === 'partner'

  const filtered = cases.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter
    const matchMine = viewMode === 'all' || myCaseIds.has(c.id) || c.assigned_to === userId
    const q = search.toLowerCase().trim()
    const matchSearch = !q ||
      (c.client_name || '').toLowerCase().includes(q) ||
      (c.case_type || '').toLowerCase().includes(q) ||
      (c.court_case_number || '').toLowerCase().includes(q) ||
      (c.file_number || '').toLowerCase().includes(q) ||
      (c.profiles?.full_name || '').toLowerCase().includes(q)
    return matchStatus && matchMine && matchSearch
  })

  function handleFilterChange(newFilter) {
    setFilter(newFilter)
    const query = {}
    if (newFilter !== 'all') query.status = newFilter
    if (viewMode === 'mine') query.assigned = 'me'
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }

  function handleViewModeChange(newMode) {
    setViewMode(newMode)
    const query = {}
    if (filter !== 'all') query.status = filter
    if (newMode === 'mine') query.assigned = 'me'
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading cases...</div>
    </Layout>
  )

  const isMine = c => myCaseIds.has(c.id) || c.assigned_to === userId
  const openCount = cases.filter(c => (viewMode === 'mine' ? isMine(c) : true) && c.status === 'open').length
  const closedCount = cases.filter(c => (viewMode === 'mine' ? isMine(c) : true) && c.status === 'closed').length
  const myCasesCount = cases.filter(isMine).length
  const allCount = viewMode === 'mine' ? myCasesCount : cases.length

  const pageTitle = viewMode === 'mine'
    ? (filter === 'open' ? 'My Open Cases' : filter === 'closed' ? 'My Closed Cases' : 'My Cases')
    : (filter === 'open' ? 'Open Cases' : filter === 'closed' ? 'Closed Cases' : 'All Cases')

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-gray-500 text-sm">{filtered.length} of {allCount} cases</p>
        </div>
        <Link href="/cases/new">
          <button className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> Open New Case
          </button>
        </Link>
      </div>

      {/* View Mode Toggle (My Cases / All Cases) */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleViewModeChange('mine')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            viewMode === 'mine'
              ? 'bg-blue-700 text-white border-blue-700'
              : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-700'
          }`}
        >
          My Cases ({myCasesCount})
        </button>
        <button
          onClick={() => handleViewModeChange('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            viewMode === 'all'
              ? 'bg-blue-700 text-white border-blue-700'
              : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-700'
          }`}
        >
          All Cases ({cases.length})
        </button>
      </div>

      {/* Search + Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <IconSearch size={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client, case type, file no., associate..."
            className="w-full pl-9 pr-4 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {[
            { key: 'all', label: `All (${allCount})` },
            { key: 'open', label: `Open (${openCount})` },
            { key: 'closed', label: `Closed (${closedCount})` },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => handleFilterChange(s.key)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === s.key ? 'bg-blue-700 text-white' : 'text-gray-600 hover:text-blue-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="flex justify-center mb-2"><IconFolder size={32} className="text-gray-300" /></div>
          <p>No cases match your filter.</p>
          {(filter !== 'all' || search) && (
            <button
              onClick={() => { setFilter('all'); setSearch('') }}
              className="mt-3 text-blue-700 hover:underline text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Case Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Associate</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Visibility</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/cases/${c.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.is_starred && <IconStar size={12} filled className="text-yellow-500 shrink-0" />}
                      <div>
                        <p className="font-medium text-gray-900">{c.client_name}</p>
                        {c.file_number && <p className="text-xs text-gray-400 font-mono">{c.file_number}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.case_type}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {c.profiles?.full_name || '—'}
                    {c.assigned_to === userId && (
                      <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">You</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <VisibilityBadge isPublic={c.is_public !== false} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                    {new Date(c.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}

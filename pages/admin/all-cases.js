import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'
import { IconGlobe, IconLock, IconFolder } from '../../components/Icons'

function VisibilityBadge({ isPublic }) {
  if (isPublic) {
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

export default function AllCases() {
  const router = useRouter()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [visFilter, setVisFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Read status from URL query param on mount and when query changes
  useEffect(() => {
    if (router.isReady) {
      const s = router.query.status
      if (s === 'open' || s === 'closed') {
        setFilter(s)
      } else {
        setFilter('all')
      }
    }
  }, [router.isReady, router.query.status])

  useEffect(() => {
    async function load() {
      const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('cases')
        .select('*, profiles!cases_assigned_to_fkey(full_name)')
        .order('updated_at', { ascending: false })

      setCases(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = cases.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter
    const matchVis = visFilter === 'all' || (visFilter === 'public' ? c.is_public !== false : c.is_public === false)
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.client_name?.toLowerCase().includes(q) ||
      c.case_type?.toLowerCase().includes(q) ||
      c.court_case_number?.toLowerCase().includes(q) ||
      c.file_number?.toLowerCase().includes(q) ||
      c.profiles?.full_name?.toLowerCase().includes(q)
    return matchStatus && matchVis && matchSearch
  })

  function handleFilterChange(newFilter) {
    setFilter(newFilter)
    // Update URL without full navigation
    const query = newFilter !== 'all' ? { status: newFilter } : {}
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
    </Layout>
  )

  const openCount = cases.filter(c => c.status === 'open').length
  const closedCount = cases.filter(c => c.status === 'closed').length

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {filter === 'open' ? 'Open Cases' : filter === 'closed' ? 'Closed Cases' : 'All Cases'}
          </h1>
          <p className="text-gray-500 text-sm">{filtered.length} of {cases.length} cases</p>
        </div>
        <Link href="/cases/new">
          <button className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> Open New Case
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client, case type, file no., associate..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {[
              { key: 'all', label: `All (${cases.length})` },
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
        {/* Visibility filter */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All Visibility' },
            { key: 'public', label: 'Public' },
            { key: 'private', label: 'Private' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setVisFilter(v.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                visFilter === v.key
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'border-gray-300 text-gray-600 hover:border-blue-400'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="flex justify-center mb-2"><IconFolder size={32} className="text-gray-300" /></div>
          <p>No cases match your filter.</p>
          {filter !== 'all' && (
            <button onClick={() => handleFilterChange('all')} className="mt-3 text-blue-700 hover:underline text-sm">
              Show all cases
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
                    <p className="font-medium text-gray-900">{c.client_name}</p>
                    {c.file_number && <p className="text-xs text-gray-400 font-mono">{c.file_number}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.case_type}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{c.profiles?.full_name || '—'}</td>
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

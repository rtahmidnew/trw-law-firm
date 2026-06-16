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

const SORT_OPTIONS = [
  { key: 'updated_desc', label: 'Last Updated' },
  { key: 'file_number_asc', label: 'File Number (Oldest First)' },
  { key: 'file_number_desc', label: 'File Number (Newest First)' },
  { key: 'client_asc', label: 'Client Name (A–Z)' },
  { key: 'client_desc', label: 'Client Name (Z–A)' },
  { key: 'created_desc', label: 'Date Created (Newest)' },
  { key: 'created_asc', label: 'Date Created (Oldest)' },
  { key: 'associate_asc', label: 'Associate Name' },
]

// Parse a file number like "TLS-22-008" or "TRW-25-112" into sortable parts
function parseFileNumber(fn) {
  if (!fn) return { prefix: 'ZZZ', year: 9999, seq: 9999, raw: '' }
  // Normalise: remove spaces, uppercase
  const s = fn.trim().toUpperCase().replace(/\s+/g, '-')
  // Match patterns like PREFIX-YY-SEQ or PREFIX-YYYY-SEQ
  const m = s.match(/^([A-Z]+)-?(\d{2,4})-?(.+)$/)
  if (!m) return { prefix: s, year: 0, seq: 0, raw: s }
  const prefix = m[1]
  const year = parseInt(m[2], 10)
  // seq may itself contain dashes (e.g. "KH-001"), use localeCompare for that part
  const seq = m[3]
  return { prefix, year, seq, raw: s }
}

function compareFileNumbers(a, b) {
  const pa = parseFileNumber(a.file_number)
  const pb = parseFileNumber(b.file_number)
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
  if (pa.year !== pb.year) return pa.year - pb.year
  // Compare seq numerically where possible, fall back to locale
  const na = parseInt(pa.seq, 10)
  const nb = parseInt(pb.seq, 10)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return pa.seq.localeCompare(pb.seq, undefined, { numeric: true })
}

function sortCases(cases, sortKey) {
  const arr = [...cases]
  switch (sortKey) {
    case 'file_number_asc':
      return arr.sort((a, b) => compareFileNumbers(a, b))
    case 'file_number_desc':
      return arr.sort((a, b) => compareFileNumbers(b, a))
    case 'client_asc':
      return arr.sort((a, b) => (a.client_name || '').localeCompare(b.client_name || ''))
    case 'client_desc':
      return arr.sort((a, b) => (b.client_name || '').localeCompare(a.client_name || ''))
    case 'created_desc':
      return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    case 'created_asc':
      return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    case 'associate_asc':
      return arr.sort((a, b) => (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || ''))
    case 'updated_desc':
    default:
      return arr.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  }
}

export default function AllCases() {
  const router = useRouter()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [visFilter, setVisFilter] = useState('all')
  const [fileTypeFilter, setFileTypeFilter] = useState('all') // 'all', 'chamber', 'court'
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('updated_desc')

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
        .select('*, file_type, profiles!cases_assigned_to_fkey(full_name)')
        .order('updated_at', { ascending: false })

      setCases(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = cases.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter
    const matchVis = visFilter === 'all' || (visFilter === 'public' ? c.is_public !== false : c.is_public === false)
    const matchFileType = fileTypeFilter === 'all' || (c.file_type || 'chamber') === fileTypeFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.client_name?.toLowerCase().includes(q) ||
      c.case_type?.toLowerCase().includes(q) ||
      c.court_case_number?.toLowerCase().includes(q) ||
      c.file_number?.toLowerCase().includes(q) ||
      c.profiles?.full_name?.toLowerCase().includes(q)
    return matchStatus && matchVis && matchSearch && matchFileType
  })

  const sorted = sortCases(filtered, sortKey)

  function handleFilterChange(newFilter) {
    setFilter(newFilter)
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
  const chamberCount = cases.filter(c => (c.file_type || 'chamber') === 'chamber').length
  const courtCount = cases.filter(c => c.file_type === 'court').length

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {filter === 'open' ? 'Open Cases' : filter === 'closed' ? 'Closed Cases' : 'All Cases'}
          </h1>
          <p className="text-gray-500 text-sm">{sorted.length} of {cases.length} cases</p>
        </div>
        <Link href="/cases/new">
          <button className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> Open New Case
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Row 1: Search + Status + Sort */}
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
          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap hidden sm:block">Sort by:</label>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Visibility + File Type buttons on same row */}
        <div className="flex gap-2 flex-wrap">
          {/* Visibility */}
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

          {/* Divider */}
          <span className="border-l border-gray-300 mx-1 self-stretch" />

          {/* File Type */}
          {[
            { key: 'all', label: 'All Files' },
            { key: 'chamber', label: `Chamber File (${chamberCount})` },
            { key: 'court', label: `Court File (${courtCount})` },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setFileTypeFilter(v.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                fileTypeFilter === v.key
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
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="flex justify-center mb-2"><IconFolder size={32} className="text-gray-300" /></div>
          <p>No cases match your filter.</p>
          {(filter !== 'all' || visFilter !== 'all' || fileTypeFilter !== 'all' || search) && (
            <button
              onClick={() => { handleFilterChange('all'); setVisFilter('all'); setFileTypeFilter('all'); setSearch('') }}
              className="mt-3 text-blue-700 hover:underline text-sm"
            >
              Clear all filters
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
              {sorted.map(c => {
                const isCourt = c.file_type === 'court'
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/cases/${c.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.client_name}</p>
                      {c.file_number && (
                        <p className={`text-xs font-mono font-semibold ${isCourt ? 'text-gray-900' : 'text-gray-700'}`}>
                          {c.file_number}
                        </p>
                      )}
                      <p className={`text-xs font-medium mt-0.5 ${isCourt ? 'text-gray-600' : 'text-gray-500'}`}>
                        {isCourt ? 'Court File' : 'Chamber File'}
                      </p>
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}

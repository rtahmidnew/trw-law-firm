import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'

export default function AllCases() {
  const router = useRouter()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
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
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.client_name?.toLowerCase().includes(q) ||
      c.case_type?.toLowerCase().includes(q) ||
      c.court_case_number?.toLowerCase().includes(q) ||
      c.file_number?.toLowerCase().includes(q) ||
      c.profiles?.full_name?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
    </Layout>
  )

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Cases</h1>
          <p className="text-gray-500 text-sm">{filtered.length} of {cases.length} cases</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by client, case type, file no., associate..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {['all', 'open', 'pending', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
                filter === s ? 'bg-blue-700 text-white' : 'text-gray-600 hover:text-blue-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">📂</p>
          <p>No cases match your filter.</p>
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

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { supabase } from '../lib/supabase'

function VisibilityBadge({ isPublic }) {
  if (isPublic !== false) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        🌐 Public
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      🔒 Private
    </span>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [cases, setCases] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [visFilter, setVisFilter] = useState('all') // 'all' | 'mine' | 'public'
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Partners shouldn't land here
      if (prof?.role === 'partner') { router.push('/admin'); return }
      setProfile(prof)
      setUserId(user.id)

      // RLS already handles visibility: associates see their own cases + public cases
      const { data: allCases } = await supabase
        .from('cases')
        .select('*')
        .order('updated_at', { ascending: false })

      setCases(allCases || [])
      setLoading(false)
    }
    load()
  }, [])

  const visFiltered = cases.filter(c => {
    if (visFilter === 'mine') return c.assigned_to === userId
    if (visFilter === 'public') return c.is_public !== false && c.assigned_to !== userId
    return true // 'all'
  })

  const filtered = filter === 'all' ? visFiltered : visFiltered.filter(c => c.status === filter)

  const counts = {
    all: visFiltered.length,
    open: visFiltered.filter(c => c.status === 'open').length,
    pending: visFiltered.filter(c => c.status === 'pending').length,
    closed: visFiltered.filter(c => c.status === 'closed').length,
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading your cases...</div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back, {profile?.full_name}</p>
        </div>
        <Link href="/cases/new">
          <button className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> Open New Case
          </button>
        </Link>
      </div>

      {/* Visibility filter tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-4">
        {[
          { key: 'all', label: 'All Cases' },
          { key: 'mine', label: '👤 My Cases' },
          { key: 'public', label: '🌐 Public Cases' },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setVisFilter(v.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              visFilter === v.key
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-gray-600 hover:text-blue-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Cases', key: 'all', color: 'bg-blue-50 text-blue-800' },
          { label: 'Open', key: 'open', color: 'bg-green-50 text-green-800' },
          { label: 'Pending', key: 'pending', color: 'bg-yellow-50 text-yellow-800' },
          { label: 'Closed', key: 'closed', color: 'bg-gray-100 text-gray-600' },
        ].map(s => (
          <div
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`cursor-pointer rounded-xl p-4 ${s.color} ${filter === s.key ? 'ring-2 ring-blue-500' : ''}`}
          >
            <p className="text-2xl font-bold">{counts[s.key]}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cases List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📂</p>
          <p className="font-medium">No cases found</p>
          <p className="text-sm mt-1">
            {filter !== 'all' ? `No ${filter} cases.` : 'Open your first case to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Link key={c.id} href={`/cases/${c.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all p-5 cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 truncate">{c.client_name}</h2>
                      <StatusBadge status={c.status} />
                      <VisibilityBadge isPublic={c.is_public} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1 truncate">
                      {c.case_type}
                      {c.court_case_number && ` · Case No. ${c.court_case_number}`}
                      {c.court_name && ` · ${c.court_name}`}
                    </p>
                    {c.opposing_party && (
                      <p className="text-xs text-gray-400 mt-0.5">vs. {c.opposing_party}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {c.file_number && (
                      <p className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">{c.file_number}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(c.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  )
}

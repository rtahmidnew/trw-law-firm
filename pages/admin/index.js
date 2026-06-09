import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const router = useRouter()
  const [associates, setAssociates] = useState([])
  const [caseCounts, setCaseCounts] = useState({})
  const [recentCases, setRecentCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, open: 0, pending: 0, closed: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (prof?.role !== 'partner') { router.push('/dashboard'); return }

      // Load all associates
      const { data: assocs } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'associate')
        .order('full_name')

      // Load all cases (partners can see all due to RLS)
      const { data: allCases } = await supabase
        .from('cases')
        .select('*, profiles!cases_assigned_to_fkey(full_name)')
        .order('updated_at', { ascending: false })

      // Count cases per associate
      const counts = {}
      allCases?.forEach(c => {
        if (c.assigned_to) {
          counts[c.assigned_to] = counts[c.assigned_to] || { total: 0, open: 0, pending: 0, closed: 0 }
          counts[c.assigned_to].total++
          counts[c.assigned_to][c.status]++
        }
      })

      setAssociates(assocs || [])
      setCaseCounts(counts)
      setRecentCases((allCases || []).slice(0, 10))
      setStats({
        total: allCases?.length || 0,
        open: allCases?.filter(c => c.status === 'open').length || 0,
        pending: allCases?.filter(c => c.status === 'pending').length || 0,
        closed: allCases?.filter(c => c.status === 'closed').length || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading firm overview...</div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partner Overview</h1>
        <p className="text-gray-500 text-sm mt-0.5">TRW Law Firm — Firm-wide case management</p>
      </div>

      {/* Firm-wide Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Cases', value: stats.total, color: 'bg-blue-50 text-blue-800' },
          { label: 'Open', value: stats.open, color: 'bg-green-50 text-green-800' },
          { label: 'Pending', value: stats.pending, color: 'bg-yellow-50 text-yellow-800' },
          { label: 'Closed', value: stats.closed, color: 'bg-gray-100 text-gray-600' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Associates List */}
        <div className="lg:col-span-1">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Associates</h2>
          <div className="space-y-2">
            {associates.length === 0 && (
              <div className="text-gray-400 text-sm py-4 text-center">No associates yet.</div>
            )}
            {associates.map(a => {
              const c = caseCounts[a.id] || { total: 0, open: 0, pending: 0, closed: 0 }
              return (
                <Link key={a.id} href={`/admin/associate/${a.id}`}>
                  <div className="bg-white border border-gray-200 hover:border-blue-400 hover:shadow-sm rounded-xl p-4 cursor-pointer transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-800 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {a.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.full_name}</p>
                        <p className="text-xs text-gray-400">{c.total} cases · {c.open} open</p>
                      </div>
                      <span className="text-gray-300 text-sm">›</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Recent Cases</h2>
            <Link href="/admin/all-cases">
              <span className="text-sm text-blue-700 hover:underline cursor-pointer">View all →</span>
            </Link>
          </div>
          <div className="space-y-2">
            {recentCases.map(c => (
              <Link key={c.id} href={`/cases/${c.id}`}>
                <div className="bg-white border border-gray-200 hover:border-blue-400 hover:shadow-sm rounded-xl p-4 cursor-pointer transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.client_name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.case_type}
                        {c.profiles?.full_name && <span className="text-gray-400"> · {c.profiles.full_name}</span>}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">
                      {new Date(c.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

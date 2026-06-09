import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'

function VisibilityBadge({ isPublic }) {
  if (isPublic !== false) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        🌐
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      🔒
    </span>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [associates, setAssociates] = useState([])
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (prof?.role !== 'partner') { router.push('/dashboard'); return }
      setProfile(prof)

      const [assocRes, casesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'associate'),
        supabase.from('cases').select('*, profiles!cases_assigned_to_fkey(full_name)').order('updated_at', { ascending: false }),
      ])

      setAssociates(assocRes.data || [])
      setCases(casesRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

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
  const recentCases = cases.slice(0, 8)

  // Per-associate stats
  const associateStats = associates.map(a => ({
    ...a,
    total: cases.filter(c => c.assigned_to === a.id).length,
    open: cases.filter(c => c.assigned_to === a.id && c.status === 'open').length,
  }))

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">{profile?.full_name} · Partner</p>
        </div>
        <Link href="/cases/new">
          <button className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> Open New Case
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Cases', value: cases.length, color: 'bg-blue-50 text-blue-800' },
          { label: 'Open', value: openCases.length, color: 'bg-green-50 text-green-800' },
          { label: 'Pending', value: pendingCases.length, color: 'bg-yellow-50 text-yellow-800' },
          { label: 'Closed', value: closedCases.length, color: 'bg-gray-100 text-gray-600' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Associates */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Associates</h2>
          <div className="space-y-2">
            {associateStats.length === 0 && (
              <p className="text-sm text-gray-400">No associates yet.</p>
            )}
            {associateStats.map(a => (
              <Link key={a.id} href={`/admin/associate/${a.id}`}>
                <div className="bg-white border border-gray-200 hover:border-blue-400 rounded-xl p-4 cursor-pointer transition-all">
                  <p className="text-sm font-semibold text-gray-900">{a.full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.total} cases · {a.open} open</p>
                </div>
              </Link>
            ))}
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

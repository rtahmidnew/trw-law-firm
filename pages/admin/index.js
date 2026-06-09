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

const PRIORITY_DOT = {
  low: 'bg-gray-400',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
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
          <h2 className="text-sm font-semibold text-gray-800">📋 Instructions & To-Do</h2>
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

      {/* Preview list */}
      <div className="divide-y divide-gray-50">
        {loading && (
          <div className="px-4 py-4 text-xs text-gray-400">Loading...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-400">No pending tasks.</p>
            <Link href="/instructions">
              <span className="text-xs text-blue-600 hover:underline cursor-pointer mt-1 block">+ Add a task</span>
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
                        {isOverdue ? '⚠ ' : ''}Due {new Date(item.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
            <span className="text-xs text-blue-700 hover:underline cursor-pointer font-medium">
              Open full board →
            </span>
          </Link>
        </div>
      )}
    </div>
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

  const associateStats = associates.map(a => ({
    ...a,
    total: cases.filter(c => c.assigned_to === a.id).length,
    open: cases.filter(c => c.assigned_to === a.id && c.status === 'open').length,
  }))

  const stats = [
    { label: 'Total Cases', value: cases.length, color: 'bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200', href: '/admin/all-cases' },
    { label: 'Open', value: openCases.length, color: 'bg-green-50 text-green-800 hover:bg-green-100 border-green-200', href: '/admin/all-cases?status=open' },
    { label: 'Pending', value: pendingCases.length, color: 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200', href: '/admin/all-cases?status=pending' },
    { label: 'Closed', value: closedCases.length, color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300', href: '/admin/all-cases?status=closed' },
  ]

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

      {/* Clickable Stats — 4 cards */}
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

      {/* Main layout: Left sidebar (Instructions + Associates) + Right (Recent Cases) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* LEFT SIDEBAR: Instructions Preview + Associates */}
        <div className="lg:col-span-1 space-y-5">

          {/* Instructions Preview Widget */}
          <InstructionsPreview />

          {/* Associates Widget */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">👥 Associates</h2>
              <p className="text-xs text-gray-400 mt-0.5">{associates.length} team member{associates.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {associateStats.length === 0 && (
                <p className="text-xs text-gray-400 px-4 py-4">No associates yet.</p>
              )}
              {associateStats.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: 'rgb(0, 200, 150)' }}>
                    {a.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.full_name}</p>
                    <p className="text-xs text-gray-400">{a.total} cases · {a.open} open</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT: Recent Cases */}
        <div className="lg:col-span-3">
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

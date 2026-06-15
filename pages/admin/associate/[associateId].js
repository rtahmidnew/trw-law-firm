import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../../components/Layout'
import StatusBadge from '../../../components/StatusBadge'
import { supabase } from '../../../lib/supabase'

export default function AssociateView() {
  const router = useRouter()
  const { associateId } = router.query
  const [associate, setAssociate] = useState(null)
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!associateId) return
    async function load() {
      const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user
      if (!user) { router.push('/'); return }

      // Fetch profile, cases assigned directly, and cases via user_cases junction
      const [assocRes, assignedRes, userCasesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', associateId).single(),
        supabase.from('cases')
          .select('*')
          .eq('assigned_to', associateId)
          .order('updated_at', { ascending: false }),
        supabase.from('user_cases')
          .select('case_id')
          .eq('user_id', associateId),
      ])

      // Build a unified list of cases (union of assigned + user_cases, no duplicates)
      const assignedCases = assignedRes.data || []
      const junctionCaseIds = (userCasesRes.data || []).map(uc => uc.case_id)
      const assignedIds = new Set(assignedCases.map(c => c.id))

      // Fetch full case data for junction cases not already in assigned list
      const missingIds = junctionCaseIds.filter(cid => !assignedIds.has(cid))
      let junctionCases = []
      if (missingIds.length > 0) {
        const { data: jRes } = await supabase
          .from('cases')
          .select('*')
          .in('id', missingIds)
          .order('updated_at', { ascending: false })
        junctionCases = jRes || []
      }

      // Merge and sort by updated_at desc
      const allCases = [...assignedCases, ...junctionCases].sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
      )

      setAssociate(assocRes.data)
      setCases(allCases)
      setLoading(false)
    }
    load()
  }, [associateId])

  const filtered = filter === 'all' ? cases : cases.filter(c => c.status === filter)

  const counts = {
    all: cases.length,
    open: cases.filter(c => c.status === 'open').length,
    pending: cases.filter(c => c.status === 'pending').length,
    closed: cases.filter(c => c.status === 'closed').length,
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
    </Layout>
  )

  return (
    <Layout>
      <button
        onClick={() => router.push('/admin')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        ← Back to Overview
      </button>

      {/* Associate header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {associate?.full_name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{associate?.full_name}</h1>
          <p className="text-gray-500 text-sm">Associate · {counts.all} total cases</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', key: 'all', color: 'bg-gray-100 text-gray-800' },
          { label: 'Open', key: 'open', color: 'bg-gray-100 text-gray-800' },
          { label: 'Pending', key: 'pending', color: 'bg-gray-100 text-gray-800' },
          { label: 'Closed', key: 'closed', color: 'bg-gray-100 text-gray-600' },
        ].map(s => (
          <div
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`cursor-pointer rounded-xl p-4 ${s.color} ${filter === s.key ? 'ring-2 ring-gray-800' : ''}`}
          >
            <p className="text-2xl font-bold">{counts[s.key]}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cases */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2" style={{fontSize:28, color:'#d1d5db'}}>&#9723;</p>
          <p>No {filter !== 'all' ? filter : ''} cases.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Link key={c.id} href={`/cases/${c.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all p-5 cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 truncate">{c.client_name}</h2>
                      <StatusBadge status={c.status} />
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

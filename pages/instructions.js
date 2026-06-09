import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  normal: { label: 'Normal', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  high: { label: 'High', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  urgent: { label: 'Urgent', color: 'bg-red-50 text-red-700 border-red-200' },
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export default function InstructionsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [associates, setAssociates] = useState([])
  const [cases, setCases] = useState([])
  const [instructions, setInstructions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('pending') // 'all' | 'pending' | 'done'
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [completingId, setCompletingId] = useState(null)
  const [completeNote, setCompleteNote] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'normal',
    due_date: '',
    case_id: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!prof) { router.push('/'); return }
      setProfile(prof)

      const [assocRes, casesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('role', 'associate'),
        supabase.from('cases').select('id, client_name').order('client_name'),
      ])
      setAssociates(assocRes.data || [])
      setCases(casesRes.data || [])
      setLoading(false)
      await loadInstructions()
    }
    load()
  }, [])

  async function loadInstructions() {
    const { data } = await supabase
      .from('instructions')
      .select(`
        *,
        created_by_profile:profiles!instructions_created_by_fkey(full_name),
        assigned_to_profile:profiles!instructions_assigned_to_fkey(full_name),
        completed_by_profile:profiles!instructions_completed_by_fkey(full_name),
        case:cases(client_name)
      `)
      .order('created_at', { ascending: false })
    setInstructions(data || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('instructions').insert({
      title: form.title,
      description: form.description || null,
      created_by: user.id,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      due_date: form.due_date || null,
      case_id: form.case_id || null,
    })
    setForm({ title: '', description: '', assigned_to: '', priority: 'normal', due_date: '', case_id: '' })
    setShowForm(false)
    setSaving(false)
    await loadInstructions()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this task?')) return
    await supabase.from('instructions').delete().eq('id', id)
    await loadInstructions()
  }

  async function handleToggleComplete(item) {
    if (!item.is_complete) {
      // Show note input before completing
      setCompletingId(item.id)
      setCompleteNote('')
    } else {
      // Undo completion
      await supabase.from('instructions').update({
        is_complete: false,
        completed_by: null,
        completed_at: null,
        completed_note: null,
      }).eq('id', item.id)
      await loadInstructions()
    }
  }

  async function submitComplete(item) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('instructions').update({
      is_complete: true,
      completed_by: user.id,
      completed_at: new Date().toISOString(),
      completed_note: completeNote || null,
    }).eq('id', item.id)
    setCompletingId(null)
    setCompleteNote('')
    await loadInstructions()
  }

  const isPartner = profile?.role === 'partner'

  // Filter logic
  let filtered = instructions
  if (filter === 'pending') filtered = filtered.filter(i => !i.is_complete)
  if (filter === 'done') filtered = filtered.filter(i => i.is_complete)
  if (assigneeFilter !== 'all') {
    if (assigneeFilter === 'unassigned') {
      filtered = filtered.filter(i => !i.assigned_to)
    } else {
      filtered = filtered.filter(i => i.assigned_to === assigneeFilter)
    }
  }

  const pendingCount = instructions.filter(i => !i.is_complete).length
  const doneCount = instructions.filter(i => i.is_complete).length
  const urgentCount = instructions.filter(i => !i.is_complete && i.priority === 'urgent').length

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={isPartner ? '/admin' : '/dashboard'}>
              <span className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">← Back</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Instructions & To-Do Board</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pendingCount} pending · {doneCount} completed
            {urgentCount > 0 && <span className="ml-2 text-red-600 font-medium">⚠ {urgentCount} urgent</span>}
          </p>
        </div>
        {isPartner && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {showForm ? '✕ Cancel' : '+ New Task'}
          </button>
        )}
      </div>

      {/* New Task Form */}
      {showForm && isPartner && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-4">Create New Task / Instruction</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Task Title *</label>
              <input
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Draft legal notice for Sonar Bangla Tannery"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description / Instructions</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed instructions for the associate..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assign To</label>
                <select
                  value={form.assigned_to}
                  onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Associates</option>
                  {associates.map(a => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Linked Case</label>
                <select
                  value={form.case_id}
                  onChange={e => setForm({ ...form, case_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No case</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.client_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Status filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {[
            { key: 'pending', label: `Pending (${pendingCount})` },
            { key: 'done', label: `Done (${doneCount})` },
            { key: 'all', label: 'All' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.key ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Assignee filter (partners only) */}
        {isPartner && associates.length > 0 && (
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {associates.map(a => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        )}

        <span className="text-xs text-gray-400">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Task List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">
            {filter === 'pending' ? 'No pending tasks.' : filter === 'done' ? 'No completed tasks yet.' : 'No tasks found.'}
          </p>
          {isPartner && filter === 'pending' && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-blue-700 hover:underline"
            >
              + Create the first task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isOverdue = item.due_date && !item.is_complete && new Date(item.due_date) < new Date()
            const isCompleting = completingId === item.id

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border transition-all ${item.is_complete ? 'border-gray-100 opacity-70' : isOverdue ? 'border-red-200' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(item)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${item.is_complete ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-blue-500'}`}
                    title={item.is_complete ? 'Mark as pending' : 'Mark as done'}
                  >
                    {item.is_complete && <span className="text-white text-xs leading-none font-bold">✓</span>}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${item.is_complete ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {item.title}
                          </p>
                          <PriorityBadge priority={item.priority} />
                          {isOverdue && (
                            <span className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              Overdue
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{item.description}</p>
                        )}

                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <span className="text-xs text-gray-400">
                            By: <span className="text-gray-600">{item.created_by_profile?.full_name || 'Partner'}</span>
                          </span>
                          {item.assigned_to_profile ? (
                            <span className="text-xs text-blue-600">
                              → {item.assigned_to_profile.full_name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">→ All Associates</span>
                          )}
                          {item.case && (
                            <Link href={`/cases/${item.case_id}`}>
                              <span className="text-xs text-blue-600 hover:underline cursor-pointer">
                                📁 {item.case.client_name}
                              </span>
                            </Link>
                          )}
                          {item.due_date && (
                            <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                              Due: {new Date(item.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                          <span className="text-xs text-gray-300">
                            {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>

                        {/* Completion info */}
                        {item.is_complete && (
                          <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                            <p className="text-xs text-green-700">
                              ✓ Completed by <strong>{item.completed_by_profile?.full_name || 'Associate'}</strong>
                              {item.completed_at && ` on ${new Date(item.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                            </p>
                            {item.completed_note && (
                              <p className="text-xs text-green-600 mt-1 italic">"{item.completed_note}"</p>
                            )}
                          </div>
                        )}

                        {/* Completion note input */}
                        {isCompleting && (
                          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-blue-800">Add a completion note (optional):</p>
                            <textarea
                              value={completeNote}
                              onChange={e => setCompleteNote(e.target.value)}
                              placeholder="e.g. Sent legal notice via courier on 9 Jun 2026..."
                              rows={2}
                              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => submitComplete(item)}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
                              >
                                Mark Complete
                              </button>
                              <button
                                onClick={() => setCompletingId(null)}
                                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Delete (partners only) */}
                      {isPartner && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-gray-300 hover:text-red-400 text-sm transition-colors flex-shrink-0 p-1"
                          title="Delete task"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'

const TABS = ['Timeline', 'Documents', 'Deadlines']

export default function CaseDetail() {
  const router = useRouter()
  const { id } = router.query
  const [caseData, setCaseData] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('Timeline')
  const [loading, setLoading] = useState(true)

  // Timeline
  const [timeline, setTimeline] = useState([])
  const [newEntry, setNewEntry] = useState('')
  const [addingEntry, setAddingEntry] = useState(false)

  // Documents
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef()

  // Deadlines
  const [deadlines, setDeadlines] = useState([])
  const [deadlineForm, setDeadlineForm] = useState({ title: '', due_date: '', notes: '' })
  const [addingDeadline, setAddingDeadline] = useState(false)
  const [showDeadlineForm, setShowDeadlineForm] = useState(false)

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (!id) return
    loadAll()
  }, [id])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [profileRes, caseRes, timelineRes, docsRes, deadlinesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('cases').select('*').eq('id', id).single(),
      supabase.from('timeline_entries').select('*, profiles(full_name)').eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('documents').select('*').eq('case_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('deadlines').select('*').eq('case_id', id).order('due_date', { ascending: true }),
    ])

    setProfile(profileRes.data)
    setCaseData(caseRes.data)
    setTimeline(timelineRes.data || [])
    setDocuments(docsRes.data || [])
    setDeadlines(deadlinesRes.data || [])
    setLoading(false)
  }

  // ── Timeline ──────────────────────────────────────────────
  async function addTimelineEntry(e) {
    e.preventDefault()
    if (!newEntry.trim()) return
    setAddingEntry(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('timeline_entries')
      .insert({ case_id: id, user_id: user.id, entry_text: newEntry.trim() })
      .select('*, profiles(full_name)')
      .single()

    setTimeline(prev => [data, ...prev])
    setNewEntry('')
    setAddingEntry(false)
  }

  // ── Documents ────────────────────────────────────────────
  async function handleFileUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()

    for (const file of files) {
      const filePath = `${id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(filePath, file)

      if (!uploadError) {
        const { data: doc } = await supabase
          .from('documents')
          .insert({
            case_id: id,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
          })
          .select()
          .single()
        setDocuments(prev => [doc, ...prev])
      }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function downloadDocument(doc) {
    const { data } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(doc.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteDocument(doc) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return
    await supabase.storage.from('case-documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  // ── Deadlines ────────────────────────────────────────────
  async function addDeadline(e) {
    e.preventDefault()
    if (!deadlineForm.title || !deadlineForm.due_date) return
    setAddingDeadline(true)

    const { data } = await supabase
      .from('deadlines')
      .insert({ case_id: id, ...deadlineForm })
      .select()
      .single()

    setDeadlines(prev => [...prev, data].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)))
    setDeadlineForm({ title: '', due_date: '', notes: '' })
    setShowDeadlineForm(false)
    setAddingDeadline(false)
  }

  async function toggleDeadline(deadline) {
    const { data } = await supabase
      .from('deadlines')
      .update({ is_complete: !deadline.is_complete })
      .eq('id', deadline.id)
      .select()
      .single()
    setDeadlines(prev => prev.map(d => d.id === data.id ? data : d))
  }

  async function deleteDeadline(id) {
    if (!confirm('Delete this deadline?')) return
    await supabase.from('deadlines').delete().eq('id', id)
    setDeadlines(prev => prev.filter(d => d.id !== id))
  }

  // ── Status Update ─────────────────────────────────────────
  async function updateStatus(newStatus) {
    setUpdatingStatus(true)
    const { data } = await supabase
      .from('cases')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single()
    setCaseData(data)
    setUpdatingStatus(false)
  }

  function formatFileSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading case...</div>
      </div>
    </Layout>
  )

  if (!caseData) return (
    <Layout>
      <div className="text-center py-16 text-gray-400">Case not found.</div>
    </Layout>
  )

  const isPartner = profile?.role === 'partner'
  const today = new Date().toISOString().split('T')[0]

  return (
    <Layout>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-700 mb-5"
      >
        ← Back
      </button>

      {/* Case Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{caseData.client_name}</h1>
              <StatusBadge status={caseData.status} />
            </div>
            <p className="text-blue-700 font-medium mt-1">{caseData.case_type}</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600">
              {caseData.client_contact && (
                <p><span className="text-gray-400">Contact:</span> {caseData.client_contact}</p>
              )}
              {caseData.opposing_party && (
                <p><span className="text-gray-400">Opposing:</span> {caseData.opposing_party}</p>
              )}
              {caseData.court_name && (
                <p><span className="text-gray-400">Court:</span> {caseData.court_name}</p>
              )}
              {caseData.court_case_number && (
                <p><span className="text-gray-400">Court No.:</span> {caseData.court_case_number}</p>
              )}
              {caseData.file_number && (
                <p><span className="text-gray-400">File No.:</span> <span className="font-mono">{caseData.file_number}</span></p>
              )}
              <p><span className="text-gray-400">Opened:</span> {new Date(caseData.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          {/* Status changer */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Change status</label>
            <select
              value={caseData.status}
              onChange={e => updateStatus(e.target.value)}
              disabled={updatingStatus}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-gray-600 hover:text-blue-700'
            }`}
          >
            {t}
            {t === 'Documents' && documents.length > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                {documents.length}
              </span>
            )}
            {t === 'Deadlines' && deadlines.filter(d => !d.is_complete).length > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-blue-600' : 'bg-red-100 text-red-600'}`}>
                {deadlines.filter(d => !d.is_complete).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── TIMELINE TAB ───────────────────────────────────── */}
      {tab === 'Timeline' && (
        <div className="space-y-4">
          {/* Add entry form */}
          <form onSubmit={addTimelineEntry} className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add update to timeline
              </label>
              <textarea
                value={newEntry}
                onChange={e => setNewEntry(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="e.g. Drafted and filed writ petition. Hearing scheduled for next week."
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={addingEntry || !newEntry.trim()}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {addingEntry ? 'Adding...' : 'Add Entry'}
                </button>
              </div>
            </form>

          {/* Timeline entries */}
          {timeline.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p>No timeline entries yet.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4 pl-10">
                {timeline.map(entry => (
                  <div key={entry.id} className="relative">
                    {/* Dot */}
                    <div className="absolute -left-6 top-4 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow" />
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-sm text-gray-900 leading-relaxed">{entry.entry_text}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {entry.profiles?.full_name} · {new Date(entry.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── DOCUMENTS TAB ──────────────────────────────────── */}
      {tab === 'Documents' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-dashed border-blue-300 p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.tif,.xlsx,.xls"
              />
              <p className="text-3xl mb-2">📎</p>
              <p className="text-sm text-gray-600 mb-3">Upload PDFs, Word docs, scanned images</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Choose Files'}
              </button>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📄</p>
              <p>No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {documents.map(doc => {
                const ext = doc.file_name.split('.').pop().toUpperCase()
                const iconBg = {
                  PDF: 'bg-red-100 text-red-700',
                  DOC: 'bg-blue-100 text-blue-700',
                  DOCX: 'bg-blue-100 text-blue-700',
                  JPG: 'bg-green-100 text-green-700',
                  JPEG: 'bg-green-100 text-green-700',
                  PNG: 'bg-green-100 text-green-700',
                }[ext] || 'bg-gray-100 text-gray-600'

                return (
                  <div key={doc.id} className="flex items-center gap-4 px-4 py-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${iconBg}`}>
                      {ext}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="text-blue-700 hover:text-blue-900 text-sm font-medium"
                      >
                        Download
                      </button>
                      <button
                          onClick={() => deleteDocument(doc)}
                          className="text-red-400 hover:text-red-600 text-sm"
                        >
                          ✕
                        </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── DEADLINES TAB ──────────────────────────────────── */}
      {tab === 'Deadlines' && (
        <div className="space-y-4">
          {!showDeadlineForm && (
            <button
              onClick={() => setShowDeadlineForm(true)}
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              + Add Deadline
            </button>
          )}

          {showDeadlineForm && (
            <form onSubmit={addDeadline} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">New Deadline</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    value={deadlineForm.title}
                    onChange={e => setDeadlineForm(p => ({ ...p, title: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. File Written Arguments"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={deadlineForm.due_date}
                    onChange={e => setDeadlineForm(p => ({ ...p, due_date: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    value={deadlineForm.notes}
                    onChange={e => setDeadlineForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional note"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addingDeadline}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50"
                >
                  {addingDeadline ? 'Saving...' : 'Save Deadline'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeadlineForm(false)}
                  className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {deadlines.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📅</p>
              <p>No deadlines set yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deadlines.map(dl => {
                const isOverdue = !dl.is_complete && dl.due_date < today
                const isDueToday = !dl.is_complete && dl.due_date === today
                return (
                  <div
                    key={dl.id}
                    className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${
                      dl.is_complete ? 'border-gray-100 opacity-60' :
                      isOverdue ? 'border-red-200 bg-red-50' :
                      isDueToday ? 'border-yellow-200 bg-yellow-50' :
                      'border-gray-200'
                    }`}
                  >
                    <input
                        type="checkbox"
                        checked={dl.is_complete}
                        onChange={() => toggleDeadline(dl)}
                        className="mt-0.5 w-4 h-4 accent-blue-700 cursor-pointer"
                      />
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${dl.is_complete ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {dl.title}
                      </p>
                      <p className={`text-xs mt-0.5 font-medium ${isOverdue ? 'text-red-600' : isDueToday ? 'text-yellow-700' : 'text-gray-500'}`}>
                        {isOverdue ? '⚠ Overdue · ' : isDueToday ? '🔔 Due Today · ' : ''}
                        {new Date(dl.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      {dl.notes && <p className="text-xs text-gray-400 mt-1">{dl.notes}</p>}
                    </div>
                    <button
                        onClick={() => deleteDeadline(dl.id)}
                        className="text-gray-300 hover:text-red-400 text-sm"
                      >
                        ✕
                      </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

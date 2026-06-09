import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'

const TABS = ['Timeline', 'Documents', 'Deadlines']

const CASE_TYPES = [
  'Civil Litigation', 'Criminal', 'Corporate / Commercial', 'Family Law',
  'Property / Real Estate', 'Immigration', 'Intellectual Property',
  'Banking & Finance', 'Tax', 'Employment', 'Constitutional', 'Other'
]

export default function CaseDetail() {
  const router = useRouter()
  const { id } = router.query
  const [caseData, setCaseData] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('Timeline')
  const [loading, setLoading] = useState(true)

  // Inline editing
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Timeline
  const [timeline, setTimeline] = useState([])
  const [newEntry, setNewEntry] = useState('')
  const [addingEntry, setAddingEntry] = useState(false)

  // Documents
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef()
  const [docSearch, setDocSearch] = useState('')
  const [docSort, setDocSort] = useState('date_desc')
  const [docView, setDocView] = useState('list')
  const [previewDoc, setPreviewDoc] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [renamingDoc, setRenamingDoc] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  // Deadlines
  const [deadlines, setDeadlines] = useState([])
  const [deadlineForm, setDeadlineForm] = useState({ title: '', due_date: '', notes: '' })
  const [addingDeadline, setAddingDeadline] = useState(false)
  const [showDeadlineForm, setShowDeadlineForm] = useState(false)

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Visibility update
  const [updatingVisibility, setUpdatingVisibility] = useState(false)

  // Client Portal
  const [portalModalOpen, setPortalModalOpen] = useState(false)
  const [portalLink, setPortalLink] = useState(null)
  const [generatingPortal, setGeneratingPortal] = useState(false)
  const [copied, setCopied] = useState(false)

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

  // ── Inline Edit ───────────────────────────────────────────
  function startEdit() {
    setEditForm({
      client_name: caseData.client_name || '',
      client_contact: caseData.client_contact || '',
      case_type: caseData.case_type || '',
      opposing_party: caseData.opposing_party || '',
      court_name: caseData.court_name || '',
      court_case_number: caseData.court_case_number || '',
      file_number: caseData.file_number || '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!editForm.client_name?.trim()) return
    setSavingEdit(true)
    const { data } = await supabase
      .from('cases')
      .update({
        client_name: editForm.client_name.trim(),
        client_contact: editForm.client_contact.trim(),
        case_type: editForm.case_type,
        opposing_party: editForm.opposing_party.trim(),
        court_name: editForm.court_name.trim(),
        court_case_number: editForm.court_case_number.trim(),
        file_number: editForm.file_number.trim(),
      })
      .eq('id', id)
      .select()
      .single()
    setCaseData(data)
    setEditing(false)
    setSavingEdit(false)
  }

  // ── Client Portal ──────────────────────────────────────────
  async function generatePortalLink() {
    setGeneratingPortal(true)
    // Check if a token already exists for this case
    const { data: existing } = await supabase
      .from('client_portal_tokens')
      .select('token')
      .eq('case_id', id)
      .eq('is_active', true)
      .single()
    if (existing) {
      setPortalLink(`${window.location.origin}/portal/${existing.token}`)
      setGeneratingPortal(false)
      return
    }
    // Generate a new token
    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('client_portal_tokens').insert({
      case_id: id,
      token,
      created_by: user.id,
      is_active: true,
    })
    setPortalLink(`${window.location.origin}/portal/${token}`)
    setGeneratingPortal(false)
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

  async function getSignedUrl(doc, expiresIn = 300) {
    const { data, error } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(doc.file_path, expiresIn)
    if (error) {
      console.error('Signed URL error:', error)
      return null
    }
    return data?.signedUrl || null
  }

  async function downloadDocument(doc) {
    const url = await getSignedUrl(doc, 60)
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } else {
      alert('Could not generate download link. Please try again.')
    }
  }

  async function deleteDocument(doc) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return
    await supabase.storage.from('case-documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  async function openPreview(doc) {
    setPreviewDoc(doc)
    setPreviewUrl(null)
    setPreviewLoading(true)
    const url = await getSignedUrl(doc, 600)
    setPreviewUrl(url)
    setPreviewLoading(false)
  }

  function closePreview() {
    setPreviewDoc(null)
    setPreviewUrl(null)
    setPreviewLoading(false)
  }

  function startRename(doc) {
    setRenamingDoc(doc.id)
    setRenameValue(doc.file_name)
  }

  async function saveRename(doc) {
    if (!renameValue.trim() || renameValue === doc.file_name) {
      setRenamingDoc(null)
      return
    }
    setRenameSaving(true)
    const { data } = await supabase
      .from('documents')
      .update({ file_name: renameValue.trim() })
      .eq('id', doc.id)
      .select()
      .single()
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, file_name: data.file_name } : d))
    setRenamingDoc(null)
    setRenameSaving(false)
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

  async function deleteDeadline(dlId) {
    if (!confirm('Delete this deadline?')) return
    await supabase.from('deadlines').delete().eq('id', dlId)
    setDeadlines(prev => prev.filter(d => d.id !== dlId))
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

  // ── Visibility Update ─────────────────────────────────────
  async function toggleVisibility() {
    setUpdatingVisibility(true)
    const newVal = !caseData.is_public
    const { data } = await supabase
      .from('cases')
      .update({ is_public: newVal })
      .eq('id', id)
      .select()
      .single()
    setCaseData(data)
    setUpdatingVisibility(false)
  }

  function formatFileSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function getDocIcon(ext) {
    return {
      PDF: { bg: 'bg-red-100 text-red-700', label: 'PDF' },
      DOC: { bg: 'bg-blue-100 text-blue-700', label: 'DOC' },
      DOCX: { bg: 'bg-blue-100 text-blue-700', label: 'DOCX' },
      XLS: { bg: 'bg-emerald-100 text-emerald-700', label: 'XLS' },
      XLSX: { bg: 'bg-emerald-100 text-emerald-700', label: 'XLSX' },
      JPG: { bg: 'bg-purple-100 text-purple-700', label: 'JPG' },
      JPEG: { bg: 'bg-purple-100 text-purple-700', label: 'JPEG' },
      PNG: { bg: 'bg-purple-100 text-purple-700', label: 'PNG' },
      TIFF: { bg: 'bg-purple-100 text-purple-700', label: 'TIFF' },
      TIF: { bg: 'bg-purple-100 text-purple-700', label: 'TIF' },
    }[ext] || { bg: 'bg-gray-100 text-gray-600', label: ext || 'FILE' }
  }

  function isImage(doc) {
    const ext = doc.file_name.split('.').pop().toUpperCase()
    return ['JPG', 'JPEG', 'PNG', 'TIFF', 'TIF', 'GIF', 'WEBP'].includes(ext)
  }

  function isPdf(doc) {
    return doc.file_name.split('.').pop().toUpperCase() === 'PDF'
  }

  const filteredDocs = documents
    .filter(d => d.file_name.toLowerCase().includes(docSearch.toLowerCase()))
    .sort((a, b) => {
      if (docSort === 'date_desc') return new Date(b.uploaded_at) - new Date(a.uploaded_at)
      if (docSort === 'date_asc') return new Date(a.uploaded_at) - new Date(b.uploaded_at)
      if (docSort === 'name_asc') return a.file_name.localeCompare(b.file_name)
      if (docSort === 'name_desc') return b.file_name.localeCompare(a.file_name)
      if (docSort === 'size_desc') return (b.file_size || 0) - (a.file_size || 0)
      if (docSort === 'size_asc') return (a.file_size || 0) - (b.file_size || 0)
      return 0
    })

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
        {!editing ? (
          /* ── VIEW MODE ── */
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{caseData.client_name}</h1>
                <StatusBadge status={caseData.status} />
                {caseData.is_public !== false ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    🌐 Public
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    🔒 Private
                  </span>
                )}
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
            {/* Right controls */}
            <div className="flex flex-col gap-3">
              {/* Edit button */}
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-700 transition-all"
              >
                ✏ Edit Case Details
              </button>
              {/* Feature buttons */}
              <div className="flex flex-col gap-1.5">
                {isPartner && (
                  <Link href={`/cases/invoice/${id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 text-xs font-medium text-green-700 hover:bg-green-50 transition-all">
                    🧾 Invoices
                  </Link>
                )}
                <Link href={`/cases/emails/${id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-all">
                  📧 Email Threads
                </Link>
                {isPartner && (
                  <button
                    onClick={() => { setPortalLink(null); setPortalModalOpen(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-300 text-xs font-medium text-purple-700 hover:bg-purple-50 transition-all">
                    🔗 Client Portal
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Change status</label>
                <select
                  value={caseData.status}
                  onChange={e => updateStatus(e.target.value)}
                  disabled={updatingStatus}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              {isPartner && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Visibility</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => caseData.is_public === false && !updatingVisibility && toggleVisibility()}
                      disabled={updatingVisibility || caseData.is_public !== false}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        caseData.is_public !== false
                          ? 'bg-green-50 border-green-400 text-green-800 ring-2 ring-green-400 cursor-default'
                          : 'border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-700'
                      }`}
                    >
                      🌐 Public
                    </button>
                    <button
                      onClick={() => caseData.is_public !== false && !updatingVisibility && toggleVisibility()}
                      disabled={updatingVisibility || caseData.is_public === false}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        caseData.is_public === false
                          ? 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-400 cursor-default'
                          : 'border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-700'
                      }`}
                    >
                      🔒 Private
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {updatingVisibility ? 'Updating...' : (caseData.is_public !== false ? 'All members can view.' : 'Only you & partners.')}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── EDIT MODE ── */
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Edit Case Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Client Name <span className="text-red-500">*</span></label>
                <input
                  value={editForm.client_name}
                  onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Client full name or company"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Case Type</label>
                <select
                  value={editForm.case_type}
                  onChange={e => setEditForm(p => ({ ...p, case_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Client Contact</label>
                <input
                  value={editForm.client_contact}
                  onChange={e => setEditForm(p => ({ ...p, client_contact: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email, phone, or address"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Opposing Party</label>
                <input
                  value={editForm.opposing_party}
                  onChange={e => setEditForm(p => ({ ...p, opposing_party: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Opposing party name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Court / Forum</label>
                <input
                  value={editForm.court_name}
                  onChange={e => setEditForm(p => ({ ...p, court_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. High Court Division"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Court Case Number</label>
                <input
                  value={editForm.court_case_number}
                  onChange={e => setEditForm(p => ({ ...p, court_case_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. WP/1234/2026"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">File Number</label>
                <input
                  value={editForm.file_number}
                  onChange={e => setEditForm(p => ({ ...p, file_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. TRW-2026-01-001"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={saveEdit}
                disabled={savingEdit || !editForm.client_name?.trim()}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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

          {timeline.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p>No timeline entries yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4 pl-10">
                {timeline.map(entry => (
                  <div key={entry.id} className="relative">
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
          {/* Upload zone */}
          <div className="bg-white rounded-xl border border-dashed border-blue-300 p-5 flex flex-col sm:flex-row items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.tif,.xlsx,.xls"
            />
            <div className="flex-1 text-sm text-gray-500">
              <span className="text-2xl mr-2">📎</span>
              Upload PDFs, Word docs, scanned images, spreadsheets
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
            >
              {uploading ? 'Uploading...' : '+ Upload Files'}
            </button>
          </div>

          {/* Search + Sort + View toggle toolbar */}
          {documents.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {docSearch && (
                  <button onClick={() => setDocSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                )}
              </div>
              <select
                value={docSort}
                onChange={e => setDocSort(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
                <option value="size_desc">Largest first</option>
                <option value="size_asc">Smallest first</option>
              </select>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button onClick={() => setDocView('list')} className={`px-3 py-2 text-sm ${docView === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} title="List view">☰</button>
                <button onClick={() => setDocView('grid')} className={`px-3 py-2 text-sm ${docView === 'grid' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} title="Grid view">⊞</button>
              </div>
              <span className="text-xs text-gray-400 shrink-0 self-center">{filteredDocs.length} of {documents.length}</span>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📄</p>
              <p>No documents uploaded yet.</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-2xl mb-2">🔍</p>
              <p>No documents match &ldquo;{docSearch}&rdquo;</p>
            </div>
          ) : docView === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredDocs.map(doc => {
                const ext = doc.file_name.split('.').pop().toUpperCase()
                const { bg, label } = getDocIcon(ext)
                const canPreview = isImage(doc) || isPdf(doc)
                return (
                  <div key={doc.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
                    <div className={`h-24 flex items-center justify-center cursor-pointer ${canPreview ? 'hover:opacity-80' : ''} ${bg}`} onClick={() => canPreview && openPreview(doc)}>
                      <span className="text-4xl">{isImage(doc) ? '🖼️' : '📄'}</span>
                    </div>
                    <div className="p-2">
                      {renamingDoc === doc.id ? (
                        <div className="flex gap-1">
                          <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveRename(doc); if (e.key === 'Escape') setRenamingDoc(null) }} className="flex-1 text-xs border border-blue-400 rounded px-1 py-0.5 focus:outline-none" />
                          <button onClick={() => saveRename(doc)} disabled={renameSaving} className="text-blue-700 text-xs font-bold">✓</button>
                          <button onClick={() => setRenamingDoc(null)} className="text-gray-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-gray-800 truncate cursor-pointer hover:text-blue-700" title={doc.file_name} onDoubleClick={() => startRename(doc)}>{doc.file_name}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(doc.file_size)}</p>
                      <div className="flex gap-1 mt-1.5">
                        {canPreview && <button onClick={() => openPreview(doc)} className="text-xs text-blue-600 hover:text-blue-800">Preview</button>}
                        <button onClick={() => downloadDocument(doc)} className="text-xs text-blue-600 hover:text-blue-800">↓ Download</button>
                        <button onClick={() => startRename(doc)} className="text-xs text-gray-400 hover:text-gray-700">✏</button>
                        <button onClick={() => deleteDocument(doc)} className="text-xs text-red-400 hover:text-red-600 ml-auto">✕</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filteredDocs.map(doc => {
                const ext = doc.file_name.split('.').pop().toUpperCase()
                const { bg, label } = getDocIcon(ext)
                const canPreview = isImage(doc) || isPdf(doc)
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer ${bg} ${canPreview ? 'hover:opacity-70' : ''}`}
                      onClick={() => canPreview && openPreview(doc)}
                      title={canPreview ? 'Click to preview' : ''}
                    >
                      {label}
                    </div>
                    <div className="flex-1 min-w-0">
                      {renamingDoc === doc.id ? (
                        <div className="flex items-center gap-1">
                          <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveRename(doc); if (e.key === 'Escape') setRenamingDoc(null) }} className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none" />
                          <button onClick={() => saveRename(doc)} disabled={renameSaving} className="text-blue-700 text-sm font-bold px-1">✓</button>
                          <button onClick={() => setRenamingDoc(null)} className="text-gray-400 text-sm px-1">✕</button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-blue-700" title={`${doc.file_name} — double-click to rename`} onDoubleClick={() => startRename(doc)}>{doc.file_name}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {formatFileSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canPreview && (
                        <button onClick={() => openPreview(doc)} className="text-xs text-gray-500 hover:text-blue-700 border border-gray-200 rounded px-2 py-1">
                          Preview
                        </button>
                      )}
                      <button onClick={() => startRename(doc)} className="text-xs text-gray-500 hover:text-blue-700 border border-gray-200 rounded px-2 py-1" title="Rename">
                        ✏ Rename
                      </button>
                      <button onClick={() => downloadDocument(doc)} className="text-blue-700 hover:text-blue-900 text-sm font-medium border border-blue-200 rounded px-2 py-1">
                        Download
                      </button>
                      <button onClick={() => deleteDocument(doc)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
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
            <button onClick={() => setShowDeadlineForm(true)} className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              + Add Deadline
            </button>
          )}
          {showDeadlineForm && (
            <form onSubmit={addDeadline} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">New Deadline</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input value={deadlineForm.title} onChange={e => setDeadlineForm(p => ({ ...p, title: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. File Written Arguments" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                  <input type="date" value={deadlineForm.due_date} onChange={e => setDeadlineForm(p => ({ ...p, due_date: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input value={deadlineForm.notes} onChange={e => setDeadlineForm(p => ({ ...p, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional note" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={addingDeadline} className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">{addingDeadline ? 'Saving...' : 'Save Deadline'}</button>
                <button type="button" onClick={() => setShowDeadlineForm(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2">Cancel</button>
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
                  <div key={dl.id} className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${dl.is_complete ? 'border-gray-100 opacity-60' : isOverdue ? 'border-red-200 bg-red-50' : isDueToday ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'}`}>
                    <input type="checkbox" checked={dl.is_complete} onChange={() => toggleDeadline(dl)} className="mt-0.5 w-4 h-4 accent-blue-700 cursor-pointer" />
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${dl.is_complete ? 'line-through text-gray-400' : 'text-gray-900'}`}>{dl.title}</p>
                      <p className={`text-xs mt-0.5 font-medium ${isOverdue ? 'text-red-600' : isDueToday ? 'text-yellow-700' : 'text-gray-500'}`}>
                        {isOverdue ? '⚠ Overdue · ' : isDueToday ? '🔔 Due Today · ' : ''}
                        {new Date(dl.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      {dl.notes && <p className="text-xs text-gray-400 mt-1">{dl.notes}</p>}
                    </div>
                    <button onClick={() => deleteDeadline(dl.id)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── PREVIEW MODAL ──────────────────────────────────── */}
      {/* Client Portal Modal */}
      {portalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPortalModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">🔗 Client Portal Link</h2>
            <p className="text-sm text-gray-500 mb-4">Share this link with your client. They can view the case status, timeline, and download their documents.</p>
            {portalLink ? (
              <>
                <div className="bg-gray-50 border rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all mb-3">{portalLink}</div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(portalLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                  <button onClick={() => setPortalModalOpen(false)} className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50">Close</button>
                </div>
              </>
            ) : (
              <button onClick={generatePortalLink} disabled={generatingPortal}
                className="w-full bg-green-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-50">
                {generatingPortal ? 'Generating...' : 'Generate Portal Link'}
              </button>
            )}
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold text-gray-800 truncate">{previewDoc.file_name}</span>
                <span className="text-xs text-gray-400 shrink-0">{formatFileSize(previewDoc.file_size)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button onClick={() => downloadDocument(previewDoc)} className="text-sm text-blue-700 hover:text-blue-900 font-medium border border-blue-200 rounded-lg px-3 py-1.5">
                  Download
                </button>
                <button onClick={closePreview} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4">
              {previewLoading ? (
                <div className="text-center text-gray-400">
                  <p className="text-4xl mb-3">⏳</p>
                  <p className="text-sm">Loading preview...</p>
                </div>
              ) : previewUrl && isImage(previewDoc) ? (
                <img src={previewUrl} alt={previewDoc.file_name} className="max-w-full max-h-full object-contain rounded-lg shadow" />
              ) : previewUrl && isPdf(previewDoc) ? (
                <iframe src={previewUrl} className="w-full h-full min-h-[60vh] rounded-lg" title={previewDoc.file_name} />
              ) : (
                <div className="text-center text-gray-400">
                  <p className="text-4xl mb-3">📄</p>
                  <p className="text-sm">Preview not available.</p>
                  <button onClick={() => downloadDocument(previewDoc)} className="mt-3 text-blue-700 hover:underline text-sm">Download instead</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

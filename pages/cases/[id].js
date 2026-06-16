import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'
import { IconGlobe, IconLock, IconInvoice, IconMail, IconLink, IconEdit, IconClipboard, IconFile, IconFileText, IconSearch, IconX, IconList, IconGrid, IconCheck, IconTrash, IconAlertTriangle, IconBell, IconCalendar, IconEye, IconDownload, IconPaperclip, IconClock, IconStar } from '../../components/Icons'
import dynamic from 'next/dynamic'
const RichEditor = dynamic(() => import('../../components/RichEditor'), { ssr: false })

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
  const [newEntryDate, setNewEntryDate] = useState(() => new Date().toISOString().split('T')[0])
  const [addingEntry, setAddingEntry] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null) // entry id being edited
  const [editEntryText, setEditEntryText] = useState('')
  const [editEntryDate, setEditEntryDate] = useState('')
  const [savingEntryEdit, setSavingEntryEdit] = useState(false)

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

  // Star toggle
  const [toggingStar, setToggingStar] = useState(false)

  // My Cases (user_cases junction)
  const [inMyCases, setInMyCases] = useState(false)
  const [toggingMyCases, setToggingMyCases] = useState(false)

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
    const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user
    if (!user) { router.push('/'); return }

    const [profileRes, caseRes, timelineRes, docsRes, deadlinesRes, myCasesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('cases').select('*, file_type').eq('id', id).single(),
      supabase.from('timeline_entries').select('*, profiles(full_name)').eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('documents').select('*').eq('case_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('deadlines').select('*').eq('case_id', id).order('due_date', { ascending: true }),
      supabase.from('user_cases').select('id').eq('user_id', user.id).eq('case_id', id).maybeSingle(),
    ])

    setProfile(profileRes.data)
    setCaseData(caseRes.data)
    setTimeline(timelineRes.data || [])
    setDocuments(docsRes.data || [])
    setDeadlines(deadlinesRes.data || [])
    setInMyCases(!!myCasesRes.data)
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
      file_type: caseData.file_type || 'chamber',
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
        file_type: editForm.file_type || 'chamber',
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
    const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user
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

    const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user
    const { data, error } = await supabase
      .from('timeline_entries')
      .insert({ case_id: id, user_id: user.id, entry_text: newEntry.trim(), entry_date: newEntryDate || null })
      .select('*, profiles(full_name)')
      .single()

    if (data) {
      setTimeline(prev => [data, ...prev])
    }
    setNewEntry('')
    setNewEntryDate(new Date().toISOString().split('T')[0])
    setAddingEntry(false)
  }

  // ── Timeline Edit / Delete (partner only) ──────────────
  function startEditEntry(entry) {
    setEditingEntry(entry.id)
    setEditEntryText(entry.entry_text)
    setEditEntryDate(entry.entry_date || new Date().toISOString().split('T')[0])
  }

  async function saveEntryEdit(entryId) {
    if (!editEntryText.trim()) return
    setSavingEntryEdit(true)
    const { data } = await supabase
      .from('timeline_entries')
      .update({ entry_text: editEntryText.trim(), entry_date: editEntryDate || null })
      .eq('id', entryId)
      .select('*, profiles(full_name)')
      .single()
    if (data) {
      setTimeline(prev => prev.map(e => e.id === entryId ? data : e))
    }
    setEditingEntry(null)
    setSavingEntryEdit(false)
  }

  async function deleteTimelineEntry(entryId) {
    if (!confirm('Delete this timeline entry?')) return
    await supabase.from('timeline_entries').delete().eq('id', entryId)
    setTimeline(prev => prev.filter(e => e.id !== entryId))
  }

  // ── Documents ────────────────────────────────────────────
  async function handleFileUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)

    const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user

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

  // ── Star Toggle ───────────────────────────────────────────
  async function toggleStar() {
    if (toggingStar) return
    setToggingStar(true)
    const newVal = !caseData.is_starred
    const { data } = await supabase
      .from('cases')
      .update({ is_starred: newVal })
      .eq('id', id)
      .select()
      .single()
    setCaseData(data)
    setToggingStar(false)
  }

  // ── Hide from Client toggles ────────────────────────────
  async function toggleTimelineHide(entry) {
    const newVal = !entry.hide_from_client
    const { data } = await supabase
      .from('timeline_entries')
      .update({ hide_from_client: newVal })
      .eq('id', entry.id)
      .select('*, profiles(full_name)')
      .single()
    if (data) setTimeline(prev => prev.map(e => e.id === entry.id ? data : e))
  }

  async function toggleDocHide(doc) {
    const newVal = !doc.hide_from_client
    const { data } = await supabase
      .from('documents')
      .update({ hide_from_client: newVal })
      .eq('id', doc.id)
      .select()
      .single()
    if (data) setDocuments(prev => prev.map(d => d.id === doc.id ? data : d))
  }

  // ── My Cases Toggle ─────────────────────────────────────
  async function toggleMyCases() {
    setToggingMyCases(true)
    const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user
    if (inMyCases) {
      await supabase.from('user_cases').delete().eq('user_id', user.id).eq('case_id', id)
      setInMyCases(false)
    } else {
      await supabase.from('user_cases').insert({ user_id: user.id, case_id: id })
      setInMyCases(true)
    }
    setToggingMyCases(false)
  }

  // ── Delete Case ──────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function deleteCase() {
    setDeleting(true)
    // Delete all storage files first
    const { data: docs } = await supabase.from('documents').select('file_path').eq('case_id', id)
    if (docs && docs.length > 0) {
      const paths = docs.map(d => d.file_path)
      await supabase.storage.from('case-documents').remove(paths)
    }
    // Delete the case (cascades to timeline_entries, documents, deadlines)
    await supabase.from('cases').delete().eq('id', id)
    router.push('/admin')
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
                {(caseData.file_type || 'chamber') === 'court' ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">Court Filing</span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">Chamber Filing</span>
                )}
                <h1 className="text-2xl font-bold text-gray-900">{caseData.client_name}</h1>
                <StatusBadge status={caseData.status} />
                {caseData.is_public !== false ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                    <IconGlobe size={10} /> Public
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                    <IconLock size={10} /> Private
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
                  <p><span className="text-gray-400">File No.:</span> <span className={`font-mono font-semibold ${(caseData.file_type || 'chamber') === 'court' ? 'text-teal-700' : 'text-indigo-700'}`}>{caseData.file_number}</span></p>
                )}
                <p><span className="text-gray-400">Opened:</span> {new Date(caseData.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            {/* Right controls */}
            <div className="flex flex-col gap-3">
              {/* Edit button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-700 transition-all"
                >
                  <IconEdit size={12} /> Edit Case Details
                </button>
                <button
                  onClick={toggleStar}
                  disabled={toggingStar}
                  title={caseData.is_starred ? 'Remove from starred' : 'Star this case'}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    caseData.is_starred
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                      : 'border-gray-300 text-gray-400 hover:border-yellow-400 hover:text-yellow-500'
                  }`}
                >
                  <IconStar size={12} filled={caseData.is_starred} />
                  {caseData.is_starred ? 'Starred' : 'Star'}
                </button>
                {!isPartner && (
                  <button
                    onClick={toggleMyCases}
                    disabled={toggingMyCases}
                    title={inMyCases ? 'Remove from My Cases' : 'Add to My Cases'}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      inMyCases
                        ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {inMyCases ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 8h12M8 2v12" transform={inMyCases ? 'rotate(45 8 8)' : ''}/></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v12M2 8h12"/></svg>
                    )}
                    {inMyCases ? 'In My Cases' : 'Add to My Cases'}
                  </button>
                )}
              </div>
              {/* Feature buttons */}
              <div className="flex flex-col gap-1.5">
                {isPartner && (
                  <Link href={`/cases/invoice/${id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all">
                    <IconInvoice size={12} /> Invoices
                  </Link>
                )}
                <Link href={`/cases/emails/${id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all">
                  <IconMail size={12} /> Email Threads
                </Link>
                <button
                    onClick={() => { setPortalLink(null); setPortalModalOpen(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all">
                    <IconLink size={12} /> Client Portal
                  </button>
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
                          ? 'bg-gray-100 border-gray-500 text-gray-800 ring-2 ring-gray-400 cursor-default'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <IconGlobe size={12} /> Public
                    </button>
                    <button
                      onClick={() => caseData.is_public !== false && !updatingVisibility && toggleVisibility()}
                      disabled={updatingVisibility || caseData.is_public === false}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        caseData.is_public === false
                          ? 'bg-gray-100 border-gray-500 text-gray-800 ring-2 ring-gray-400 cursor-default'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <IconLock size={12} /> Private
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {updatingVisibility ? 'Updating...' : (caseData.is_public !== false ? 'All members can view.' : 'Only you & partners.')}
                  </p>
                </div>
              )}
              {/* Delete Case — partner only */}
              {isPartner && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-400 transition-all w-full justify-center"
                  >
                    <IconTrash size={12} /> Delete Case
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── EDIT MODE ── */
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Edit Case Details</h2>
            {/* File Type Selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">Filing Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm(p => ({ ...p, file_type: 'chamber' }))}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                    (editForm.file_type || 'chamber') === 'chamber'
                      ? 'bg-indigo-700 text-white border-indigo-700'
                      : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  Chamber Filing
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm(p => ({ ...p, file_type: 'court' }))}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                    editForm.file_type === 'court'
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'border-teal-200 text-teal-700 hover:bg-teal-50'
                  }`}
                >
                  Court Filing
                </button>
              </div>
            </div>
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
              {editForm.file_type === 'court' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Court / Forum</label>
                    <input
                      value={editForm.court_name}
                      onChange={e => setEditForm(p => ({ ...p, court_name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="e.g. High Court Division"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Court Case Number</label>
                    <input
                      value={editForm.court_case_number}
                      onChange={e => setEditForm(p => ({ ...p, court_case_number: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="e.g. WP/1234/2026"
                    />
                  </div>
                </>
              )}
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
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Event Date</label>
              <input
                type="date"
                value={newEntryDate}
                onChange={e => setNewEntryDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <RichEditor
              value={newEntry}
              onChange={setNewEntry}
              placeholder="e.g. Drafted and filed writ petition. Hearing scheduled for next week."
              minHeight={100}
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
              <div className="flex justify-center mb-2"><IconClipboard size={28} className="text-gray-300" /></div>
              <p>No timeline entries yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4 pl-10">
                {timeline.map(entry => (
                  <div key={entry.id} className="relative">
                    <div className="absolute -left-6 top-4 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow" />
                    {editingEntry === entry.id ? (
                      /* ── EDIT MODE for this entry ── */
                      <div className="bg-white rounded-xl border border-blue-300 p-4">
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Event Date</label>
                          <input
                            type="date"
                            value={editEntryDate}
                            onChange={e => setEditEntryDate(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <RichEditor
                          value={editEntryText}
                          onChange={setEditEntryText}
                          minHeight={100}
                        />
                        <div className="flex gap-2 mt-2 justify-end">
                          <button
                            onClick={() => saveEntryEdit(entry.id)}
                            disabled={savingEntryEdit || !editEntryText.trim()}
                            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {savingEntryEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingEntry(null)}
                            className="text-gray-500 hover:text-gray-700 text-xs px-3 py-1.5 border border-gray-300 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── VIEW MODE for this entry ── */
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="text-sm text-gray-900 leading-relaxed flex-1 rich-content"
                            dangerouslySetInnerHTML={{ __html: entry.entry_text }}
                          />
                          <div className="flex gap-1 shrink-0">
                              {/* Hide from client toggle — visible to partners & associates */}
                              <button
                                onClick={() => toggleTimelineHide(entry)}
                                title={entry.hide_from_client ? 'Hidden from client — click to show' : 'Visible to client — click to hide'}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  entry.hide_from_client
                                    ? 'text-orange-500 bg-orange-50 hover:bg-orange-100'
                                    : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                                }`}
                              >
                                <IconEye size={12} />
                              </button>
              <>
                  <button
                    onClick={() => startEditEntry(entry)}
                    title="Edit entry"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <IconEdit size={12} />
                  </button>
                  <button
                    onClick={() => deleteTimelineEntry(entry.id)}
                    title="Delete entry"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <IconTrash size={12} />
                  </button>
                </>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-400">
                            {entry.entry_date ? (
                              <span className="font-medium text-gray-500">
                                {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            ) : null}
                            {entry.entry_date && ' · '}
                            {entry.profiles?.full_name || 'Team'}
                            {' · Added '}
                            {new Date(entry.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </p>
                          {entry.hide_from_client && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">Hidden from client</span>
                          )}
                        </div>
                      </div>
                    )}
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
              <IconPaperclip size={18} className="inline mr-2 text-gray-400" />
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><IconSearch size={14} /></span>
                <input
                  type="text"
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {docSearch && (
                  <button onClick={() => setDocSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><IconX size={12} /></button>
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
                <button onClick={() => setDocView('list')} className={`px-3 py-2 ${docView === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} title="List view"><IconList size={14} /></button>
                <button onClick={() => setDocView('grid')} className={`px-3 py-2 ${docView === 'grid' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} title="Grid view"><IconGrid size={14} /></button>
              </div>
              <span className="text-xs text-gray-400 shrink-0 self-center">{filteredDocs.length} of {documents.length}</span>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="flex justify-center mb-2"><IconFile size={28} className="text-gray-300" /></div>
              <p>No documents uploaded yet.</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="flex justify-center mb-2"><IconSearch size={24} className="text-gray-300" /></div>
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
                      <div className="flex items-center justify-center">{isImage(doc) ? <IconEye size={28} className="text-gray-400" /> : <IconFile size={28} className="text-gray-400" />}</div>
                    </div>
                    <div className="p-2">
                      {renamingDoc === doc.id ? (
                        <div className="flex gap-1">
                          <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveRename(doc); if (e.key === 'Escape') setRenamingDoc(null) }} className="flex-1 text-xs border border-blue-400 rounded px-1 py-0.5 focus:outline-none" />
                          <button onClick={() => saveRename(doc)} disabled={renameSaving} className="text-blue-700"><IconCheck size={12} /></button>
                          <button onClick={() => setRenamingDoc(null)} className="text-gray-400"><IconX size={12} /></button>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-gray-800 truncate cursor-pointer hover:text-blue-700" title={doc.file_name} onDoubleClick={() => startRename(doc)}>{doc.file_name}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(doc.file_size)}</p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {canPreview && <button onClick={() => openPreview(doc)} className="text-xs text-blue-600 hover:text-blue-800">Preview</button>}
                        <button onClick={() => downloadDocument(doc)} className="text-xs text-blue-600 hover:text-blue-800">↓ Download</button>
                        <button onClick={() => startRename(doc)} className="text-xs text-gray-400 hover:text-gray-700"><IconEdit size={11} /></button>
                        <button
                          onClick={() => toggleDocHide(doc)}
                          title={doc.hide_from_client ? 'Hidden from client' : 'Visible to client'}
                          className={`text-xs ml-auto ${
                            doc.hide_from_client ? 'text-orange-500 font-medium' : 'text-gray-300 hover:text-gray-500'
                          }`}
                        >
                          <IconEye size={11} />
                        </button>
                        <button onClick={() => deleteDocument(doc)} className="text-xs text-red-400 hover:text-red-600"><IconX size={11} /></button>
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
                          <button onClick={() => saveRename(doc)} disabled={renameSaving} className="text-blue-700 px-1"><IconCheck size={14} /></button>
                          <button onClick={() => setRenamingDoc(null)} className="text-gray-400 px-1"><IconX size={14} /></button>
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
                      <button onClick={() => startRename(doc)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-700 border border-gray-200 rounded px-2 py-1" title="Rename">
                        <IconEdit size={11} /> Rename
                      </button>
                      <button onClick={() => downloadDocument(doc)} className="text-blue-700 hover:text-blue-900 text-sm font-medium border border-blue-200 rounded px-2 py-1">
                        Download
                      </button>
                      <button
                        onClick={() => toggleDocHide(doc)}
                        title={doc.hide_from_client ? 'Hidden from client — click to show' : 'Visible to client — click to hide'}
                        className={`inline-flex items-center gap-1 text-xs border rounded px-2 py-1 transition-colors ${
                          doc.hide_from_client
                            ? 'border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100'
                            : 'border-gray-200 text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        <IconEye size={11} />{doc.hide_from_client ? 'Hidden' : 'Visible'}
                      </button>
                      <button onClick={() => deleteDocument(doc)} className="text-red-400 hover:text-red-600"><IconX size={14} /></button>
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
              <div className="flex justify-center mb-2"><IconCalendar size={28} className="text-gray-300" /></div>
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
                        {isOverdue && <><IconAlertTriangle size={11} className="inline mr-0.5" />Overdue · </>}{isDueToday && <><IconBell size={11} className="inline mr-0.5" />Due Today · </>}
                        {new Date(dl.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      {dl.notes && <p className="text-xs text-gray-400 mt-1">{dl.notes}</p>}
                    </div>
                    <button onClick={() => deleteDeadline(dl.id)} className="text-gray-300 hover:text-red-400"><IconX size={14} /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2"><IconLink size={16} /> Client Portal Link</h2>
            <p className="text-sm text-gray-500 mb-4">Share this link with your client. They can view the case status, timeline, and download their documents.</p>
            {portalLink ? (
              <>
                <div className="bg-gray-50 border rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all mb-3">{portalLink}</div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(portalLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                    {copied ? <><IconCheck size={13} className="inline mr-1" />Copied!</> : 'Copy Link'}
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
                <button onClick={closePreview} className="text-gray-400 hover:text-gray-700 px-2"><IconX size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4">
              {previewLoading ? (
                <div className="text-center text-gray-400">
                  <div className="flex justify-center mb-3"><IconClock size={36} className="text-gray-300" /></div>
                  <p className="text-sm">Loading preview...</p>
                </div>
              ) : previewUrl && isImage(previewDoc) ? (
                <img src={previewUrl} alt={previewDoc.file_name} className="max-w-full max-h-full object-contain rounded-lg shadow" />
              ) : previewUrl && isPdf(previewDoc) ? (
                <iframe src={previewUrl} className="w-full h-full min-h-[60vh] rounded-lg" title={previewDoc.file_name} />
              ) : (
                <div className="text-center text-gray-400">
                  <div className="flex justify-center mb-3"><IconFile size={36} className="text-gray-300" /></div>
                  <p className="text-sm">Preview not available.</p>
                  <button onClick={() => downloadDocument(previewDoc)} className="mt-3 text-blue-700 hover:underline text-sm">Download instead</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Case Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <IconAlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Case?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-5">
              <p className="text-sm text-red-700">
                You are about to permanently delete <strong>{caseData.client_name}</strong> ({caseData.file_number}). All timeline entries, documents, and deadlines will be deleted.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={deleteCase}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

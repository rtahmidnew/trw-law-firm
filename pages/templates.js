import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  'All',
  'Legal Opinion',
  'Contract',
  'Court Filing',
  'Demand Notice',
  'Power of Attorney',
  'Affidavit',
  'Agreement',
  'Petition',
  'Correspondence',
  'Other',
]

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(fileType) {
  if (!fileType) return docIcon()
  if (fileType.includes('pdf')) return pdfIcon()
  if (fileType.includes('word') || fileType.includes('docx') || fileType.includes('doc')) return wordIcon()
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('xlsx') || fileType.includes('xls')) return excelIcon()
  if (fileType.includes('presentation') || fileType.includes('powerpoint') || fileType.includes('pptx')) return pptIcon()
  if (fileType.includes('image')) return imgIcon()
  return docIcon()
}

function pdfIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
      <line x1="9" y1="11" x2="15" y2="11"/>
    </svg>
  )
}
function wordIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 13l1.5 4 1.5-4 1.5 4 1.5-4"/>
    </svg>
  )
}
function excelIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="11" x2="15" y2="17"/>
      <line x1="15" y1="11" x2="9" y2="17"/>
    </svg>
  )
}
function pptIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <rect x="9" y="11" width="6" height="5" rx="1"/>
    </svg>
  )
}
function imgIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
}
function docIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

export default function TemplatesPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)

  const [profile, setProfile] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // template id to delete
  const [deleting, setDeleting] = useState(false)

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    category: 'Other',
    file: null,
  })

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (!prof) { router.push('/'); return }
      setProfile({ ...prof, uid: session.user.id })
      await loadTemplates()
    }
    init()
  }, [])

  async function loadTemplates() {
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setTemplates(data)
    setLoading(false)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!uploadForm.file) { setUploadError('Please select a file.'); return }
    if (!uploadForm.name.trim()) { setUploadError('Please enter a template name.'); return }
    setUploading(true)
    setUploadError('')

    const file = uploadForm.file
    const ext = file.name.split('.').pop()
    const storagePath = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    // Upload to storage
    const { error: storageErr } = await supabase.storage
      .from('templates')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false })

    if (storageErr) {
      setUploadError('Upload failed: ' + storageErr.message)
      setUploading(false)
      return
    }

    // Insert record
    const { error: dbErr } = await supabase
      .from('templates')
      .insert({
        name: uploadForm.name.trim(),
        description: uploadForm.description.trim() || null,
        category: uploadForm.category,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
        uploaded_by: profile.uid,
        uploader_name: profile.full_name,
      })

    if (dbErr) {
      // Clean up storage if db insert fails
      await supabase.storage.from('templates').remove([storagePath])
      setUploadError('Failed to save template: ' + dbErr.message)
      setUploading(false)
      return
    }

    setUploading(false)
    setShowUploadModal(false)
    setUploadForm({ name: '', description: '', category: 'Other', file: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
    await loadTemplates()
  }

  async function handleDownload(template) {
    const { data, error } = await supabase.storage
      .from('templates')
      .createSignedUrl(template.storage_path, 60)
    if (error || !data?.signedUrl) {
      alert('Could not generate download link. Please try again.')
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = template.file_name
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleDelete(template) {
    setDeleting(true)
    // Remove from storage
    await supabase.storage.from('templates').remove([template.storage_path])
    // Remove from DB
    await supabase.from('templates').delete().eq('id', template.id)
    setDeleteConfirm(null)
    setDeleting(false)
    await loadTemplates()
  }

  const canDelete = (template) => {
    if (!profile) return false
    if (profile.role === 'partner') return true
    return template.uploaded_by === profile.uid
  }

  // Filter templates
  const filtered = templates.filter(t => {
    const matchSearch = !search.trim() ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.file_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.uploader_name || '').toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'All' || t.category === activeCategory
    return matchSearch && matchCategory
  })

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
            <p className="text-sm text-gray-500 mt-0.5">Shared team library — upload and find document templates</p>
          </div>
          <button
            onClick={() => { setShowUploadModal(true); setUploadError('') }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#0d1b2a' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Upload Template
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search templates by name, category, description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeCategory === cat
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates list */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading templates...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <svg className="mx-auto mb-3 text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-gray-400 text-sm">
              {search || activeCategory !== 'All'
                ? 'No templates match your search.'
                : 'No templates yet. Upload the first one!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-gray-200 transition-colors">
                {/* File icon */}
                <div className="flex-shrink-0">
                  {fileIcon(t.file_type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{t.name}</span>
                    {t.category && t.category !== 'Other' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{t.category}</span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{t.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{t.file_name}</span>
                    {t.file_size && <span className="text-xs text-gray-400">{formatBytes(t.file_size)}</span>}
                    <span className="text-xs text-gray-400">
                      Uploaded by {t.uploader_name || 'Team'} · {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                  </button>
                  {canDelete(t) && (
                    <button
                      onClick={() => setDeleteConfirm(t)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete template"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && templates.length > 0 && (
          <p className="text-xs text-gray-400 mt-4">
            {filtered.length === templates.length
              ? `${templates.length} template${templates.length !== 1 ? 's' : ''} total`
              : `${filtered.length} of ${templates.length} templates`}
          </p>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Upload Template</h2>
              <button
                onClick={() => { setShowUploadModal(false); setUploadError('') }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpload} className="px-6 py-5 space-y-4">
              {/* File picker */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">File <span className="text-red-500">*</span></label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.ods,.odp,.png,.jpg,.jpeg"
                  onChange={e => {
                    const file = e.target.files[0]
                    if (file) {
                      setUploadForm(prev => ({
                        ...prev,
                        file,
                        name: prev.name || file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
                      }))
                    }
                  }}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />
                <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, PowerPoint, images — max 50 MB</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Template Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={e => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Legal Opinion — Commercial Dispute"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={uploadForm.category}
                  onChange={e => setUploadForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
                <textarea
                  value={uploadForm.description}
                  onChange={e => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this template is for..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                />
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{uploadError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setUploadError('') }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
                  style={{ backgroundColor: '#0d1b2a' }}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-6 py-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete Template?</h2>
            <p className="text-sm text-gray-500 mb-5">
              <strong className="text-gray-800">{deleteConfirm.name}</strong> will be permanently deleted and cannot be recovered.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

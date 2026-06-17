import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { IconGlobe, IconLock } from '../../components/Icons'

const CASE_TYPES = [
  'Corporate / Commercial',
  'Civil Litigation',
  'Criminal',
  'Family Law',
  'Property / Real Estate',
  'Labour & Employment',
  'Constitutional & Administrative',
  'Banking & Finance',
  'Intellectual Property',
  'Tax',
  'Other',
]

export default function NewCase() {
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    file_type: 'chamber',
    file_number: '',
    client_name: '',
    client_contact: '',
    case_type: '',
    opposing_party: '',
    court_name: '',
    court_case_number: '',
    status: 'open',
    is_public: true,
  })

  useEffect(() => {
    async function getUser() {
      const { data: { session: _sess } } = await supabase.auth.getSession(); const user = _sess?.user
      if (!user) { router.push('/'); return }
      setUserId(user.id)
    }
    getUser()
  }, [])

  function handleChange(e) {
    let value = e.target.value
    // Auto-expand 2-digit years in file_number: PREFIX-YY-REST → PREFIX-20YY-REST
    if (e.target.name === 'file_number') {
      value = value.replace(/^([A-Za-z]+-)(2[0-9])(-)/,
        (_, prefix, yy, dash) => `${prefix}20${yy}${dash}`)
    }
    setForm(prev => ({ ...prev, [e.target.name]: value }))
  }

  function setFileType(type) {
    setForm(prev => ({
      ...prev,
      file_type: type,
      // Clear court fields when switching to non-court
      ...(type !== 'court' ? { court_name: '', court_case_number: '' } : {}),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.client_name || !form.case_type) {
      setError('Client name and case type are required.')
      return
    }
    setSaving(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('cases')
      .insert({ ...form, assigned_to: userId })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    router.push(`/cases/${data.id}`)
  }

  const isChamber = form.file_type === 'chamber'
  const isCourt = form.file_type === 'court'
  const isTemp = form.file_type === 'temporary'

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-700 mb-6"
        >
          ← Back
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-6">Open New Case File</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Filing Type Selector */}
            <div className="border-b border-gray-100 pb-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Filing Type</h2>
              <div className="flex gap-3">
                {/* Chamber File */}
                <button
                  type="button"
                  onClick={() => setFileType('chamber')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 px-4 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    isChamber
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-800'
                      : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isChamber ? 'text-gray-900' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l9-4 9 4M3 6v12l9 4 9-4V6M12 2v20M3 12h18" /></svg>
                  <span>Chamber File</span>
                  <span className="text-xs font-normal text-gray-400">Advisory, drafting, long-term</span>
                </button>
                {/* Temporary File */}
                <button
                  type="button"
                  onClick={() => setFileType('temporary')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 px-4 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    isTemp
                      ? 'bg-amber-50 border-amber-600 text-amber-800'
                      : 'border-gray-200 text-gray-500 hover:border-amber-300 hover:bg-amber-50/50'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isTemp ? 'text-gray-900' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>Temporary File</span>
                  <span className="text-xs font-normal text-gray-400">Tax, divorce, affidavit, short-term</span>
                </button>
                {/* Court File */}
                <button
                  type="button"
                  onClick={() => setFileType('court')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 px-4 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    isCourt
                      ? 'bg-teal-50 border-teal-600 text-teal-800'
                      : 'border-gray-200 text-gray-500 hover:border-teal-300 hover:bg-teal-50/50'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isCourt ? 'text-gray-900' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11" /></svg>
                  <span>Court File</span>
                  <span className="text-xs font-normal text-gray-400">Litigation, court proceedings</span>
                </button>
              </div>
              {isChamber && (
                <p className="mt-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
                  Chamber File — long-term advisory and drafting matters. File number format: TRW-YYYY-001 to TRW-YYYY-099.
                </p>
              )}
              {isTemp && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Temporary File — short-duration matters (tax returns, divorce, affidavits, translations). File number format: TRW-YYYY-100+.
                </p>
              )}
              {isCourt && (
                <p className="mt-2 text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2">
                  Court File — requires court name and court case number. Hearing dates managed in Case Diary.
                </p>
              )}
            </div>

            {/* Client info */}
            <div className="border-b border-gray-100 pb-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Client Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="client_name"
                    value={form.client_name}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Rahman Enterprises Ltd."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Contact (phone or email)
                  </label>
                  <input
                    name="client_contact"
                    value={form.client_contact}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. +880-1700-000000"
                  />
                </div>
              </div>
            </div>

            {/* Case info */}
            <div className="border-b border-gray-100 pb-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Case Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Case Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="case_type"
                    value={form.case_type}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select type...</option>
                    {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal File Number
                  </label>
                  <input
                    name="file_number"
                    value={form.file_number}
                    onChange={handleChange}
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                      isChamber ? 'border-indigo-200 focus:ring-indigo-500 bg-indigo-50/30'
                      : isTemp ? 'border-amber-200 focus:ring-amber-500 bg-amber-50/30'
                      : 'border-teal-200 focus:ring-teal-500 bg-teal-50/30'
                    }`}
                    placeholder={isTemp ? 'e.g. TRW-2026-101' : 'e.g. TRW-2026-001'}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opposing Party
                  </label>
                  <input
                    name="opposing_party"
                    value={form.opposing_party}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Name of opposing party (if applicable)"
                  />
                </div>
              </div>
            </div>

            {/* Court info — only for court filings */}
            {isCourt && (
              <div className="border-b border-gray-100 pb-5">
                <h2 className="text-sm font-semibold text-teal-600 uppercase tracking-wide mb-3">Court Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Court Name</label>
                    <input
                      name="court_name"
                      value={form.court_name}
                      onChange={handleChange}
                      className="w-full border border-teal-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-teal-50/30"
                      placeholder="e.g. High Court Division, Dhaka"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Court Case Number</label>
                    <input
                      name="court_case_number"
                      value={form.court_case_number}
                      onChange={handleChange}
                      className="w-full border border-teal-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-teal-50/30"
                      placeholder="Official court case number"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Hearing dates and next steps are managed in the Case Diary section.</p>
              </div>
            )}

            {/* Status + Visibility */}
            <div className="border-b border-gray-100 pb-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Case Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, is_public: true }))}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        form.is_public
                          ? 'bg-gray-100 border-gray-500 text-gray-800 ring-2 ring-gray-400'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <IconGlobe size={14} /> Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, is_public: false }))}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        !form.is_public
                          ? 'bg-gray-100 border-gray-500 text-gray-800 ring-2 ring-gray-400'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <IconLock size={14} /> Private
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {form.is_public
                      ? 'All firm members can view this case.'
                      : 'Only you and partners can view this case.'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`w-full text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 ${
                isCourt
                  ? 'bg-teal-700 hover:bg-teal-800'
                  : 'bg-indigo-700 hover:bg-indigo-800'
              }`}
            >
              {saving ? 'Creating case...' : `Create ${isCourt ? 'Court' : 'Chamber'} File`}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

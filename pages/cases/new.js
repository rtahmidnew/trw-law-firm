import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

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
    file_number: '',
    client_name: '',
    client_contact: '',
    case_type: '',
    opposing_party: '',
    court_name: '',
    court_case_number: '',
    status: 'open',
  })

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)
    }
    getUser()
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. TRW-2025-001"
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

            {/* Court info */}
            <div className="border-b border-gray-100 pb-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Court Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Court Name</label>
                  <input
                    name="court_name"
                    value={form.court_name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. High Court Division, Dhaka"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Court Case Number</label>
                  <input
                    name="court_case_number"
                    value={form.court_case_number}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Official court case number"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initial Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? 'Creating case...' : 'Create Case File'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

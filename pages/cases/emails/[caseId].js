import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import Head from 'next/head';
import Link from 'next/link';

export default function CaseEmails() {
  const router = useRouter();
  const { caseId } = router.query;

  const [user, setUser] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [linkedEmails, setLinkedEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    subject: '',
    from_email: '',
    from_name: '',
    snippet: '',
    thread_date: new Date().toISOString().split('T')[0],
    has_attachment: false,
    gmail_thread_id: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return; }
      setUser(user);
    });
  }, []);

  useEffect(() => {
    if (caseId && user) fetchData();
  }, [caseId, user]);

  async function fetchData() {
    setLoading(true);
    const [{ data: c }, { data: emails }] = await Promise.all([
      supabase.from('cases').select('*').eq('id', caseId).single(),
      supabase.from('email_threads').select('*').eq('case_id', caseId).order('thread_date', { ascending: false }),
    ]);
    setCaseData(c);
    setLinkedEmails(emails || []);
    setLoading(false);
  }

  async function linkEmail() {
    if (!form.subject || !form.from_email) return;
    setSaving(true);
    const { error } = await supabase.from('email_threads').insert({
      case_id: caseId,
      user_id: user.id,
      gmail_thread_id: form.gmail_thread_id || `manual-${Date.now()}`,
      subject: form.subject,
      from_email: form.from_email,
      from_name: form.from_name,
      snippet: form.snippet,
      thread_date: form.thread_date ? new Date(form.thread_date).toISOString() : new Date().toISOString(),
      has_attachment: form.has_attachment,
    });
    setSaving(false);
    if (!error) {
      setForm({ subject: '', from_email: '', from_name: '', snippet: '', thread_date: new Date().toISOString().split('T')[0], has_attachment: false, gmail_thread_id: '' });
      setShowLinkForm(false);
      await fetchData();
    }
  }

  async function deleteEmail(id) {
    if (!confirm('Remove this email from the case?')) return;
    await supabase.from('email_threads').delete().eq('id', id);
    await fetchData();
  }

  function openInGmail(threadId) {
    if (threadId && !threadId.startsWith('manual-')) {
      window.open(`https://mail.google.com/mail/u/0/#inbox/${threadId}`, '_blank');
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Emails — {caseData?.client_name} — TRW</title></Head>

      <div className="bg-white border-b px-6 py-4 flex items-center gap-4 shadow-sm">
        <Link href={`/cases/${caseId}`} className="text-sm text-gray-500 hover:text-gray-800">← Back to Case</Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Email Threads — {caseData?.client_name}</h1>
          <p className="text-xs text-gray-400">{linkedEmails.length} linked email thread{linkedEmails.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowLinkForm(true)} className="ml-auto bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          + Link Email Thread
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <strong>Gmail Integration</strong> — Link email threads from info@trfirm.com to this case.
          Linked emails appear here and in the case timeline for a complete record of client communications.
          <br />
          <span className="text-blue-600 text-xs mt-1 block">
            To link: Open the Gmail thread, copy the thread ID from the URL (the long code after #inbox/), then paste it below.
          </span>
        </div>

        {showLinkForm && (
          <div className="bg-white rounded-lg border p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Link Email Thread</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Email Subject *</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Re: Contract Review — Atlas HXM" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">From Email *</label>
                <input value={form.from_email} onChange={e => setForm(f => ({ ...f, from_email: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="client@company.com" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">From Name</label>
                <input value={form.from_name} onChange={e => setForm(f => ({ ...f, from_name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="John Smith" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Thread Date</label>
                <input type="date" value={form.thread_date} onChange={e => setForm(f => ({ ...f, thread_date: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Gmail Thread ID (optional)</label>
                <input value={form.gmail_thread_id} onChange={e => setForm(f => ({ ...f, gmail_thread_id: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm font-mono" placeholder="FMfcgzQgLXv..." />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Email Snippet / Summary</label>
                <textarea value={form.snippet} onChange={e => setForm(f => ({ ...f, snippet: e.target.value }))}
                  rows={2} className="w-full border rounded px-3 py-2 text-sm" placeholder="Brief summary of what this email thread is about..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="has_attachment" checked={form.has_attachment}
                  onChange={e => setForm(f => ({ ...f, has_attachment: e.target.checked }))} className="rounded" />
                <label htmlFor="has_attachment" className="text-sm text-gray-600">Has attachments</label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={linkEmail} disabled={saving || !form.subject || !form.from_email}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Linking...' : 'Link Thread'}
              </button>
              <button onClick={() => setShowLinkForm(false)} className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}

        {linkedEmails.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <div className="text-4xl mb-3 text-gray-300" style={{fontSize:36}}>&#9993;</div>
            <p className="text-gray-500 mb-4">No email threads linked to this case yet.</p>
            <button onClick={() => setShowLinkForm(true)} className="bg-blue-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-700">
              Link First Email Thread
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedEmails.map(email => (
              <div key={email.id} className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-600 flex-shrink-0 mt-0.5">
                    {email.from_name ? email.from_name[0].toUpperCase() : email.from_email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-sm truncate">{email.subject}</span>
                      {email.has_attachment && <span className="text-gray-400 text-xs"></span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
                    </div>
                    {email.snippet && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{email.snippet}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-gray-400">
                      {email.thread_date ? new Date(email.thread_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </div>
                    <div className="flex gap-1 mt-2 justify-end">
                      {email.gmail_thread_id && !email.gmail_thread_id.startsWith('manual-') && (
                        <button onClick={() => openInGmail(email.gmail_thread_id)}
                          className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">
                          Open in Gmail
                        </button>
                      )}
                      <button onClick={() => deleteEmail(email.id)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded hover:bg-gray-200">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

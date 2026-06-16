import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabase';

export default function ClientPortal() {
  const router = useRouter();
  const { token } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [caseData, setCase] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [nextHearing, setNextHearing] = useState(null);

  useEffect(() => {
    if (token) fetchPortalData();
  }, [token]);

  async function fetchPortalData() {
    setLoading(true);

    // Look up the token
    const { data: portalToken, error: tokenError } = await supabase
      .from('client_portal_tokens')
      .select('*, cases(*)')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !portalToken) {
      setError('This portal link is invalid or has been deactivated.');
      setLoading(false);
      return;
    }

    // Check expiry
    if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) {
      setError('This portal link has expired. Please contact your lawyer for a new link.');
      setLoading(false);
      return;
    }

    const c = portalToken.cases;
    setCase(c);

    // Fetch timeline entries — exclude hidden ones
    const { data: tl } = await supabase
      .from('timeline_entries')
      .select('*')
      .eq('case_id', c.id)
      .eq('hide_from_client', false)
      .order('entry_date', { ascending: true, nullsFirst: false });
    setTimeline(tl || []);

    // Fetch documents — exclude hidden ones
    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('case_id', c.id)
      .eq('hide_from_client', false)
      .order('uploaded_at', { ascending: false });
    setDocuments(docs || []);

    // Fetch final invoices
    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('case_id', c.id)
      .eq('status', 'final')
      .order('created_at', { ascending: false });
    setInvoices(inv || []);

    // Fetch next hearing date from case_diary via linked_case_id
    const { data: diaryEntry } = await supabase
      .from('case_diary')
      .select('next_date, next_step, parties, case_no, court')
      .eq('linked_case_id', c.id)
      .not('next_date', 'is', null)
      .order('next_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    setNextHearing(diaryEntry || null);

    setLoading(false);
  }

  async function downloadDocument(doc) {
    const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function getDaysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00');
    return Math.round((d - today) / (1000 * 60 * 60 * 24));
  }

  const statusColor = {
    open: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    closed: 'bg-gray-100 text-gray-600 border border-gray-200',
    pending: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Loading your case portal...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-10 max-w-md text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-400"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-4">TRW Law Firm · info@trfirm.com</p>
      </div>
    </div>
  );

  const hearingDays = nextHearing ? getDaysUntil(nextHearing.next_date) : null;

  return (
    <>
      <Head>
        <title>Case Portal — TRW Law Firm</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div style={{ background: '#0d1b2a' }} className="text-white px-4 sm:px-6 py-4 flex items-center gap-4">
          <img src="/trw-logo.webp" alt="TRW" className="h-8" onError={e => { e.target.style.display='none'; }} />
          <div className="ml-2">
            <div className="font-semibold text-sm">Client Case Portal</div>
            <div className="text-xs text-gray-400">Tahmidur Remura Wahid — TRW Law Firm</div>
          </div>
          <div className="ml-auto text-xs text-gray-400 hidden sm:block">Secure · Read-only</div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-5">

          {/* ── Case Header ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{caseData.client_name}</h1>
                <p className="text-gray-600 font-medium mt-1 text-sm">{caseData.case_type}</p>
              </div>
              <span className={`self-start px-3 py-1 rounded-full text-sm font-medium capitalize ${statusColor[caseData.status] || 'bg-gray-100 text-gray-600'}`}>
                {caseData.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {caseData.file_number && (
                <div className="flex gap-2"><span className="text-gray-400 shrink-0">File No.</span><span className="font-medium text-gray-800 font-mono">{caseData.file_number}</span></div>
              )}
              {caseData.court_name && (
                <div className="flex gap-2"><span className="text-gray-400 shrink-0">Court</span><span className="font-medium text-gray-800">{caseData.court_name}</span></div>
              )}
              {caseData.court_case_number && (
                <div className="flex gap-2"><span className="text-gray-400 shrink-0">Court Case No.</span><span className="font-medium text-gray-800">{caseData.court_case_number}</span></div>
              )}
              {caseData.opposing_party && (
                <div className="flex gap-2"><span className="text-gray-400 shrink-0">Opposing Party</span><span className="font-medium text-gray-800">{caseData.opposing_party}</span></div>
              )}
              <div className="flex gap-2"><span className="text-gray-400 shrink-0">Opened</span><span className="font-medium text-gray-800">{new Date(caseData.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            </div>
          </div>

          {/* ── Next Hearing Date ── */}
          {nextHearing && (
            <div className={`rounded-xl border p-5 sm:p-6 ${
              hearingDays === 0
                ? 'bg-red-50 border-red-200'
                : hearingDays !== null && hearingDays <= 3
                ? 'bg-orange-50 border-orange-200'
                : hearingDays !== null && hearingDays <= 7
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-white border-gray-200 shadow-sm'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  hearingDays === 0 ? 'bg-red-100' : hearingDays !== null && hearingDays <= 3 ? 'bg-orange-100' : hearingDays !== null && hearingDays <= 7 ? 'bg-yellow-100' : 'bg-gray-100'
                }`}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className={hearingDays === 0 ? 'text-red-600' : hearingDays !== null && hearingDays <= 3 ? 'text-orange-600' : hearingDays !== null && hearingDays <= 7 ? 'text-yellow-600' : 'text-gray-600'}>
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="font-semibold text-gray-800 text-sm">Next Hearing Date</h2>
                    {hearingDays === 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Today</span>}
                    {hearingDays !== null && hearingDays > 0 && hearingDays <= 3 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">In {hearingDays} day{hearingDays !== 1 ? 's' : ''}</span>}
                    {hearingDays !== null && hearingDays > 3 && hearingDays <= 7 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">In {hearingDays} days</span>}
                    {hearingDays !== null && hearingDays > 7 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">In {hearingDays} days</span>}
                    {hearingDays !== null && hearingDays < 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Past date</span>}
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatDate(nextHearing.next_date)}</p>
                  {nextHearing.next_step && (
                    <p className="text-sm text-gray-600 mt-1"><span className="text-gray-400">Next step:</span> {nextHearing.next_step}</p>
                  )}
                  {nextHearing.court && (
                    <p className="text-sm text-gray-500 mt-0.5">{nextHearing.court}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Timeline ── */}
          {timeline.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
              <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2 text-sm">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-500"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Case Timeline
              </h2>
              <div className="relative">
                <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-gray-100" />
                <div className="space-y-4 pl-8">
                  {timeline.map((entry) => (
                    <div key={entry.id} className="relative">
                      <div className="absolute -left-5.5 top-3 w-2.5 h-2.5 rounded-full bg-gray-800 border-2 border-white shadow-sm" style={{ left: '-1.375rem' }} />
                      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 sm:p-4">
                        <div
                          className="text-sm text-gray-800 leading-relaxed rich-content"
                          dangerouslySetInnerHTML={{ __html: entry.entry_text }}
                        />
                        {entry.entry_date && (
                          <p className="text-xs text-gray-400 mt-2 font-medium">
                            {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Documents ── */}
          {documents.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-500"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Documents
                <span className="ml-auto text-xs text-gray-400 font-normal">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
              </h2>
              <div className="space-y-2">
                {documents.map(doc => {
                  const ext = doc.file_name?.split('.').pop()?.toUpperCase() || 'FILE';
                  const extColors = {
                    PDF: 'bg-red-100 text-red-700',
                    DOC: 'bg-blue-100 text-blue-700', DOCX: 'bg-blue-100 text-blue-700',
                    XLS: 'bg-emerald-100 text-emerald-700', XLSX: 'bg-emerald-100 text-emerald-700',
                    JPG: 'bg-purple-100 text-purple-700', JPEG: 'bg-purple-100 text-purple-700',
                    PNG: 'bg-purple-100 text-purple-700',
                  };
                  const extColor = extColors[ext] || 'bg-gray-100 text-gray-600';
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${extColor}`}>
                        {ext.length > 4 ? ext.slice(0, 4) : ext}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                        <p className="text-xs text-gray-400">
                          {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB · ` : ''}
                          {new Date(doc.uploaded_at || doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Invoices ── */}
          {invoices.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-500"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                Invoices
              </h2>
              <div className="space-y-2">
                {invoices.map(inv => {
                  const items = inv.line_items || [];
                  const subtotal = items.reduce((s, i) => s + (parseFloat(i.govt_cost) || 0) + (parseFloat(i.professional_fee) || 0), 0);
                  const ait = items.reduce((s, i) => s + (parseFloat(i.professional_fee) || 0), 0) * ((inv.ait_percentage ?? 10) / 100);
                  const total = subtotal + ait;
                  const sym = inv.currency === 'USD' ? '$' : inv.currency === 'BDT' ? '৳' : inv.currency === 'EUR' ? '€' : inv.currency;
                  return (
                    <div key={inv.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-xs font-bold text-gray-500 bg-gray-200 rounded px-2 py-1">INV</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{inv.invoice_number}</p>
                        <p className="text-xs text-gray-400">{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</p>
                      </div>
                      <div className="font-bold text-gray-800 text-sm">{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {timeline.length === 0 && documents.length === 0 && invoices.length === 0 && !nextHearing && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-400">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mx-auto mb-3 text-gray-300"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p className="text-sm">No updates have been added to your case yet.</p>
              <p className="text-xs mt-1">Check back later or contact your lawyer.</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 pb-6">
            <p>This is a secure, read-only client portal provided by TRW Law Firm.</p>
            <p className="mt-1">Questions? Contact us at <a href="mailto:info@trfirm.com" className="text-gray-600 underline">info@trfirm.com</a></p>
          </div>
        </div>
      </div>
    </>
  );
}

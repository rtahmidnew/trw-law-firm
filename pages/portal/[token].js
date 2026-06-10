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

    // Fetch timeline entries (public-friendly)
    const { data: tl } = await supabase
      .from('timeline_entries')
      .select('*')
      .eq('case_id', c.id)
      .order('created_at', { ascending: true });
    setTimeline(tl || []);

    // Fetch documents
    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('case_id', c.id)
      .order('created_at', { ascending: false });
    setDocuments(docs || []);

    // Fetch final invoices
    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('case_id', c.id)
      .eq('status', 'final')
      .order('created_at', { ascending: false });
    setInvoices(inv || []);

    setLoading(false);
  }

  async function downloadDocument(doc) {
    const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  const statusColor = {
    open: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
    pending: 'bg-yellow-100 text-yellow-700',
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700 mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Loading your case portal...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-10 max-w-md text-center">
        <div className="text-5xl mb-4 text-gray-300">&#9632;</div>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-4">TRW Law Firm · info@trfirm.com</p>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>Case Portal — TRW Law Firm</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div style={{ background: '#0d1b2a' }} className="text-white px-6 py-4 flex items-center gap-4">
          <img src="/trw-logo.webp" alt="TRW" className="h-8" onError={e => { e.target.style.display='none'; }} />
          <div className="ml-2">
            <div className="font-semibold text-sm">Client Case Portal</div>
            <div className="text-xs text-gray-400">Tahmidur Remura Wahid — TRW Law Firm</div>
          </div>
          <div className="ml-auto text-xs text-gray-400">Secure · Read-only</div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {/* Case header */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{caseData.client_name}</h1>
                <p className="text-green-700 font-medium mt-1">{caseData.case_type}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${statusColor[caseData.status] || 'bg-gray-100 text-gray-600'}`}>
                {caseData.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {caseData.file_number && (
                <div><span className="text-gray-400">File No.</span> <span className="font-medium">{caseData.file_number}</span></div>
              )}
              {caseData.court_name && (
                <div><span className="text-gray-400">Court</span> <span className="font-medium">{caseData.court_name}</span></div>
              )}
              {caseData.court_case_number && (
                <div><span className="text-gray-400">Court Case No.</span> <span className="font-medium">{caseData.court_case_number}</span></div>
              )}
              {caseData.opposing_party && (
                <div><span className="text-gray-400">Opposing Party</span> <span className="font-medium">{caseData.opposing_party}</span></div>
              )}
              <div><span className="text-gray-400">Opened</span> <span className="font-medium">{new Date(caseData.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            </div>
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                Case Timeline
              </h2>
              <div className="space-y-3">
                {timeline.map((entry, i) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-600 mt-1.5 flex-shrink-0"></div>
                      {i < timeline.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 mt-1"></div>}
                    </div>
                    <div className="pb-3 flex-1">
                      <p className="text-sm text-gray-700">{entry.entry_text}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                Documents
              </h2>
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center text-xs font-bold text-red-600">
                      {doc.file_name?.split('.').pop()?.toUpperCase() || 'FILE'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                      <p className="text-xs text-gray-400">{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB · ` : ''}{new Date(doc.created_at).toLocaleDateString('en-GB')}</p>
                    </div>
                    <button onClick={() => downloadDocument(doc)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex-shrink-0">
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {invoices.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
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
                    <div key={inv.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-bold text-gray-500 bg-gray-100 rounded px-1">INV</div>
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

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 pb-6">
            <p>This is a secure, read-only client portal provided by TRW Law Firm.</p>
            <p className="mt-1">Questions? Contact us at <a href="mailto:info@trfirm.com" className="text-green-700">info@trfirm.com</a></p>
          </div>
        </div>
      </div>
    </>
  );
}

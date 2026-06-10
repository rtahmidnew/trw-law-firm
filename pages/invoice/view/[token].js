import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../../lib/supabase';

const TRW_DARK = 'rgb(13, 27, 42)';
const TRW_BLUE = '#1d4ed8';

export default function PublicInvoiceView() {
  const router = useRouter();
  const { token } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inv, setInv] = useState(null);
  const [caseData, setCaseData] = useState(null);

  useEffect(() => {
    if (token) fetchInvoice();
  }, [token]);

  async function fetchInvoice() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('invoices')
      .select('*, cases(client_name, file_number, case_type)')
      .eq('public_token', token)
      .single();

    if (err || !data) {
      setError('This invoice link is invalid or has been removed. Please contact TRW Law Firm.');
      setLoading(false);
      return;
    }
    setInv(data);
    setCaseData(data.cases);
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: 14 }}>Loading invoice...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
          <img src="/trw-logo.webp" alt="TRW" style={{ height: 40, marginBottom: 24 }} />
          <div style={{ fontSize: 16, color: '#111827', fontWeight: 600, marginBottom: 8 }}>Invoice Not Found</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{error}</div>
          <div style={{ marginTop: 20, fontSize: 12, color: '#9ca3af' }}>
            <a href="https://trwbd.com" style={{ color: TRW_BLUE }}>trwbd.com</a> · info@trfirm.com
          </div>
        </div>
      </div>
    );
  }

  const items = inv.line_items || [];
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.govt_cost) || 0) + (parseFloat(i.professional_fee) || 0), 0);
  const aitBase = items.reduce((s, i) => s + (parseFloat(i.professional_fee) || 0), 0);
  const ait = aitBase * ((inv.ait_percentage ?? 10) / 100);
  const total = subtotal + ait;
  const sym = inv.currency === 'USD' ? '$' : inv.currency === 'BDT' ? '৳' : inv.currency === 'EUR' ? '€' : inv.currency === 'GBP' ? '£' : inv.currency === 'SGD' ? 'S$' : (inv.currency || '$');

  const retainerPct = inv.payment_schedule?.retainer || 50;
  const deliveryPct = inv.payment_schedule?.delivery || 50;
  const retainerAmt = total * (retainerPct / 100);
  const deliveryAmt = total * (deliveryPct / 100);

  const iconMail = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
  const iconPhone = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.6 4.9 2 2 0 0 1 3.57 2.72h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.4a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 17.8z"/></svg>;
  const iconGlobe = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
  const iconPin = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>;

  return (
    <>
      <Head>
        <title>Invoice {inv.invoice_number} — TRW Law Firm</title>
        <meta name="robots" content="noindex, nofollow" />
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { margin: 0; }
            .print-page { box-shadow: none !important; margin: 0 !important; }
          }
        `}</style>
      </Head>

      {/* Top bar */}
      <div className="no-print" style={{ background: TRW_DARK, padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/trw-logo-white.webp" alt="TRW" style={{ height: 28 }} onError={e => { e.target.style.display='none'; }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Client Invoice Verification Portal</span>
        </div>
        <button onClick={() => window.print()} style={{ background: TRW_BLUE, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          Print / Save PDF
        </button>
      </div>

      {/* Verification notice */}
      <div className="no-print" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#166534' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <strong>Verified Official Invoice</strong> — This invoice was officially generated from the TRW Law Firm case management system at <a href="https://trw.ac" style={{ color: '#166534', fontWeight: 600 }}>trw.ac</a>. Invoice No: <strong>{inv.invoice_number}</strong>
      </div>

      {/* Invoice document */}
      <div style={{ background: '#f1f5f9', padding: '24px 16px', minHeight: '80vh' }}>
        <div className="print-page" style={{ background: '#fff', maxWidth: 860, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', fontFamily: 'Arial, sans-serif' }}>

          {/* ── HEADER ── */}
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ background: TRW_DARK, flex: 1, padding: '28px 32px', color: '#fff' }}>
              <img src="/trw-logo.webp" alt="TRW" style={{ height: 36, marginBottom: 10, filter: 'brightness(0) invert(1)' }} onError={e => { e.target.style.display='none'; }} />
              <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.55)', marginBottom: 10, textTransform: 'uppercase' }}>Tahmidur Remura Wahid</div>
              <div style={{ fontSize: 11, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)' }}>
                <strong style={{ color: '#fff', fontSize: 12 }}>Tahmidur Remura Wahid — TRW Law Firm</strong><br />
                House 410, Road 29, Mohakhali New DOHS<br />
                Dhaka 1206, Bangladesh<br />
                Tel: +8801708-000660<br />
                Email: info@trfirm.com<br />
                Web: trwbd.com
              </div>
            </div>
            <div style={{ background: 'rgba(13,27,42,0.85)', minWidth: 200, padding: '28px 28px', color: '#fff', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>INVOICE</div>
              <div style={{ fontSize: 11, lineHeight: 2, color: 'rgba(255,255,255,0.85)' }}>
                No: <strong style={{ color: '#fff' }}>{inv.invoice_number}</strong><br />
                Date: <strong style={{ color: '#fff' }}>{new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong><br />
                Ref: <strong style={{ color: '#fff' }}>{inv.matter_reference || caseData?.file_number || '—'}</strong>
              </div>
            </div>
          </div>

          {/* ── BILL TO ── */}
          <div style={{ padding: '20px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: '#f8fafc', borderRadius: 6, padding: '14px 16px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginBottom: 6 }}>Bill To</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{inv.to_name}</div>
              {inv.attention && inv.attention !== inv.to_name && (
                <div style={{ fontSize: 11, color: '#6b7280' }}>Attn: {inv.attention}</div>
              )}
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 6, padding: '14px 16px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginBottom: 6 }}>Matter</div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
                <div><strong>Reference:</strong> {inv.matter_reference || '—'}</div>
                <div><strong>Description:</strong> {inv.project_description || '—'}</div>
              </div>
            </div>
          </div>

          {/* ── LINE ITEMS TABLE ── */}
          <div style={{ padding: '0 32px 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: TRW_DARK, color: '#fff' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, width: 32 }}>Sl.</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Description of Services</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 110 }}>Govt. Cost ({sym})</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 130 }}>Professional Fee ({sym})</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '9px 10px', color: '#6b7280' }}>{item.sl || idx + 1}</td>
                    <td style={{ padding: '9px 10px', color: '#111827' }}>{item.description}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151' }}>{sym}{(parseFloat(item.govt_cost) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151' }}>{sym}{(parseFloat(item.professional_fee) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Sub-Total</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{sym}{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ padding: '4px 10px', textAlign: 'right', fontSize: 11, color: '#6b7280' }}>AIT ({inv.ait_percentage ?? 10}% on Professional Fee)</td>
                  <td style={{ padding: '4px 10px', textAlign: 'right', color: '#374151' }}>{sym}{ait.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style={{ background: TRW_DARK }}>
                  <td colSpan={3} style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 12 }}>Grand Total</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#fff', fontSize: 14 }}>{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── PAYMENT SCHEDULE ── */}
          <div style={{ padding: '0 32px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f8fafc', borderRadius: 6, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginBottom: 4 }}>Retainer ({retainerPct}%)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: TRW_DARK }}>{sym}{retainerAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Due upon engagement</div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 6, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginBottom: 4 }}>On Delivery ({deliveryPct}%)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: TRW_DARK }}>{sym}{deliveryAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Due upon completion</div>
            </div>
          </div>

          {/* ── PAYMENT INSTRUCTIONS ── */}
          <div style={{ padding: '0 32px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 8, textDecoration: 'underline' }}>Payment Instructions:</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #d1d5db' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#111827', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db' }}>Bangladesh Account</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#111827', borderBottom: '1px solid #d1d5db' }}>Other Accepted Methods</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #d1d5db', lineHeight: 1.9 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Account Details—</div>
                    <div><strong>Account Name—</strong> Tahmidur Remura Wahid</div>
                    <div><strong>Account Number—</strong> 1161070004652</div>
                    <div><strong>Bank Name—</strong> Eastern Bank PLC.</div>
                    <div><strong>Branch Name—</strong> Banani Branch</div>
                    <div><strong>Routing Number—</strong> 095260439</div>
                    <div><strong>Swift Code—</strong> EBLDBDDH</div>
                  </td>
                  <td style={{ padding: '12px', verticalAlign: 'top', lineHeight: 1.9 }}>
                    <div>MoneyGram, Western Union, Ria Money Transfer in the name of <strong>Mohammad Wahidul Alam.</strong></div>
                    <br />
                    <div><strong>bKash number:</strong></div>
                    <div>01708000660 (merchant)</div>
                    <br />
                    <div><strong>SSLCOMMERZ</strong></div>
                    <div style={{ color: '#6b7280' }}>(please request for the online link, if required)</div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 11, color: '#374151' }}>Should you have any further queries please feel free to contact us.</div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{ background: '#f4f5f7', borderTop: '1px solid #e2e8f0', padding: '18px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, marginBottom: 12 }}>
              <div style={{ flexShrink: 0 }}>
                <img src="/trw-logo.webp" alt="TRW" style={{ height: 30 }} />
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 10, color: '#374151', lineHeight: 1.8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4, fontSize: 10 }}>Contact</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{iconMail} info@trfirm.com</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{iconMail} info@trwbd.com</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{iconMail} info@tahmidur.com</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{iconGlobe} trwbd.com</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4, fontSize: 10 }}>Phone</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{iconPhone} +8801708-000660</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{iconPhone} +8801847220062</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{iconPhone} +8801708080817</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4, fontSize: 10 }}>Address</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    {iconPin}
                    <span>House 410, Road 29, Mohakhali New DOHS, Dhaka 1206, Bangladesh</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: '#6b7280' }}>
              <div>TRW is a trademark and/or registered trademark of Tahmidur Remura Wahid Law Firm.</div>
              <div style={{ textAlign: 'right' }}>
                This is an official invoice generated from{' '}
                <a href="https://trw.ac" style={{ color: '#111827', fontWeight: 600, textDecoration: 'underline' }}>trw.ac</a>.
                {' '}Clients may verify authenticity at that link.
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

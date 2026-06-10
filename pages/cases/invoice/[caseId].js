import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import Head from 'next/head';
import Link from 'next/link';

// TRW brand blue — matches trw.ac
const TRW_BLUE = '#1d4ed8';
const TRW_BLUE_DARK = '#1e3a8a';
const TRW_BLUE_LIGHT = '#eff6ff';

export default function InvoicePage() {
  const router = useRouter();
  const { caseId } = router.query;

  const [user, setUser] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'preview'
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const printRef = useRef(null);

  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    to_name: '',
    attention: '',
    matter_reference: '',
    project_description: '',
    line_items: [{ sl: 1, description: '', govt_cost: '', professional_fee: '' }],
    ait_percentage: 10,
    currency: 'USD',
    payment_schedule: { retainer: 50, delivery: 50 },
    notes: '',
    status: 'draft',
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
    const [{ data: c }, { data: p }, { data: inv }] = await Promise.all([
      supabase.from('cases').select('*').eq('id', caseId).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('invoices').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
    ]);
    setCaseData(c);
    setProfile(p);
    setInvoices(inv || []);
    if (c) {
      const nextNum = `TRW-INV-${new Date().getFullYear()}-${String((inv?.length || 0) + 1).padStart(3, '0')}`;
      setForm(f => ({
        ...f,
        invoice_number: nextNum,
        to_name: c.client_name || '',
        attention: c.client_name || '',
        matter_reference: c.file_number || '',
        project_description: c.case_type || '',
      }));
    }
    setLoading(false);
  }

  function addLineItem() {
    setForm(f => ({
      ...f,
      line_items: [...f.line_items, { sl: f.line_items.length + 1, description: '', govt_cost: '', professional_fee: '' }],
    }));
  }

  function removeLineItem(idx) {
    setForm(f => ({
      ...f,
      line_items: f.line_items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sl: i + 1 })),
    }));
  }

  function updateLineItem(idx, field, value) {
    setForm(f => ({
      ...f,
      line_items: f.line_items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  }

  function calcSubtotal() {
    return form.line_items.reduce((sum, item) => {
      return sum + (parseFloat(item.govt_cost) || 0) + (parseFloat(item.professional_fee) || 0);
    }, 0);
  }

  function calcAIT() {
    const subtotal = form.line_items.reduce((sum, item) => sum + (parseFloat(item.professional_fee) || 0), 0);
    return subtotal * (form.ait_percentage / 100);
  }

  function calcTotal() {
    return calcSubtotal() + calcAIT();
  }

  async function saveInvoice(status = 'draft') {
    setSaving(true);
    const payload = { ...form, status, case_id: caseId, user_id: user.id };
    let result;
    if (selectedInvoice) {
      result = await supabase.from('invoices').update(payload).eq('id', selectedInvoice.id).select().single();
    } else {
      result = await supabase.from('invoices').insert(payload).select().single();
    }
    setSaving(false);
    if (!result.error) {
      setSelectedInvoice(result.data);
      await fetchData();
      if (status === 'final') setView('preview');
    }
  }

  function openInvoice(inv) {
    setSelectedInvoice(inv);
    setForm({
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      to_name: inv.to_name,
      attention: inv.attention || '',
      matter_reference: inv.matter_reference || '',
      project_description: inv.project_description || '',
      line_items: inv.line_items || [{ sl: 1, description: '', govt_cost: '', professional_fee: '' }],
      ait_percentage: inv.ait_percentage || 10,
      currency: inv.currency || 'USD',
      payment_schedule: inv.payment_schedule || { retainer: 50, delivery: 50 },
      notes: inv.notes || '',
      status: inv.status || 'draft',
    });
    setView('create');
  }

  async function deleteInvoice(id) {
    if (!confirm('Delete this invoice?')) return;
    await supabase.from('invoices').delete().eq('id', id);
    await fetchData();
  }

  const currencySymbol = form.currency === 'USD' ? '$' : form.currency === 'BDT' ? '৳' : form.currency === 'EUR' ? '€' : form.currency === 'GBP' ? '£' : form.currency === 'SGD' ? 'S$' : form.currency;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (profile?.role !== 'partner') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Only partners can access the invoice generator.</p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PRINT / PREVIEW VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'preview' && selectedInvoice) {
    const inv = selectedInvoice;
    const items = inv.line_items || [];
    const subtotal = items.reduce((s, i) => s + (parseFloat(i.govt_cost) || 0) + (parseFloat(i.professional_fee) || 0), 0);
    const aitBase = items.reduce((s, i) => s + (parseFloat(i.professional_fee) || 0), 0);
    const ait = aitBase * ((inv.ait_percentage || 10) / 100);
    const total = subtotal + ait;
    const sym = inv.currency === 'USD' ? '$' : inv.currency === 'BDT' ? '৳' : inv.currency === 'EUR' ? '€' : inv.currency === 'GBP' ? '£' : inv.currency === 'SGD' ? 'S$' : inv.currency;

    return (
      <>
        <Head>
          <title>Invoice {inv.invoice_number} — TRW</title>
          <style>{`
            @media print {
              .no-print { display: none !important; }
              body { margin: 0; }
              .print-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
            }
          `}</style>
        </Head>
        <div className="no-print bg-gray-100 p-4 flex gap-3 items-center sticky top-0 z-10 shadow">
          <button onClick={() => setView('list')} className="text-sm text-gray-600 hover:text-gray-900">← Back</button>
          <button onClick={() => window.print()} className="ml-auto bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800">Print / Save PDF</button>
          <button onClick={() => { openInvoice(inv); }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300">Edit</button>
        </div>

        <div ref={printRef} className="print-page bg-white max-w-4xl mx-auto my-6 shadow-lg" style={{ fontFamily: 'Arial, sans-serif' }}>

          {/* ── HEADER BAND ── */}
          <div style={{ background: TRW_BLUE_DARK, color: 'white', padding: '0' }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              {/* Left: Firm details */}
              <div style={{ flex: 1, padding: '28px 32px 24px' }}>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4, marginBottom: 2 }}>TRW</div>
                <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.8, marginBottom: 10 }}>TAHMIDUR REMURA WAHID</div>
                <div style={{ fontSize: 11, lineHeight: 1.7, opacity: 0.9 }}>
                  <strong>Tahmidur Remura Wahid — TRW Law Firm</strong><br />
                  House 410, Road 29, Mohakhali DOHS<br />
                  Dhaka 1206, Bangladesh<br />
                  Tel: +880 1711-985987<br />
                  Email: info@trfirm.com<br />
                  Web: www.trw.ac
                </div>
              </div>
              {/* Right: INVOICE label */}
              <div style={{ background: TRW_BLUE, padding: '28px 32px 24px', minWidth: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 3, textAlign: 'right' }}>INVOICE</div>
                  <div style={{ fontSize: 11, opacity: 0.85, textAlign: 'right', marginTop: 4 }}>
                    No: <strong>{inv.invoice_number}</strong>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.85, textAlign: 'right', marginTop: 2 }}>
                    Date: <strong>{new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  </div>
                  {inv.matter_reference && (
                    <div style={{ fontSize: 11, opacity: 0.85, textAlign: 'right', marginTop: 2 }}>
                      Ref: <strong>{inv.matter_reference}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 32px' }}>

            {/* Bill To */}
            <div style={{ background: TRW_BLUE_LIGHT, border: `1px solid #bfdbfe`, borderRadius: 6, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: TRW_BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>Bill To</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{inv.to_name}</div>
              {inv.attention && inv.attention !== inv.to_name && (
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Attn: {inv.attention}</div>
              )}
            </div>

            {inv.project_description && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: TRW_BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>Re: Matter / Project</div>
                <div style={{ fontSize: 13, color: '#334155' }}>{inv.project_description}</div>
              </div>
            )}

            {/* Line items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0, fontSize: 12 }}>
              <thead>
                <tr style={{ background: TRW_BLUE_DARK, color: 'white' }}>
                  <th style={{ padding: '9px 10px', textAlign: 'left', width: 40 }}>SL</th>
                  <th style={{ padding: '9px 10px', textAlign: 'left' }}>Description of Services</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', width: 120 }}>Govt. Cost ({sym})</th>
                  <th style={{ padding: '9px 10px', textAlign: 'right', width: 140 }}>Professional Fee ({sym})</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{item.sl}</td>
                    <td style={{ padding: '8px 10px', color: '#1e293b' }}>{item.description}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>{item.govt_cost ? `${sym}${parseFloat(item.govt_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>{item.professional_fee ? `${sym}${parseFloat(item.professional_fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${TRW_BLUE}` }}>
                  <td colSpan={2}></td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>Subtotal</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{sym}{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style={{ background: '#f1f5f9' }}>
                  <td colSpan={2}></td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>AIT @ {inv.ait_percentage}%</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>{sym}{ait.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style={{ background: TRW_BLUE_DARK, color: 'white' }}>
                  <td colSpan={2}></td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>GRAND TOTAL</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>

            {/* Payment schedule */}
            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: TRW_BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Payment Schedule</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, background: TRW_BLUE_LIGHT, border: `1px solid #bfdbfe`, borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
                  <strong style={{ color: TRW_BLUE_DARK }}>{inv.payment_schedule?.retainer || 50}% Retainer</strong><br />
                  <span style={{ color: '#475569' }}>Due upon engagement: {sym}{(total * ((inv.payment_schedule?.retainer || 50) / 100)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ flex: 1, background: TRW_BLUE_LIGHT, border: `1px solid #bfdbfe`, borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
                  <strong style={{ color: TRW_BLUE_DARK }}>{inv.payment_schedule?.delivery || 50}% Upon Delivery</strong><br />
                  <span style={{ color: '#475569' }}>Due upon completion: {sym}{(total * ((inv.payment_schedule?.delivery || 50) / 100)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Payment instructions */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '16px 18px', marginBottom: 20, fontSize: 11 }}>
              <div style={{ fontSize: 10, color: TRW_BLUE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Payment Instructions</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ lineHeight: 1.7 }}>
                  <strong style={{ color: TRW_BLUE_DARK, fontSize: 11 }}>Bank Transfer (Bangladesh)</strong><br />
                  Account Name: Tahmidur Rahman<br />
                  Bank: Dutch-Bangla Bank Ltd<br />
                  Account No: 105.110.42975<br />
                  Branch: Gulshan, Dhaka<br />
                  Routing No: 090261502
                </div>
                <div style={{ lineHeight: 1.7 }}>
                  <strong style={{ color: TRW_BLUE_DARK, fontSize: 11 }}>International Transfer</strong><br />
                  MoneyGram / Western Union<br />
                  Receiver: Tahmidur Rahman<br />
                  Country: Bangladesh<br />
                  <br />
                  <strong style={{ color: TRW_BLUE_DARK, fontSize: 11 }}>Mobile Banking (bKash)</strong><br />
                  bKash Number: <strong style={{ color: '#1e293b' }}>01711-985987</strong><br />
                  Account Type: Personal
                </div>
              </div>
            </div>

            {inv.notes && (
              <div style={{ marginBottom: 16, fontSize: 11, color: '#475569', fontStyle: 'italic', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '8px 12px' }}>
                <strong>Notes:</strong> {inv.notes}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: `2px solid ${TRW_BLUE}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                This invoice is generated by TRW Case Management System
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: '#64748b' }}>
                <strong>Tahmidur Remura Wahid — TRW Law Firm</strong><br />
                info@trfirm.com · www.trw.ac · +880 1711-985987
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE / EDIT VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Head><title>Invoice Generator — TRW</title></Head>
        <div className="bg-white border-b px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
          <button onClick={() => { setView('list'); setSelectedInvoice(null); }} className="text-sm text-gray-500 hover:text-gray-800">← Back</button>
          <h1 className="text-lg font-semibold text-gray-800">{selectedInvoice ? 'Edit Invoice' : 'New Invoice'}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => saveInvoice('draft')} disabled={saving} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button onClick={() => saveInvoice('final')} disabled={saving} className="px-4 py-2 text-sm bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Saving...' : 'Finalise & Preview'}
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-700 mb-4">Invoice Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice Number</label>
                <input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice Date</label>
                <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bill To (Client / Company)</label>
                <input value={form.to_name} onChange={e => setForm(f => ({ ...f, to_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Attention (Contact Person)</label>
                <input value={form.attention} onChange={e => setForm(f => ({ ...f, attention: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Matter Reference</label>
                <input value={form.matter_reference} onChange={e => setForm(f => ({ ...f, matter_reference: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="USD">USD ($)</option>
                  <option value="BDT">BDT (৳)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="SGD">SGD (S$)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Re: Matter / Project Description</label>
                <textarea value={form.project_description} onChange={e => setForm(f => ({ ...f, project_description: e.target.value }))} rows={2} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-700 mb-4">Services / Line Items</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left py-2 px-2 w-8">SL</th>
                  <th className="text-left py-2 px-2">Description</th>
                  <th className="text-right py-2 px-2 w-32">Govt. Cost ({currencySymbol})</th>
                  <th className="text-right py-2 px-2 w-36">Professional Fee ({currencySymbol})</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {form.line_items.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="py-2 px-2 text-gray-400">{item.sl}</td>
                    <td className="py-2 px-2">
                      <input value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" placeholder="Service description..." />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" value={item.govt_cost} onChange={e => updateLineItem(idx, 'govt_cost', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-right" placeholder="0.00" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" value={item.professional_fee} onChange={e => updateLineItem(idx, 'professional_fee', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-right" placeholder="0.00" />
                    </td>
                    <td className="py-2 px-2">
                      {form.line_items.length > 1 && (
                        <button onClick={() => removeLineItem(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addLineItem} className="mt-3 text-sm text-blue-600 hover:text-blue-800">+ Add line item</button>
            <div className="mt-4 border-t pt-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{currencySymbol}{calcSubtotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span className="flex items-center gap-2">
                  AIT
                  <input type="number" value={form.ait_percentage} onChange={e => setForm(f => ({ ...f, ait_percentage: parseFloat(e.target.value) || 0 }))} className="w-14 border rounded px-2 py-0.5 text-xs text-center" />
                  %
                </span>
                <span>{currencySymbol}{calcAIT().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t pt-1 text-base">
                <span>Grand Total</span>
                <span>{currencySymbol}{calcTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-700 mb-4">Payment Schedule</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Retainer % (upon engagement)</label>
                <input type="number" min="0" max="100" value={form.payment_schedule.retainer}
                  onChange={e => setForm(f => ({ ...f, payment_schedule: { retainer: parseFloat(e.target.value) || 0, delivery: 100 - (parseFloat(e.target.value) || 0) } }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Balance % (upon delivery)</label>
                <input type="number" min="0" max="100" value={form.payment_schedule.delivery}
                  onChange={e => setForm(f => ({ ...f, payment_schedule: { ...f.payment_schedule, delivery: parseFloat(e.target.value) || 0 } }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-700 mb-4">Additional Notes</h2>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full border rounded px-3 py-2 text-sm" placeholder="Any additional notes or terms..." />
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Head><title>Invoices — {caseData?.client_name} — TRW</title></Head>
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4 shadow-sm">
        <Link href={`/cases/${caseId}`} className="text-sm text-gray-500 hover:text-gray-800">← Back to Case</Link>
        <h1 className="text-lg font-semibold text-gray-800">Invoices — {caseData?.client_name}</h1>
        <button onClick={() => { setSelectedInvoice(null); setView('create'); }} className="ml-auto bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800">
          + New Invoice
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {invoices.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <div className="text-4xl mb-3 text-gray-300" style={{fontSize:36}}>&#9632;</div>
            <p className="text-gray-500 mb-4">No invoices yet for this case.</p>
            <button onClick={() => { setSelectedInvoice(null); setView('create'); }} className="bg-blue-700 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-800">
              Create First Invoice
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map(inv => {
              const items = inv.line_items || [];
              const subtotal = items.reduce((s, i) => s + (parseFloat(i.govt_cost) || 0) + (parseFloat(i.professional_fee) || 0), 0);
              const ait = items.reduce((s, i) => s + (parseFloat(i.professional_fee) || 0), 0) * ((inv.ait_percentage || 10) / 100);
              const total = subtotal + ait;
              const sym = inv.currency === 'USD' ? '$' : inv.currency === 'BDT' ? '৳' : inv.currency === 'EUR' ? '€' : inv.currency === 'GBP' ? '£' : inv.currency === 'SGD' ? 'S$' : inv.currency;
              return (
                <div key={inv.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
                  <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center text-xs font-bold text-blue-700">INV</div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{inv.invoice_number}</div>
                    <div className="text-sm text-gray-500">{inv.to_name} · {new Date(inv.invoice_date).toLocaleDateString('en-GB')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'final' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {inv.status === 'final' ? 'Final' : 'Draft'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedInvoice(inv); setView('preview'); }} className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Preview</button>
                    <button onClick={() => openInvoice(inv)} className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Edit</button>
                    <button onClick={() => deleteInvoice(inv.id)} className="text-sm px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

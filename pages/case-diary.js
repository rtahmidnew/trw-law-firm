import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

export default function CaseDiary() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [message, setMessage] = useState('');

  // Edit/Add form state
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    diary_no: '',
    parties: '',
    case_no: '',
    court: '',
    previous_dates: '',
    next_date: '',
    next_step: '',
    status: 'Active'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      setUser(session.user);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetchEntries();
  }, [user]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('case_diary')
      .select('*')
      .order('diary_no', { ascending: true });
    if (!error) setEntries(data || []);
    setLoading(false);
  }, [user]);

  const isPartner = profile?.role === 'partner';

  const filtered = entries.filter(e => {
    const matchStatus = filterStatus === 'All' || e.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || e.parties?.toLowerCase().includes(q) || e.case_no?.toLowerCase().includes(q) || e.court?.toLowerCase().includes(q) || e.next_step?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      diary_no: entry.diary_no,
      parties: entry.parties || '',
      case_no: entry.case_no || '',
      court: entry.court || '',
      previous_dates: entry.previous_dates || '',
      next_date: entry.next_date || '',
      next_step: entry.next_step || '',
      status: entry.status || 'Active'
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdd = () => {
    setEditingEntry(null);
    const maxNo = entries.length > 0 ? Math.max(...entries.map(e => e.diary_no || 0)) + 1 : 1;
    setFormData({ diary_no: maxNo, parties: '', case_no: '', court: '', previous_dates: '', next_date: '', next_step: '', status: 'Active' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!formData.parties.trim()) return;
    setSaving(true);
    const payload = {
      diary_no: parseInt(formData.diary_no) || 0,
      parties: formData.parties.trim(),
      case_no: formData.case_no.trim() || null,
      court: formData.court.trim() || null,
      previous_dates: formData.previous_dates.trim() || null,
      next_date: formData.next_date || null,
      next_step: formData.next_step.trim() || null,
      status: formData.status,
      updated_at: new Date().toISOString()
    };
    if (editingEntry) {
      await supabase.from('case_diary').update(payload).eq('id', editingEntry.id);
      setMessage('Entry updated.');
    } else {
      await supabase.from('case_diary').insert(payload);
      setMessage('Entry added.');
    }
    setSaving(false);
    setShowForm(false);
    setEditingEntry(null);
    fetchEntries();
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this diary entry?')) return;
    await supabase.from('case_diary').delete().eq('id', id);
    fetchEntries();
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((next - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getUrgencyColor = (days) => {
    if (days === null) return '#e2e8f0';
    if (days < 0) return '#fca5a5';
    if (days <= 3) return '#fbbf24';
    if (days <= 7) return '#86efac';
    return '#e2e8f0';
  };

  if (!user) return null;

  return (
    <Layout>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0d1b2a', margin: 0 }}>Case Diary</h1>
            <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
              {filtered.length} of {entries.length} entries · Hearing dates marked on calendar
            </p>
          </div>
          {isPartner && (
            <button
              onClick={handleAdd}
              style={{ background: '#0d1b2a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
            >
              + Add Entry
            </button>
          )}
        </div>

        {message && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#166534', fontSize: 14 }}>
            {message}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && isPartner && (
          <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #0d1b2a', padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0d1b2a', margin: '0 0 20px' }}>
              {editingEntry ? `Edit Entry #${editingEntry.diary_no}` : 'Add New Diary Entry'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Diary No.</label>
                <input type="number" value={formData.diary_no} onChange={e => setFormData(f => ({ ...f, diary_no: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Parties *</label>
                <input type="text" value={formData.parties} onChange={e => setFormData(f => ({ ...f, parties: e.target.value }))}
                  placeholder="e.g. Selim Reza vs. State" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Case No.</label>
                <input type="text" value={formData.case_no} onChange={e => setFormData(f => ({ ...f, case_no: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Court</label>
                <input type="text" value={formData.court} onChange={e => setFormData(f => ({ ...f, court: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Previous Dates</label>
                <input type="text" value={formData.previous_dates} onChange={e => setFormData(f => ({ ...f, previous_dates: e.target.value }))}
                  placeholder="e.g. 12.03.25, 15.04.25" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Next Date</label>
                <input type="date" value={formData.next_date} onChange={e => setFormData(f => ({ ...f, next_date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Next Step</label>
                <input type="text" value={formData.next_step} onChange={e => setFormData(f => ({ ...f, next_step: e.target.value }))}
                  placeholder="e.g. Framing of Charge" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Status</label>
                <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}>
                  <option>Active</option>
                  <option>Disposed</option>
                  <option>Stayed</option>
                  <option>Adjourned</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleSave} disabled={saving || !formData.parties.trim()}
                style={{ background: '#0d1b2a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14, opacity: (!formData.parties.trim() || saving) ? 0.5 : 1 }}>
                {saving ? 'Saving...' : editingEntry ? 'Update Entry' : 'Add Entry'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingEntry(null); }}
                style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search parties, case no., court, next step..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
          />
          {['All', 'Active', 'Disposed', 'Stayed', 'Adjourned'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', border: 'none',
                background: filterStatus === s ? '#0d1b2a' : '#f1f5f9',
                color: filterStatus === s ? '#fff' : '#64748b'
              }}>
              {s}
            </button>
          ))}
        </div>

        {/* Urgency legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#fca5a5', display: 'inline-block' }} /> Overdue / Past</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#fbbf24', display: 'inline-block' }} /> Within 3 days</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#86efac', display: 'inline-block' }} /> Within 7 days</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#e2e8f0', display: 'inline-block' }} /> Upcoming</span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Loading case diary...</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Desktop table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0d1b2a', color: '#fff' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>No.</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Parties</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Case No.</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Court</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Previous Dates</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Next Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Next Step</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                    {isPartner && <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={isPartner ? 9 : 8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                        No entries found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((entry, idx) => {
                      const days = getDaysUntil(entry.next_date);
                      const urgencyColor = getUrgencyColor(days);
                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0d1b2a' }}>{entry.diary_no}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0d1b2a', maxWidth: 220 }}>
                            {entry.linked_case_id ? (
                              <Link href={`/cases/${entry.linked_case_id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>
                                {entry.parties}
                              </Link>
                            ) : entry.parties}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{entry.case_no || '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#374151', maxWidth: 180 }}>{entry.court || '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{entry.previous_dates || '—'}</td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            {entry.next_date ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: urgencyColor, borderRadius: 6, padding: '4px 10px',
                                fontWeight: 700, color: days !== null && days < 0 ? '#991b1b' : '#0d1b2a'
                              }}>
                                {formatDate(entry.next_date)}
                                {days !== null && days >= 0 && days <= 7 && (
                                  <span style={{ fontSize: 11, fontWeight: 600 }}>({days === 0 ? 'Today' : `${days}d`})</span>
                                )}
                                {days !== null && days < 0 && (
                                  <span style={{ fontSize: 11, fontWeight: 600 }}>({Math.abs(days)}d ago)</span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#374151' }}>{entry.next_step || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '3px 8px',
                              background: entry.status === 'Active' ? '#dcfce7' : entry.status === 'Disposed' ? '#f1f5f9' : '#fef9c3',
                              color: entry.status === 'Active' ? '#166534' : entry.status === 'Disposed' ? '#64748b' : '#92400e'
                            }}>
                              {entry.status}
                            </span>
                          </td>
                          {isPartner && (
                            <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button onClick={() => handleEdit(entry)}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: '#374151', marginRight: 6 }}>
                                Edit
                              </button>
                              <button onClick={() => handleDelete(entry.id)}
                                style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mobile cards */}
        <style>{`
          @media (max-width: 768px) {
            table { display: none !important; }
            .diary-cards { display: block !important; }
          }
          .diary-cards { display: none; }
        `}</style>
        <div className="diary-cards">
          {filtered.map(entry => {
            const days = getDaysUntil(entry.next_date);
            const urgencyColor = getUrgencyColor(days);
            return (
              <div key={entry.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginRight: 8 }}>#{entry.diary_no}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 6px',
                      background: entry.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                      color: entry.status === 'Active' ? '#166534' : '#64748b'
                    }}>{entry.status}</span>
                  </div>
                  {isPartner && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleEdit(entry)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                      <button onClick={() => handleDelete(entry.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>Del</button>
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0d1b2a', marginBottom: 4 }}>
                  {entry.linked_case_id ? (
                    <Link href={`/cases/${entry.linked_case_id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>{entry.parties}</Link>
                  ) : entry.parties}
                </div>
                {entry.case_no && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Case No: {entry.case_no}</div>}
                {entry.court && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{entry.court}</div>}
                {entry.next_date && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: urgencyColor, borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 13, color: days !== null && days < 0 ? '#991b1b' : '#0d1b2a' }}>
                      Next: {formatDate(entry.next_date)}
                      {days !== null && days >= 0 && days <= 7 && ` (${days === 0 ? 'Today' : `${days}d`})`}
                    </span>
                    {entry.next_step && <span style={{ fontSize: 12, color: '#374151' }}>{entry.next_step}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

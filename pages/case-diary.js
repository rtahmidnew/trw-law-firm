import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

const STATUS_OPTIONS = ['Active', 'Disposed', 'Stayed', 'Adjourned'];

// Monochrome calendar SVG icon — no emoji, no color
const CalendarIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const EditIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const LinkIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export default function CaseDiary() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [filterUrgency, setFilterUrgency] = useState(null); // null | 'overdue' | '3days' | '7days' | 'upcoming'
  const [toast, setToast] = useState('');

  // Inline editing — one entry at a time
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Add new entry form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    diary_no: '', parties: '', case_no: '', court: '',
    previous_dates: '', next_date: '', next_step: '', status: 'Active'
  });
  const [addSaving, setAddSaving] = useState(false);

  const addFormRef = useRef(null);

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

  const canEdit = profile?.role === 'partner' || profile?.role === 'associate';

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const next = new Date(dateStr + 'T00:00:00');
    return Math.round((next - today) / (1000 * 60 * 60 * 24));
  };

  const filtered = entries.filter(e => {
    const matchStatus = filterStatus === 'All' || e.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (e.parties || '').toLowerCase().includes(q) ||
      (e.case_no || '').toLowerCase().includes(q) ||
      (e.court || '').toLowerCase().includes(q) ||
      (e.next_step || '').toLowerCase().includes(q);
    let matchUrgency = true;
    if (filterUrgency) {
      const days = getDaysUntil(e.next_date);
      if (filterUrgency === 'overdue') matchUrgency = days !== null && days < 0;
      else if (filterUrgency === '3days') matchUrgency = days !== null && days >= 0 && days <= 3;
      else if (filterUrgency === '7days') matchUrgency = days !== null && days > 3 && days <= 7;
      else if (filterUrgency === 'upcoming') matchUrgency = days !== null && days > 7;
    }
    return matchStatus && matchSearch && matchUrgency;
  });

  // Start inline edit
  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({
      diary_no: entry.diary_no,
      parties: entry.parties || '',
      case_no: entry.case_no || '',
      court: entry.court || '',
      previous_dates: entry.previous_dates || '',
      next_date: entry.next_date || '',
      next_step: entry.next_step || '',
      status: entry.status || 'Active'
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (entryId) => {
    setSaving(true);
    const payload = {
      diary_no: parseInt(editForm.diary_no) || 0,
      parties: editForm.parties.trim(),
      case_no: editForm.case_no.trim() || null,
      court: editForm.court.trim() || null,
      previous_dates: editForm.previous_dates.trim() || null,
      next_date: editForm.next_date || null,
      next_step: editForm.next_step.trim() || null,
      status: editForm.status,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('case_diary').update(payload).eq('id', entryId);
    setSaving(false);
    if (!error) {
      setEditingId(null);
      setEditForm({});
      showToast('Entry updated.');
      fetchEntries();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this diary entry? This cannot be undone.')) return;
    await supabase.from('case_diary').delete().eq('id', id);
    showToast('Entry deleted.');
    fetchEntries();
  };

  const handleAdd = async () => {
    if (!addForm.parties.trim()) return;
    setAddSaving(true);
    const maxNo = entries.length > 0 ? Math.max(...entries.map(e => e.diary_no || 0)) + 1 : 1;
    const payload = {
      diary_no: parseInt(addForm.diary_no) || maxNo,
      parties: addForm.parties.trim(),
      case_no: addForm.case_no.trim() || null,
      court: addForm.court.trim() || null,
      previous_dates: addForm.previous_dates.trim() || null,
      next_date: addForm.next_date || null,
      next_step: addForm.next_step.trim() || null,
      status: addForm.status
    };
    await supabase.from('case_diary').insert(payload);
    setAddSaving(false);
    setShowAddForm(false);
    setAddForm({ diary_no: '', parties: '', case_no: '', court: '', previous_dates: '', next_date: '', next_step: '', status: 'Active' });
    showToast('New entry added.');
    fetchEntries();
  };

  const formatDate = (d) => {
    if (!d) return null;
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getUrgencyStyle = (days) => {
    if (days === null) return { bg: 'transparent', color: '#374151', border: '#e2e8f0' };
    if (days < 0) return { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' };
    if (days <= 3) return { bg: '#fff7ed', color: '#9a3412', border: '#fdba74' };
    if (days <= 7) return { bg: '#fefce8', color: '#713f12', border: '#fde047' };
    return { bg: '#f0fdf4', color: '#14532d', border: '#86efac' };
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Active': return { bg: '#f0fdf4', color: '#15803d', border: '#86efac' };
      case 'Disposed': return { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' };
      case 'Stayed': return { bg: '#fefce8', color: '#713f12', border: '#fde047' };
      case 'Adjourned': return { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' };
      default: return { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' };
    }
  };

  if (!user) return null;

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 6,
    border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box',
    fontFamily: 'inherit', background: '#fff', color: '#0d1b2a',
    outline: 'none', lineHeight: 1.4
  };

  const fieldLabel = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em'
  };

  return (
    <Layout>
      <style>{`
        .cd-page { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
        .cd-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 12px; flex-wrap: wrap; }
        .cd-title { font-size: 26px; font-weight: 700; color: #0d1b2a; margin: 0; display: flex; align-items: center; gap: 10px; }
        .cd-subtitle { color: #64748b; margin-top: 4px; font-size: 13px; }
        .cd-add-btn { display: flex; align-items: center; gap: 7px; background: #0d1b2a; color: #fff; border: none; border-radius: 8px; padding: '10px 18px'; font-weight: 600; cursor: pointer; font-size: 13px; padding: 10px 18px; white-space: nowrap; }
        .cd-add-btn:hover { background: #1e293b; }
        .cd-filters { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; align-items: center; }
        .cd-search { flex: 1; min-width: 200px; padding: 9px 13px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; outline: none; }
        .cd-search:focus { border-color: #94a3b8; }
        .cd-filter-btn { padding: 7px 14px; border-radius: 7px; font-weight: 600; font-size: 12px; cursor: pointer; border: 1px solid transparent; transition: all 0.12s; }
        .cd-filter-btn.active { background: #0d1b2a; color: #fff; border-color: #0d1b2a; }
        .cd-filter-btn.inactive { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
        .cd-filter-btn.inactive:hover { background: #f1f5f9; }
        .cd-legend { display: flex; gap: 14px; margin-bottom: 18px; font-size: 11px; color: #94a3b8; flex-wrap: wrap; }
        .cd-legend-dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; margin-right: 4px; vertical-align: middle; }
        .cd-toast { position: fixed; bottom: 24px; right: 24px; background: #0d1b2a; color: #fff; border-radius: 8px; padding: 12px 20px; font-size: 13px; font-weight: 600; z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        
        /* Entry card */
        .cd-entry { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 10px; overflow: hidden; transition: box-shadow 0.15s; }
        .cd-entry:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
        .cd-entry.editing { border-color: #0d1b2a; box-shadow: 0 0 0 2px rgba(13,27,42,0.08); }
        
        /* View mode */
        .cd-view { padding: 16px 18px; }
        .cd-view-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
        .cd-no { font-size: 11px; font-weight: 700; color: #94a3b8; background: #f8fafc; border-radius: 5px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0; }
        .cd-parties { font-size: 15px; font-weight: 700; color: #0d1b2a; flex: 1; line-height: 1.4; }
        .cd-parties-link { color: #0d1b2a; text-decoration: none; }
        .cd-parties-link:hover { text-decoration: underline; }
        .cd-status-badge { font-size: 11px; font-weight: 700; border-radius: 5px; padding: 3px 9px; white-space: nowrap; flex-shrink: 0; border: 1px solid; }
        .cd-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .cd-btn-icon { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; cursor: pointer; color: #64748b; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; transition: all 0.12s; }
        .cd-btn-icon:hover { background: #f1f5f9; color: #0d1b2a; }
        .cd-btn-icon.danger:hover { background: #fef2f2; color: #dc2626; border-color: #fca5a5; }
        .cd-view-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
        .cd-field { font-size: 12px; color: #374151; }
        .cd-field-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1px; }
        .cd-field-value { color: #374151; }
        .cd-field-value.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; }
        .cd-next-date { display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; padding: 4px 10px; font-weight: 700; font-size: 12px; border: 1px solid; }
        .cd-prev-dates { font-size: 11px; color: #64748b; line-height: 1.5; word-break: break-word; }
        .cd-case-link { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #0d1b2a; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 10px; text-decoration: none; font-weight: 600; margin-top: 8px; }
        .cd-case-link:hover { background: #0d1b2a; color: #fff; border-color: #0d1b2a; }
        
        /* Edit mode */
        .cd-edit { padding: 16px 18px; background: #fafafa; }
        .cd-edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px; }
        .cd-edit-full { grid-column: 1 / -1; }
        .cd-edit-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .cd-save-btn { display: flex; align-items: center; gap: 6px; background: #0d1b2a; color: #fff; border: none; border-radius: 7px; padding: 8px 18px; font-weight: 600; cursor: pointer; font-size: 13px; }
        .cd-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cd-cancel-btn { display: flex; align-items: center; gap: 6px; background: #f1f5f9; color: #64748b; border: none; border-radius: 7px; padding: 8px 14px; font-weight: 600; cursor: pointer; font-size: 13px; }
        .cd-cancel-btn:hover { background: #e2e8f0; }
        
        /* Add form */
        .cd-add-form { background: #fff; border-radius: 12px; border: 2px solid #0d1b2a; padding: 20px; margin-bottom: 18px; }
        .cd-add-form-title { font-size: 15px; font-weight: 700; color: #0d1b2a; margin: 0 0 16px; display: flex; align-items: center; gap: 8px; }
        
        @media (max-width: 640px) {
          .cd-page { padding: 16px 12px; }
          .cd-title { font-size: 22px; }
          .cd-view-fields { grid-template-columns: 1fr; }
          .cd-edit-grid { grid-template-columns: 1fr; }
          .cd-view-top { flex-wrap: wrap; }
          .cd-actions { margin-left: auto; }
        }
        @media (min-width: 641px) {
          .cd-view-fields { grid-template-columns: 1fr 1fr 1fr; }
        }
        @media (min-width: 900px) {
          .cd-view-fields { grid-template-columns: 1fr 1fr 1fr 1fr; }
        }
      `}</style>

      <div className="cd-page">
        {/* Header */}
        <div className="cd-header">
          <div>
            <h1 className="cd-title">
              <CalendarIcon size={22} />
              Case Diary
            </h1>
            <p className="cd-subtitle">
              {filtered.length} of {entries.length} entries · Hearing dates marked on calendar
            </p>
          </div>
          {canEdit && (
            <button className="cd-add-btn" onClick={() => {
              setShowAddForm(true);
              setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            }}>
              <PlusIcon size={14} /> Add Entry
            </button>
          )}
        </div>

        {/* Add New Entry Form */}
        {showAddForm && canEdit && (
          <div className="cd-add-form" ref={addFormRef}>
            <h2 className="cd-add-form-title">
              <PlusIcon size={15} /> New Diary Entry
            </h2>
            <div className="cd-edit-grid">
              <div>
                <label style={fieldLabel}>Diary No.</label>
                <input style={inputStyle} type="number" value={addForm.diary_no}
                  placeholder={entries.length > 0 ? String(Math.max(...entries.map(e => e.diary_no || 0)) + 1) : '1'}
                  onChange={e => setAddForm(f => ({ ...f, diary_no: e.target.value }))} />
              </div>
              <div className="cd-edit-full">
                <label style={fieldLabel}>Parties *</label>
                <input style={inputStyle} type="text" value={addForm.parties}
                  placeholder="e.g. Selim Reza VS State"
                  onChange={e => setAddForm(f => ({ ...f, parties: e.target.value }))} />
              </div>
              <div>
                <label style={fieldLabel}>Case No.</label>
                <input style={inputStyle} type="text" value={addForm.case_no}
                  placeholder="e.g. CR Case No. 123/2024"
                  onChange={e => setAddForm(f => ({ ...f, case_no: e.target.value }))} />
              </div>
              <div>
                <label style={fieldLabel}>Court</label>
                <input style={inputStyle} type="text" value={addForm.court}
                  placeholder="e.g. 1st Joint Session Court"
                  onChange={e => setAddForm(f => ({ ...f, court: e.target.value }))} />
              </div>
              <div>
                <label style={fieldLabel}>Next Date</label>
                <input style={inputStyle} type="date" value={addForm.next_date}
                  onChange={e => setAddForm(f => ({ ...f, next_date: e.target.value }))} />
              </div>
              <div>
                <label style={fieldLabel}>Next Step</label>
                <input style={inputStyle} type="text" value={addForm.next_step}
                  placeholder="e.g. Framing of Charge"
                  onChange={e => setAddForm(f => ({ ...f, next_step: e.target.value }))} />
              </div>
              <div>
                <label style={fieldLabel}>Status</label>
                <select style={inputStyle} value={addForm.status}
                  onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="cd-edit-full">
                <label style={fieldLabel}>Previous Dates</label>
                <input style={inputStyle} type="text" value={addForm.previous_dates}
                  placeholder="e.g. 12.03.2025, 15.04.2025, 20.05.2025"
                  onChange={e => setAddForm(f => ({ ...f, previous_dates: e.target.value }))} />
              </div>
            </div>
            <div className="cd-edit-actions">
              <button className="cd-save-btn" onClick={handleAdd} disabled={addSaving || !addForm.parties.trim()}>
                <CheckIcon size={13} /> {addSaving ? 'Saving...' : 'Add Entry'}
              </button>
              <button className="cd-cancel-btn" onClick={() => setShowAddForm(false)}>
                <XIcon size={13} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="cd-filters">
          <input className="cd-search" type="text" placeholder="Search parties, case no., court, next step..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {['All', 'Active', 'Disposed', 'Stayed', 'Adjourned'].map(s => (
            <button key={s} className={`cd-filter-btn ${filterStatus === s ? 'active' : 'inactive'}`}
              onClick={() => setFilterStatus(s)}>{s}</button>
          ))}
        </div>

        {/* Legend */}
        <div className="cd-legend">
          {[
            { key: 'overdue', label: 'Overdue / Past', color: '#fca5a5', active: '#dc2626' },
            { key: '3days',   label: 'Within 3 days',  color: '#fdba74', active: '#ea580c' },
            { key: '7days',   label: 'Within 7 days',  color: '#fde047', active: '#ca8a04' },
            { key: 'upcoming',label: 'Upcoming',        color: '#86efac', active: '#16a34a' },
          ].map(({ key, label, color, active }) => {
            const isActive = filterUrgency === key;
            return (
              <button
                key={key}
                onClick={() => setFilterUrgency(isActive ? null : key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: isActive ? '#f8fafc' : 'transparent',
                  border: isActive ? `1.5px solid ${active}` : '1.5px solid transparent',
                  borderRadius: 20, padding: '3px 10px 3px 6px',
                  cursor: 'pointer', fontSize: 11, fontWeight: isActive ? 700 : 500,
                  color: isActive ? active : '#94a3b8',
                  transition: 'all 0.15s'
                }}
              >
                <span className="cd-legend-dot" style={{ background: color, flexShrink: 0 }} />
                {label}
                {isActive && <span style={{ marginLeft: 3, fontSize: 10, opacity: 0.7 }}>✕</span>}
              </button>
            );
          })}
        </div>

        {/* Entries */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 14 }}>Loading case diary...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 14 }}>No entries found.</div>
        ) : (
          filtered.map(entry => {
            const isEditing = editingId === entry.id;
            const days = getDaysUntil(entry.next_date);
            const urgStyle = getUrgencyStyle(days);
            const stStyle = getStatusStyle(entry.status);

            return (
              <div key={entry.id} className={`cd-entry${isEditing ? ' editing' : ''}`}>
                {isEditing ? (
                  /* ── EDIT MODE ── */
                  <div className="cd-edit">
                    <div className="cd-edit-grid">
                      <div>
                        <label style={fieldLabel}>Diary No.</label>
                        <input style={inputStyle} type="number" value={editForm.diary_no}
                          onChange={e => setEditForm(f => ({ ...f, diary_no: e.target.value }))} />
                      </div>
                      <div className="cd-edit-full">
                        <label style={fieldLabel}>Parties *</label>
                        <input style={inputStyle} type="text" value={editForm.parties}
                          onChange={e => setEditForm(f => ({ ...f, parties: e.target.value }))} />
                      </div>
                      <div>
                        <label style={fieldLabel}>Case No.</label>
                        <input style={inputStyle} type="text" value={editForm.case_no}
                          onChange={e => setEditForm(f => ({ ...f, case_no: e.target.value }))} />
                      </div>
                      <div>
                        <label style={fieldLabel}>Court</label>
                        <input style={inputStyle} type="text" value={editForm.court}
                          onChange={e => setEditForm(f => ({ ...f, court: e.target.value }))} />
                      </div>
                      <div>
                        <label style={fieldLabel}>Next Date</label>
                        <input style={inputStyle} type="date" value={editForm.next_date}
                          onChange={e => setEditForm(f => ({ ...f, next_date: e.target.value }))} />
                      </div>
                      <div>
                        <label style={fieldLabel}>Next Step</label>
                        <input style={inputStyle} type="text" value={editForm.next_step}
                          onChange={e => setEditForm(f => ({ ...f, next_step: e.target.value }))} />
                      </div>
                      <div>
                        <label style={fieldLabel}>Status</label>
                        <select style={inputStyle} value={editForm.status}
                          onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="cd-edit-full">
                        <label style={fieldLabel}>Previous Dates</label>
                        <input style={inputStyle} type="text" value={editForm.previous_dates}
                          placeholder="e.g. 12.03.2025, 15.04.2025"
                          onChange={e => setEditForm(f => ({ ...f, previous_dates: e.target.value }))} />
                      </div>
                    </div>
                    <div className="cd-edit-actions">
                      <button className="cd-save-btn" onClick={() => saveEdit(entry.id)}
                        disabled={saving || !editForm.parties.trim()}>
                        <CheckIcon size={13} /> {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button className="cd-cancel-btn" onClick={cancelEdit}>
                        <XIcon size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── VIEW MODE ── */
                  <div className="cd-view">
                    {/* Top row: number, parties, status, actions */}
                    <div className="cd-view-top">
                      <span className="cd-no">#{entry.diary_no}</span>
                      <div style={{ flex: 1 }}>
                        {entry.linked_case_id ? (
                          <Link href={`/cases/${entry.linked_case_id}`} className="cd-parties-link">
                            <span className="cd-parties">{entry.parties}</span>
                          </Link>
                        ) : (
                          <span className="cd-parties">{entry.parties}</span>
                        )}
                      </div>
                      <span className="cd-status-badge" style={{ background: stStyle.bg, color: stStyle.color, borderColor: stStyle.border }}>
                        {entry.status}
                      </span>
                      {canEdit && (
                        <div className="cd-actions">
                          <button className="cd-btn-icon" onClick={() => startEdit(entry)} title="Edit entry">
                            <EditIcon size={13} /> <span style={{ display: 'none' }}>Edit</span>
                          </button>
                          <button className="cd-btn-icon danger" onClick={() => handleDelete(entry.id)} title="Delete entry">
                            <TrashIcon size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Fields grid */}
                    <div className="cd-view-fields">
                      {/* Case No */}
                      <div className="cd-field">
                        <div className="cd-field-label">Case No.</div>
                        <div className="cd-field-value mono">{entry.case_no || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
                      </div>

                      {/* Court */}
                      <div className="cd-field">
                        <div className="cd-field-label">Court</div>
                        <div className="cd-field-value">{entry.court || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
                      </div>

                      {/* Next Date */}
                      <div className="cd-field">
                        <div className="cd-field-label">Next Date</div>
                        <div>
                          {entry.next_date ? (
                            <span className="cd-next-date" style={{ background: urgStyle.bg, color: urgStyle.color, borderColor: urgStyle.border }}>
                              <CalendarIcon size={12} />
                              {formatDate(entry.next_date)}
                              {days !== null && days === 0 && <span style={{ fontSize: 10, fontWeight: 700 }}>TODAY</span>}
                              {days !== null && days > 0 && days <= 7 && <span style={{ fontSize: 10 }}>{days}d</span>}
                              {days !== null && days < 0 && <span style={{ fontSize: 10 }}>{Math.abs(days)}d ago</span>}
                            </span>
                          ) : (
                            <span style={{ color: '#cbd5e1', fontSize: 12 }}>Not set</span>
                          )}
                        </div>
                      </div>

                      {/* Next Step */}
                      <div className="cd-field">
                        <div className="cd-field-label">Next Step</div>
                        <div className="cd-field-value">{entry.next_step || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
                      </div>

                      {/* Previous Dates — full width, truncated with expand */}
                      {entry.previous_dates && (
                        <div className="cd-field" style={{ gridColumn: '1 / -1' }}>
                          <div className="cd-field-label">Previous Dates</div>
                          <PreviousDates dates={entry.previous_dates} />
                        </div>
                      )}
                    </div>

                    {/* Case file link */}
                    {entry.linked_case_id && (
                      <Link href={`/cases/${entry.linked_case_id}`} className="cd-case-link">
                        <LinkIcon size={12} /> Open Case File
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Toast notification */}
      {toast && <div className="cd-toast">{toast}</div>}
    </Layout>
  );
}

// Collapsible previous dates component
function PreviousDates({ dates }) {
  const [expanded, setExpanded] = useState(false);
  const parts = dates.split(',').map(d => d.trim()).filter(Boolean);
  const SHOW_COUNT = 5;
  const visible = expanded ? parts : parts.slice(0, SHOW_COUNT);
  const hidden = parts.length - SHOW_COUNT;

  return (
    <div>
      <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
        {visible.join(', ')}
        {!expanded && hidden > 0 && (
          <>
            {' '}
            <button
              onClick={() => setExpanded(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 11, fontWeight: 600, padding: 0 }}>
              +{hidden} more
            </button>
          </>
        )}
        {expanded && hidden > 0 && (
          <>
            {' '}
            <button
              onClick={() => setExpanded(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, fontWeight: 600, padding: 0 }}>
              show less
            </button>
          </>
        )}
      </span>
    </div>
  );
}

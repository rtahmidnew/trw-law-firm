import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function Journal() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [today] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [cases, setCases] = useState([]);
  const [activeTab, setActiveTab] = useState('journal'); // 'journal' | 'reminders'

  // Journal form
  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');
  const [journalCase, setJournalCase] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [savingJournal, setSavingJournal] = useState(false);

  // Reminder form
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDesc, setReminderDesc] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderCase, setReminderCase] = useState('');
  const [reminderNotifyPartner, setReminderNotifyPartner] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, currentMonth, currentYear]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Fetch journal entries for this month
    const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('*, cases(client_name)')
      .eq('user_id', user.id)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: true });
    setJournalEntries(entries || []);

    // Fetch upcoming reminders
    const { data: rems } = await supabase
      .from('reminders')
      .select('*, cases(client_name)')
      .eq('user_id', user.id)
      .gte('reminder_datetime', new Date().toISOString())
      .order('reminder_datetime', { ascending: true });
    setReminders(rems || []);

    // Fetch cases for dropdown
    const { data: casesData } = await supabase
      .from('cases')
      .select('id, client_name')
      .order('client_name');
    setCases(casesData || []);
    setLoading(false);
  }, [user, currentMonth, currentYear]);

  // Get entries for selected date
  const selectedEntries = journalEntries.filter(e => e.entry_date === selectedDate);

  // Get days that have entries (for calendar dots)
  const daysWithEntries = new Set(journalEntries.map(e => e.entry_date));

  // Calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setEditingEntry(null);
    setJournalTitle('');
    setJournalContent('');
    setJournalCase('');
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setJournalTitle(entry.title || '');
    setJournalContent(entry.content);
    setJournalCase(entry.case_id || '');
    setActiveTab('journal');
  };

  const handleSaveJournal = async () => {
    if (!journalContent.trim()) return;
    setSavingJournal(true);
    if (editingEntry) {
      await supabase.from('journal_entries').update({
        title: journalTitle,
        content: journalContent,
        case_id: journalCase || null,
        updated_at: new Date().toISOString()
      }).eq('id', editingEntry.id);
      setMessage('Entry updated.');
    } else {
      await supabase.from('journal_entries').insert({
        user_id: user.id,
        entry_date: selectedDate,
        title: journalTitle,
        content: journalContent,
        case_id: journalCase || null
      });
      setMessage('Entry saved.');
    }
    setEditingEntry(null);
    setJournalTitle('');
    setJournalContent('');
    setJournalCase('');
    setSavingJournal(false);
    fetchData();
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeleteEntry = async (id) => {
    if (!confirm('Delete this journal entry?')) return;
    await supabase.from('journal_entries').delete().eq('id', id);
    fetchData();
  };

  const handleSaveReminder = async () => {
    if (!reminderTitle.trim() || !reminderDate) return;
    setSavingReminder(true);
    const reminderDatetime = `${reminderDate}T${reminderTime}:00`;
    await supabase.from('reminders').insert({
      user_id: user.id,
      title: reminderTitle,
      description: reminderDesc,
      reminder_datetime: reminderDatetime,
      case_id: reminderCase || null,
      notify_partner: reminderNotifyPartner
    });
    // Send email notification via API route
    try {
      await fetch('/api/send-reminder-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reminderTitle,
          description: reminderDesc,
          reminderDatetime,
          notifyPartner: reminderNotifyPartner,
          userEmail: user.email,
          userName: profile?.full_name || user.email
        })
      });
    } catch (e) { /* email sending is best-effort */ }
    setReminderTitle('');
    setReminderDesc('');
    setReminderDate('');
    setReminderTime('09:00');
    setReminderCase('');
    setReminderNotifyPartner(true);
    setShowReminderForm(false);
    setSavingReminder(false);
    setMessage('Reminder set! Email notification sent.');
    fetchData();
    setTimeout(() => setMessage(''), 4000);
  };

  const handleDeleteReminder = async (id) => {
    if (!confirm('Delete this reminder?')) return;
    await supabase.from('reminders').delete().eq('id', id);
    fetchData();
  };

  const formatDateTime = (dt) => {
    const d = new Date(dt);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isToday = (day) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  const isSelected = (day) => {
    if (!day) return false;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === selectedDate;
  };

  const hasEntry = (day) => {
    if (!day) return false;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return daysWithEntries.has(dateStr);
  };

  const formatSelectedDate = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (!user) return null;

  return (
    <Layout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0d1b2a', margin: 0 }}>Journal & Calendar</h1>
            <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>Daily work log, notes, and meeting reminders</p>
          </div>
          <button
            onClick={() => { setShowReminderForm(true); setActiveTab('reminders'); }}
            style={{ background: '#0d1b2a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
          >
            + Set Reminder
          </button>
        </div>

        {message && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#166534', fontSize: 14 }}>
            {message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
          {/* Left: Calendar */}
          <div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 }}>
              {/* Month navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <button onClick={prevMonth} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}>‹</button>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#0d1b2a' }}>{MONTHS[currentMonth]} {currentYear}</span>
                <button onClick={nextMonth} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}>›</button>
              </div>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {DAYS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              {/* Calendar cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {calendarCells.map((day, i) => (
                  <div
                    key={i}
                    onClick={() => handleDayClick(day)}
                    style={{
                      textAlign: 'center',
                      padding: '6px 2px',
                      borderRadius: 6,
                      cursor: day ? 'pointer' : 'default',
                      background: isSelected(day) ? '#0d1b2a' : isToday(day) ? '#dbeafe' : 'transparent',
                      color: isSelected(day) ? '#fff' : isToday(day) ? '#1d4ed8' : day ? '#374151' : 'transparent',
                      fontWeight: isToday(day) || isSelected(day) ? 700 : 400,
                      fontSize: 13,
                      position: 'relative',
                      transition: 'background 0.15s'
                    }}
                  >
                    {day}
                    {hasEntry(day) && (
                      <div style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: isSelected(day) ? '#fff' : '#3b82f6',
                        margin: '2px auto 0'
                      }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Reminders sidebar */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0d1b2a', margin: '0 0 12px' }}>Upcoming Reminders</h3>
              {reminders.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>No upcoming reminders.</p>
              ) : (
                reminders.slice(0, 5).map(r => (
                  <div key={r.id} style={{ borderLeft: '3px solid #f59e0b', paddingLeft: 10, marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0d1b2a' }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(r.reminder_datetime)}</div>
                    {r.cases && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.cases.client_name}</div>}
                  </div>
                ))
              )}
              {reminders.length > 5 && (
                <button onClick={() => setActiveTab('reminders')} style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  View all {reminders.length} reminders →
                </button>
              )}
            </div>
          </div>

          {/* Right: Journal / Reminders panel */}
          <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setActiveTab('journal')}
                style={{
                  padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  background: activeTab === 'journal' ? '#0d1b2a' : '#f1f5f9',
                  color: activeTab === 'journal' ? '#fff' : '#64748b',
                  border: 'none'
                }}
              >
                Journal
              </button>
              <button
                onClick={() => setActiveTab('reminders')}
                style={{
                  padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  background: activeTab === 'reminders' ? '#0d1b2a' : '#f1f5f9',
                  color: activeTab === 'reminders' ? '#fff' : '#64748b',
                  border: 'none'
                }}
              >
                Reminders {reminders.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{reminders.length}</span>}
              </button>
            </div>

            {activeTab === 'journal' && (
              <div>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0d1b2a', margin: '0 0 16px' }}>
                    {editingEntry ? 'Edit Entry — ' : 'New Entry — '}{formatSelectedDate()}
                  </h2>
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={journalTitle}
                    onChange={e => setJournalTitle(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
                  />
                  <textarea
                    placeholder="Write your journal entry for this day — what you worked on, meetings attended, progress made, notes..."
                    value={journalContent}
                    onChange={e => setJournalContent(e.target.value)}
                    rows={6}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <select
                      value={journalCase}
                      onChange={e => setJournalCase(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#374151' }}
                    >
                      <option value="">Link to case (optional)</option>
                      {cases.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                    </select>
                    <button
                      onClick={handleSaveJournal}
                      disabled={savingJournal || !journalContent.trim()}
                      style={{ background: '#0d1b2a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14, opacity: (!journalContent.trim() || savingJournal) ? 0.5 : 1 }}
                    >
                      {savingJournal ? 'Saving...' : editingEntry ? 'Update' : 'Save Entry'}
                    </button>
                    {editingEntry && (
                      <button
                        onClick={() => { setEditingEntry(null); setJournalTitle(''); setJournalContent(''); setJournalCase(''); }}
                        style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Entries for selected date */}
                {selectedEntries.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>
                      Entries for {formatSelectedDate()}
                    </h3>
                    {selectedEntries.map(entry => (
                      <div key={entry.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            {entry.title && <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#0d1b2a' }}>{entry.title}</h4>}
                            <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.content}</p>
                            {entry.cases && (
                              <span style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#3b82f6', background: '#eff6ff', borderRadius: 4, padding: '2px 8px' }}>
                                {entry.cases.client_name}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                            <button onClick={() => handleEditEntry(entry)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#374151' }}>Edit</button>
                            <button onClick={() => handleDeleteEntry(entry.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedEntries.length === 0 && !loading && (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: 14 }}>
                    No journal entries for this date. Write your first entry above.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reminders' && (
              <div>
                {showReminderForm && (
                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0d1b2a', margin: '0 0 16px' }}>Set New Reminder</h2>
                    <input
                      type="text"
                      placeholder="Reminder title (e.g. Court hearing — Selim Reza)"
                      value={reminderTitle}
                      onChange={e => setReminderTitle(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
                    />
                    <textarea
                      placeholder="Description / notes (optional)"
                      value={reminderDesc}
                      onChange={e => setReminderDesc(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date</label>
                        <input
                          type="date"
                          value={reminderDate}
                          onChange={e => setReminderDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Time</label>
                        <input
                          type="time"
                          value={reminderTime}
                          onChange={e => setReminderTime(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                    <select
                      value={reminderCase}
                      onChange={e => setReminderCase(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
                    >
                      <option value="">Link to case (optional)</option>
                      {cases.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', marginBottom: 16, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={reminderNotifyPartner}
                        onChange={e => setReminderNotifyPartner(e.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
                      Also notify partner (info@trfirm.com)
                    </label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={handleSaveReminder}
                        disabled={savingReminder || !reminderTitle.trim() || !reminderDate}
                        style={{ background: '#0d1b2a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14, opacity: (!reminderTitle.trim() || !reminderDate || savingReminder) ? 0.5 : 1 }}
                      >
                        {savingReminder ? 'Setting...' : 'Set Reminder & Notify'}
                      </button>
                      <button
                        onClick={() => setShowReminderForm(false)}
                        style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!showReminderForm && (
                  <button
                    onClick={() => setShowReminderForm(true)}
                    style={{ background: '#fff', color: '#0d1b2a', border: '2px dashed #cbd5e1', borderRadius: 12, padding: '14px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14, width: '100%', marginBottom: 20 }}
                  >
                    + Add New Reminder
                  </button>
                )}

                {reminders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: 14 }}>
                    No upcoming reminders. Set one above to get email notifications.
                  </div>
                ) : (
                  reminders.map(r => {
                    const dt = new Date(r.reminder_datetime);
                    const isOverdue = dt < new Date();
                    return (
                      <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${isOverdue ? '#fca5a5' : '#e2e8f0'}`, padding: 20, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 18 }}>🔔</span>
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0d1b2a' }}>{r.title}</h4>
                              {isOverdue && <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>OVERDUE</span>}
                            </div>
                            {r.description && <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>{r.description}</p>}
                            <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>📅 {formatDateTime(r.reminder_datetime)}</div>
                            {r.cases && <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>📁 {r.cases.client_name}</div>}
                            {r.notify_partner && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>✉ Partner notified at info@trfirm.com</div>}
                          </div>
                          <button onClick={() => handleDeleteReminder(r.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#dc2626', marginLeft: 16 }}>Delete</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

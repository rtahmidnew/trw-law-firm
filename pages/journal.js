import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

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
  const [activeTab, setActiveTab] = useState('journal');

  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');
  const [journalCase, setJournalCase] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [savingJournal, setSavingJournal] = useState(false);

  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDesc, setReminderDesc] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderCase, setReminderCase] = useState('');
  const [reminderNotifyPartner, setReminderNotifyPartner] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [hearingDates, setHearingDates] = useState({});
  const [hearingPopup, setHearingPopup] = useState(null);
  const [monthHearings, setMonthHearings] = useState([]);
  const [allUpcomingHearings, setAllUpcomingHearings] = useState([]);

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
    fetchData();
  }, [user, currentMonth, currentYear]);

  const fetchData = useCallback(async () => {
    setLoading(true);
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

    const { data: rems } = await supabase
      .from('reminders')
      .select('*, cases(client_name)')
      .eq('user_id', user.id)
      .gte('reminder_datetime', new Date().toISOString())
      .order('reminder_datetime', { ascending: true });
    setReminders(rems || []);

    const { data: casesData } = await supabase
      .from('cases')
      .select('id, client_name, file_number')
      .order('client_name');
    setCases(casesData || []);

    // Fetch hearings for current month (for calendar dots) — status = 'Active' (capital A)
    const { data: diaryMonth } = await supabase
      .from('case_diary')
      .select('id, diary_no, parties, next_step, next_date, linked_case_id, cases(id, file_number, client_name)')
      .gte('next_date', startDate)
      .lte('next_date', endDate)
      .eq('status', 'Active')
      .order('next_date', { ascending: true });

    const hdMap = {};
    const hearingsList = [];
    (diaryMonth || []).forEach(d => {
      const entry = {
        id: d.id,
        diary_no: d.diary_no,
        parties: d.parties,
        next_step: d.next_step,
        next_date: d.next_date,
        linked_case_id: d.linked_case_id,
        case_file_number: d.cases?.file_number || null,
        case_client_name: d.cases?.client_name || null,
      };
      if (!hdMap[d.next_date]) hdMap[d.next_date] = [];
      hdMap[d.next_date].push(entry);
      hearingsList.push(entry);
    });
    setHearingDates(hdMap);
    setMonthHearings(hearingsList);

    // Fetch ALL upcoming hearings (for Hearings tab) — not filtered by month
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: diaryAll } = await supabase
      .from('case_diary')
      .select('id, diary_no, parties, next_step, next_date, linked_case_id, cases(id, file_number, client_name)')
      .gte('next_date', todayStr)
      .eq('status', 'Active')
      .order('next_date', { ascending: true });

    setAllUpcomingHearings((diaryAll || []).map(d => ({
      id: d.id,
      diary_no: d.diary_no,
      parties: d.parties,
      next_step: d.next_step,
      next_date: d.next_date,
      linked_case_id: d.linked_case_id,
      case_file_number: d.cases?.file_number || null,
      case_client_name: d.cases?.client_name || null,
    })));

    setLoading(false);
  }, [user, currentMonth, currentYear]);

  const selectedEntries = journalEntries.filter(e => e.entry_date === selectedDate);
  const daysWithEntries = new Set(journalEntries.map(e => e.entry_date));

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

  const getDateStr = (day) => day ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = getDateStr(day);
    setSelectedDate(dateStr);
    setEditingEntry(null);
    setJournalTitle('');
    setJournalContent('');
    setJournalCase('');
    if (hearingDates[dateStr]) {
      setHearingPopup({ day, dateStr, entries: hearingDates[dateStr] });
    } else {
      setHearingPopup(null);
    }
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
      setMsg('Entry updated.');
    } else {
      await supabase.from('journal_entries').insert({
        user_id: user.id,
        entry_date: selectedDate,
        title: journalTitle,
        content: journalContent,
        case_id: journalCase || null
      });
      setMsg('Entry saved.');
    }
    setEditingEntry(null);
    setJournalTitle('');
    setJournalContent('');
    setJournalCase('');
    setSavingJournal(false);
    fetchData();
    setTimeout(() => setMsg(''), 3000);
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
    } catch (e) {}
    setReminderTitle('');
    setReminderDesc('');
    setReminderDate('');
    setReminderTime('09:00');
    setReminderCase('');
    setReminderNotifyPartner(true);
    setShowReminderForm(false);
    setSavingReminder(false);
    setMsg('Reminder set! Email notification sent.');
    fetchData();
    setTimeout(() => setMsg(''), 4000);
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  const isSelected = (day) => !!day && getDateStr(day) === selectedDate;
  const hasEntry = (day) => !!day && daysWithEntries.has(getDateStr(day));
  const hasHearing = (day) => !!day && !!hearingDates[getDateStr(day)];
  const getHearingCount = (day) => !day ? 0 : (hearingDates[getDateStr(day)] || []).length;

  const formatSelectedDate = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0,0,0,0);
    const target = new Date(dateStr + 'T00:00:00');
    return Math.round((target - now) / (1000 * 60 * 60 * 24));
  };

  const urgencyBadge = (dateStr) => {
    const d = daysUntil(dateStr);
    if (d === null) return null;
    if (d < 0) return { label: `${Math.abs(d)}d ago`, bg: '#f1f5f9', color: '#94a3b8' };
    if (d === 0) return { label: 'TODAY', bg: '#fef2f2', color: '#dc2626' };
    if (d === 1) return { label: 'Tomorrow', bg: '#fef2f2', color: '#dc2626' };
    if (d <= 3) return { label: `In ${d} days`, bg: '#fff7ed', color: '#ea580c' };
    if (d <= 7) return { label: `In ${d} days`, bg: '#fefce8', color: '#ca8a04' };
    if (d <= 14) return { label: `In ${d} days`, bg: '#eff6ff', color: '#2563eb' };
    return { label: `In ${d} days`, bg: '#f0fdf4', color: '#16a34a' };
  };

  const borderColor = (dateStr) => {
    const d = daysUntil(dateStr);
    if (d === null || d < 0) return '#e2e8f0';
    if (d <= 3) return '#dc2626';
    if (d <= 7) return '#f59e0b';
    if (d <= 14) return '#3b82f6';
    return '#10b981';
  };

  if (!user) return null;

  return (
    <Layout>
      <style>{`
        .jc-page { max-width: 1400px; margin: 0 auto; padding: 24px 16px; }
        .jc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 12px; flex-wrap: wrap; }
        .jc-title { font-size: 26px; font-weight: 700; color: #0d1b2a; margin: 0; }
        .jc-subtitle { color: #64748b; margin-top: 4px; font-size: 14px; }
        .jc-body { display: grid; grid-template-columns: 1fr; gap: 20px; }
        .jc-calendar-col { width: 100%; }
        .jc-panel-col { width: 100%; }
        .jc-cal-box { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px; }
        .jc-cal-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .jc-cal-nav-btn { background: none; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 14px; cursor: pointer; font-size: 18px; color: #374151; }
        .jc-cal-nav-btn:hover { background: #f8fafc; }
        .jc-cal-month { font-weight: 700; font-size: 18px; color: #0d1b2a; }
        .jc-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .jc-cal-dayhead { text-align: center; font-size: 11px; font-weight: 600; color: #94a3b8; padding: 6px 0; }
        .jc-cal-cell { text-align: center; padding: 8px 2px; border-radius: 8px; cursor: pointer; position: relative; font-size: 14px; font-weight: 400; color: #374151; border: 2px solid transparent; transition: all 0.15s; min-height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
        .jc-cal-cell:hover { background: #f8fafc; }
        .jc-cal-cell.empty { cursor: default; }
        .jc-cal-cell.today { background: #dbeafe; color: #1d4ed8; font-weight: 700; }
        .jc-cal-cell.selected { background: #0d1b2a !important; color: #fff !important; font-weight: 700; }
        .jc-cal-cell.has-hearing { border-color: #f59e0b; }
        .jc-cal-cell.selected.has-hearing { border-color: #fbbf24; }
        .jc-dots { display: flex; justify-content: center; gap: 3px; margin-top: 3px; }
        .jc-dot { width: 5px; height: 5px; border-radius: 50%; }
        .jc-dot-journal { background: #3b82f6; }
        .jc-dot-hearing { background: #f59e0b; }
        .jc-cell-selected .jc-dot-journal { background: #93c5fd; }
        .jc-cell-selected .jc-dot-hearing { background: #fbbf24; }
        .jc-legend { display: flex; gap: 16px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
        .jc-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .jc-popup { background: #fff; border-radius: 12px; border: 2px solid #f59e0b; padding: 16px; margin-top: 16px; }
        .jc-popup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .jc-popup-title { font-size: 14px; font-weight: 700; color: #92400e; margin: 0; }
        .jc-popup-close { background: none; border: none; cursor: pointer; font-size: 18px; color: #94a3b8; line-height: 1; }
        .jc-hearing-item { border-left: 3px solid #f59e0b; padding-left: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #fef3c7; }
        .jc-hearing-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .jc-hearing-parties { font-weight: 700; font-size: 14px; color: #0d1b2a; margin-bottom: 4px; }
        .jc-hearing-step { font-size: 12px; color: #64748b; margin-bottom: 8px; }
        .jc-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .jc-btn-dark { font-size: 12px; color: #fff; background: #0d1b2a; border-radius: 6px; padding: 5px 12px; text-decoration: none; font-weight: 600; border: none; cursor: pointer; }
        .jc-btn-amber { font-size: 12px; color: #92400e; background: #fef3c7; border-radius: 6px; padding: 5px 12px; text-decoration: none; font-weight: 600; border: none; cursor: pointer; }
        .jc-reminders-box { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px; margin-top: 16px; }
        .jc-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .jc-tab { padding: 9px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; border: none; transition: all 0.15s; }
        .jc-tab.active { background: #0d1b2a; color: #fff; }
        .jc-tab.inactive { background: #f1f5f9; color: #64748b; }
        .jc-tab.inactive:hover { background: #e2e8f0; }
        .jc-badge { background: #f59e0b; color: #fff; border-radius: 10px; padding: 1px 7px; font-size: 11px; margin-left: 6px; }
        .jc-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 14px; }
        .jc-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; box-sizing: border-box; font-family: inherit; }
        .jc-input:focus { outline: none; border-color: #94a3b8; }
        .jc-textarea { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; box-sizing: border-box; font-family: inherit; resize: vertical; }
        .jc-textarea:focus { outline: none; border-color: #94a3b8; }
        .jc-select { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; box-sizing: border-box; background: #fff; }
        .jc-save-btn { background: #0d1b2a; color: #fff; border: none; border-radius: 8px; padding: 10px 24px; font-weight: 600; cursor: pointer; font-size: 14px; }
        .jc-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .jc-cancel-btn { background: #f1f5f9; color: #64748b; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; font-size: 14px; }
        .jc-hearing-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 18px; margin-bottom: 12px; }
        .jc-hearing-card-parties { font-size: 15px; font-weight: 700; color: #0d1b2a; margin: 0 0 6px; }
        .jc-hearing-card-date { font-size: 13px; color: #64748b; margin-bottom: 6px; }
        .jc-hearing-card-step { font-size: 13px; color: #374151; margin-bottom: 10px; }
        .jc-badge-pill { font-size: 11px; font-weight: 700; border-radius: 6px; padding: 3px 9px; display: inline-block; }
        .jc-diary-badge { font-size: 11px; font-weight: 700; background: #f1f5f9; color: #64748b; border-radius: 6px; padding: 3px 9px; }
        .jc-msg { background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; color: #166534; font-size: 14px; }
        .jc-empty { text-align: center; padding: 48px 24px; color: #94a3b8; font-size: 14px; }
        .jc-set-reminder-btn { background: #0d1b2a; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; font-size: 14px; white-space: nowrap; }
        @media (min-width: 900px) {
          .jc-body { grid-template-columns: 380px 1fr; }
          .jc-title { font-size: 30px; }
        }
        @media (min-width: 1200px) {
          .jc-body { grid-template-columns: 420px 1fr; }
        }
        @media (max-width: 480px) {
          .jc-page { padding: 16px 12px; }
          .jc-cal-cell { padding: 6px 1px; min-height: 38px; font-size: 13px; }
          .jc-tab { padding: 8px 14px; font-size: 13px; }
        }
      `}</style>

      <div className="jc-page">
        {/* Header */}
        <div className="jc-header">
          <div>
            <h1 className="jc-title">Journal &amp; Calendar</h1>
            <p className="jc-subtitle">
              Daily work log, notes, and court hearing tracker
              {allUpcomingHearings.length > 0 && (
                <span style={{ marginLeft: 10, background: '#fef3c7', color: '#92400e', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                  ⚖ {allUpcomingHearings.length} upcoming hearing{allUpcomingHearings.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <button className="jc-set-reminder-btn" onClick={() => { setShowReminderForm(true); setActiveTab('reminders'); }}>
            + Set Reminder
          </button>
        </div>

        {msg && <div className="jc-msg">{msg}</div>}

        <div className="jc-body">
          {/* LEFT: Calendar column */}
          <div className="jc-calendar-col">
            <div className="jc-cal-box">
              {/* Month nav */}
              <div className="jc-cal-nav">
                <button className="jc-cal-nav-btn" onClick={prevMonth}>‹</button>
                <span className="jc-cal-month">{MONTHS[currentMonth]} {currentYear}</span>
                <button className="jc-cal-nav-btn" onClick={nextMonth}>›</button>
              </div>

              {/* Day headers */}
              <div className="jc-cal-grid" style={{ marginBottom: 4 }}>
                {DAYS.map(d => <div key={d} className="jc-cal-dayhead">{d}</div>)}
              </div>

              {/* Calendar cells */}
              <div className="jc-cal-grid">
                {calendarCells.map((day, i) => {
                  const hCount = getHearingCount(day);
                  const sel = isSelected(day);
                  const tod = isToday(day);
                  const hEntry = hasEntry(day);
                  const hHear = hasHearing(day);
                  let cls = 'jc-cal-cell';
                  if (!day) cls += ' empty';
                  else if (sel) cls += ' selected';
                  else if (tod) cls += ' today';
                  if (hHear) cls += ' has-hearing';

                  return (
                    <div key={i} className={cls} onClick={() => handleDayClick(day)}>
                      <span>{day}</span>
                      {(hEntry || hHear) && (
                        <div className="jc-dots">
                          {hEntry && <div className={`jc-dot jc-dot-journal${sel ? ' jc-cell-selected' : ''}`} style={sel ? { background: '#93c5fd' } : {}} />}
                          {hHear && <div className={`jc-dot jc-dot-hearing${sel ? ' jc-cell-selected' : ''}`} style={sel ? { background: '#fbbf24' } : {}} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="jc-legend">
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="jc-legend-dot" style={{ background: '#3b82f6' }} /> Journal entry
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="jc-legend-dot" style={{ background: '#f59e0b' }} /> Court hearing
                </span>
              </div>
            </div>

            {/* Hearing popup */}
            {hearingPopup && (
              <div className="jc-popup">
                <div className="jc-popup-header">
                  <h4 className="jc-popup-title">⚖ {hearingPopup.entries.length} Hearing{hearingPopup.entries.length !== 1 ? 's' : ''} — {formatDate(hearingPopup.dateStr)}</h4>
                  <button className="jc-popup-close" onClick={() => setHearingPopup(null)}>✕</button>
                </div>
                {hearingPopup.entries.map(h => (
                  <div key={h.id} className="jc-hearing-item">
                    <div className="jc-hearing-parties">#{h.diary_no} — {h.parties}</div>
                    {h.next_step && <div className="jc-hearing-step"><strong>Next Step:</strong> {h.next_step}</div>}
                    <div className="jc-btn-row">
                      {h.linked_case_id && (
                        <Link href={`/cases/${h.linked_case_id}`} className="jc-btn-dark">Open Case File →</Link>
                      )}
                      <Link href="/case-diary" className="jc-btn-amber">Case Diary</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming Reminders */}
            <div className="jc-reminders-box">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0d1b2a', margin: '0 0 12px' }}>Upcoming Reminders</h3>
              {reminders.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No upcoming reminders.</p>
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

          {/* RIGHT: Panel */}
          <div className="jc-panel-col">
            {/* Tabs */}
            <div className="jc-tabs">
              <button className={`jc-tab ${activeTab === 'journal' ? 'active' : 'inactive'}`} onClick={() => setActiveTab('journal')}>Journal</button>
              <button className={`jc-tab ${activeTab === 'reminders' ? 'active' : 'inactive'}`} onClick={() => setActiveTab('reminders')}>
                Reminders {reminders.length > 0 && <span className="jc-badge">{reminders.length}</span>}
              </button>
              <button className={`jc-tab ${activeTab === 'hearings' ? 'active' : 'inactive'}`} onClick={() => setActiveTab('hearings')}>
                Hearings {allUpcomingHearings.length > 0 && <span className="jc-badge">{allUpcomingHearings.length}</span>}
              </button>
            </div>

            {/* JOURNAL TAB */}
            {activeTab === 'journal' && (
              <div>
                <div className="jc-card">
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0d1b2a', margin: '0 0 16px' }}>
                    {editingEntry ? 'Edit Entry — ' : 'New Entry — '}{formatSelectedDate()}
                  </h2>
                  <input className="jc-input" type="text" placeholder="Title (optional)" value={journalTitle} onChange={e => setJournalTitle(e.target.value)} style={{ marginBottom: 12 }} />
                  <textarea
                    className="jc-textarea"
                    placeholder="Write your journal entry for this day — what you worked on, meetings attended, progress made, notes..."
                    value={journalContent}
                    onChange={e => setJournalContent(e.target.value)}
                    rows={6}
                    style={{ marginBottom: 12 }}
                  />
                  <select className="jc-select" value={journalCase} onChange={e => setJournalCase(e.target.value)} style={{ marginBottom: 14 }}>
                    <option value="">Link to case (optional)</option>
                    {cases.map(c => <option key={c.id} value={c.id}>{c.client_name}{c.file_number ? ` (${c.file_number})` : ''}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="jc-save-btn" onClick={handleSaveJournal} disabled={savingJournal || !journalContent.trim()}>
                      {savingJournal ? 'Saving...' : editingEntry ? 'Update' : 'Save Entry'}
                    </button>
                    {editingEntry && (
                      <button className="jc-cancel-btn" onClick={() => { setEditingEntry(null); setJournalTitle(''); setJournalContent(''); setJournalCase(''); }}>Cancel</button>
                    )}
                  </div>
                </div>

                {selectedEntries.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>Entries for {formatSelectedDate()}</h3>
                    {selectedEntries.map(entry => (
                      <div key={entry.id} className="jc-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            {entry.title && <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#0d1b2a' }}>{entry.title}</h4>}
                            <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.content}</p>
                            {entry.cases && (
                              <span style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#3b82f6', background: '#eff6ff', borderRadius: 4, padding: '2px 8px' }}>
                                {entry.cases.client_name}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button onClick={() => handleEditEntry(entry)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#374151' }}>Edit</button>
                            <button onClick={() => handleDeleteEntry(entry.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedEntries.length === 0 && !loading && (
                  <div className="jc-empty">No journal entries for this date. Write your first entry above.</div>
                )}
              </div>
            )}

            {/* REMINDERS TAB */}
            {activeTab === 'reminders' && (
              <div>
                {showReminderForm && (
                  <div className="jc-card">
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0d1b2a', margin: '0 0 16px' }}>Set New Reminder</h2>
                    <input className="jc-input" type="text" placeholder="Reminder title (e.g. Court hearing — Selim Reza)" value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} style={{ marginBottom: 12 }} />
                    <textarea className="jc-textarea" placeholder="Description / notes (optional)" value={reminderDesc} onChange={e => setReminderDesc(e.target.value)} rows={3} style={{ marginBottom: 12 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date</label>
                        <input className="jc-input" type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Time</label>
                        <input className="jc-input" type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
                      </div>
                    </div>
                    <select className="jc-select" value={reminderCase} onChange={e => setReminderCase(e.target.value)} style={{ marginBottom: 12 }}>
                      <option value="">Link to case (optional)</option>
                      {cases.map(c => <option key={c.id} value={c.id}>{c.client_name}{c.file_number ? ` (${c.file_number})` : ''}</option>)}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', marginBottom: 16, cursor: 'pointer' }}>
                      <input type="checkbox" checked={reminderNotifyPartner} onChange={e => setReminderNotifyPartner(e.target.checked)} style={{ width: 16, height: 16 }} />
                      Also notify partner (info@trfirm.com &amp; info@trwbd.com)
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="jc-save-btn" onClick={handleSaveReminder} disabled={savingReminder || !reminderTitle.trim() || !reminderDate}>
                        {savingReminder ? 'Setting...' : 'Set Reminder & Notify'}
                      </button>
                      <button className="jc-cancel-btn" onClick={() => setShowReminderForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {!showReminderForm && (
                  <button onClick={() => setShowReminderForm(true)} style={{ background: '#fff', color: '#0d1b2a', border: '2px dashed #cbd5e1', borderRadius: 12, padding: '14px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14, width: '100%', marginBottom: 20 }}>
                    + Add New Reminder
                  </button>
                )}

                {reminders.length === 0 ? (
                  <div className="jc-empty">No upcoming reminders. Set one above to get email notifications.</div>
                ) : (
                  reminders.map(r => {
                    const dt = new Date(r.reminder_datetime);
                    const isOverdue = dt < new Date();
                    return (
                      <div key={r.id} className="jc-card" style={{ borderColor: isOverdue ? '#fca5a5' : '#e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isOverdue ? '#dc2626' : '#0d1b2a' }}>{r.title}</h4>
                              {isOverdue && <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '2px 6px' }}>Overdue</span>}
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{formatDateTime(r.reminder_datetime)}</div>
                            {r.description && <p style={{ margin: '4px 0', fontSize: 13, color: '#374151' }}>{r.description}</p>}
                            {r.cases && <span style={{ display: 'inline-block', fontSize: 12, color: '#3b82f6', background: '#eff6ff', borderRadius: 4, padding: '2px 8px' }}>{r.cases.client_name}</span>}
                          </div>
                          <button onClick={() => handleDeleteReminder(r.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#dc2626', flexShrink: 0 }}>Delete</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* HEARINGS TAB */}
            {activeTab === 'hearings' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0d1b2a', margin: 0 }}>
                    All Upcoming Court Hearings
                  </h2>
                  <Link href="/case-diary" style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
                    Full Case Diary →
                  </Link>
                </div>

                {loading && <div style={{ color: '#94a3b8', fontSize: 14, padding: 24 }}>Loading hearings...</div>}

                {!loading && allUpcomingHearings.length === 0 && (
                  <div className="jc-empty">No upcoming court hearings found.</div>
                )}

                {!loading && allUpcomingHearings.map(h => {
                  const badge = urgencyBadge(h.next_date);
                  const bc = borderColor(h.next_date);
                  return (
                    <div key={h.id} className="jc-hearing-card" style={{ borderLeft: `4px solid ${bc}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span className="jc-diary-badge">Diary #{h.diary_no}</span>
                        {badge && (
                          <span className="jc-badge-pill" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                        )}
                      </div>
                      <h4 className="jc-hearing-card-parties">{h.parties}</h4>
                      <div className="jc-hearing-card-date">📅 <strong>Hearing:</strong> {formatDate(h.next_date)}</div>
                      {h.next_step && <div className="jc-hearing-card-step"><strong>Next Step:</strong> {h.next_step}</div>}
                      <div className="jc-btn-row">
                        {h.linked_case_id && (
                          <Link href={`/cases/${h.linked_case_id}`} className="jc-btn-dark">Open Case File →</Link>
                        )}
                        <Link href="/case-diary" className="jc-btn-amber">Case Diary</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

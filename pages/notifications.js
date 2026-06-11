import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error) setNotifications(data || []);
    setLoading(false);
  }

  async function markAsRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function deleteNotification(id) {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getTypeLabel(type) {
    if (type === 'hearing_reminder_1d') return 'Tomorrow';
    if (type === 'hearing_reminder_3d') return 'In 3 Days';
    if (type === 'hearing_reminder_7d') return 'In 7 Days';
    if (type === 'hearing_reminder') return 'Hearing';
    if (type === 'new_enquiry') return 'New Enquiry';
    return 'Notification';
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'hearing') return n.type?.includes('hearing');
    if (filter === 'enquiry') return n.type === 'new_enquiry';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Layout>
      <Head><title>Notifications — TRW Law Firm</title></Head>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0d1b2a', margin: 0, letterSpacing: '-0.02em' }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
                {unreadCount} unread
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none', color: '#0d1b2a', border: '1px solid #d1d5db',
                  borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '0.01em'
                }}
              >
                Mark all read
              </button>
            )}
            {/* Close / back button */}
            <button
              onClick={() => router.back()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 7,
                background: 'none', border: '1px solid #d1d5db',
                cursor: 'pointer', color: '#374151'
              }}
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="13" y2="13"/>
                <line x1="13" y1="1" x2="1" y2="13"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            { key: 'hearing', label: 'Hearings' },
            { key: 'enquiry', label: 'Enquiries' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 16px', fontSize: 13,
                fontWeight: filter === tab.key ? 700 : 400,
                color: filter === tab.key ? '#0d1b2a' : '#9ca3af',
                borderBottom: filter === tab.key ? '2px solid #0d1b2a' : '2px solid transparent',
                marginBottom: -1
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p style={{ margin: 0, fontSize: 14 }}>No notifications{filter !== 'all' ? ' here' : ''}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filtered.map((n, i) => (
              <div
                key={n.id}
                style={{
                  background: n.is_read ? '#fff' : '#fafafa',
                  borderTop: i === 0 ? '1px solid #e5e7eb' : 'none',
                  borderBottom: '1px solid #e5e7eb',
                  padding: '16px 0',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  cursor: n.is_read ? 'default' : 'pointer',
                }}
                onClick={() => !n.is_read && markAsRead(n.id)}
              >
                {/* Unread dot */}
                <div style={{ width: 20, flexShrink: 0, paddingTop: 4, display: 'flex', justifyContent: 'center' }}>
                  {!n.is_read && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d1b2a', display: 'inline-block', marginTop: 2 }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: 3 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: '#9ca3af'
                    }}>
                      {getTypeLabel(n.type)}
                    </span>
                  </div>
                  <p style={{
                    margin: '0 0 4px', fontSize: 14,
                    fontWeight: n.is_read ? 400 : 600,
                    color: '#0d1b2a', lineHeight: 1.45
                  }}>
                    {n.title}
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatDate(n.created_at)}</span>
                    {n.linked_case_id && (
                      <Link href={`/cases/${n.linked_case_id}`}>
                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                          Open Case →
                        </span>
                      </Link>
                    )}
                    {n.type?.includes('hearing') && (
                      <Link href="/case-diary">
                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                          View Diary →
                        </span>
                      </Link>
                    )}
                    {!n.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          fontSize: 12, color: '#9ca3af', cursor: 'pointer',
                          textDecoration: 'underline', textUnderlineOffset: 2
                        }}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                  title="Dismiss"
                  style={{
                    background: 'none', border: 'none', padding: '2px 4px',
                    cursor: 'pointer', color: '#d1d5db', flexShrink: 0,
                    lineHeight: 1, fontSize: 16, marginTop: 2
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="13" y2="13"/>
                    <line x1="13" y1="1" x2="1" y2="13"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

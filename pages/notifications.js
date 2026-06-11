import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'hearing' | 'enquiry'

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

  function getNotificationStyle(type) {
    if (type === 'hearing_reminder_1d') return { border: '#dc2626', bg: '#fef2f2', icon: '🔴', label: 'Tomorrow' };
    if (type === 'hearing_reminder_3d') return { border: '#f59e0b', bg: '#fffbeb', icon: '🟡', label: 'In 3 Days' };
    if (type === 'hearing_reminder_7d') return { border: '#3b82f6', bg: '#eff6ff', icon: '🔵', label: 'In 7 Days' };
    if (type === 'hearing_reminder') return { border: '#dc2626', bg: '#fef2f2', icon: '⚖', label: 'Hearing' };
    if (type === 'new_enquiry') return { border: '#10b981', bg: '#f0fdf4', icon: '📧', label: 'New Enquiry' };
    return { border: '#6b7280', bg: '#f9fafb', icon: '🔔', label: 'Notification' };
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
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0d1b2a', margin: 0 }}>Notifications</h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{ background: '#0d1b2a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
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
                background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px',
                fontSize: 13, fontWeight: filter === tab.key ? 700 : 500,
                color: filter === tab.key ? '#0d1b2a' : '#64748b',
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
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <p style={{ margin: 0, fontSize: 15 }}>No notifications{filter !== 'all' ? ' in this category' : ''}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(n => {
              const style = getNotificationStyle(n.type);
              return (
                <div
                  key={n.id}
                  style={{
                    background: n.is_read ? '#fff' : style.bg,
                    border: `1px solid ${n.is_read ? '#e2e8f0' : style.border}30`,
                    borderLeft: `4px solid ${n.is_read ? '#e2e8f0' : style.border}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    cursor: n.is_read ? 'default' : 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                >
                  {/* Icon */}
                  <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{style.icon}</div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: n.is_read ? '#94a3b8' : style.border,
                        background: `${style.border}15`, padding: '2px 8px', borderRadius: 4
                      }}>
                        {style.label}
                      </span>
                      {!n.is_read && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.border, display: 'inline-block' }} />
                      )}
                    </div>
                    <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: n.is_read ? 500 : 700, color: '#0d1b2a', lineHeight: 1.4 }}>
                      {n.title}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                      {n.message}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(n.created_at)}</span>
                      {n.linked_case_id && (
                        <Link href={`/cases/${n.linked_case_id}`}>
                          <span style={{ fontSize: 11, color: '#0d1b2a', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                            Open Case →
                          </span>
                        </Link>
                      )}
                      {n.type?.includes('hearing') && (
                        <Link href="/case-diary">
                          <span style={{ fontSize: 11, color: '#0d1b2a', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                            View Diary →
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {!n.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        title="Mark as read"
                        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#64748b', whiteSpace: 'nowrap' }}
                      >
                        ✓ Read
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      title="Delete"
                      style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#dc2626' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

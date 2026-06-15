import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function Layout({ children }) {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Use onAuthStateChange so we wait for the session to be fully restored
    // from localStorage before deciding whether to redirect to /
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (!session) {
          router.push('/')
          return
        }
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setProfile(data)
        setProfileLoaded(true)
      } else if (event === 'SIGNED_OUT') {
        router.push('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load unread notification count
  useEffect(() => {
    async function loadUnreadCount() {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }
    loadUnreadCount()

    // Poll every 60 seconds for new notifications
    const interval = setInterval(loadUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  // Close menu on route change; refresh count when visiting notifications page
  useEffect(() => {
    setMenuOpen(false)
    if (router.pathname === '/notifications') {
      setTimeout(async () => {
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
        setUnreadCount(count || 0)
      }, 2000)
    }
  }, [router.pathname, router.query])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Only determine role once profile is loaded — prevents associate nav flash on partner pages
  const isPartner = profileLoaded ? profile?.role === 'partner' : null

  const partnerLinks = [
    { href: '/admin', label: 'Overview', exact: true },
    { href: '/admin/all-cases', label: 'All Cases', startsWith: '/admin/all' },
    { href: '/case-diary', label: 'Case Diary', exact: true },
    { href: '/instructions', label: 'Instructions', exact: true },
    { href: '/journal', label: 'Journal', exact: true },
  ]

  const associateLinks = [
    { href: '/dashboard', label: 'Dashboard', exact: true },
    { href: '/cases?assigned=me', label: 'My Cases', matchFn: () => router.pathname === '/cases' && router.query.assigned === 'me' },
    { href: '/cases', label: 'All Cases', matchFn: () => router.pathname === '/cases' && !router.query.assigned },
    { href: '/case-diary', label: 'Case Diary', exact: true },
    { href: '/instructions', label: 'Instructions', exact: true },
    { href: '/journal', label: 'Journal', exact: true },
    { href: '/cases/new', label: '+ New Case', exact: true },
  ]

  // While profile is loading, show no nav links (prevents flash of wrong role nav)
  const navLinks = isPartner === null ? [] : (isPartner ? partnerLinks : associateLinks)

  function isActive(link) {
    if (link.matchFn) return link.matchFn()
    if (link.startsWith) return router.pathname.startsWith(link.startsWith)
    if (link.exact) return router.pathname === link.href
    return false
  }

  const isNotificationsActive = router.pathname === '/notifications'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <nav style={{ backgroundColor: 'rgb(13, 27, 42)' }} className="text-white shadow-lg relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Left: Logo */}
            <div className="flex items-center gap-8">
              <Link href={isPartner ? '/admin' : '/dashboard'}>
                <span className="flex items-center cursor-pointer">
                  <img
                    src="/trw-logo.webp"
                    alt="TRW Law Firm"
                    style={{ height: '36px', width: 'auto', filter: 'brightness(0) invert(1)' }}
                  />
                </span>
              </Link>

              {/* Desktop nav links — only rendered once profile is loaded */}
              <div className="hidden sm:flex items-center gap-4 text-sm">
                {navLinks.map(link => (
                  <Link key={link.href} href={link.href}>
                    <span className={`cursor-pointer transition-colors ${isActive(link) ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}>
                      {link.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: Notifications bell + User info + logout + hamburger */}
            <div className="flex items-center gap-3">

              {/* Notification Bell — desktop */}
              <Link href="/notifications">
                <span
                  className="hidden sm:flex relative cursor-pointer items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: isNotificationsActive ? '#fff' : '#d1d5db' }}
                  title="Notifications"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: 4, right: 4,
                      background: '#dc2626', color: '#fff',
                      borderRadius: '50%', width: 16, height: 16,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1, border: '1.5px solid rgb(13,27,42)'
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
              </Link>

              {/* User info — desktop only */}
              {profile && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: '#374151' }}>
                    {profile.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium leading-none">{profile.full_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                  </div>
                </div>
              )}

              {/* Logout — desktop only */}
              <button
                onClick={handleLogout}
                className="hidden sm:block text-xs px-3 py-1.5 rounded-lg transition-colors text-white border border-gray-600 hover:border-gray-400"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                Logout
              </button>

              {/* Notification Bell — mobile only, beside hamburger */}
              <Link href="/notifications">
                <span
                  className="sm:hidden relative flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer transition-colors"
                  style={{ color: isNotificationsActive ? '#fff' : '#d1d5db' }}
                  title="Notifications"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: 4, right: 4,
                      background: '#dc2626', color: '#fff',
                      borderRadius: '50%', width: 16, height: 16,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1, border: '1.5px solid rgb(13,27,42)'
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
              </Link>

              {/* Hamburger button — mobile only */}
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                className="sm:hidden flex flex-col justify-center items-center w-9 h-9 rounded-lg gap-1.5 transition-colors"
                style={{ backgroundColor: menuOpen ? 'rgba(255,255,255,0.12)' : 'transparent' }}
                aria-label="Toggle menu"
              >
                <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {menuOpen && (
          <div
            className="sm:hidden border-t border-gray-700"
            style={{ backgroundColor: 'rgb(13, 27, 42)' }}
          >
            {/* User info strip */}
            {profile && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: '#374151' }}>
                  {profile.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{profile.full_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                </div>
              </div>
            )}

            {/* Nav links — only rendered once profile is loaded */}
            <div className="py-2">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href}>
                  <span
                    className={`flex items-center px-4 py-3 text-sm cursor-pointer transition-colors ${
                      isActive(link)
                        ? 'text-white font-semibold bg-white/10 border-l-2 border-white'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}

              {/* Notifications link in mobile menu */}
              <Link href="/notifications">
                <span
                  className={`flex items-center justify-between px-4 py-3 text-sm cursor-pointer transition-colors ${
                    isNotificationsActive
                      ? 'text-white font-semibold bg-white/10 border-l-2 border-white'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span style={{
                      background: '#dc2626', color: '#fff',
                      borderRadius: 10, padding: '1px 7px',
                      fontSize: 11, fontWeight: 700
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
              </Link>
            </div>

            {/* Logout */}
            <div className="px-4 py-3 border-t border-gray-700">
              <button
                onClick={handleLogout}
                className="w-full text-sm py-2.5 rounded-lg text-white border border-gray-600 transition-colors hover:border-gray-400"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

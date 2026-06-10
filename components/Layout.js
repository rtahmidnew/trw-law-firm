import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function Layout({ children }) {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(data)
    }
    loadProfile()
  }, [])

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [router.pathname, router.query])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isPartner = profile?.role === 'partner'

  const partnerLinks = [
    { href: '/admin', label: 'Overview', exact: true },
    { href: '/admin/all-cases', label: 'All Cases', startsWith: '/admin/all' },
    { href: '/instructions', label: 'Instructions', exact: true },
    { href: '/journal', label: 'Journal', exact: true },
  ]

  const associateLinks = [
    { href: '/dashboard', label: 'Dashboard', exact: true },
    { href: '/cases?assigned=me', label: 'My Cases', matchFn: () => router.pathname === '/cases' && router.query.assigned === 'me' },
    { href: '/cases', label: 'All Cases', matchFn: () => router.pathname === '/cases' && !router.query.assigned },
    { href: '/instructions', label: 'Instructions', exact: true },
    { href: '/journal', label: 'Journal', exact: true },
    { href: '/cases/new', label: '+ New Case', exact: true },
  ]

  const navLinks = isPartner ? partnerLinks : associateLinks

  function isActive(link) {
    if (link.matchFn) return link.matchFn()
    if (link.startsWith) return router.pathname.startsWith(link.startsWith)
    if (link.exact) return router.pathname === link.href
    return false
  }

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

              {/* Desktop nav links */}
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

            {/* Right: User info + logout + hamburger */}
            <div className="flex items-center gap-3">
              {/* User info — desktop only */}
              {profile && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: 'rgb(0, 200, 150)' }}>
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
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: 'rgb(0, 200, 150)' }}>
                  {profile.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{profile.full_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                </div>
              </div>
            )}

            {/* Nav links */}
            <div className="py-2">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href}>
                  <span
                    className={`flex items-center px-4 py-3 text-sm cursor-pointer transition-colors ${
                      isActive(link)
                        ? 'text-white font-semibold bg-white/10 border-l-2 border-emerald-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
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

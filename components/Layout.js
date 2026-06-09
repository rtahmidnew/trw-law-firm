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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isPartner = profile?.role === 'partner'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <nav className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Nav Links */}
            <div className="flex items-center gap-8">
              <Link href={isPartner ? '/admin' : '/dashboard'}>
                <span className="flex items-center gap-2 font-bold text-lg tracking-wide cursor-pointer">
                  <span className="bg-white text-blue-900 rounded px-2 py-0.5 text-sm font-extrabold">TRW</span>
                  <span className="hidden sm:inline">Law Firm</span>
                </span>
              </Link>
              <div className="hidden sm:flex items-center gap-4 text-sm">
                {isPartner ? (
                  <>
                    <Link href="/admin">
                      <span className={`cursor-pointer hover:text-blue-200 transition-colors ${router.pathname === '/admin' ? 'text-white font-semibold' : 'text-blue-200'}`}>
                        Overview
                      </span>
                    </Link>
                    <Link href="/admin/all-cases">
                      <span className={`cursor-pointer hover:text-blue-200 transition-colors ${router.pathname.startsWith('/admin/all') ? 'text-white font-semibold' : 'text-blue-200'}`}>
                        All Cases
                      </span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/dashboard">
                      <span className={`cursor-pointer hover:text-blue-200 transition-colors ${router.pathname === '/dashboard' ? 'text-white font-semibold' : 'text-blue-200'}`}>
                        My Cases
                      </span>
                    </Link>
                    <Link href="/cases/new">
                      <span className={`cursor-pointer hover:text-blue-200 transition-colors ${router.pathname === '/cases/new' ? 'text-white font-semibold' : 'text-blue-200'}`}>
                        + New Case
                      </span>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right: User info + logout */}
            <div className="flex items-center gap-3">
              {profile && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                    {profile.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium leading-none">{profile.full_name}</p>
                    <p className="text-xs text-blue-300 capitalize">{profile.role}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-xs bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

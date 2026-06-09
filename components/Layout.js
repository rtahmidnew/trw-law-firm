import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Image from 'next/image'
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
      <nav style={{ backgroundColor: 'rgb(13, 27, 42)' }} className="text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Nav Links */}
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
              <div className="hidden sm:flex items-center gap-4 text-sm">
                {isPartner ? (
                  <>
                    <Link href="/admin">
                      <span className={`cursor-pointer transition-colors ${router.pathname === '/admin' ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}>
                        Overview
                      </span>
                    </Link>
                    <Link href="/admin/all-cases">
                      <span className={`cursor-pointer transition-colors ${router.pathname.startsWith('/admin/all') ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}>
                        All Cases
                      </span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/dashboard">
                      <span className={`cursor-pointer transition-colors ${router.pathname === '/dashboard' ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}>
                        My Cases
                      </span>
                    </Link>
                    <Link href="/cases/new">
                      <span className={`cursor-pointer transition-colors ${router.pathname === '/cases/new' ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}>
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
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: 'rgb(0, 200, 150)' }}>
                    {profile.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium leading-none">{profile.full_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors text-white border border-gray-600 hover:border-gray-400"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
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

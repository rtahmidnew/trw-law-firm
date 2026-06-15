import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

/**
 * useAuth - reliable auth hook for TRW Law Firm portal
 *
 * Usage:
 *   const { user, profile, authLoading } = useAuth({ requiredRole: 'partner' })
 *
 * - Waits for the Supabase session to be fully established (handles the
 *   localStorage async read on first mount).
 * - If requiredRole is set and the user's role doesn't match, redirects to
 *   the appropriate page.
 * - Returns authLoading=true until the session check is complete.
 */
export function useAuth({ requiredRole = null } = {}) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function init(sessionUser) {
      if (!sessionUser) {
        if (!cancelled) {
          router.push('/')
        }
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single()

      if (cancelled) return

      if (!prof) {
        router.push('/')
        return
      }

      if (requiredRole && prof.role !== requiredRole) {
        router.push(prof.role === 'partner' ? '/admin' : '/dashboard')
        return
      }

      setUser(sessionUser)
      setProfile(prof)
      setAuthLoading(false)
    }

    // First, try getSession() — works if session is already in localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        init(session.user)
      } else {
        // Session not yet available — wait for onAuthStateChange
        // This handles the race condition on fresh page loads
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            subscription.unsubscribe()
            if (session?.user) {
              init(session.user)
            } else {
              if (!cancelled) router.push('/')
            }
          } else if (event === 'SIGNED_OUT') {
            subscription.unsubscribe()
            if (!cancelled) router.push('/')
          }
        })
      }
    })

    return () => { cancelled = true }
  }, [])

  return { user, profile, authLoading }
}

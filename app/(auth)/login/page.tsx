// app/(auth)/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Inter_Tight } from 'next/font/google'
import { ArrowUpRight, Loader2 } from 'lucide-react'

const display = Inter_Tight({
  subsets: ['latin'],
  weight: ['500', '600', '800'],
  display: 'swap',
})

const inputClass =
  'mt-2 h-12 w-full rounded-2xl bg-neutral-100 px-4 text-sm font-medium outline-none transition-all duration-300 placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-950'

const labelClass = 'text-sm font-semibold text-neutral-500'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (data.authenticated) {
          router.push('/admin')
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        router.push('/admin')
        router.refresh()
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div
        className={`${display.className} flex min-h-screen items-center justify-center bg-white`}
      >
        <div className="h-1 w-40 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${display.className} flex min-h-screen items-center justify-center bg-white px-5 py-10 text-neutral-950 sm:px-8`}
    >
      <div className="w-full max-w-md duration-700 animate-in fade-in slide-in-from-bottom-6">
        {/* Header */}
        <div className="inline-flex items-center gap-2 rounded-md bg-blue-600/10 px-3.5 py-1.5 text-sm font-semibold text-blue-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
          </span>
          Admin access
        </div>

        <h1 className="mt-4 text-balance text-6xl font-extrabold leading-[0.9] tracking-[-0.045em] sm:text-7xl">
          WhiteWalk
          <br />
          Admin.
        </h1>
        <p className="mt-4 text-base font-medium text-neutral-500">
          Sign in to manage your store.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-3xl bg-red-50 p-4 text-sm font-semibold text-red-700 duration-300 animate-in fade-in slide-in-from-top-2"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              placeholder="Enter your email"
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group flex h-14 w-full items-center justify-between rounded-full bg-neutral-950 pl-6 pr-1.5 text-white transition-all duration-300 hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-neutral-950"
            >
              <span className="text-lg font-extrabold tracking-[-0.03em]">
                {loading ? 'Signing in…' : 'Sign in'}
              </span>
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-950 transition-transform duration-300 group-enabled:group-hover:rotate-45"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-5 w-5" />
                )}
              </span>
            </button>
          </div>

          <p className="text-center text-xs font-semibold text-neutral-400">
            Contact developer for email &amp; password
          </p>
        </form>
      </div>
    </div>
  )
}
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth, roleHome } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { ApiisLogo } from '@/components/apiis-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email atau password salah'
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Hubungi administrator.'
  if (m.includes('rate limit')) return 'Terlalu banyak percobaan. Coba lagi nanti.'
  return msg
}

export function LoginPage() {
  const { loading, session, profile, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <FullPageSpinner />
  if (session && profile) return <Navigate to={roleHome(profile.role)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) {
      setError(translateAuthError(error))
      setSubmitting(false)
    }
    // 成功后 auth 状态更新，上方的 <Navigate> 会自动跳转到对应首页
  }

  async function onForgot() {
    if (resetting) return
    if (!email) {
      toast.error('Isi email di atas dulu, lalu tap "Lupa password?"')
      return
    }
    setResetting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetting(false)
    if (error) {
      toast.error(translateAuthError(error.message))
      return
    }
    toast.success('Jika email tersebut punya akun, link reset password sedang dikirim.')
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#0d2438] via-[#0c3c60] to-[#0a2c49] p-4">
      {/* 柔光点缀，纯 CSS 渐变、零额外资源 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #1690D0, transparent)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-24 size-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #7CB518, transparent)' }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <ApiisLogo className="h-24 w-auto" />
          <p className="mt-4 text-sm text-white/70">
            Pelatihan Abad 21. Untuk Orang Kristen. Gratis
          </p>
        </div>

        <Card className="w-full shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Masuk</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="anda@contoh.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onForgot()}
              disabled={resetting}
              className="text-brand -mt-1 self-end text-xs hover:underline disabled:opacity-60"
            >
              {resetting ? 'Mengirim link reset…' : 'Lupa password?'}
            </button>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Sedang masuk…' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-white/60">
          OBS mau menggantikan rekan?{' '}
          <Link to="/obs" className="underline hover:text-white">
            Masuk tanpa login →
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-white/45">Portal OBS APIIS</p>
      </div>
    </div>
  )
}

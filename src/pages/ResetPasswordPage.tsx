import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { ApiisLogo } from '@/components/apiis-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * 密码找回的落地页：用户点邮件里的恢复链接到达这里（supabase 自动从 URL 建立恢复会话）。
 * 有恢复会话则显示「设新密码」表单；否则提示链接失效。
 */
export function ResetPasswordPage() {
  const { loading, session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }
    if (password !== confirm) {
      setError('Password tidak cocok.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }
    toast.success('Password berhasil diperbarui. Kamu sudah masuk.')
    navigate('/', { replace: true })
  }

  if (loading) return <FullPageSpinner />

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#0d2438] via-[#0c3c60] to-[#0a2c49] p-4">
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <ApiisLogo className="h-20 w-auto" />
        </div>
        <Card className="w-full shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Atur password baru</CardTitle>
          </CardHeader>
          <CardContent>
            {!session ? (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-muted-foreground text-sm">
                  Link reset ini tidak valid atau sudah kedaluwarsa. Minta link baru dari halaman
                  masuk.
                </p>
                <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
                  Kembali ke halaman masuk
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password">Password baru</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={show ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
                      aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                      tabIndex={-1}
                    >
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Konfirmasi password baru</Label>
                  <Input
                    id="confirm-password"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Memperbarui…' : 'Perbarui password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

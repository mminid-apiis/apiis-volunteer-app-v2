import { useState } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { nextWeekMonday } from '@/lib/date'
import {
  useAppSettings,
  useIsSessionWeek,
  useNextSession,
  useReopenCoverage,
  useRunSummarize,
  useRunWeeklyCheck,
  useUpdateAppSettings,
  useWeekAvailability,
  useWeekCoverage,
} from '@/hooks/use-scheduling'
import type { AppSettings } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SavePatch {
  reminders_enabled: boolean
}

function SettingsForm({
  settings,
  onSave,
  saving,
}: {
  settings: AppSettings
  onSave: (p: SavePatch) => void
  saving: boolean
}) {
  const [enabled, setEnabled] = useState(settings.reminders_enabled)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="reminders"
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
        />
        <Label htmlFor="reminders">Pengingat mingguan aktif</Label>
      </div>
      <div>
        <Button size="sm" disabled={saving} onClick={() => onSave({ reminders_enabled: enabled })}>
          {saving ? 'Menyimpan…' : 'Simpan pengaturan'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Saat aktif, pengingat hanya dikirim di minggu kelas sungguhan — term break otomatis
        dilewati sesuai kalender kursus.
      </p>
    </div>
  )
}

export function SchedulingAdmin() {
  const week = nextWeekMonday()
  const settingsQ = useAppSettings()
  const updateSettings = useUpdateAppSettings()
  const runWeekly = useRunWeeklyCheck()
  const runSummarize = useRunSummarize()
  const availQ = useWeekAvailability(week)
  const coverQ = useWeekCoverage(week)
  const reopen = useReopenCoverage()
  const { data: isSessionWeek } = useIsSessionWeek(week)
  const { data: nextSession } = useNextSession()
  const isBreak = isSessionWeek === false

  function saveSettings(p: SavePatch) {
    updateSettings.mutate(p, {
      onSuccess: () => toast.success('Pengaturan tersimpan'),
      onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
    })
  }

  const avail = availQ.data ?? []
  const available = avail.filter((a) => a.is_available === true).length
  const unavailable = avail.filter((a) => a.is_available === false).length
  const noResponse = avail.filter((a) => a.is_available === null).length
  const coverage = coverQ.data ?? []
  const openCoverage = coverage.filter((c) => c.status === 'open').length
  const needsAttention = !isBreak && (openCoverage > 0 || noResponse > 0)
  const allClear = !isBreak && avail.length > 0 && openCoverage === 0 && noResponse === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={availQ.isFetching || coverQ.isFetching}
          onClick={() => {
            void availQ.refetch()
            void coverQ.refetch()
          }}
        >
          <RefreshCw
            className={`size-4 ${availQ.isFetching || coverQ.isFetching ? 'animate-spin' : ''}`}
          />
          Segarkan
        </Button>
      </div>
      {needsAttention && (
        <Card className="border-amber-400/60 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-4" /> Perlu tindakan — minggu dari {week}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {openCoverage > 0 && (
              <p>
                <b>{openCoverage}</b> permintaan pengganti masih <b>belum diklaim</b> — tugaskan
                seseorang di <b>Grup &amp; Penugasan</b> jika tidak ada OBS yang mengklaim.
              </p>
            )}
            {noResponse > 0 && (
              <p>
                <b>{noResponse}</b> OBS belum menjawab — yang tidak menjawab tidak memicu
                permintaan pengganti, jadi tindak lanjuti bila perlu.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {allClear && (
        <Card className="border-green-500/40">
          <CardContent className="py-4 text-sm text-green-700 dark:text-green-400">
            ✓ Tidak ada yang perlu ditindak minggu ini — tidak ada pengganti yang belum diklaim
            dan semua sudah menjawab.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pengaturan pengingat</CardTitle>
        </CardHeader>
        <CardContent>
          {settingsQ.data ? (
            <SettingsForm settings={settingsQ.data} onSave={saveSettings} saving={updateSettings.isPending} />
          ) : (
            <p className="text-muted-foreground text-sm">Memuat…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jalankan sekarang (manual)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={runWeekly.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  'Jalankan pengecekan ketersediaan mingguan sekarang? Ini memberi notifikasi ke SEMUA OBS di aplikasi (tidak mengirim email).',
                )
              )
                return
              runWeekly.mutate(undefined, {
                onSuccess: (n) => toast.success(`Pengecekan mingguan selesai — ${n} OBS diberi tahu`),
                onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
              })
            }}
          >
            Jalankan pengecekan ketersediaan mingguan
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={runSummarize.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  'Jalankan ringkasan pengganti sekarang? Ini membuat permintaan pengganti dan memberi notifikasi ke OBS di aplikasi (tidak mengirim email).',
                )
              )
                return
              runSummarize.mutate(undefined, {
                onSuccess: (n) => toast.success(`Ringkasan selesai — ${n} permintaan pengganti terbuka`),
                onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
              })
            }}
          >
            Jalankan ringkasan pengganti
          </Button>
          <p className="text-muted-foreground w-full text-xs">
            {isBreak
              ? `Minggu depan (${week}) adalah term break — jalankan akan dilewati.`
              : `Menyasar minggu dari ${week}.`}{' '}
            Biasanya ini jalan otomatis lewat pg_cron — ketersediaan Kamis/Jumat, pengganti
            Sabtu/Minggu (per kurikulum).
          </p>
        </CardContent>
      </Card>

      {isBreak ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Minggu depan</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Minggu dari {week} adalah term break — tidak ada kelas, jadi tidak ada pengingat yang
            dikirim.
            {nextSession && (
              <>
                {' '}
                Pengingat berlanjut lagi minggu dari{' '}
                <span className="text-foreground font-medium">{nextSession}</span>.
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ketersediaan — minggu dari {week}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              <span className="text-green-600">Bisa hadir: {available}</span>
              <span className="text-destructive">Tidak bisa hadir: {unavailable}</span>
              <span className="text-muted-foreground">Belum jawab: {noResponse}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permintaan pengganti — minggu dari {week}</CardTitle>
            </CardHeader>
            <CardContent>
              {coverage.length === 0 ? (
                <p className="text-muted-foreground text-sm">Tidak ada permintaan pengganti.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {coverage.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{c.group_name}</span>
                        <span className="text-muted-foreground"> · {c.class_name}</span>
                      </span>
                      {c.status === 'open' ? (
                        <Badge variant="outline">Terbuka</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Digantikan oleh {c.coverer ?? '—'}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reopen.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Buka lagi pengganti untuk ${c.group_name} (${c.class_name})? Ini melepas ${c.coverer ?? 'orang yang menggantikan'} supaya bisa diklaim orang lain.`,
                                )
                              )
                                return
                              reopen.mutate(c.id, {
                                onSuccess: () => toast.success('Pengganti dibuka lagi'),
                                onError: (e) => toast.error(`Gagal: ${(e as Error).message}`),
                              })
                            }}
                          >
                            Buka lagi
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

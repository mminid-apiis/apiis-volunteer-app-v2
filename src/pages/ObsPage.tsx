import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useObsAttendance,
  useObsGroups,
  useObsGroupStudents,
  useObsSaveAttendance,
  useObsVerify,
  useObsVolunteers,
} from '@/hooks/use-obs-access'
import {
  curriculumForClass,
  currentWeek,
  sessionDateForWeek,
  weekLabel,
  weeksForCurriculum,
} from '@/lib/calendar'
import { todaySG } from '@/lib/date'
import { AttendanceForm } from '@/components/attendance-form'
import { ApiisLogo } from '@/components/apiis-logo'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const LS_CODE = 'obs_code'
const LS_VOLUNTEER_ID = 'obs_volunteer_id'
const LS_FULL_NAME = 'obs_full_name'

function readLS(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLS(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private browsing dsb — abaikan, cuma berarti kode/nama diminta ulang tiap kunjungan */
  }
}
function clearLS(...keys: string[]) {
  try {
    for (const k of keys) window.localStorage.removeItem(k)
  } catch {
    /* no-op */
  }
}

function deviceInfo(): string {
  return navigator.userAgent.slice(0, 300)
}

/** Gerbang masuk: masukkan kode akses bersama, lalu pilih nama sendiri dari daftar. */
function ObsGate({ onVerified }: { onVerified: (volunteerId: string, fullName: string, code: string) => void }) {
  const [code, setCode] = useState('')
  const [volunteerId, setVolunteerId] = useState('')
  const volunteersQ = useObsVolunteers(code.trim())
  const verify = useObsVerify()

  const volunteers = volunteersQ.data ?? []

  async function onSubmit() {
    if (!code.trim() || !volunteerId) return
    try {
      const ok = await verify.mutateAsync({ code: code.trim(), volunteerId, deviceInfo: deviceInfo() })
      if (!ok) {
        toast.error('Kode akses atau nama tidak valid')
        return
      }
      const name = volunteers.find((v) => v.id === volunteerId)?.full_name ?? ''
      onVerified(volunteerId, name, code.trim())
    } catch (e) {
      toast.error(`Gagal: ${(e as Error).message}`)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#0d2438] via-[#0c3c60] to-[#0a2c49] p-4">
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <ApiisLogo className="h-20 w-auto" />
          <p className="mt-4 text-sm text-white/70">Mode OBS tanpa login</p>
        </div>
        <Card className="w-full shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Masuk mode OBS</CardTitle>
            <CardDescription>
              Untuk OBS yang menggantikan rekan secara dadakan — pakai kode akses bersama, lalu
              pilih namamu sendiri.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="obs-code">Kode akses</Label>
              <Input
                id="obs-code"
                type="password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setVolunteerId('')
                }}
                placeholder="Kode dari admin"
                autoComplete="off"
              />
            </div>
            {code.trim() && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="obs-name">Nama kamu</Label>
                {volunteersQ.isLoading ? (
                  <p className="text-muted-foreground text-xs">Memuat daftar nama…</p>
                ) : volunteers.length === 0 ? (
                  <p className="text-destructive text-xs">
                    Tidak ada nama ditemukan — cek lagi kode aksesnya.
                  </p>
                ) : (
                  <Select value={volunteerId} onValueChange={setVolunteerId}>
                    <SelectTrigger id="obs-name">
                      <SelectValue placeholder="Pilih namamu" />
                    </SelectTrigger>
                    <SelectContent>
                      {volunteers.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <Button
              className="w-full"
              disabled={!code.trim() || !volunteerId || verify.isPending}
              onClick={() => void onSubmit()}
            >
              {verify.isPending ? 'Memeriksa…' : 'Masuk'}
            </Button>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-white/45">
          Admin? <Link to="/login" className="underline">Masuk lewat halaman login</Link>
        </p>
      </div>
    </div>
  )
}

/** Pilih kelas → grup mana saja (tidak dibatasi penugasan). */
function ObsGroupPicker({
  code,
  fullName,
  onPick,
  onSwitchName,
}: {
  code: string
  fullName: string
  onPick: (groupId: string, className: string, groupName: string) => void
  onSwitchName: () => void
}) {
  const groupsQ = useObsGroups(code)
  const [cohortId, setCohortId] = useState('')
  const [groupId, setGroupId] = useState('')

  const groups = groupsQ.data ?? []
  const classes = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of groupsQ.data ?? []) map.set(g.cohort_id, g.cohort_name)
    return [...map.entries()]
  }, [groupsQ.data])
  const groupsInClass = groups.filter((g) => g.cohort_id === cohortId)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Masuk sebagai <span className="text-foreground font-medium">{fullName}</span>
        </p>
        <button type="button" onClick={onSwitchName} className="text-brand text-xs hover:underline">
          Ganti nama
        </button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pilih grup</CardTitle>
          <CardDescription>Bisa pilih grup manapun, tidak harus grup kamu sendiri.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {groupsQ.isLoading ? (
            <Spinner />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label>Kelas</Label>
                <Select
                  value={cohortId}
                  onValueChange={(v) => {
                    setCohortId(v)
                    setGroupId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {cohortId && (
                <div className="flex flex-col gap-2">
                  <Label>Grup</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih grup" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupsInClass.map((g) => (
                        <SelectItem key={g.group_id} value={g.group_id}>
                          {g.group_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                disabled={!groupId}
                onClick={() => {
                  const g = groupsInClass.find((x) => x.group_id === groupId)
                  if (g) onPick(g.group_id, g.cohort_name, g.group_name)
                }}
              >
                Lanjut
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Form penilaian untuk grup yang dipilih — memakai kalender kurikulum yang sama seperti mode login. */
function ObsAttendance({
  code,
  volunteerId,
  className,
  groupName,
  groupId,
  onSwitchGroup,
}: {
  code: string
  volunteerId: string
  className: string
  groupName: string
  groupId: string
  onSwitchGroup: () => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const studentsQ = useObsGroupStudents(code, groupId)
  const save = useObsSaveAttendance()

  const curriculum = curriculumForClass(className)
  const today = todaySG()
  const curWeek = curriculum ? currentWeek(curriculum, today) : null
  const defaultDate = curriculum && curWeek !== null ? sessionDateForWeek(curriculum, curWeek, className) : today
  const sessionDate = picked ?? defaultDate ?? today

  const attendanceQ = useObsAttendance(code, groupId, sessionDate)
  const students = studentsQ.data ?? []

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 py-8">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSwitchGroup}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
        >
          ← Ganti grup
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{groupName}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{className}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="obs-session-week">Minggu sesi</Label>
        {curriculum ? (
          <>
            <Select value={sessionDate} onValueChange={setPicked}>
              <SelectTrigger id="obs-session-week" className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weeksForCurriculum(curriculum).map((w) => {
                  const d = sessionDateForWeek(curriculum, w.week, className) ?? w.date
                  return (
                    <SelectItem key={w.week} value={d} disabled={w.week !== curWeek}>
                      {weekLabel(w.week)} · {d}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Kamu hanya bisa mencatat minggu berjalan.</p>
          </>
        ) : (
          <Input
            id="obs-session-week"
            type="date"
            value={sessionDate}
            onChange={(e) => setPicked(e.target.value)}
            className="w-[180px]"
          />
        )}
      </div>

      {studentsQ.isLoading || attendanceQ.isLoading ? (
        <Spinner label="Memuat siswa…" />
      ) : students.length === 0 ? (
        <p className="text-muted-foreground text-sm">Tidak ada siswa di grup ini.</p>
      ) : (
        <AttendanceForm
          key={`${groupId}:${sessionDate}`}
          students={students}
          existing={attendanceQ.data ?? []}
          groupId={groupId}
          sessionDate={sessionDate}
          volunteerId={volunteerId}
          saving={save.isPending}
          onSave={async (rows) => {
            await save.mutateAsync({
              code,
              volunteerId,
              deviceInfo: deviceInfo(),
              groupId,
              sessionDate,
              rows: rows.map((r) => ({
                student_id: r.student_id,
                contribution: r.contribution,
                notes: r.notes,
              })),
            })
          }}
        />
      )}
    </div>
  )
}

export function ObsPage() {
  const [code, setCode] = useState<string | null>(() => readLS(LS_CODE))
  const [volunteerId, setVolunteerId] = useState<string | null>(() => readLS(LS_VOLUNTEER_ID))
  const [fullName, setFullName] = useState<string | null>(() => readLS(LS_FULL_NAME))
  const [checking, setChecking] = useState(!!code && !!volunteerId)
  const [group, setGroup] = useState<{ id: string; className: string; groupName: string } | null>(null)
  const verify = useObsVerify()

  // 已有缓存身份时,进 /obs 自动重新校验一次(顺便留一条"进入"日志,记录这次访问的时间/设备)。
  useEffect(() => {
    if (!code || !volunteerId) return
    let cancelled = false
    verify
      .mutateAsync({ code, volunteerId, deviceInfo: deviceInfo() })
      .then((ok) => {
        if (cancelled) return
        if (!ok) {
          clearLS(LS_CODE, LS_VOLUNTEER_ID, LS_FULL_NAME)
          setCode(null)
          setVolunteerId(null)
          setFullName(null)
        }
        setChecking(false)
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onVerified(vid: string, name: string, c: string) {
    writeLS(LS_CODE, c)
    writeLS(LS_VOLUNTEER_ID, vid)
    writeLS(LS_FULL_NAME, name)
    setCode(c)
    setVolunteerId(vid)
    setFullName(name)
  }

  function onSwitchName() {
    clearLS(LS_CODE, LS_VOLUNTEER_ID, LS_FULL_NAME)
    setCode(null)
    setVolunteerId(null)
    setFullName(null)
    setGroup(null)
  }

  if (checking) return <Spinner label="Memeriksa akses…" className="min-h-svh" />

  if (!code || !volunteerId || !fullName) {
    return <ObsGate onVerified={onVerified} />
  }

  if (!group) {
    return (
      <ObsGroupPicker
        code={code}
        fullName={fullName}
        onSwitchName={onSwitchName}
        onPick={(groupId, className, groupName) => setGroup({ id: groupId, className, groupName })}
      />
    )
  }

  return (
    <ObsAttendance
      code={code}
      volunteerId={volunteerId}
      className={group.className}
      groupName={group.groupName}
      groupId={group.id}
      onSwitchGroup={() => setGroup(null)}
    />
  )
}

import { useObsAccessLog } from '@/hooks/use-obs-access'
import { Spinner } from '@/components/spinner'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function AdminAccessLogPage() {
  const { data, isLoading } = useObsAccessLog()
  if (isLoading) return <Spinner />
  const rows = data ?? []

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Jejak akses mode OBS tanpa login (/obs) — setiap kali seseorang masuk atau menyimpan
        penilaian, tercatat di sini beserta perangkat dan alamat IP-nya.
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Belum ada aktivitas.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Waktu</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Grup</TableHead>
                <TableHead className="whitespace-nowrap">Tanggal sesi</TableHead>
                <TableHead>Device</TableHead>
                <TableHead className="whitespace-nowrap">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium">{r.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={r.action === 'save_attendance' ? 'default' : 'outline'} className="font-normal">
                      {r.action === 'save_attendance' ? 'Simpan absensi' : 'Masuk'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.class_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.group_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {r.session_date ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate text-xs" title={r.device_info ?? ''}>
                    {r.device_info ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {r.ip_address ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

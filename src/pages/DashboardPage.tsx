import { Link } from 'react-router-dom'
import { Video } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useMyGroups } from '@/hooks/use-groups'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DashboardPage() {
  const { user, profile } = useAuth()
  const { data: groups, isLoading, isError } = useMyGroups(user?.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard OBS"
        description={`Selamat datang, ${profile?.full_name ?? ''}. Pilih grup untuk mencatat absensi.`}
      />

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Memuat grup kamu…</p>
      ) : isError ? (
        <p className="text-destructive text-sm">Gagal memuat grup kamu. Muat ulang dan coba lagi.</p>
      ) : !groups || groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Belum ada grup yang ditugaskan. Hubungi administrator kamu.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card
              key={g.id}
              className="border-t-2 border-t-transparent transition-all hover:border-t-brand hover:shadow-md"
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{g.name}</span>
                  {g.class_name && (
                    <Badge variant="outline" className="shrink-0 font-normal">
                      {g.class_name}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                {g.zoom_link ? (
                  <a
                    href={g.zoom_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    <Video className="size-4" /> Zoom
                  </a>
                ) : (
                  <span />
                )}
                <Button asChild size="sm">
                  <Link to={`/groups/${g.id}`}>Catat absensi</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

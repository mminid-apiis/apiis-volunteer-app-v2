import { Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useDeleteFeedback,
  useFeedback,
  useSetFeedbackResolved,
  type Feedback,
} from '@/hooks/use-feedback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/spinner'

export function AdminFeedbackPage() {
  const { data: items, isLoading } = useFeedback()
  const setResolved = useSetFeedbackResolved()
  const del = useDeleteFeedback()
  if (isLoading) return <Spinner />
  if (!items || items.length === 0)
    return <p className="text-muted-foreground text-sm">No feedback yet.</p>

  // 未解决在前,其次按时间(新 → 旧)
  const sorted = [...items].sort(
    (a, b) => Number(a.resolved) - Number(b.resolved) || b.created_at.localeCompare(a.created_at),
  )

  function toggle(f: Feedback) {
    setResolved.mutate(
      { id: f.id, resolved: !f.resolved },
      {
        onSuccess: () => toast.success(f.resolved ? 'Reopened' : 'Marked resolved'),
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
      },
    )
  }

  function onDelete(f: Feedback) {
    if (
      !window.confirm(
        `Delete this feedback from ${f.full_name || 'Unknown'}? This permanently removes it.`,
      )
    )
      return
    del.mutate(f.id, {
      onSuccess: () => toast.success('Feedback deleted'),
      onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((f) => (
        <div key={f.id} className={`rounded-md border p-3 ${f.resolved ? 'bg-muted/40' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="font-medium">{f.full_name || 'Unknown'}</p>
              {f.resolved && (
                <Badge
                  variant="secondary"
                  className="gap-1 font-normal"
                  title={f.resolved_at ? `Resolved ${new Date(f.resolved_at).toLocaleString()}` : undefined}
                >
                  <Check className="size-3" /> Resolved
                </Badge>
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              {new Date(f.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{f.message}</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              size="sm"
              variant={f.resolved ? 'outline' : 'secondary'}
              disabled={setResolved.isPending}
              onClick={() => toggle(f)}
            >
              {f.resolved ? 'Reopen' : 'Mark resolved'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={del.isPending}
              onClick={() => onDelete(f)}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

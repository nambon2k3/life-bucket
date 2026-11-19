import { Badge } from "@/components/ui/badge"
import { statusLabel } from "@/lib/format"

const tones: Record<string, string> = {
  planned: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  in_progress: "border-amber-500/30 bg-amber-500/15 text-amber-200",
  completed: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  high: "border-rose-500/30 bg-rose-500/15 text-rose-200",
  medium: "border-amber-500/30 bg-amber-500/15 text-amber-200",
  low: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
  open: "border-border bg-muted text-muted-foreground",
  done: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={tones[value] ?? ""}>
      {statusLabel(value)}
    </Badge>
  )
}

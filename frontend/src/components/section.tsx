import type { ReactNode } from "react"

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {action}
      </div>
      <p className="mt-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}

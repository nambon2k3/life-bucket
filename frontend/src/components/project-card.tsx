import { useState } from "react"
import { Link } from "react-router-dom"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Project } from "@/lib/types"

const covers = [
  "from-zinc-700 to-zinc-950",
  "from-slate-700 to-zinc-950",
  "from-stone-700 to-zinc-950",
  "from-neutral-600 to-zinc-950",
]

export function ProjectCard({ project, onDeleted }: { project: Project; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const percent = project.task_total === 0 ? 0 : Math.round((project.task_done / project.task_total) * 100)
  const cover = covers[project.id % covers.length]

  async function remove() {
    setRemoving(true)
    try {
      await api(`/api/v1/projects/${project.id}`, { method: "DELETE" })
      setOpen(false)
      onDeleted()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not delete the project")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card className="relative overflow-hidden py-0 transition duration-200 hover:-translate-y-0.5 hover:bg-muted/50">
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-3 right-3 z-10 bg-background/80"
        aria-label={`Delete ${project.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
    <Link to={`/projects/${project.id}`} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className={`relative h-28 bg-gradient-to-br ${cover}`}>
        <div className="absolute top-3 left-3">
          <StatusBadge value={project.status} />
        </div>
      </div>
      <CardHeader className="px-4 pt-4">
        <CardTitle className="text-base tracking-wide">{project.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Project overview</p>
          <p className="mt-1 text-foreground/90">{project.overview || "No overview yet."}</p>
        </div>
        {project.start_on || project.end_on ? (
          <p className="text-xs text-muted-foreground">
            {formatDate(project.start_on)} – {formatDate(project.end_on)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{project.bucket_name}</p>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {project.task_done} / {project.task_total} tasks complete
          </p>
        </div>
      </CardContent>
    </Link>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {project.name}?</DialogTitle>
            <DialogDescription>Tasks in this project are deleted with it.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={removing} onClick={() => void remove()}>
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

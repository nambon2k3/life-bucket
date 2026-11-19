import { Link } from "react-router-dom"

import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import type { Project } from "@/lib/types"

const covers = [
  "from-zinc-700 to-zinc-950",
  "from-slate-700 to-zinc-950",
  "from-stone-700 to-zinc-950",
  "from-neutral-600 to-zinc-950",
]

export function ProjectCard({ project }: { project: Project }) {
  const percent = project.task_total === 0 ? 0 : Math.round((project.task_done / project.task_total) * 100)
  const cover = covers[project.id % covers.length]

  return (
    <Link to={`/projects/${project.id}`} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <Card className="overflow-hidden py-0 transition duration-200 hover:-translate-y-0.5 hover:bg-muted/50">
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
    </Card>
    </Link>
  )
}

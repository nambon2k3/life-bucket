import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { BucketCard } from "@/components/bucket-card"
import { MonthCalendar } from "@/components/month-calendar"
import { ProjectCard } from "@/components/project-card"
import { ErrorNote, SectionHeader } from "@/components/section"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { secondsAgo } from "@/lib/format"
import type { Dashboard, Project } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

const filters = ["all", "planned", "in_progress", "completed"] as const

export function DashboardPage() {
  const { data, error, loading, reload } = useResource<Dashboard>("/api/v1/dashboard")
  const [filter, setFilter] = useState<(typeof filters)[number]>("all")

  const projects = useMemo(() => {
    if (!data) return []
    if (filter === "all") return data.projects
    return data.projects.filter((project) => project.status === filter)
  }, [data, filter])

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading the board…</p>
  if (error && !data) return <ErrorNote message={error} />
  if (!data) return null

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader
          title="Life Buckets"
          description="Life buckets group projects and habits into the areas you want to keep in view."
        />
        <p className="mb-3 text-xs text-muted-foreground">
          {data.cached ? `Served from Redis · ${secondsAgo(data.generated_at)}s old` : "Fresh from Postgres"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.buckets.map((bucket) => (
            <BucketCard key={bucket.id} bucket={bucket} onChanged={() => void reload()} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="My Projects"
          description="Active work, either still ahead of you or already finished."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/projects">All projects</Link>
            </Button>
          }
        />
        <Tabs value={filter} onValueChange={(value) => setFilter(value as (typeof filters)[number])}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="planned">Planned</TabsTrigger>
            <TabsTrigger value="in_progress">In progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <ProjectGrid projects={projects} />
      </section>

      <section>
        <SectionHeader
          title="This month"
          description="Tasks due this month, laid out on the day they are due."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/inbox">Open inbox</Link>
            </Button>
          }
        />
        <MonthCalendar tasks={data.tasks} />
      </section>
    </div>
  )
}

function ProjectGrid({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No projects in this view.</p>
  }
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}

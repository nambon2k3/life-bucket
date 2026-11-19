import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { ProjectCard } from "@/components/project-card"
import { ErrorNote, SectionHeader } from "@/components/section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { Bucket, Project } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

const filters = ["all", "planned", "in_progress", "completed"] as const

export function ProjectsPage() {
  const projects = useResource<Project[]>("/api/v1/projects")
  const buckets = useResource<Bucket[]>("/api/v1/buckets")
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<(typeof filters)[number]>("all")
  const [bucketFilter, setBucketFilter] = useState(params.get("bucket") ?? "all")
  const [name, setName] = useState("")
  const [overview, setOverview] = useState("")
  const [status, setStatus] = useState("planned")
  const [bucketId, setBucketId] = useState(params.get("bucket") ?? "")
  const [saving, setSaving] = useState(false)
  const open = params.get("new") === "1"

  useEffect(() => {
    const incoming = params.get("bucket")
    if (incoming) {
      setBucketId(incoming)
      setBucketFilter(incoming)
    }
  }, [params])

  const visible = (projects.data ?? []).filter((project) => {
    const statusOk = filter === "all" || project.status === filter
    const bucketOk = bucketFilter === "all" || String(project.bucket_id) === bucketFilter
    return statusOk && bucketOk
  })

  async function createProject() {
    setSaving(true)
    try {
      await api("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          bucket_id: Number(bucketId),
          name,
          overview,
          status,
        }),
      })
      setName("")
      setOverview("")
      setParams({})
      await projects.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add the project")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader
        title="My Projects"
        description="A project belongs to one life bucket and collects the tasks that move it forward."
        action={
          <Button size="sm" onClick={() => setParams({ new: "1" })}>
            Add project
          </Button>
        }
      />
      {projects.error ? <ErrorNote message={projects.error} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as (typeof filters)[number])}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="planned">Planned</TabsTrigger>
            <TabsTrigger value="in_progress">In progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Label htmlFor="bucket-filter">Bucket</Label>
          <Select value={bucketFilter} onValueChange={setBucketFilter}>
            <SelectTrigger id="bucket-filter" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All buckets</SelectItem>
              {(buckets.data ?? []).map((bucket) => (
                <SelectItem key={bucket.id} value={String(bucket.id)}>
                  {bucket.icon} {bucket.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {visible.length === 0 && !projects.loading ? (
        <p className="mt-4 text-sm text-muted-foreground">No projects in this view.</p>
      ) : null}

      <Dialog open={open} onOpenChange={(next) => setParams(next ? { new: "1", ...(bucketId ? { bucket: bucketId } : {}) } : {})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-overview">Overview</Label>
              <Textarea id="project-overview" value={overview} onChange={(event) => setOverview(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Bucket</Label>
              <Select value={bucketId} onValueChange={setBucketId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a life bucket" />
                </SelectTrigger>
                <SelectContent>
                  {(buckets.data ?? []).map((bucket) => (
                    <SelectItem key={bucket.id} value={String(bucket.id)}>
                      {bucket.icon} {bucket.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={saving || !name.trim() || !bucketId} onClick={() => void createProject()}>
              Save project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

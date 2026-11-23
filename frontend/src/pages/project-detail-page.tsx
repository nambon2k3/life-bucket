import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronLeft, Folder, ImageIcon, CalendarRange, Trash2 } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { ErrorNote } from "@/components/section"
import { StatusBadge } from "@/components/status-badge"
import { TaskTable } from "@/components/task-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Bucket, Project, Task } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

const covers = [
  "from-zinc-700 to-zinc-950",
  "from-slate-700 to-zinc-950",
  "from-stone-700 to-zinc-950",
  "from-neutral-600 to-zinc-950",
]

function scopeLines(scope: string): string[] {
  return scope
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
}

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const project = useResource<Project>(`/api/v1/projects/${projectId}`)
  const tasks = useResource<Task[]>("/api/v1/tasks")
  const buckets = useResource<Bucket[]>("/api/v1/buckets")
  const [bucketId, setBucketId] = useState("")
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [dueOn, setDueOn] = useState("")
  const [priority, setPriority] = useState("medium")
  const [saving, setSaving] = useState(false)
  const [pendingTask, setPendingTask] = useState<Task | null>(null)
  const [removingTask, setRemovingTask] = useState(false)
  const [confirmProject, setConfirmProject] = useState(false)
  const [removingProject, setRemovingProject] = useState(false)

  useEffect(() => {
    if (project.data) setBucketId(String(project.data.bucket_id))
  }, [project.data])

  const related = useMemo(
    () => (tasks.data ?? []).filter((task) => task.project_id === Number(projectId)),
    [tasks.data, projectId],
  )

  async function changeBucket(next: string) {
    if (!project.data || next === String(project.data.bucket_id)) return
    setBucketId(next)
    try {
      await api(`/api/v1/projects/${project.data.id}`, {
        method: "PATCH",
        body: JSON.stringify({ bucket_id: Number(next) }),
      })
      await Promise.all([project.reload(), tasks.reload()])
    } catch (caught) {
      setBucketId(String(project.data.bucket_id))
      toast.error(caught instanceof Error ? caught.message : "Could not move the project")
    }
  }

  async function toggle(task: Task) {
    try {
      await api(`/api/v1/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: task.status === "done" ? "open" : "done" }),
      })
      await Promise.all([tasks.reload(), project.reload()])
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the task")
    }
  }

  async function removeTask() {
    if (!pendingTask) return
    setRemovingTask(true)
    try {
      await api(`/api/v1/tasks/${pendingTask.id}`, { method: "DELETE" })
      setPendingTask(null)
      await Promise.all([tasks.reload(), project.reload()])
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not delete the task")
    } finally {
      setRemovingTask(false)
    }
  }

  async function removeProject() {
    if (!project.data) return
    setRemovingProject(true)
    try {
      await api(`/api/v1/projects/${project.data.id}`, { method: "DELETE" })
      navigate("/projects")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not delete the project")
      setRemovingProject(false)
    }
  }

  async function createTask() {
    if (!project.data) return
    setSaving(true)
    try {
      await api("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          notes,
          due_on: dueOn || null,
          priority,
          bucket_id: project.data.bucket_id,
          project_id: project.data.id,
        }),
      })
      setTitle("")
      setNotes("")
      setDueOn("")
      setOpen(false)
      await Promise.all([tasks.reload(), project.reload()])
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add the task")
    } finally {
      setSaving(false)
    }
  }

  if (project.loading && !project.data) return <p className="text-sm text-muted-foreground">Loading project…</p>
  if (project.error || !project.data) return <ErrorNote message={project.error ?? "Project was not found"} />

  const current = project.data
  const percent = current.task_total === 0 ? 0 : Math.round((current.task_done / current.task_total) * 100)
  const bullets = scopeLines(current.scope ?? "")
  const cover = covers[current.id % covers.length]

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back to projects" onClick={() => navigate("/projects")}>
          <ChevronLeft />
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">{current.name}</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label={`Delete ${current.name}`}
          onClick={() => setConfirmProject(true)}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Property label="Status">
          <StatusBadge value={current.status} />
        </Property>
        <Property label="Cover">
          <span className={`block h-8 w-14 rounded-md bg-gradient-to-br ${cover}`} />
        </Property>
        <Property label="Bucket">
          <div className="flex items-center gap-1.5">
            <Folder className="size-3.5 shrink-0 text-muted-foreground" />
            <Select value={bucketId} onValueChange={(value) => void changeBucket(value)}>
              <SelectTrigger className="h-8 w-44" aria-label="Project bucket">
                <SelectValue placeholder={current.bucket_name} />
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
        </Property>
        <Property label="Timeline">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="size-3.5 text-muted-foreground" />
            {current.start_on || current.end_on
              ? `${formatDate(current.start_on)} – ${formatDate(current.end_on)}`
              : "No dates"}
          </span>
        </Property>
      </div>

      <section className="mt-8">
        <p className="text-sm text-muted-foreground">Progress</p>
        <p className="mt-1 text-2xl font-medium">{percent}%</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {current.task_done} / {current.task_total} tasks complete
        </p>
      </section>

      <section className="mt-8 rounded-xl border bg-card px-4 py-4">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ImageIcon className="size-4 text-muted-foreground" />
          Project Overview
        </h2>
        <p className="mt-3 text-sm leading-6 text-foreground/90">{current.overview || "No overview yet."}</p>
        {bullets.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-sm font-medium">Scope of work</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground/90">
              {bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Tasks</h2>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Add task
          </Button>
        </div>
        <p className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          See your related tasks within a project, organized by priority, due date, and status.
        </p>
        <h3 className="mt-4 mb-2 text-sm">Related tasks</h3>
        <TaskTable
          tasks={related}
          onToggle={(task) => void toggle(task)}
          onDelete={(task) => setPendingTask(task)}
        />
      </section>

      <Dialog open={pendingTask !== null} onOpenChange={(next) => { if (!next) setPendingTask(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingTask?.title}?</DialogTitle>
            <DialogDescription>This task is removed from the project.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTask(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={removingTask} onClick={() => void removeTask()}>
              Delete task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmProject} onOpenChange={setConfirmProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {current.name}?</DialogTitle>
            <DialogDescription>Tasks in this project are deleted with it.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmProject(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={removingProject} onClick={() => void removeProject()}>
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="detail-title">Title</Label>
              <Input id="detail-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="detail-notes">Description</Label>
              <Input id="detail-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="detail-due">Due</Label>
              <Input id="detail-due" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={saving || !title.trim()} onClick={() => void createTask()}>
              Save task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}

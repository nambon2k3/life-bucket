import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { ErrorNote, SectionHeader } from "@/components/section"
import { TaskTable } from "@/components/task-table"
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
import { api } from "@/lib/api"
import { isOverdue, isSameDay, isThisMonth, isThisWeek } from "@/lib/format"
import type { Project, Task } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

const periods = ["today", "week", "month"] as const
const statuses = ["all", "open", "done", "overdue"] as const

function matchesStatus(task: Task, status: (typeof statuses)[number]): boolean {
  if (status === "all") return true
  if (status === "open") return task.status === "open"
  if (status === "done") return task.status === "done"
  return isOverdue(task.due_on, task.status)
}

function matchesPeriod(task: Task, period: (typeof periods)[number], today: Date): boolean {
  if (period === "today") return isSameDay(task.due_on, today)
  if (period === "week") return isThisWeek(task.due_on)
  return isThisMonth(task.due_on, today)
}

export function InboxPage() {
  const tasks = useResource<Task[]>("/api/v1/tasks")
  const projects = useResource<Project[]>("/api/v1/projects")
  const [period, setPeriod] = useState<(typeof periods)[number]>("today")
  const [status, setStatus] = useState<(typeof statuses)[number]>("all")
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [dueOn, setDueOn] = useState("")
  const [priority, setPriority] = useState("medium")
  const [projectId, setProjectId] = useState("")
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (projectId || !projects.data) return
    const general = projects.data.find((project) => project.name === "General")
    if (general) setProjectId(String(general.id))
  }, [projects.data, projectId])

  const { dated, undated } = useMemo(() => {
    const today = new Date()
    const matching = (tasks.data ?? []).filter((task) => matchesStatus(task, status))
    return {
      dated: matching.filter((task) => matchesPeriod(task, period, today)),
      undated: matching.filter((task) => !task.due_on && status !== "overdue"),
    }
  }, [tasks.data, period, status])

  function toggleSelected(task: Task, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(task.id)
      else next.delete(task.id)
      return next
    })
  }

  async function applySelection(action: "done" | "open" | "remove") {
    const ids = [...selected]
    if (ids.length === 0) return
    setActing(true)
    try {
      await Promise.all(
        ids.map((id) =>
          action === "remove"
            ? api(`/api/v1/tasks/${id}`, { method: "DELETE" })
            : api(`/api/v1/tasks/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: action }),
              }),
        ),
      )
      setSelected(new Set())
      await tasks.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the selection")
    } finally {
      setActing(false)
    }
  }

  async function createTask() {
    setSaving(true)
    try {
      await api("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          notes,
          due_on: dueOn || null,
          priority,
          project_id: Number(projectId),
        }),
      })
      setTitle("")
      setNotes("")
      setDueOn("")
      setOpen(false)
      await tasks.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add the task")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Task Inbox"
        description="Today, this week, and this month follow the due date. Status is a separate filter."
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            Add task
          </Button>
        }
      />
      {tasks.error ? <ErrorNote message={tasks.error} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={period}
          onValueChange={(value) => {
            setPeriod(value as (typeof periods)[number])
            setSelected(new Set())
          }}
        >
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This week</TabsTrigger>
            <TabsTrigger value="month">This month</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as (typeof statuses)[number])
              setSelected(new Set())
            }}
          >
            <SelectTrigger id="status-filter" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {selected.size > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="text-sm">{selected.size} selected</span>
          <Button size="sm" disabled={acting} onClick={() => void applySelection("done")}>
            Complete
          </Button>
          <Button size="sm" variant="destructive" disabled={acting} onClick={() => void applySelection("remove")}>
            Remove
          </Button>
          <Button size="sm" variant="outline" disabled={acting} onClick={() => void applySelection("open")}>
            Undo
          </Button>
        </div>
      ) : null}
      <div className="mt-4">
        <TaskTable tasks={dated} selectedIds={selected} onSelect={toggleSelected} />
      </div>
      {undated.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-2 text-sm text-muted-foreground">No due date</h3>
          <TaskTable tasks={undated} selectedIds={selected} onSelect={toggleSelected} />
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-due">Due</Label>
              <Input id="task-due" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
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
            <div className="grid gap-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects.data ?? []).map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={saving || !title.trim() || !projectId} onClick={() => void createTask()}>
              Save task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

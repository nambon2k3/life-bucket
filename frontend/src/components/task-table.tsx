import { Trash2 } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, isOverdue } from "@/lib/format"
import type { Task } from "@/lib/types"

export function TaskTable({
  tasks,
  selectedIds,
  onSelect,
  onToggle,
  onDelete,
}: {
  tasks: Task[]
  selectedIds?: ReadonlySet<number>
  onSelect?: (task: Task, checked: boolean) => void
  onToggle?: (task: Task) => void
  onDelete?: (task: Task) => void
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing in this view.</p>
  }

  const showCheck = Boolean(onSelect || onToggle)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showCheck ? <TableHead className="w-10" /> : null}
          <TableHead>Task</TableHead>
          <TableHead>Due date</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Bucket</TableHead>
          <TableHead>Description</TableHead>
          {onDelete ? <TableHead className="w-12" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const checked = onSelect ? (selectedIds?.has(task.id) ?? false) : task.status === "done"
          return (
          <TableRow key={task.id} className={task.status === "done" ? "opacity-60" : undefined}>
            {showCheck ? (
              <TableCell>
                <input
                  type="checkbox"
                  checked={checked}
                  aria-label={`Select ${task.title}`}
                  className="size-4 accent-sky-500"
                  onChange={(event) => {
                    if (onSelect) onSelect(task, event.target.checked)
                    else onToggle?.(task)
                  }}
                />
              </TableCell>
            ) : null}
            <TableCell className="max-w-64 font-medium">{task.title}</TableCell>
            <TableCell className={isOverdue(task.due_on, task.status) ? "text-rose-300" : undefined}>
              {formatDate(task.due_on)}
            </TableCell>
            <TableCell>
              <StatusBadge value={task.priority} />
            </TableCell>
            <TableCell>{task.project_name ?? "—"}</TableCell>
            <TableCell>{task.bucket_name ?? "—"}</TableCell>
            <TableCell className="max-w-48 text-muted-foreground">{task.notes || "—"}</TableCell>
            {onDelete ? (
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => onDelete(task)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

import { useState } from "react"
import { Link } from "react-router-dom"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import type { Bucket } from "@/lib/types"

export function BucketCard({ bucket, onChanged }: { bucket: Bucket; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const isGeneral = bucket.slug === "general"
  const detail =
    bucket.project_count === 0
      ? "No projects yet"
      : `${bucket.project_count} project${bucket.project_count === 1 ? "" : "s"} · ${bucket.habit_count} habits`

  async function remove() {
    setRemoving(true)
    try {
      await api(`/api/v1/buckets/${bucket.id}`, { method: "DELETE" })
      setOpen(false)
      onChanged()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not delete the bucket")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card className="gap-3 py-4 transition duration-200 hover:-translate-y-0.5 hover:bg-muted/40">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <span aria-hidden>{bucket.icon}</span>
            {bucket.name}
          </span>
          {isGeneral ? null : (
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${bucket.name}`} onClick={() => setOpen(true)}>
              <Trash2 />
            </Button>
          )}
        </CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2 px-4">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/projects?bucket=${bucket.id}`}>View projects</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/projects?new=1&bucket=${bucket.id}`}>Add project</Link>
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {bucket.name}?</DialogTitle>
            <DialogDescription>
              Projects and habits in this bucket move to General. Their tasks stay attached to the same projects.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={removing} onClick={() => void remove()}>
              Delete bucket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

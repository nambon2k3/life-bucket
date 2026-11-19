import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { HabitHeatmap } from "@/components/habit-heatmap"
import { ErrorNote, SectionHeader } from "@/components/section"
import { StreakFlame } from "@/components/streak-flame"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { Bucket, Habit } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

export function HabitsPage() {
  const habits = useResource<Habit[]>("/api/v1/habits")
  const buckets = useResource<Bucket[]>("/api/v1/buckets")
  const [params, setParams] = useSearchParams()
  const open = params.get("new") === "1"
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [frequency, setFrequency] = useState("daily")
  const [bucketId, setBucketId] = useState(params.get("bucket") ?? "")
  const [saving, setSaving] = useState(false)

  async function toggle(habit: Habit) {
    try {
      if (habit.done_today) {
        await api(`/api/v1/habits/${habit.id}/checkins/today`, { method: "DELETE" })
      } else {
        await api(`/api/v1/habits/${habit.id}/checkins`, { method: "POST" })
      }
      await habits.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the habit")
    }
  }

  async function createHabit() {
    setSaving(true)
    try {
      await api("/api/v1/habits", {
        method: "POST",
        body: JSON.stringify({
          bucket_id: Number(bucketId),
          name,
          description,
          frequency,
        }),
      })
      setName("")
      setDescription("")
      setParams({})
      await habits.reload()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add the habit")
    } finally {
      setSaving(false)
    }
  }

  const grouped = new Map<string, Habit[]>()
  for (const habit of habits.data ?? []) {
    const list = grouped.get(habit.bucket_name) ?? []
    list.push(habit)
    grouped.set(habit.bucket_name, list)
  }

  return (
    <div>
      <SectionHeader
        title="Habits"
        description="Check in for today. The streak updates in the request, and a Celery message records the activity."
        action={
          <Button size="sm" onClick={() => setParams({ new: "1" })}>
            Add habit
          </Button>
        }
      />
      {habits.error ? <ErrorNote message={habits.error} /> : null}
      {habits.loading && !habits.data ? <p className="text-sm text-muted-foreground">Loading habits…</p> : null}
      <div className="space-y-6">
        {[...grouped.entries()].map(([bucketName, items]) => (
          <section key={bucketName}>
            <h3 className="mb-2 text-sm text-muted-foreground">{bucketName}</h3>
            <div className="grid gap-3">
              {items.map((habit) => (
                <Card key={habit.id} className="w-full py-4 transition duration-200 hover:bg-muted/40">
                  <CardHeader className="px-4">
                    <CardTitle className="flex items-center justify-between gap-3 text-base">
                      <span>{habit.name}</span>
                      <Button
                        size="sm"
                        variant={habit.done_today ? "secondary" : "default"}
                        onClick={() => void toggle(habit)}
                      >
                        {habit.done_today ? "Done today" : "Check in"}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 text-sm text-muted-foreground">
                    <p>{habit.description}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <StreakFlame days={habit.current_streak} />
                      <span>
                        {habit.frequency} · best {habit.longest_streak}
                      </span>
                    </div>
                    <HabitHeatmap checkins={habit.checkins ?? []} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(next) => setParams(next ? { new: "1" } : {})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New habit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="habit-name">Name</Label>
              <Input id="habit-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="habit-notes">Description</Label>
              <Textarea id="habit-notes" value={description} onChange={(event) => setDescription(event.target.value)} />
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
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={saving || !name.trim() || !bucketId} onClick={() => void createHabit()}>
              Save habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

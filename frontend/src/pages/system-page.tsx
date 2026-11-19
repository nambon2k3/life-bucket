import { useEffect, useState } from "react"
import { toast } from "sonner"

import { ErrorNote, SectionHeader } from "@/components/section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { formatTime } from "@/lib/format"
import type { Activity, Health, JobAccepted, JobStatus, Reminder, Review } from "@/lib/types"
import { useResource } from "@/lib/use-resource"

const jobs = [
  { path: "/api/v1/jobs/recompute-streaks", label: "Recompute streaks", queue: "habits" },
  { path: "/api/v1/jobs/daily-reminder", label: "Daily reminder", queue: "reminders" },
  { path: "/api/v1/jobs/weekly-review", label: "Weekly review", queue: "agent" },
]

export function SystemPage() {
  const health = useResource<Health>("/api/v1/health")
  const activity = useResource<Activity[]>("/api/v1/activity")
  const reminders = useResource<Reminder | null>("/api/v1/reminders")
  const review = useResource<Review | null>("/api/v1/reviews/latest")
  const [job, setJob] = useState<JobStatus | null>(null)
  const [enqueueing, setEnqueueing] = useState<string | null>(null)
  const reloadActivity = activity.reload
  const reloadReminders = reminders.reload
  const reloadReview = review.reload

  useEffect(() => {
    if (!job || job.state === "SUCCESS" || job.state === "FAILURE") return
    const timer = window.setInterval(() => {
      void api<JobStatus>(`/api/v1/jobs/${job.task_id}`)
        .then((next) => {
          setJob(next)
          if (next.state === "SUCCESS" || next.state === "FAILURE") {
            void reloadActivity()
            void reloadReminders()
            void reloadReview()
          }
        })
        .catch((caught: unknown) => {
          toast.error(caught instanceof Error ? caught.message : "Could not read the job")
        })
    }, 1500)
    return () => window.clearInterval(timer)
  }, [job, reloadActivity, reloadReminders, reloadReview])

  async function enqueue(path: string) {
    setEnqueueing(path)
    try {
      const accepted = await api<JobAccepted>(path, { method: "POST" })
      setJob({ task_id: accepted.task_id, state: "PENDING", result: null, error: null })
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not enqueue the job")
    } finally {
      setEnqueueing(null)
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          title="System"
          description="Postgres stores the board. Redis DB 0 caches it. RabbitMQ moves Celery messages. Redis DB 1 stores the task result you poll here."
        />
        {health.error ? <ErrorNote message={health.error} /> : null}
        <div className="grid gap-3 md:grid-cols-3">
          {(health.data?.services ?? []).map((service) => (
            <Card key={service.name} className="py-4">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center justify-between text-sm">
                  {service.name}
                  <Badge variant={service.ok ? "secondary" : "destructive"}>{service.ok ? "up" : "down"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xs text-muted-foreground">
                {service.detail || "Reachable"}
              </CardContent>
            </Card>
          ))}
        </div>
        {health.data ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Coach model {health.data.ollama_model} at {health.data.ollama_base_url}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Enqueue a job</h2>
        <div className="flex flex-wrap gap-2">
          {jobs.map((item) => (
            <Button
              key={item.path}
              variant="outline"
              disabled={enqueueing !== null}
              onClick={() => void enqueue(item.path)}
            >
              {item.label}
              <span className="text-muted-foreground">· {item.queue}</span>
            </Button>
          ))}
        </div>
        {job ? (
          <Card className="mt-3 py-4">
            <CardContent className="space-y-1 px-4 text-sm">
              <p>
                {job.state} · <span className="font-mono text-xs">{job.task_id}</span>
              </p>
              {job.result ? <p className="text-muted-foreground">{JSON.stringify(job.result)}</p> : null}
              {job.error ? <p className="text-destructive">{job.error}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Activity feed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 text-sm">
            {(activity.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">Check in a habit. The worker writes that event here.</p>
            ) : (
              activity.data?.map((entry) => (
                <p key={`${entry.at}-${entry.message}`}>
                  <span className="text-muted-foreground">{formatTime(entry.at)}</span> {entry.message}
                </p>
              ))
            )}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">Latest reminder</CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-sm text-muted-foreground">
              {reminders.data ? (
                <p>
                  {reminders.data.pending.length} habit{reminders.data.pending.length === 1 ? "" : "s"} still open on{" "}
                  {reminders.data.date}.
                </p>
              ) : (
                <p>Run the daily reminder job to fill Redis.</p>
              )}
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">Latest weekly review</CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-sm">
              {review.data ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{review.data.reply}</p>
              ) : (
                <p className="text-muted-foreground">The review job calls the same LangGraph agent with writes turned off.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

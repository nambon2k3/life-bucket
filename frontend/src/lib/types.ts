export type Bucket = {
  id: number
  name: string
  slug: string
  icon: string
  description: string
  sort_order: number
  habit_count: number
  project_count: number
}

export type Habit = {
  id: number
  bucket_id: number
  bucket_name: string
  name: string
  description: string
  frequency: "daily" | "weekly"
  current_streak: number
  longest_streak: number
  done_today: boolean
  checkins: string[]
}

export type Project = {
  id: number
  bucket_id: number
  bucket_name: string
  name: string
  overview: string
  scope: string
  status: "planned" | "in_progress" | "completed"
  start_on: string | null
  end_on: string | null
  task_done: number
  task_total: number
}

export type Task = {
  id: number
  title: string
  notes: string
  due_on: string | null
  priority: "low" | "medium" | "high"
  status: "open" | "done"
  bucket_id: number | null
  bucket_name: string | null
  project_id: number | null
  project_name: string | null
}

export type JournalEvent = {
  id: number
  entry_on: string
  at_time: string | null
  title: string
  note: string
  tag: string
  created_at: string
}

export type Dashboard = {
  buckets: Bucket[]
  habits: Habit[]
  projects: Project[]
  tasks: Task[]
  generated_at: string
  cached: boolean
}

export type ServiceStatus = {
  name: string
  ok: boolean
  detail: string
}

export type Health = {
  ok: boolean
  services: ServiceStatus[]
  ollama_model: string
  ollama_base_url: string
}

export type ChatResponse = {
  reply: string
  tool_trace: string[]
}

export type JobAccepted = {
  task_id: string
  task_name: string
}

export type JobStatus = {
  task_id: string
  state: string
  result: unknown
  error: string | null
}

export type Activity = {
  kind: string
  message: string
  at: string
}

export type Reminder = {
  date: string
  pending: { id: number; name: string; frequency: string }[]
  at: string
}

export type Review = {
  reply: string
  tool_trace: string[]
  at: string
}

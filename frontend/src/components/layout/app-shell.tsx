import { BookOpen, Flame, FolderKanban, Inbox, LayoutGrid, Server, Sparkles } from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"

import { cn } from "@/lib/utils"

const links = [
  { to: "/", label: "Life Buckets", icon: LayoutGrid, end: true },
  { to: "/habits", label: "Habits", icon: Flame, end: false },
  { to: "/projects", label: "Projects", icon: FolderKanban, end: false },
  { to: "/inbox", label: "Task Inbox", icon: Inbox, end: false },
  { to: "/journal", label: "Journal", icon: BookOpen, end: false },
  { to: "/coach", label: "Assistant", icon: Sparkles, end: false },
  { to: "/system", label: "System", icon: Server, end: false },
]

function itemClass(active: boolean) {
  return cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    active && "bg-muted text-foreground",
  )
}

export function AppShell() {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="px-4 py-5">
          <p className="text-sm font-medium">Life Buckets</p>
          <p className="text-xs text-muted-foreground">Habits, projects, inbox</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => itemClass(isActive)}>
              <link.icon className="size-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex gap-1 overflow-x-auto border-b px-2 py-2 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => cn(itemClass(isActive), "shrink-0")}
            >
              <link.icon className="size-4" />
              {link.label}
            </NavLink>
          ))}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

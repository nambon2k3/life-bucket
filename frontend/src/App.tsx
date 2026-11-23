import { Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { DashboardPage } from "@/pages/dashboard-page"
import { HabitsPage } from "@/pages/habits-page"
import { JournalDayPage } from "@/pages/journal-day-page"
import { JournalPage } from "@/pages/journal-page"
import { InboxPage } from "@/pages/inbox-page"
import { ProjectDetailPage } from "@/pages/project-detail-page"
import { ProjectsPage } from "@/pages/projects-page"
import { SystemPage } from "@/pages/system-page"

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="habits" element={<HabitsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="journal/:day" element={<JournalDayPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

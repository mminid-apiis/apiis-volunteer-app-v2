import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, roleHome } from '@/lib/auth'
import { ProtectedRoute } from '@/components/protected-route'
import { RequireRole } from '@/components/require-role'
import { Layout } from '@/components/layout'
import { LoginPage } from '@/pages/LoginPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { ObsPage } from '@/pages/ObsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { GroupAttendancePage } from '@/pages/GroupAttendancePage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { AccountPage } from '@/pages/AccountPage'
import { FeedbackPage } from '@/pages/FeedbackPage'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { AdminGroupsPage } from '@/pages/admin/AdminGroupsPage'
import { AdminRecordsPage } from '@/pages/admin/AdminRecordsPage'
import { AdminStudentsPage } from '@/pages/admin/AdminStudentsPage'
import { AdminObsPage } from '@/pages/admin/AdminObsPage'
import { AdminSchedulingPage } from '@/pages/admin/AdminSchedulingPage'
import { AdminHistoryPage } from '@/pages/admin/AdminHistoryPage'
import { AdminFeedbackPage } from '@/pages/admin/AdminFeedbackPage'
import { AdminAccessLogPage } from '@/pages/admin/AdminAccessLogPage'

/** 已登录时，根据角色跳到对应首页。 */
function HomeRedirect() {
  const { profile } = useAuth()
  return <Navigate to={roleHome(profile?.role)} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/obs" element={<ObsPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<Layout />}>
          <Route
            path="/dashboard"
            element={
              <RequireRole role="volunteer">
                <DashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/admin/groups" replace />} />
            <Route path="groups" element={<AdminGroupsPage />} />
            <Route path="records" element={<AdminRecordsPage />} />
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="obs" element={<AdminObsPage />} />
            <Route path="scheduling" element={<AdminSchedulingPage />} />
            <Route path="history" element={<AdminHistoryPage />} />
            <Route path="access-log" element={<AdminAccessLogPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
          </Route>
          <Route path="/groups/:groupId" element={<GroupAttendancePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

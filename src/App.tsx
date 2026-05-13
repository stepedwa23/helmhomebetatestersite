import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Auth screens
import Login from './pages/Login'
import Welcome from './pages/Welcome'

// Shared (role-conditional content inside the page)
import Dashboard from './pages/Dashboard'

// Tester-facing pages
import ReportBug from './pages/tester/ReportBug'
import MySubmissions from './pages/tester/MySubmissions'
import HelpLibrary from './pages/tester/HelpLibrary'
import HelpArticleView from './pages/tester/HelpArticleView'
import Suggestions from './pages/tester/Suggestions'

// Admin pages
import AdminTesters from './pages/admin/Testers'
import AdminTestCycles from './pages/admin/TestCycles'
import AdminBugTriage from './pages/admin/BugTriage'
import AdminBugDetail from './pages/admin/BugDetail'
import AdminFeedback from './pages/admin/Feedback'
import AdminPatchNotes from './pages/admin/PatchNotes'
import AdminHelpLibrary from './pages/admin/HelpLibraryAdmin'
import AdminHelpArticleEdit from './pages/admin/HelpArticleEdit'
import AdminSuggestions from './pages/admin/SuggestionsTriage'
import AdminSettings from './pages/admin/Settings'

export default function App() {
  return (
    <Routes>
      {/* Public auth routes — outside the layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/welcome" element={<Welcome />} />

      {/* Full-screen standalone admin views (own fixed toolbar) — protected but OUTSIDE Layout */}
      <Route
        path="/admin/bugs/:id"
        element={
          <ProtectedRoute>
            <AdminBugDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/help/:id/edit"
        element={
          <ProtectedRoute>
            <AdminHelpArticleEdit />
          </ProtectedRoute>
        }
      />

      {/* All other authenticated routes — inside Layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Tester pages */}
        <Route path="/report-bug" element={<ReportBug />} />
        <Route path="/my-submissions" element={<MySubmissions />} />
        <Route path="/help" element={<HelpLibrary />} />
        <Route path="/help/:slug" element={<HelpArticleView />} />
        <Route path="/suggestions" element={<Suggestions />} />

        {/* Admin pages */}
        <Route path="/admin/testers" element={<AdminTesters />} />
        <Route path="/admin/cycles" element={<AdminTestCycles />} />
        <Route path="/admin/bugs" element={<AdminBugTriage />} />
        <Route path="/admin/feedback" element={<AdminFeedback />} />
        <Route path="/admin/patch-notes" element={<AdminPatchNotes />} />
        <Route path="/admin/help" element={<AdminHelpLibrary />} />
        <Route path="/admin/suggestions" element={<AdminSuggestions />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

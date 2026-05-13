import { Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { project, isAdmin, tester } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-shrink-0 md:flex-col bg-slate-900 text-slate-100">
        <Sidebar />
      </aside>

      {/* Mobile sidebar (overlay) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative w-64 flex flex-col bg-slate-900 text-slate-100">
            <button
              className="absolute top-3 right-3 p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Right column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center justify-between gap-3 px-4 md:px-6 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden p-1.5 rounded text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-gray-900 truncate">
              {project?.name ?? 'Beta Tester Site'}
            </h1>
          </div>
          <div className="hidden sm:block text-xs text-gray-500">
            {isAdmin ? 'Admin' : tester ? `Signed in as ${tester.name}` : 'Signed in'}
          </div>
          <button
            type="button"
            className="text-xs font-medium text-gray-600 hover:text-gray-900"
            onClick={() => navigate('/dashboard')}
          >
            Home
          </button>
        </header>

        {/* Scrollable main */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

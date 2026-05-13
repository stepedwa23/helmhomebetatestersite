import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Bug, Lightbulb, BookOpen, Download as DownloadIcon } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import PagePlaceholder from '../components/PagePlaceholder'
import LoadingSpinner from '../components/LoadingSpinner'
import PreviewModeBanner from '../components/PreviewModeBanner'
import TipTapView from '../components/editor/TipTapView'
import { getCurrentVersion } from '../lib/appVersions'
import { listDownloads, getDownloadUrl } from '../lib/appDownloads'
import {
  ACTIVE_PLATFORMS,
  APP_PLATFORM_LABEL,
  type AppDownload,
  type AppPlatform,
  type AppVersion,
  type Tester,
} from '../types'

export default function Dashboard() {
  const { effectiveIsAdmin, tester, project, rolesLoading } = useAuth()

  if (effectiveIsAdmin) {
    return (
      <PagePlaceholder
        title="Admin dashboard"
        description="Open bug counts, active test cycles, recent submissions."
      />
    )
  }

  // Tester dashboard — current beta version + patch notes + quick links.
  // This branch also runs when the admin is in preview mode (effectiveIsAdmin=false).
  return <TesterDashboard tester={tester} projectId={project?.id ?? null} rolesLoading={rolesLoading} />
}

// ---------- Tester dashboard ----------

interface TesterDashboardProps {
  tester: Tester | null
  projectId: string | null
  rolesLoading: boolean
}

function TesterDashboard({ tester, projectId, rolesLoading }: TesterDashboardProps) {
  const [version, setVersion] = useState<AppVersion | null | undefined>(undefined)
  const [versionError, setVersionError] = useState<string | null>(null)
  const [downloads, setDownloads] = useState<AppDownload[]>([])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setVersionError(null)
    getCurrentVersion(projectId)
      .then(async (v) => {
        if (cancelled) return
        setVersion(v)
        if (v) {
          try {
            const dl = await listDownloads(v.id)
            if (!cancelled) setDownloads(dl)
          } catch (err) {
            console.warn('[Dashboard] Failed to load downloads', err)
            if (!cancelled) setDownloads([])
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setVersionError(err instanceof Error ? err.message : 'Failed to load')
          setVersion(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const detectedPlatform = useDetectedPlatform(tester?.os ?? null)

  if (rolesLoading || !projectId) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const firstName = tester?.name.split(' ')[0]

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PreviewModeBanner />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          The latest from the Helm beta — and quick links to where you can help.
        </p>
      </header>

      {/* Current version banner */}
      {version === undefined ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-center mb-4">
          <LoadingSpinner size="sm" />
        </div>
      ) : version ? (
        <section className="mb-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl overflow-hidden">
          <div className="px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-100">
              Current beta
            </div>
            <div className="mt-1 flex items-baseline gap-3 flex-wrap">
              <h2 className="text-2xl font-semibold">Version {version.version}</h2>
              {version.release_date && (
                <span className="inline-flex items-center gap-1 text-sm text-blue-100">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(version.release_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
          <div className="bg-white px-6 py-5">
            <TipTapView
              content={version.patch_notes}
              emptyText="No patch notes for this version yet."
            />
          </div>
        </section>
      ) : (
        <section className="mb-6 bg-white border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-600">
            {versionError
              ? `Couldn't load the current version (${versionError}).`
              : 'No current beta version has been published yet.'}
          </p>
        </section>
      )}

      {/* Downloads */}
      {version && downloads.length > 0 && (
        <section className="mb-6 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h3 className="text-base font-semibold text-gray-900">
              Download Helm v{version.version}
            </h3>
            {detectedPlatform && (
              <span className="text-xs text-gray-500">
                Looks like you're on {APP_PLATFORM_LABEL[detectedPlatform]}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ACTIVE_PLATFORMS.map((p) => {
              const dl = downloads.find((d) => d.platform === p)
              return (
                <DownloadButton
                  key={p}
                  platform={p}
                  download={dl ?? null}
                  highlighted={detectedPlatform === p}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Help shape this beta
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickLink
            to="/report-bug"
            icon={Bug}
            title="Report a bug"
            description="Something broken? Let me know."
          />
          <QuickLink
            to="/suggestions"
            icon={Lightbulb}
            title="Suggest something"
            description="Ideas for what's next."
          />
          <QuickLink
            to="/help"
            icon={BookOpen}
            title="Help library"
            description="Guides and references."
          />
        </div>
      </section>
    </div>
  )
}

function QuickLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <Icon className="w-5 h-5 text-blue-600 mb-2" />
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="mt-0.5 text-xs text-gray-500">{description}</div>
    </Link>
  )
}

// ---------- Download button + OS detection ----------

interface DownloadButtonProps {
  platform: AppPlatform
  download: AppDownload | null
  highlighted: boolean
}

function DownloadButton({ platform, download, highlighted }: DownloadButtonProps) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const available = !!download

  async function handleClick() {
    if (!download) return
    setErr(null)
    setBusy(true)
    try {
      const url = await getDownloadUrl(download.storage_path, 300)
      // Navigate to the signed URL; the `download: true` option on the signed
      // URL forces a content-disposition that prompts a download in the browser.
      window.location.href = url
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed')
    } finally {
      // Leave the button "busy" for a moment so the user sees something happened.
      setTimeout(() => setBusy(false), 800)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!available || busy}
      className={[
        'text-left rounded-xl p-4 border transition-all',
        available
          ? highlighted
            ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700 shadow-sm'
            : 'bg-white border-gray-200 text-gray-900 hover:border-blue-300 hover:shadow-sm'
          : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <DownloadIcon className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-semibold">{APP_PLATFORM_LABEL[platform]}</span>
      </div>
      <div className={`mt-1 text-xs ${highlighted && available ? 'text-blue-100' : 'text-gray-500'}`}>
        {available ? (
          <>
            <span className="truncate inline-block max-w-full">{download!.filename}</span>
            <br />
            <span>{formatBytes(download!.size_bytes)}</span>
          </>
        ) : (
          'Not available yet'
        )}
      </div>
      {err && (
        <div className="mt-2 text-xs text-red-100 bg-red-700/80 rounded px-2 py-1">{err}</div>
      )}
    </button>
  )
}

/**
 * Best-effort guess at the tester's platform. Prefers their tester profile's
 * `os` field (admin-known truth). Falls back to navigator.userAgent for finer
 * arch hints. Returns null if we genuinely can't tell.
 */
function useDetectedPlatform(testerOs: Tester['os']): AppPlatform | null {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  if (testerOs === 'macos' || /Macintosh|Mac OS X/.test(ua)) {
    // navigator.userAgent doesn't reliably distinguish Apple Silicon from Intel
    // (Safari hides this for fingerprinting reasons). We default to arm64
    // since Stephen's tester pool is presumably mostly recent Macs and our
    // ACTIVE_PLATFORMS doesn't include macos_x64.
    return 'macos_arm64'
  }
  if (testerOs === 'windows' || /Windows/.test(ua)) {
    // ARM64 Windows uses "ARM64" in the user agent.
    if (/ARM64|aarch64/i.test(ua)) return 'windows_arm64'
    return 'windows_x64'
  }
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

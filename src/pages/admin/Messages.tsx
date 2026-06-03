import { useCallback, useEffect, useState } from 'react'
import {
  Mail,
  MoreHorizontal,
  Trash2,
  Inbox,
  CheckCircle2,
  RotateCcw,
  Archive,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmDialog from '../../components/ConfirmDialog'
import Badge from '../../components/StatusBadge'
import {
  listMessagesAdmin,
  updateMessageStatus,
  deleteMessage,
  type TesterMessageWithTester,
} from '../../lib/messages'
import {
  TESTER_MESSAGE_STATUS_LABEL,
  type TesterMessageStatus,
} from '../../types'

const STATUS_TONE: Record<TesterMessageStatus, 'blue' | 'green' | 'gray'> = {
  new: 'blue',
  replied: 'green',
  archived: 'gray',
}

type Filter = 'inbox' | 'all'

export default function AdminMessages() {
  const { project } = useAuth()
  const [messages, setMessages] = useState<TesterMessageWithTester[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('inbox')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<TesterMessageWithTester | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listMessagesAdmin(project.id)
      setMessages(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
      setMessages([])
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!openMenu) return
    function onClick() {
      setOpenMenu(null)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [openMenu])

  if (!project) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  async function setStatus(m: TesterMessageWithTester, status: TesterMessageStatus) {
    try {
      await updateMessageStatus(m.id, status)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update message')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteMessage(deleting.id)
      setDeleting(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message')
    }
  }

  const filtered = (messages ?? []).filter((m) =>
    filter === 'inbox' ? m.status !== 'archived' : true,
  )
  const newCount = (messages ?? []).filter((m) => m.status === 'new').length

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
          <p className="mt-1 text-sm text-gray-500">
            Direct messages from testers. You'll also get each one by email with
            Reply-To set to the tester — hitting Reply in your mail client responds to
            them directly. Mark as replied here to keep your inbox tidy.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 whitespace-nowrap">
          <FilterButton
            label={`Inbox${newCount > 0 ? ` (${newCount})` : ''}`}
            active={filter === 'inbox'}
            onClick={() => setFilter('inbox')}
          />
          <FilterButton
            label="All"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {messages === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Inbox className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">
            {filter === 'inbox'
              ? 'No messages in your inbox.'
              : 'No messages from testers yet.'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Testers can reach you via the "Contact" link in their sidebar.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {filtered.map((m) => {
            const isOpen = expanded === m.id
            return (
              <div key={m.id} className={isOpen ? 'bg-gray-50/40' : ''}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                  className="w-full px-5 py-3 flex items-start justify-between gap-3 text-left hover:bg-gray-50/60"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 flex-shrink-0">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {m.subject}
                        </span>
                        <Badge tone={STATUS_TONE[m.status]}>
                          {TESTER_MESSAGE_STATUS_LABEL[m.status]}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {m.tester?.name ?? 'Unknown tester'} ·{' '}
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="relative flex-shrink-0"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu(openMenu === m.id ? null : m.id)
                      }}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                      aria-label="Message actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === m.id && (
                      <RowMenu
                        message={m}
                        onMarkReplied={() => {
                          setOpenMenu(null)
                          setStatus(m, 'replied')
                        }}
                        onReopen={() => {
                          setOpenMenu(null)
                          setStatus(m, 'new')
                        }}
                        onArchive={() => {
                          setOpenMenu(null)
                          setStatus(m, 'archived')
                        }}
                        onDelete={() => {
                          setOpenMenu(null)
                          setDeleting(m)
                        }}
                      />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 pl-12">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {m.body}
                    </p>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {m.tester?.email && (
                        <a
                          href={`mailto:${m.tester.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Reply via email
                        </a>
                      )}
                      {m.status !== 'replied' && (
                        <button
                          type="button"
                          onClick={() => setStatus(m, 'replied')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark replied
                        </button>
                      )}
                      {m.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => setStatus(m, 'archived')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete message?"
        message={
          deleting
            ? `Permanently delete "${deleting.subject}"? The tester's send record stays in their history if you keep it; deletion removes it from everywhere.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function RowMenu({
  message,
  onMarkReplied,
  onReopen,
  onArchive,
  onDelete,
}: {
  message: TesterMessageWithTester
  onMarkReplied: () => void
  onReopen: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-full mt-1 z-10 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm text-left"
    >
      {message.status !== 'replied' && (
        <MenuItem icon={CheckCircle2} label="Mark replied" onClick={onMarkReplied} />
      )}
      {message.status === 'replied' && (
        <MenuItem icon={RotateCcw} label="Mark as new" onClick={onReopen} />
      )}
      {message.status !== 'archived' && (
        <MenuItem icon={Archive} label="Archive" onClick={onArchive} />
      )}
      {message.status === 'archived' && (
        <MenuItem icon={RotateCcw} label="Unarchive" onClick={onReopen} />
      )}
      <div className="my-1 border-t border-gray-100" />
      <MenuItem
        icon={Trash2}
        label="Delete"
        onClick={onDelete}
        className="text-red-600 hover:bg-red-50"
      />
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  className = 'text-gray-700 hover:bg-gray-50',
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 ${className}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </button>
  )
}

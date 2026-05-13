import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Star, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import PreviewModeBanner from '../../components/PreviewModeBanner'
import { listArticles } from '../../lib/helpArticles'
import type { HelpArticle } from '../../types'

export default function HelpLibrary() {
  const { project, rolesLoading } = useAuth()
  const [articles, setArticles] = useState<HelpArticle[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listArticles(project.id)
      setArticles(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Split into pinned + grouped-by-category.
  const sections = useMemo(() => {
    if (!articles) return null

    const pinned = articles.filter((a) => a.is_pinned)
    const unpinned = articles.filter((a) => !a.is_pinned)

    // Group unpinned by category (or "Other" if empty).
    const byCategory = new Map<string, HelpArticle[]>()
    for (const a of unpinned) {
      const key = a.category?.trim() || 'Other'
      const list = byCategory.get(key) ?? []
      list.push(a)
      byCategory.set(key, list)
    }
    // Sorted: pinned first (handled separately), then alphabetical by category,
    // with "Other" always last.
    const categories = Array.from(byCategory.keys()).sort((a, b) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.localeCompare(b)
    })
    return {
      pinned,
      categories: categories.map((name) => ({ name, articles: byCategory.get(name)! })),
    }
  }, [articles])

  if (rolesLoading || !project) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const isEmpty = articles?.length === 0

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PreviewModeBanner />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Help Library</h1>
        <p className="mt-1 text-sm text-gray-500">
          Guides and references for testing Helm. Browse by category or jump to a pinned
          article.
        </p>
      </header>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {articles === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : isEmpty ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No articles yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            The project owner hasn't published any help articles. Check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections!.pinned.length > 0 && (
            <Section title="Pinned" icon={Star}>
              {sections!.pinned.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </Section>
          )}

          {sections!.categories.map((cat) => (
            <Section key={cat.name} title={cat.name}>
              {cat.articles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </Section>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Section + Card ----------

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function ArticleCard({ article }: { article: HelpArticle }) {
  return (
    <Link
      to={`/help/${article.slug}`}
      className="block bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 truncate">{article.title}</div>
          {article.category && !article.is_pinned && (
            <div className="mt-0.5 text-xs text-gray-500">{article.category}</div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </div>
    </Link>
  )
}

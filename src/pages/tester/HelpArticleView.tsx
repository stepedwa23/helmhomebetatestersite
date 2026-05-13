import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Star, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import PreviewModeBanner from '../../components/PreviewModeBanner'
import TipTapView from '../../components/editor/TipTapView'
import { getArticleBySlug } from '../../lib/helpArticles'
import type { HelpArticle } from '../../types'

export default function HelpArticleView() {
  const { slug } = useParams<{ slug: string }>()
  const { project, rolesLoading } = useAuth()
  const [article, setArticle] = useState<HelpArticle | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!project || !slug) return
    setError(null)
    try {
      const a = await getArticleBySlug(project.id, slug)
      setArticle(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article')
      setArticle(null)
    }
  }, [project, slug])

  useEffect(() => {
    load()
  }, [load])

  if (rolesLoading || !project) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PreviewModeBanner />

      <Link
        to="/help"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Help Library
      </Link>

      {article === undefined ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : article === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-600">
            {error
              ? `Couldn't load the article (${error}).`
              : `No article found at "/help/${slug}".`}
          </p>
          <Link
            to="/help"
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            Back to Help Library
          </Link>
        </div>
      ) : (
        <article className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <header className="px-6 py-5 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {article.is_pinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800 rounded-full">
                  <Star className="w-3 h-3" />
                  Pinned
                </span>
              )}
              {article.category && (
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {article.category}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">{article.title}</h1>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>Updated {format(new Date(article.updated_at), 'MMM d, yyyy')}</span>
            </div>
          </header>

          <div className="px-6 py-6">
            <TipTapView
              content={article.body}
              emptyText="This article doesn't have any content yet."
            />
          </div>
        </article>
      )}
    </div>
  )
}

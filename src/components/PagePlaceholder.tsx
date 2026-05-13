import type { ReactNode } from 'react'

interface PagePlaceholderProps {
  title: string
  description?: string
  children?: ReactNode
}

/**
 * Temporary scaffold for placeholder pages. Each feature page will replace
 * this with real content during the build-order phase 7.
 */
export default function PagePlaceholder({ title, description, children }: PagePlaceholderProps) {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {children ?? (
          <p className="text-sm text-gray-500">
            This page is scaffolded but not yet implemented. Feature pages will be built in
            the order specified in the project README.
          </p>
        )}
      </div>
    </div>
  )
}

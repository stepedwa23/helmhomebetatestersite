import { useParams } from 'react-router-dom'
import PagePlaceholder from '../../components/PagePlaceholder'

export default function HelpArticleView() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <PagePlaceholder
      title="Help article"
      description={`Slug: ${slug ?? '(unknown)'} — rendered with TipTap read-only + Tailwind 'prose'.`}
    />
  )
}

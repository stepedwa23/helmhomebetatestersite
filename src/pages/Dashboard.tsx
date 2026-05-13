import { useAuth } from '../contexts/AuthContext'
import PagePlaceholder from '../components/PagePlaceholder'

export default function Dashboard() {
  const { isAdmin, tester } = useAuth()

  if (isAdmin) {
    return (
      <PagePlaceholder
        title="Admin dashboard"
        description="Open bug counts, active test cycles, recent submissions."
      />
    )
  }

  return (
    <PagePlaceholder
      title={tester ? `Welcome back, ${tester.name.split(' ')[0]}` : 'Welcome'}
      description="Current beta version and patch notes will appear here."
    />
  )
}

import { EmptyState } from '../components/ui/Feedback'

export default function PlaceholderPage({ title, description }) {
  return (
    <section className="card">
      <EmptyState title={`${title} coming soon`} description={description} />
    </section>
  )
}

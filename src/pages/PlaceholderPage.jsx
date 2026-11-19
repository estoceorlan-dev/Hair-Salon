import { EmptyState } from '../components/ui/Feedback'

export default function PlaceholderPage({ title, description }) {
  return (
    <section className="card">
      <EmptyState title={title} description={description} />
    </section>
  )
}

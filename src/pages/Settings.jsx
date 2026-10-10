import { Feedback, LoadingState } from '../components/ui/Feedback'
import { useHealth } from '../hooks/useHealth'

export default function Settings() {
  const health = useHealth()
  return (
    <div className="flex-col gap-4">
      <section className="card">
        <h2 className="text-lg">Salon settings</h2>
        <p className="text-muted">
          Business hours, prices, tax, payroll, and payment settings will be
          configured later.
        </p>
      </section>
      <section className="card">
        <h2 className="text-lg">Connection status</h2>
        {health.status === 'loading' && (
          <LoadingState message="Checking connection..." />
        )}
        {health.status === 'error' && (
          <Feedback tone="error">{health.error}</Feedback>
        )}
        {health.status === 'success' && (
          <Feedback
            tone={health.data.database.status === 'ready' ? 'success' : 'info'}
          >
            {health.data.database.status === 'ready'
              ? 'The application and data storage are connected. Screens still use sample records in this preview.'
              : 'The application is connected. Data storage is not ready yet; screens use sample records.'}
          </Feedback>
        )}
        <button
          type="button"
          className="btn btn-secondary mt-4"
          onClick={health.retry}
          disabled={health.status === 'loading'}
        >
          Check again
        </button>
      </section>
    </div>
  )
}

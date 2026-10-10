import { Scissors, ArrowRight } from 'lucide-react'
import { Feedback } from './ui/Feedback'

export default function Login({ onLogin }) {
  return (
    <div className="preview-entry">
      <div className="card glass preview-entry-card">
        <div className="text-center mb-4">
          <div className="salon-logo">
            <Scissors size={32} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold">Romel Hair Salon</h1>
          <p className="text-muted">Explore the salon workspace.</p>
        </div>
        <Feedback>
          Preview only. Account sign-in and saved records will be available
          later.
        </Feedback>
        <div className="flex-col gap-4 mt-4">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onLogin('employee')}
          >
            Preview employee workspace <ArrowRight size={18} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onLogin('customer')}
          >
            Preview customer booking
          </button>
        </div>
      </div>
    </div>
  )
}

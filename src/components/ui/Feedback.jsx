import { AlertCircle, CheckCircle, Info, LoaderCircle } from 'lucide-react'

export function Feedback({ tone = 'info', children }) {
  const Icon =
    tone === 'error' || tone === 'validation'
      ? AlertCircle
      : tone === 'success'
        ? CheckCircle
        : Info
  return (
    <div
      className={`feedback feedback-${tone}`}
      role={tone === 'error' || tone === 'validation' ? 'alert' : 'status'}
    >
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spinner" size={20} aria-hidden="true" />
      {message}
    </div>
  )
}

export function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <p className="font-bold">{title}</p>
      {description && <p className="text-muted text-sm">{description}</p>}
    </div>
  )
}

export function FieldError({ id, children }) {
  if (!children) return null
  return (
    <p id={id} className="field-error" role="alert">
      {children}
    </p>
  )
}

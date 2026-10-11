import { EmptyState, Feedback, LoadingState } from './Feedback'

export function Field({ label, children, ...props }) {
  return <label className="input-group"><span className="input-label">{label}</span>
    {children || <input className="input-field" {...props} />}</label>
}
export function Select({ label, children, ...props }) {
  return <Field label={label}><select className="input-field" {...props}>{children}</select></Field>
}
export function StatusField({ value = true }) {
  return <Select label="Status" name="isActive" defaultValue={String(value)}><option value="true">Active</option><option value="false">Inactive</option></Select>
}
export function Pager({ page, total = 0, size = 20, onChange }) {
  return <div className="list-pagination"><span>{total} records · Page {page} of {Math.max(1, Math.ceil(total / size))}</span>
    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
    <button className="btn btn-secondary" disabled={page * size >= total} onClick={() => onChange(page + 1)}>Next</button></div>
}
export function RecordState({ records, children }) {
  if (records.loading) return <LoadingState />
  if (records.error) return <><Feedback tone="error">{records.error}</Feedback><button className="btn btn-secondary mt-4" onClick={records.refresh}>Retry</button></>
  if (!records.data?.items?.length) return <EmptyState title="No records found" />
  return children
}
export function Filters({ query, setQuery, status = true }) {
  return <div className="management-toolbar">
    <Field label="Search records" type="search" value={query.q} onChange={(e) => setQuery({ ...query, q: e.target.value, page: 1 })} />
    {status && <Select label="Filter status" value={query.status} onChange={(e) => setQuery({ ...query, status: e.target.value, page: 1 })}>
      <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>}
  </div>
}

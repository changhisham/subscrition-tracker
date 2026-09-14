const labels = { PENDING: 'Pending', PAID: 'Paid', OVERDUE: 'Overdue', WAIVED: 'Waived' }

export default function StatusBadge({ status }) {
  return <span className={`status status-${String(status).toLowerCase()}`}>{labels[status] || status}</span>
}

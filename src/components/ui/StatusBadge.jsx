const labels = { PENDING: 'Pending', PAID: 'Paid', OVERDUE: 'Overdue', WAIVED: 'Waived', PARTIAL: 'Partial' }

export default function StatusBadge({ status, amountDue, amountPaid }) {
  const isPartial = ['PENDING', 'OVERDUE'].includes(status)
    && Number(amountPaid) > 0
    && Number(amountPaid) < Number(amountDue)
  const effective = isPartial ? 'PARTIAL' : status
  return <span className={`status status-${String(effective).toLowerCase()}`}>{labels[effective] || effective}</span>
}

export default function StatCard({ label, value, icon: Icon, tone = 'default', hint }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-icon"><Icon size={19} /></div>
      <div className="min-w-0">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  )
}

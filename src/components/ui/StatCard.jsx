import { TrendingDown, TrendingUp } from 'lucide-react'
import Sparkline from './Sparkline'

const sparklineColors = { default: '#3B1C64', success: '#039855', warning: '#dc6803', danger: '#d92d20' }

export default function StatCard({ label, value, icon: Icon, tone = 'default', hint, delta, sparkline }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-icon"><Icon size={19} /></div>
      <div className="stat-body">
        <div className="stat-top-row">
          <div className="stat-label">{label}</div>
          {delta && (
            <span className={`stat-delta stat-delta-${delta.tone}`}>
              {delta.tone !== 'neutral' && (delta.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
              {delta.text}
            </span>
          )}
        </div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
      {sparkline && sparkline.length > 1 && (
        <Sparkline data={sparkline} color={sparklineColors[tone] || sparklineColors.default} />
      )}
    </div>
  )
}

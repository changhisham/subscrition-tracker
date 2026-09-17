import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CheckCircle, Scale, Users } from 'lucide-react'
import { listPayments, updatePayment } from '../services/payments'
import { SkeletonList } from '../components/ui/Skeleton'
import StatCard from '../components/ui/StatCard'
import { useToast } from '../context/ToastContext'
import { money } from '../utils/currency'
import { todayIso } from '../utils/dates'
import { colorFor } from '../utils/color'

export default function Balances() {
  const toast = useToast()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  async function load() {
    setLoading(true)
    setPayments(await listPayments({}))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const balances = useMemo(() => {
    const map = new Map()
    payments.forEach(p => {
      const key = p.member_id
      if (!map.has(key)) map.set(key, { member: p.member, due: 0, paid: 0, outstanding: 0, overdue: 0, unpaidIds: [] })
      const entry = map.get(key)
      entry.due += Number(p.amount_due || 0)
      entry.paid += Number(p.amount_paid || 0)
      if (!['PAID', 'WAIVED'].includes(p.status)) {
        entry.outstanding += Math.max(0, Number(p.amount_due || 0) - Number(p.amount_paid || 0))
        entry.unpaidIds.push(p.id)
      }
      if (p.status === 'OVERDUE') entry.overdue += 1
    })
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding)
  }, [payments])

  const totalOutstanding = balances.reduce((a, b) => a + b.outstanding, 0)
  const settledCount = balances.filter(b => b.outstanding <= 0).length

  async function settleAll(entry) {
    setBusy(entry.member?.id)
    try {
      const targets = payments.filter(p => entry.unpaidIds.includes(p.id))
      await Promise.all(targets.map(p => updatePayment(p.id, { status: 'PAID', payment_date: todayIso(), amount_paid: p.amount_due })))
      await load()
      toast.success(`Settled ${entry.unpaidIds.length} payment${entry.unpaidIds.length === 1 ? '' : 's'} for ${entry.member?.nickname || 'friend'}`)
    } catch (e) {
      toast.error(e.message)
    }
    setBusy('')
  }

  return (
    <>
      <div className="page-heading-row"><div><h2>Balances</h2><p>Lifetime totals across every subscription — settle up with a friend in one click.</p></div></div>

      <div className="stats-grid three">
        <StatCard label="Total outstanding" value={money(totalOutstanding)} icon={Scale} tone={totalOutstanding > 0 ? 'danger' : 'success'} />
        <StatCard label="Friends tracked" value={String(balances.length)} icon={Users} />
        <StatCard label="Fully settled" value={String(settledCount)} icon={CheckCircle} tone="success" />
      </div>

      <section className="panel">
        <div className="panel-header"><div><h3><Scale size={17}/> Balances</h3><p>Sorted by who owes the most.</p></div><span className="count">{balances.length}</span></div>
        {loading ? <SkeletonList rows={4} /> : (
          <div className="payment-list">
            {balances.map(b => {
              const tint = colorFor(b.member?.nickname)
              const pct = b.due > 0 ? Math.min(100, (b.paid / b.due) * 100) : 100
              const barColor = pct >= 100 ? '#039855' : pct >= 50 ? '#dc6803' : '#d92d20'
              return (
              <div className="payment-row balance-row" key={b.member?.id || b.member?.nickname}>
                <div className="avatar soft" style={{ background: tint.bg, color: tint.fg }}>{b.member?.nickname?.slice(0,1).toUpperCase() || '?'}</div>
                <div className="row-main">
                  <strong>{b.member?.nickname}</strong>
                  <span>{money(b.paid)} paid of {money(b.due)} billed{b.overdue ? ` · ${b.overdue} overdue` : ''}</span>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} /></div>
                </div>
                <div className="row-end">
                  <strong className={b.outstanding > 0 ? 'owing-text' : ''}>{b.outstanding > 0 ? `${money(b.outstanding)} owing` : 'Settled up'}</strong>
                  {b.outstanding > 0 && <button className="btn small success-btn" disabled={busy===b.member?.id} onClick={()=>settleAll(b)}><CheckCircle2 size={14}/>Settle all</button>}
                </div>
              </div>
              )
            })}
            {!balances.length && <div className="empty">No payment records yet.</div>}
          </div>
        )}
      </section>
    </>
  )
}

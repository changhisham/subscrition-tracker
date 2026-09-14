import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, CreditCard, WalletCards } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import { listPayments } from '../services/payments'
import { listSubscriptions } from '../services/subscriptions'
import { money } from '../utils/currency'
import { formatDate, monthInputValue, formatMonth } from '../utils/dates'

export default function Dashboard() {
  const [month, setMonth] = useState(monthInputValue())
  const [payments, setPayments] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [year, m] = month.split('-').map(Number)
    const from = `${month}-01`
    const last = new Date(year, m, 0).getDate()
    const to = `${month}-${String(last).padStart(2, '0')}`
    const [p, s] = await Promise.all([
      listPayments({ from, to }),
      listSubscriptions(),
    ])
    setPayments(p)
    setSubscriptions(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [month])

  const stats = useMemo(() => ({
    total: payments.reduce((a, p) => a + Number(p.amount_due || 0), 0),
    received: payments.reduce((a, p) => a + Number(p.amount_paid || 0), 0),
    outstanding: payments.filter(p => !['PAID', 'WAIVED'].includes(p.status)).reduce((a, p) => a + Math.max(0, Number(p.amount_due || 0) - Number(p.amount_paid || 0)), 0),
    overdue: payments.filter(p => p.status === 'OVERDUE').length,
  }), [payments])

  const active = subscriptions.filter(s => s.status === 'ACTIVE')

  return (
    <>
      <div className="page-heading-row">
        <div><h2>{formatMonth(month)}</h2><p>Here is what needs your attention this month.</p></div>
        <input className="month-picker" type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      <div className="stats-grid">
        <StatCard label="Expected" value={money(stats.total)} icon={CreditCard} />
        <StatCard label="Received" value={money(stats.received)} icon={CheckCircle2} tone="success" />
        <StatCard label="Outstanding" value={money(stats.outstanding)} icon={WalletCards} tone="warning" />
        <StatCard label="Overdue" value={String(stats.overdue)} icon={AlertCircle} tone="danger" hint="payments" />
      </div>

      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><div><h3>Outstanding payments</h3><p>People you may want to contact privately.</p></div></div>
          {loading ? <div className="empty">Loading…</div> : payments.filter(p => !['PAID', 'WAIVED'].includes(p.status)).length === 0 ? (
            <div className="empty success-empty"><CheckCircle2 size={28}/><strong>All caught up</strong><span>No outstanding payments for this period.</span></div>
          ) : (
            <div className="payment-list">
              {payments.filter(p => !['PAID', 'WAIVED'].includes(p.status)).map(p => (
                <div className="payment-row" key={p.id}>
                  <div className="avatar soft">{p.member?.nickname?.slice(0,1).toUpperCase() || '?'}</div>
                  <div className="row-main"><strong>{p.member?.nickname}</strong><span>{p.subscription?.name} · Due {formatDate(p.due_date)}</span></div>
                  <div className="row-end"><strong>{money(Number(p.amount_due) - Number(p.amount_paid || 0))}</strong><StatusBadge status={p.status}/></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header"><div><h3>Active subscriptions</h3><p>{active.length} active service{active.length === 1 ? '' : 's'}.</p></div></div>
          {active.length === 0 ? <div className="empty">No subscriptions yet.</div> : (
            <div className="payment-list">
              {active.map(s => {
                const charges = (s.subscription_members || []).reduce((a, x) => a + Number(x.monthly_amount || 0), 0)
                return <div className="payment-row" key={s.id}>
                  <div className="service-icon"><CreditCard size={18}/></div>
                  <div className="row-main"><strong>{s.name}</strong><span>{s.provider || '—'} · {s.billing_day || '—'}th monthly</span></div>
                  <div className="row-end"><strong>{money(s.price)}</strong><span className="muted">{money(charges)} allocated</span></div>
                </div>
              })}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

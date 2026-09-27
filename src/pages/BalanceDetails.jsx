import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, ChevronRight, Info, Scale, Wallet, X } from 'lucide-react'
import { listMembersWithSubscriptions } from '../services/subscriptions'
import { listPayments, updatePayment } from '../services/payments'
import RadialMeter from '../components/ui/RadialMeter'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import ServiceIcon from '../components/ui/ServiceIcon'
import { SkeletonList } from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'
import { money } from '../utils/currency'
import { formatDate, formatRelative, todayIso } from '../utils/dates'
import { colorFor } from '../utils/color'

const statusRank = { OVERDUE: 3, PENDING: 2, WAIVED: 1, PAID: 0 }
const tabs = ['Overview', 'Subscriptions', 'Payment History']

function insightText(name, overdueSubCount, activeSubCount, outstanding) {
  const plural = n => (n === 1 ? '' : 's')
  if (!activeSubCount) return `${name} isn't part of any subscription yet.`
  if (overdueSubCount > 0 && overdueSubCount === activeSubCount) return `${name} has ${activeSubCount} subscription${plural(activeSubCount)} and all are currently overdue. Total outstanding amount is ${money(outstanding)}.`
  if (overdueSubCount > 0) return `${name} has ${overdueSubCount} of ${activeSubCount} subscription${plural(activeSubCount)} overdue, totaling ${money(outstanding)} outstanding.`
  if (outstanding > 0) return `${name} owes ${money(outstanding)} across ${activeSubCount} subscription${plural(activeSubCount)}, none overdue yet.`
  return `${name} is fully settled across all ${activeSubCount} subscription${plural(activeSubCount)}.`
}

export default function BalanceDetails() {
  const { id } = useParams()
  const toast = useToast()
  const [member, setMember] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('Overview')

  async function load() {
    setLoading(true)
    try {
      const [members, pays] = await Promise.all([listMembersWithSubscriptions(), listPayments({ memberId: id })])
      setMember(members.find(m => String(m.id) === String(id)) || null)
      setPayments(pays)
    } catch (e) {
      toast.error(e.message)
      setMember(null)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const bySub = useMemo(() => {
    const map = new Map()
    payments.forEach(p => {
      const key = p.subscription_id
      if (!map.has(key)) map.set(key, { subscription: p.subscription, due: 0, paid: 0, outstanding: 0, status: 'PAID', nextDue: null, lastDue: null })
      const s = map.get(key)
      const due = Number(p.amount_due || 0)
      const paid = Number(p.amount_paid || 0)
      const unpaid = !['PAID', 'WAIVED'].includes(p.status)
      s.due += due; s.paid += paid
      if (unpaid) {
        s.outstanding += Math.max(0, due - paid)
        if (!s.nextDue || p.due_date < s.nextDue) s.nextDue = p.due_date
      }
      if (!s.lastDue || p.due_date > s.lastDue) s.lastDue = p.due_date
      if ((statusRank[p.status] || 0) > (statusRank[s.status] || 0)) s.status = p.status
    })
    return Array.from(map.values())
      .map(s => ({ ...s, displayDue: s.nextDue || s.lastDue, pct: s.due > 0 ? Math.min(100, (s.paid / s.due) * 100) : 100 }))
      .sort((a, b) => (a.subscription?.name || '').localeCompare(b.subscription?.name || ''))
  }, [payments])

  const totals = useMemo(() => bySub.reduce((a, s) => ({ due: a.due + s.due, paid: a.paid + s.paid, outstanding: a.outstanding + s.outstanding }), { due: 0, paid: 0, outstanding: 0 }), [bySub])
  const activeSubCount = (member?.subscription_members || []).filter(sm => !sm.left_date).length
  const overdueSubCount = bySub.filter(s => s.status === 'OVERDUE').length
  const collectPct = totals.due > 0 ? (totals.paid / totals.due) * 100 : 0
  const collectColor = collectPct >= 90 ? '#039855' : collectPct >= 50 ? '#dc6803' : '#d92d20'

  const recentActivity = useMemo(() => (
    payments.filter(p => ['PAID', 'WAIVED'].includes(p.status)).slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 6)
  ), [payments])

  const paymentHistory = useMemo(() => payments.slice().sort((a, b) => b.due_date.localeCompare(a.due_date)), [payments])

  async function settleAll() {
    if (!member) return
    setBusy(true)
    try {
      const unpaid = payments.filter(p => !['PAID', 'WAIVED'].includes(p.status))
      await Promise.all(unpaid.map(p => updatePayment(p.id, { status: 'PAID', payment_date: todayIso(), amount_paid: p.amount_due })))
      await load()
      toast.success(`Settled ${unpaid.length} payment${unpaid.length === 1 ? '' : 's'} for ${member.nickname}`)
    } catch (e) {
      toast.error(e.message)
    }
    setBusy(false)
  }

  function remind() {
    toast.info(`Reminders aren't set up yet — let ${member?.nickname || 'them'} know directly for now.`)
  }

  if (loading) return (
    <>
      <Link to="/balances" className="back-link"><ArrowLeft size={16} /> Back to balances</Link>
      <section className="panel"><SkeletonList rows={4} /></section>
    </>
  )

  if (!member) return (
    <>
      <Link to="/balances" className="back-link"><ArrowLeft size={16} /> Back to balances</Link>
      <section className="panel"><div className="empty">Friend not found. They may have been removed.</div></section>
    </>
  )

  const tint = colorFor(member.nickname)
  const insight = insightText(member.nickname, overdueSubCount, activeSubCount, totals.outstanding)

  return (
    <>
      <Link to="/balances" className="back-link"><ArrowLeft size={16} /> Back to balances</Link>

      <div className="balance-hero">
        <div className="identity-card">
          <div className="avatar" style={{ width: 50, height: 50, fontSize: 18, background: tint.bg, color: tint.fg }}>{member.nickname.slice(0, 1).toUpperCase()}</div>
          <h2>{member.nickname}</h2>
          <div className="identity-meta">
            {activeSubCount} active subscription{activeSubCount === 1 ? '' : 's'}
            {overdueSubCount > 0 && <><span className="status-dot red" />{overdueSubCount} overdue</>}
          </div>
          <div className="identity-added"><CalendarDays size={12} /> Added {formatDate(member.created_at)}</div>
        </div>

        <StatCard label="Total billed" value={money(totals.due)} icon={Wallet} hint={`${bySub.length} subscription${bySub.length === 1 ? '' : 's'}`} />
        <StatCard label="Total paid" value={money(totals.paid)} icon={CheckCircle2} tone="success" hint={`${Math.round(collectPct)}% collected`} />
        <StatCard label="Outstanding" value={money(totals.outstanding)} icon={Scale} tone={totals.outstanding > 0 ? 'danger' : 'success'} hint={`${bySub.length} subscription${bySub.length === 1 ? '' : 's'}`} />

        <div className="collection-card">
          <span className="stat-label" style={{ alignSelf: 'flex-start' }}>Collection progress</span>
          <RadialMeter pct={collectPct} color={collectColor}><strong>{Math.round(collectPct)}%</strong></RadialMeter>
          <button className="btn primary full" disabled={busy || totals.outstanding <= 0} onClick={settleAll}><CheckCircle2 size={16} />Settle all</button>
          <button className="btn ghost full" onClick={remind}><Bell size={16} />Send reminder</button>
        </div>
      </div>

      <div className="report-tabs">
        {tabs.map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'Subscriptions' ? `Subscriptions (${bySub.length})` : t}</button>)}
      </div>

      <div className="content-grid two">
        <div>
          {tab !== 'Payment History' && (
            <section className="panel" style={{ marginBottom: 14 }}>
              <div className="panel-header"><div><h3>Subscription breakdown</h3><p>Amounts owed per subscription.</p></div></div>
              <div className="payment-list">
                {bySub.map(s => (
                  <Link className="payment-row" to={`/subscriptions/${s.subscription?.id}`} key={s.subscription?.id || s.subscription?.name}>
                    <ServiceIcon name={s.subscription?.name} provider={s.subscription?.provider} size={34} iconSize={18} />
                    <div className="row-main">
                      <strong>{s.subscription?.name || 'Unknown'}</strong>
                      <span>Due {formatDate(s.displayDue)} · {s.subscription?.billing_frequency === 'YEARLY' ? 'Yearly' : 'Monthly'}</span>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${s.pct}%`, background: s.pct >= 100 ? '#039855' : s.pct >= 50 ? '#dc6803' : '#d92d20' }} /></div>
                    </div>
                    <div className="row-end">
                      <StatusBadge status={s.status} />
                      <strong>{money(s.outstanding)}</strong>
                      <span className="muted">{Math.round(s.pct)}% paid</span>
                    </div>
                    <ChevronRight size={16} />
                  </Link>
                ))}
                {!bySub.length && <div className="empty">No subscriptions yet.</div>}
              </div>
            </section>
          )}

          {tab === 'Overview' && (
            <section className="panel">
              <div className="panel-header"><div><h3>Payment history</h3><p>Most recent first.</p></div><button className="btn ghost small" onClick={() => setTab('Payment History')}>View all</button></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Subscription</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {paymentHistory.slice(0, 5).map(p => (
                      <tr key={p.id}><td className="nowrap">{formatDate(p.due_date)}</td><td>{p.subscription?.name}</td><td>{money(p.amount_due)}</td><td><StatusBadge status={p.status} amountDue={p.amount_due} amountPaid={p.amount_paid} /></td></tr>
                    ))}
                  </tbody>
                </table>
                {!paymentHistory.length && <div className="empty">No payment records yet.</div>}
              </div>
            </section>
          )}

          {tab === 'Payment History' && (
            <section className="panel">
              <div className="panel-header"><div><h3>Payment history</h3><p>{paymentHistory.length} record(s).</p></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Subscription</th><th>Amount</th><th>Status</th><th>Note</th></tr></thead>
                  <tbody>
                    {paymentHistory.map(p => (
                      <tr key={p.id}><td className="nowrap">{formatDate(p.due_date)}</td><td>{p.subscription?.name}</td><td>{money(p.amount_due)}</td><td><StatusBadge status={p.status} amountDue={p.amount_due} amountPaid={p.amount_paid} /></td><td>{p.notes || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
                {!paymentHistory.length && <div className="empty">No payment records yet.</div>}
              </div>
            </section>
          )}
        </div>

        <div>
          <section className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-header"><h3>Subscription summary</h3></div>
            <div className="payment-list">
              {bySub.map(s => (
                <div className="payment-row" key={s.subscription?.id || s.subscription?.name}>
                  <ServiceIcon name={s.subscription?.name} provider={s.subscription?.provider} size={28} iconSize={15} />
                  <div className="row-main"><strong>{s.subscription?.name}</strong></div>
                  <div className="row-end"><strong>{money(s.outstanding)}</strong><StatusBadge status={s.status} /></div>
                </div>
              ))}
              {!bySub.length && <div className="empty small">Nothing to show.</div>}
            </div>
          </section>

          <div className="callout insight-callout" style={{ marginBottom: 14 }}>
            <Info size={16} />
            <span>{insight}</span>
          </div>

          <section className="panel">
            <div className="panel-header"><h3>Recent activity</h3></div>
            <div className="activity-list">
              {recentActivity.map(p => (
                <div className="activity-item" key={p.id}>
                  <div className={`activity-icon ${p.status === 'WAIVED' ? 'waived' : ''}`}>{p.status === 'WAIVED' ? <X size={14} /> : <CheckCircle2 size={14} />}</div>
                  <div className="activity-body">
                    <strong>{member.nickname} {p.status === 'WAIVED' ? 'waived' : 'paid'} {money(p.status === 'WAIVED' ? p.amount_due : p.amount_paid)}</strong>
                    <span className="sub">{p.subscription?.name} · {formatRelative(p.updated_at)}</span>
                  </div>
                </div>
              ))}
              {!recentActivity.length && <div className="empty small">No activity yet.</div>}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

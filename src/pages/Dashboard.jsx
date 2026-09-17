import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, CreditCard, WalletCards, X } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import RadialMeter from '../components/ui/RadialMeter'
import { Skeleton, SkeletonList } from '../components/ui/Skeleton'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { listPayments, updatePayment } from '../services/payments'
import { listSubscriptions } from '../services/subscriptions'
import { money } from '../utils/currency'
import { monthInputValue, formatMonth, formatDate, todayIso } from '../utils/dates'
import { colorFor } from '../utils/color'

function greetingFor(hour) {
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const statusColors = { OVERDUE: '#d92d20', PENDING: '#dc6803', PAID: '#039855', WAIVED: '#98a2b3' }
const statusTints = { OVERDUE: 'rgba(217,45,32,.12)', PENDING: 'rgba(220,104,3,.12)', PAID: 'rgba(3,152,85,.14)', WAIVED: 'rgba(152,162,179,.16)' }

const scopes = ['Monthly', 'Yearly']
const statusOrder = ['OVERDUE', 'PENDING', 'PAID', 'WAIVED']
const monthLetters = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i)
const TREND_PERIODS = 6

function monthIndexOf(dateStr) {
  return Number(dateStr.slice(5, 7)) - 1
}

function periodBounds(scope, month, year, offset = 0) {
  if (scope === 'Yearly') {
    const y = year + offset
    return { key: String(y), from: `${y}-01-01`, to: `${y}-12-31` }
  }
  const [yy, mm] = month.split('-').map(Number)
  const d = new Date(yy, mm - 1 + offset, 1)
  const y2 = d.getFullYear(), m2 = d.getMonth() + 1
  const key = `${y2}-${String(m2).padStart(2, '0')}`
  const last = new Date(y2, m2, 0).getDate()
  return { key, from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` }
}

function deltaBadge(curr, prev, invert = false, neutral = false) {
  if (prev === 0) return curr === 0 ? { text: '0%', tone: 'neutral', up: false } : { text: 'New', tone: 'neutral', up: true }
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) < 0.5) return { text: '0%', tone: 'neutral', up: false }
  const up = pct > 0
  const tone = neutral ? 'neutral' : (invert ? !up : up) ? 'success' : 'danger'
  return { text: `${up ? '+' : ''}${pct.toFixed(0)}%`, tone, up }
}

function GridCell({ status }) {
  if (!status) return <td className="grid-cell grid-cell-empty">–</td>
  const bg = statusTints[status] || statusTints.PAID
  if (status === 'OVERDUE') return <td className="grid-cell grid-cell-cross" style={{ background: bg }}><X size={14}/></td>
  if (status === 'PENDING') return <td className="grid-cell grid-cell-pending" style={{ background: bg }}>•</td>
  return <td className="grid-cell grid-cell-check" style={{ background: bg }}><Check size={14}/></td>
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [scope, setScope] = useState('Monthly')
  const [month, setMonth] = useState(monthInputValue())
  const [year, setYear] = useState(currentYear)
  const [allPayments, setAllPayments] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const trailPeriods = useMemo(
    () => Array.from({ length: TREND_PERIODS }, (_, i) => periodBounds(scope, month, year, i - (TREND_PERIODS - 1))),
    [scope, month, year]
  )
  const current = trailPeriods[TREND_PERIODS - 1]

  async function load() {
    setLoading(true)
    const [p, s] = await Promise.all([
      listPayments({ from: trailPeriods[0].from, to: current.to }),
      listSubscriptions(),
    ])
    setAllPayments(p)
    setSubscriptions(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [scope, month, year])

  const payments = useMemo(
    () => allPayments.filter(p => p.due_date >= current.from && p.due_date <= current.to),
    [allPayments, current.from, current.to]
  )

  const trendBuckets = useMemo(() => {
    const map = new Map(trailPeriods.map(tp => [tp.key, { total: 0, received: 0, outstanding: 0, overdue: 0 }]))
    allPayments.forEach(p => {
      const key = scope === 'Yearly' ? p.due_date.slice(0, 4) : p.due_date.slice(0, 7)
      const bucket = map.get(key)
      if (!bucket) return
      bucket.total += Number(p.amount_due || 0)
      bucket.received += Number(p.amount_paid || 0)
      if (!['PAID', 'WAIVED'].includes(p.status)) bucket.outstanding += Math.max(0, Number(p.amount_due || 0) - Number(p.amount_paid || 0))
      if (p.status === 'OVERDUE') bucket.overdue += 1
    })
    return trailPeriods.map(tp => map.get(tp.key))
  }, [allPayments, trailPeriods, scope])

  const currentBucket = trendBuckets[TREND_PERIODS - 1]
  const previousBucket = trendBuckets[TREND_PERIODS - 2]
  const sparklines = useMemo(() => ({
    total: trendBuckets.map(b => b.total),
    received: trendBuckets.map(b => b.received),
    outstanding: trendBuckets.map(b => b.outstanding),
    overdue: trendBuckets.map(b => b.overdue),
  }), [trendBuckets])

  const collectPct = currentBucket.total ? Math.min(100, (currentBucket.received / currentBucket.total) * 100) : 0
  const collectColor = collectPct >= 90 ? '#039855' : collectPct >= 50 ? '#dc6803' : '#d92d20'

  const active = subscriptions.filter(s => s.status === 'ACTIVE')

  const dueSoon = useMemo(() => (
    payments
      .filter(p => ['OVERDUE', 'PENDING'].includes(p.status))
      .slice()
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
  ), [payments])
  const upNext = dueSoon.slice(0, 5)

  async function markPaid(p) {
    setBusyId(p.id)
    try {
      await updatePayment(p.id, { status: 'PAID', payment_date: todayIso(), amount_paid: p.amount_due })
      await load()
      toast.success(`Marked ${p.subscription?.name || 'payment'} as paid for ${p.member?.nickname || 'friend'}`)
    } catch (e) {
      toast.error(e.message)
    }
    setBusyId('')
  }

  const friendsSummary = useMemo(() => {
    const map = new Map()
    payments.forEach(p => {
      const key = p.member_id
      if (!map.has(key)) map.set(key, { member: p.member, due: 0, paid: 0, outstanding: 0, overdue: 0, count: 0 })
      const entry = map.get(key)
      entry.due += Number(p.amount_due || 0)
      entry.paid += Number(p.amount_paid || 0)
      entry.count += 1
      if (!['PAID', 'WAIVED'].includes(p.status)) entry.outstanding += Math.max(0, Number(p.amount_due || 0) - Number(p.amount_paid || 0))
      if (p.status === 'OVERDUE') entry.overdue += 1
    })
    return Array.from(map.values()).sort((a, b) => (a.member?.nickname || '').localeCompare(b.member?.nickname || ''))
  }, [payments])

  const statusSummary = useMemo(() => {
    const map = Object.fromEntries(statusOrder.map(s => [s, { count: 0, due: 0, paid: 0 }]))
    payments.forEach(p => {
      if (!map[p.status]) map[p.status] = { count: 0, due: 0, paid: 0 }
      map[p.status].count += 1
      map[p.status].due += Number(p.amount_due || 0)
      map[p.status].paid += Number(p.amount_paid || 0)
    })
    return statusOrder.map(s => ({ status: s, ...map[s] }))
  }, [payments])

  // One check/cross/blank grid per subscription: rows = members (+ an "All" aggregate row),
  // columns = months of the selected year, plus a Total column and a bottom Collected row.
  const yearlyGrids = useMemo(() => {
    const bySub = new Map()
    payments.forEach(p => {
      const subId = p.subscription_id
      if (!bySub.has(subId)) {
        bySub.set(subId, {
          subscription: p.subscription,
          rows: new Map(),
          monthTotals: Array.from({ length: 12 }, () => ({ paid: 0, total: 0 })),
        })
      }
      const g = bySub.get(subId)
      const idx = monthIndexOf(p.due_date)

      if (!g.rows.has(p.member_id)) {
        g.rows.set(p.member_id, { member: p.member, cells: Array(12).fill(null), total: 0 })
      }
      const row = g.rows.get(p.member_id)
      row.cells[idx] = p.status
      row.total += Number(p.amount_due || 0)

      g.monthTotals[idx].total += 1
      if (['PAID', 'WAIVED'].includes(p.status)) g.monthTotals[idx].paid += 1
    })

    return Array.from(bySub.values()).map(g => {
      const rows = Array.from(g.rows.values()).sort((a, b) => (a.member?.nickname || '').localeCompare(b.member?.nickname || ''))
      const allCells = Array.from({ length: 12 }, (_, i) => {
        const statuses = rows.map(r => r.cells[i]).filter(Boolean)
        if (!statuses.length) return null
        if (statuses.includes('OVERDUE')) return 'OVERDUE'
        if (statuses.includes('PENDING')) return 'PENDING'
        return 'PAID'
      })
      const allTotal = rows.reduce((a, r) => a + r.total, 0)
      return { subscription: g.subscription, rows, allCells, allTotal, monthTotals: g.monthTotals }
    }).sort((a, b) => (a.subscription?.name || '').localeCompare(b.subscription?.name || ''))
  }, [payments])

  const heading = scope === 'Yearly' ? `Year ${year}` : formatMonth(month)
  const periodWord = scope === 'Yearly' ? 'year' : 'month'

  const [subTab, setSubTab] = useState(null)
  useEffect(() => {
    if (scope !== 'Yearly') return
    const exists = yearlyGrids.some(g => (g.subscription?.id ?? g.subscription?.name) === subTab)
    if (!exists) setSubTab(yearlyGrids[0] ? (yearlyGrids[0].subscription?.id ?? yearlyGrids[0].subscription?.name) : null)
  }, [yearlyGrids, scope])
  const activeGrid = yearlyGrids.find(g => (g.subscription?.id ?? g.subscription?.name) === subTab)

  const name = profile?.display_name || user?.email?.split('@')[0] || 'there'
  const initial = name.slice(0, 1).toUpperCase()

  return (
    <>
      <div className="welcome-banner">
        <div className="welcome-copy">
          <p className="welcome-eyebrow">{greetingFor(new Date().getHours())}</p>
          <h1>Welcome back, {name}</h1>
          <p className="welcome-sub">
            {loading ? 'Loading your latest activity…' : dueSoon.length
              ? `You have ${dueSoon.length} payment${dueSoon.length === 1 ? '' : 's'} pending or overdue this ${periodWord}.`
              : `You're all caught up — nothing pending this ${periodWord}.`}
          </p>
        </div>
        <div className="welcome-meta">
          <div className="avatar">{initial}</div>
          <div><strong>{name}</strong><span>{user?.email}</span></div>
        </div>
      </div>

      <div className="page-heading-row">
        <div><h2>{heading}</h2><p>Here is what needs your attention this {periodWord}.</p></div>
        {scope === 'Yearly'
          ? <select className="month-picker" value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          : <input className="month-picker" type="month" value={month} onChange={e => setMonth(e.target.value)} />}
      </div>

      <div className="report-tabs">
        {scopes.map(s => <button key={s} className={scope === s ? 'active' : ''} onClick={() => setScope(s)}>{s}</button>)}
      </div>

      <div className="content-grid two hero-row">
        <section className="panel hero-panel">
          <div className="panel-header"><div><h3>Collection rate</h3><p>Share of this {periodWord}'s billing collected so far.</p></div></div>
          <div className="hero-content">
            {loading ? <Skeleton className="skeleton-block" style={{ width: 108, height: 108, borderRadius: '50%', margin: 0 }} /> : (
              <RadialMeter pct={collectPct} color={collectColor}>
                <strong>{Math.round(collectPct)}%</strong>
              </RadialMeter>
            )}
            <div className="hero-copy">
              <strong>{money(currentBucket.received)}</strong>
              <span>collected of {money(currentBucket.total)} expected</span>
            </div>
          </div>
          <div className="hero-breakdown">
            <div><span>Outstanding</span><strong>{money(currentBucket.outstanding)}</strong></div>
            <div><span>Overdue</span><strong>{currentBucket.overdue}</strong></div>
            <div><span>Active subs</span><strong>{active.length}</strong></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div><h3>Up next</h3><p>Due or overdue, soonest first.</p></div></div>
          {loading ? <SkeletonList rows={3} withAvatar={false} /> : !upNext.length ? (
            <div className="empty">Nothing due — all caught up.</div>
          ) : (
            <div className="payment-list">
              {upNext.map(p => (
                <div className="payment-row" key={p.id}>
                  <StatusBadge status={p.status} amountDue={p.amount_due} amountPaid={p.amount_paid} />
                  <div className="row-main">
                    <strong>{p.subscription?.name || 'Unknown'}</strong>
                    <span>{p.member?.nickname || '—'} · due {formatDate(p.due_date)}</span>
                  </div>
                  <div className="row-end">
                    <strong>{money(p.amount_due)}</strong>
                    <button className="btn small success-btn" disabled={busyId === p.id} onClick={() => markPaid(p)}>
                      <CheckCircle2 size={14}/>Paid
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="stats-grid">
        <StatCard label="Expected" value={money(currentBucket.total)} icon={CreditCard}
          delta={deltaBadge(currentBucket.total, previousBucket.total, false, true)}
          sparkline={sparklines.total} />
        <StatCard label="Received" value={money(currentBucket.received)} icon={CheckCircle2} tone="success"
          delta={deltaBadge(currentBucket.received, previousBucket.received)}
          sparkline={sparklines.received} />
        <StatCard label="Outstanding" value={money(currentBucket.outstanding)} icon={WalletCards} tone="warning"
          delta={deltaBadge(currentBucket.outstanding, previousBucket.outstanding, true)}
          sparkline={sparklines.outstanding} />
        <StatCard label="Overdue" value={String(currentBucket.overdue)} icon={AlertCircle} tone="danger" hint="payments"
          delta={deltaBadge(currentBucket.overdue, previousBucket.overdue, true)}
          sparkline={sparklines.overdue} />
      </div>

      {scope === 'Yearly' ? (
        loading ? (
          <section className="panel"><Skeleton className="skeleton-block" /></section>
        ) : !yearlyGrids.length ? (
          <section className="panel"><div className="empty">No payment records for {year}.</div></section>
        ) : (
          <>
            <div className="report-tabs sub-tabs">
              {yearlyGrids.map(g => {
                const key = g.subscription?.id ?? g.subscription?.name
                return <button key={key} className={subTab === key ? 'active' : ''} onClick={() => setSubTab(key)}>{g.subscription?.name || 'Unknown'}</button>
              })}
            </div>
            {activeGrid && (
              <section className="panel">
                <div className="panel-header"><div><h3>{activeGrid.subscription?.name || 'Unknown subscription'}</h3><p>{activeGrid.subscription?.provider || '—'}</p></div></div>
                <div className="table-wrap">
                  <table className="grid-table">
                    <thead>
                      <tr><th></th>{monthLetters.map((l, i) => <th key={i}>{l}</th>)}<th>Total</th></tr>
                    </thead>
                    <tbody>
                      <tr className="grid-all-row">
                        <td>All</td>
                        {activeGrid.allCells.map((s, i) => <GridCell key={i} status={s} />)}
                        <td className="grid-total">{money(activeGrid.allTotal)}</td>
                      </tr>
                      {activeGrid.rows.map(r => (
                        <tr key={r.member?.id || r.member?.nickname}>
                          <td>{r.member?.nickname}</td>
                          {r.cells.map((s, i) => <GridCell key={i} status={s} />)}
                          <td className="grid-total">{money(r.total)}</td>
                        </tr>
                      ))}
                      <tr className="grid-collected-row">
                        <td>Collected</td>
                        {activeGrid.monthTotals.map((mt, i) => <td key={i}>{mt.total ? `${mt.paid}/${mt.total}` : '–'}</td>)}
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )
      ) : (
        <>
          <div className="content-grid two">
            <section className="panel">
              <div className="panel-header"><div><h3>Subscriptions</h3><p>{active.length} active service{active.length === 1 ? '' : 's'}.</p></div></div>
              {loading ? <SkeletonList rows={3} withAvatar={false} /> : active.length === 0 ? <div className="empty">No subscriptions yet.</div> : (
                <div className="payment-list">
                  {active.map(s => {
                    const charges = (s.subscription_members || []).reduce((a, x) => a + Number(x.monthly_amount || 0), 0)
                    const tint = colorFor(s.name)
                    return <div className="payment-row" key={s.id}>
                      <div className="service-icon" style={{ background: tint.bg, color: tint.fg }}><CreditCard size={18}/></div>
                      <div className="row-main"><strong>{s.name}</strong><span>{s.provider || '—'} · {s.billing_day || '—'}th monthly</span></div>
                      <div className="row-end"><strong>{money(s.price)}</strong><span className="muted">{money(charges)} allocated</span></div>
                    </div>
                  })}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header"><div><h3>Friends</h3><p>Payment activity for this {periodWord}.</p></div></div>
              {loading ? <SkeletonList rows={4} /> : !friendsSummary.length ? (
                <div className="empty">No payment records for this period.</div>
              ) : (
                <div className="payment-list">
                  {friendsSummary.map(f => {
                    const tint = colorFor(f.member?.nickname)
                    const pct = f.due > 0 ? Math.min(100, (f.paid / f.due) * 100) : 100
                    const barColor = pct >= 100 ? '#039855' : pct >= 50 ? '#dc6803' : '#d92d20'
                    return <div className="payment-row leaderboard-row" key={f.member?.id || f.member?.nickname}>
                      <div className="avatar soft" style={{ background: tint.bg, color: tint.fg }}>{f.member?.nickname?.slice(0,1).toUpperCase() || '?'}</div>
                      <div className="row-main">
                        <strong>{f.member?.nickname}</strong>
                        <span>{f.count} payment{f.count === 1 ? '' : 's'} · {f.overdue} overdue</span>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} /></div>
                      </div>
                      <div className="row-end"><strong>{money(f.paid)} / {money(f.due)}</strong><span className="muted">{f.outstanding > 0 ? `${money(f.outstanding)} owing` : 'Settled'}</span></div>
                    </div>
                  })}
                </div>
              )}
            </section>
          </div>

          <section className="panel">
            <div className="panel-header"><div><h3>Payments status</h3><p>Breakdown by status for this {periodWord}.</p></div></div>
            {loading ? <SkeletonList rows={3} withAvatar={false} /> : !payments.length ? (
              <div className="empty">No payment records for this period.</div>
            ) : (
              <div className="content-grid two">
                <div className="chart-panel">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusSummary.filter(s => s.count > 0)} dataKey="due" nameKey="status" innerRadius={52} outerRadius={80} paddingAngle={3}>
                        {statusSummary.filter(s => s.count > 0).map(s => <Cell key={s.status} fill={statusColors[s.status]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => money(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="chart-legend">
                    {statusSummary.filter(s => s.count > 0).map(s => (
                      <span className="chart-legend-item" key={s.status}><span className="chart-legend-dot" style={{ background: statusColors[s.status] }} />{s.status}</span>
                    ))}
                  </div>
                </div>
                <div className="payment-list">
                  {statusSummary.filter(s => s.count > 0).map(s => (
                    <div className="payment-row" key={s.status}>
                      <StatusBadge status={s.status}/>
                      <div className="row-main"><strong>{s.count} payment{s.count === 1 ? '' : 's'}</strong></div>
                      <div className="row-end"><strong>{money(s.due)}</strong><span className="muted">{money(s.paid)} received</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, CreditCard, WalletCards, X } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import { listPayments } from '../services/payments'
import { listSubscriptions } from '../services/subscriptions'
import { money } from '../utils/currency'
import { monthInputValue, formatMonth } from '../utils/dates'

const scopes = ['Monthly', 'Yearly']
const statusOrder = ['OVERDUE', 'PENDING', 'PAID', 'WAIVED']
const monthLetters = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i)

function monthIndexOf(dateStr) {
  return Number(dateStr.slice(5, 7)) - 1
}

function GridCell({ status }) {
  if (!status) return <td className="grid-cell grid-cell-empty">–</td>
  if (status === 'OVERDUE') return <td className="grid-cell grid-cell-cross"><X size={14}/></td>
  if (status === 'PENDING') return <td className="grid-cell grid-cell-pending">•</td>
  return <td className="grid-cell grid-cell-check"><Check size={14}/></td>
}

export default function Dashboard() {
  const [scope, setScope] = useState('Monthly')
  const [month, setMonth] = useState(monthInputValue())
  const [year, setYear] = useState(currentYear)
  const [payments, setPayments] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    let from, to
    if (scope === 'Yearly') {
      from = `${year}-01-01`
      to = `${year}-12-31`
    } else {
      const [y, m] = month.split('-').map(Number)
      from = `${month}-01`
      const last = new Date(y, m, 0).getDate()
      to = `${month}-${String(last).padStart(2, '0')}`
    }
    const [p, s] = await Promise.all([
      listPayments({ from, to }),
      listSubscriptions(),
    ])
    setPayments(p)
    setSubscriptions(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [scope, month, year])

  const stats = useMemo(() => ({
    total: payments.reduce((a, p) => a + Number(p.amount_due || 0), 0),
    received: payments.reduce((a, p) => a + Number(p.amount_paid || 0), 0),
    outstanding: payments.filter(p => !['PAID', 'WAIVED'].includes(p.status)).reduce((a, p) => a + Math.max(0, Number(p.amount_due || 0) - Number(p.amount_paid || 0)), 0),
    overdue: payments.filter(p => p.status === 'OVERDUE').length,
  }), [payments])

  const active = subscriptions.filter(s => s.status === 'ACTIVE')

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

  return (
    <>
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

      <div className="stats-grid">
        <StatCard label="Expected" value={money(stats.total)} icon={CreditCard} />
        <StatCard label="Received" value={money(stats.received)} icon={CheckCircle2} tone="success" />
        <StatCard label="Outstanding" value={money(stats.outstanding)} icon={WalletCards} tone="warning" />
        <StatCard label="Overdue" value={String(stats.overdue)} icon={AlertCircle} tone="danger" hint="payments" />
      </div>

      {scope === 'Yearly' ? (
        loading ? (
          <section className="panel"><div className="empty">Loading…</div></section>
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

            <section className="panel">
              <div className="panel-header"><div><h3>Friends</h3><p>Payment activity for this {periodWord}.</p></div></div>
              {loading ? <div className="empty">Loading…</div> : !friendsSummary.length ? (
                <div className="empty">No payment records for this period.</div>
              ) : (
                <div className="payment-list">
                  {friendsSummary.map(f => (
                    <div className="payment-row" key={f.member?.id || f.member?.nickname}>
                      <div className="avatar soft">{f.member?.nickname?.slice(0,1).toUpperCase() || '?'}</div>
                      <div className="row-main"><strong>{f.member?.nickname}</strong><span>{f.count} payment{f.count === 1 ? '' : 's'} · {f.overdue} overdue</span></div>
                      <div className="row-end"><strong>{money(f.paid)} / {money(f.due)}</strong><span className="muted">{f.outstanding > 0 ? `${money(f.outstanding)} owing` : 'Settled'}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="panel">
            <div className="panel-header"><div><h3>Payments status</h3><p>Breakdown by status for this {periodWord}.</p></div></div>
            {loading ? <div className="empty">Loading…</div> : !payments.length ? (
              <div className="empty">No payment records for this period.</div>
            ) : (
              <div className="payment-list">
                {statusSummary.filter(s => s.count > 0).map(s => (
                  <div className="payment-row" key={s.status}>
                    <StatusBadge status={s.status}/>
                    <div className="row-main"><strong>{s.count} payment{s.count === 1 ? '' : 's'}</strong></div>
                    <div className="row-end"><strong>{money(s.due)}</strong><span className="muted">{money(s.paid)} received</span></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

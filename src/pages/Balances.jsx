import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCircle, CheckCircle2, ChevronRight, Download, PieChart, Scale, Search, Users, X } from 'lucide-react'
import { listPayments, updatePayment } from '../services/payments'
import { exportCsv } from '../services/reports'
import { SkeletonList } from '../components/ui/Skeleton'
import StatCard from '../components/ui/StatCard'
import { useToast } from '../context/ToastContext'
import { money } from '../utils/currency'
import { formatRelative, todayIso } from '../utils/dates'
import { colorFor } from '../utils/color'

const statusRank = { OVERDUE: 3, PENDING: 2, WAIVED: 1, PAID: 0 }
const tabKeys = ['All', 'Outstanding', 'Overdue', 'Settled']

export default function Balances() {
  const toast = useToast()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('amount')

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
      if (!map.has(key)) map.set(key, { member: p.member, due: 0, paid: 0, outstanding: 0, unpaidIds: [], subs: new Map() })
      const entry = map.get(key)
      const due = Number(p.amount_due || 0)
      const paid = Number(p.amount_paid || 0)
      const unpaid = !['PAID', 'WAIVED'].includes(p.status)
      entry.due += due
      entry.paid += paid
      if (unpaid) { entry.outstanding += Math.max(0, due - paid); entry.unpaidIds.push(p.id) }

      if (!entry.subs.has(p.subscription_id)) entry.subs.set(p.subscription_id, { subscription: p.subscription, due: 0, paid: 0, outstanding: 0, status: 'PAID' })
      const s = entry.subs.get(p.subscription_id)
      s.due += due; s.paid += paid
      if (unpaid) s.outstanding += Math.max(0, due - paid)
      if ((statusRank[p.status] || 0) > (statusRank[s.status] || 0)) s.status = p.status
    })
    return Array.from(map.values()).map(e => {
      const subs = Array.from(e.subs.values())
      return { ...e, subs, subCount: subs.length, overdueSubs: subs.filter(s => s.status === 'OVERDUE').length }
    })
  }, [payments])

  const totalDue = balances.reduce((a, b) => a + b.due, 0)
  const totalPaid = balances.reduce((a, b) => a + b.paid, 0)
  const totalOutstanding = balances.reduce((a, b) => a + b.outstanding, 0)
  const owingCount = balances.filter(b => b.outstanding > 0).length
  const settledCount = balances.filter(b => b.outstanding <= 0).length
  const overdueFriendsCount = balances.filter(b => b.overdueSubs > 0).length
  const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0

  const tabCounts = { All: balances.length, Outstanding: owingCount, Overdue: overdueFriendsCount, Settled: settledCount }

  const visible = useMemo(() => {
    let list = balances
    if (filter === 'Outstanding') list = list.filter(b => b.outstanding > 0)
    if (filter === 'Overdue') list = list.filter(b => b.overdueSubs > 0)
    if (filter === 'Settled') list = list.filter(b => b.outstanding <= 0)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(b => (b.member?.nickname || '').toLowerCase().includes(q))
    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => (a.member?.nickname || '').localeCompare(b.member?.nickname || ''))
    else if (sort === 'overdue') sorted.sort((a, b) => b.overdueSubs - a.overdueSubs || b.outstanding - a.outstanding)
    else sorted.sort((a, b) => b.outstanding - a.outstanding)
    return sorted
  }, [balances, filter, search, sort])

  const recentActivity = useMemo(() => (
    payments
      .filter(p => ['PAID', 'WAIVED'].includes(p.status))
      .slice()
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 8)
  ), [payments])

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

  function remind(entry) {
    toast.info(`Reminders aren't set up yet — let ${entry.member?.nickname || 'them'} know directly for now.`)
  }

  function handleExport() {
    if (!balances.length) return
    exportCsv(balances.map(b => ({
      friend: b.member?.nickname,
      subscriptions: b.subCount,
      overdue: b.overdueSubs,
      billed: b.due,
      paid: b.paid,
      outstanding: b.outstanding,
    })), `balances-${todayIso()}.csv`)
  }

  const collectedPct = totalDue > 0 ? Math.min(100, (totalPaid / totalDue) * 100) : 0
  const outstandingPct = totalDue > 0 ? Math.min(100 - collectedPct, (totalOutstanding / totalDue) * 100) : 0

  return (
    <>
      <div className="page-heading-row">
        <div><h2>Balances</h2><p>Track who owes you and how much across every subscription.</p></div>
        <button className="btn ghost" onClick={handleExport}><Download size={16} />Export</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Total outstanding" value={money(totalOutstanding)} icon={Scale} tone={totalOutstanding > 0 ? 'danger' : 'success'} hint={`${owingCount} friend${owingCount === 1 ? '' : 's'} owe you`} />
        <StatCard label="Friends tracked" value={String(balances.length)} icon={Users} hint={`${owingCount} currently owing`} />
        <StatCard label="Settled" value={`${settledCount}/${balances.length}`} icon={CheckCircle} tone="success" hint={`${balances.length ? Math.round((settledCount / balances.length) * 100) : 0}% fully settled`} />
        <StatCard label="Collection rate" value={`${Math.round(collectionRate)}%`} icon={PieChart} hint={`${money(totalPaid)} / ${money(totalDue)}`} />
      </div>

      <div className="report-tabs">
        {tabKeys.map(t => <button key={t} className={filter === t ? 'active' : ''} onClick={() => setFilter(t)}>{t} ({tabCounts[t]})</button>)}
      </div>

      <div className="filter-row">
        <div className="search-row"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friend…" /></div>
        <select className="select-input" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="amount">Sort: Amount owed</option>
          <option value="name">Sort: Name</option>
          <option value="overdue">Sort: Most overdue</option>
        </select>
      </div>

      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><div><h3><Scale size={17} /> Money owed to you</h3><p>{filter === 'All' ? 'Every friend' : filter} · {visible.length} shown</p></div></div>
          {loading ? <SkeletonList rows={4} /> : (
            <div className="friend-list">
              {visible.map(b => {
                const tint = colorFor(b.member?.nickname)
                const pct = b.due > 0 ? Math.min(100, (b.paid / b.due) * 100) : 100
                const barColor = pct >= 100 ? '#039855' : pct >= 50 ? '#dc6803' : '#d92d20'
                return (
                  <div className="friend-card" key={b.member?.id || b.member?.nickname}>
                    <Link to={`/balances/${b.member?.id}`} className="avatar soft" style={{ background: tint.bg, color: tint.fg }}>{b.member?.nickname?.slice(0, 1).toUpperCase() || '?'}</Link>
                    <div className="row-main">
                      <Link to={`/balances/${b.member?.id}`} className="friend-name-link"><strong>{b.member?.nickname}</strong><ChevronRight size={14} className="link-chevron" /></Link>
                      <span>
                        {b.subCount} subscription{b.subCount === 1 ? '' : 's'}
                        {b.overdueSubs > 0
                          ? <> · <span className="status-dot red" />{b.overdueSubs} overdue</>
                          : <> · <span className="status-dot green" />All paid</>}
                      </span>
                      <span className="muted">{money(b.paid)} paid of {money(b.due)} billed</span>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} /></div>
                    </div>
                    <div className="row-end">
                      <strong className={b.outstanding > 0 ? 'owing-text' : ''}>{b.outstanding > 0 ? `${money(b.outstanding)} owing` : 'Settled up'}</strong>
                      {b.outstanding > 0 && (
                        <div className="action-row">
                          <button className="btn small ghost" onClick={() => remind(b)}><Bell size={13} />Remind</button>
                          <button className="btn small success-btn" disabled={busy === b.member?.id} onClick={() => settleAll(b)}><CheckCircle2 size={13} />Settle all</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {!visible.length && <div className="empty">{balances.length ? 'No friends match this filter.' : 'No payment records yet.'}</div>}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header"><h3>Recent activity</h3></div>
          <div className="activity-list">
            {recentActivity.map(p => (
              <div className="activity-item" key={p.id}>
                <div className={`activity-icon ${p.status === 'WAIVED' ? 'waived' : ''}`}>{p.status === 'WAIVED' ? <X size={14} /> : <CheckCircle2 size={14} />}</div>
                <div className="activity-body">
                  <strong>{p.member?.nickname || 'Someone'} {p.status === 'WAIVED' ? 'waived' : 'paid'} {money(p.status === 'WAIVED' ? p.amount_due : p.amount_paid)}</strong>
                  <span className="sub">{p.subscription?.name || 'Unknown'} · {formatRelative(p.updated_at)}</span>
                </div>
              </div>
            ))}
            {!recentActivity.length && <div className="empty small">No activity yet.</div>}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="collection-overview">
          <div className="collection-overview-bar-wrap">
            <div className="collection-overview-bar">
              <div className="seg-collected" style={{ width: `${collectedPct}%` }} />
              <div className="seg-outstanding" style={{ width: `${outstandingPct}%` }} />
            </div>
            <div className="collection-overview-legend">
              <span><span className="legend-dot" style={{ background: '#039855' }} />{money(totalPaid)} collected</span>
              <span><span className="legend-dot" style={{ background: '#d92d20' }} />{money(totalOutstanding)} outstanding</span>
              <span><span className="legend-dot" style={{ background: '#e4e7ec' }} />{money(totalDue)} billed</span>
            </div>
          </div>
          <div className="collection-overview-rate">
            <strong>{Math.round(collectionRate)}%</strong>
            <span>Collection rate</span>
          </div>
        </div>
      </section>
    </>
  )
}

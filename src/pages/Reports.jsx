import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, FileBarChart2, PieChart as PieChartIcon, Search, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { monthlySummary, yearlySummary, exportCsv } from '../services/reports'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import { Skeleton } from '../components/ui/Skeleton'
import { money } from '../utils/currency'
import { monthInputValue } from '../utils/dates'

const scopes = ['Monthly', 'Yearly']
const tabs = ['Monthly Summary', 'Payment History', 'Outstanding', 'Overdue']
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i)

export default function Reports() {
  const [scope, setScope] = useState('Monthly')
  const [month, setMonth] = useState(monthInputValue())
  const [year, setYear] = useState(currentYear)
  const [tab, setTab] = useState(tabs[0])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    if (scope === 'Yearly') {
      setRows(await yearlySummary(year))
    } else {
      const [y, m] = month.split('-').map(Number)
      setRows(await monthlySummary(y, m))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [scope, month, year])

  const visible = useMemo(() => {
    let list = rows
    if (tab === 'Outstanding') list = list.filter(r => !['PAID','WAIVED'].includes(r.status))
    if (tab === 'Overdue') list = list.filter(r => r.status === 'OVERDUE')
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(r => (r.member?.nickname||'').toLowerCase().includes(q) || (r.subscription?.name||'').toLowerCase().includes(q))
    return list
  }, [rows, tab, search])

  const bySubscription = useMemo(() => {
    const map = new Map()
    visible.forEach(r => {
      const key = r.subscription?.name || 'Unknown'
      if (!map.has(key)) map.set(key, { name: key, due: 0, received: 0 })
      const entry = map.get(key)
      entry.due += Number(r.amount_due || 0)
      entry.received += Number(r.amount_paid || 0)
    })
    return Array.from(map.values())
  }, [visible])

  const total = visible.reduce((a,r)=>a+Number(r.amount_due||0),0)
  const received = visible.reduce((a,r)=>a+Number(r.amount_paid||0),0)
  const collectPct = total > 0 ? Math.min(100, (received / total) * 100) : 0
  const periodLabel = scope === 'Yearly' ? String(year) : month

  return (
    <>
      <div className="page-heading-row">
        <div><h2>Reports</h2><p>Review financial and payment history and export the current report.</p></div>
        {scope === 'Yearly'
          ? <select className="month-picker" value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          : <input className="month-picker" type="month" value={month} onChange={e => setMonth(e.target.value)}/>}
      </div>

      <div className="stats-grid three">
        <StatCard label="Total due" value={money(total)} icon={Wallet} />
        <StatCard label="Received" value={money(received)} icon={CheckCircle2} tone="success" />
        <StatCard label="Collection rate" value={`${Math.round(collectPct)}%`} icon={PieChartIcon} tone={collectPct >= 90 ? 'success' : collectPct >= 50 ? 'warning' : 'danger'} />
      </div>

      <div className="report-tabs">{scopes.map(s => <button key={s} className={scope===s?'active':''} onClick={()=>setScope(s)}>{s}</button>)}</div>
      <div className="report-tabs">{tabs.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
      <div className="search-row"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by friend or subscription…"/></div>

      <section className="panel">
        <div className="panel-header"><div><h3>Due vs received by subscription</h3><p>Visual breakdown for the current filter.</p></div></div>
        {loading ? <Skeleton className="skeleton-block" /> : !bySubscription.length ? <div className="empty chart-empty">No records for this report.</div> : (
          <div className="chart-panel">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySubscription} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecf0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#667085' }} axisLine={{ stroke: '#e4e7ec' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} tickFormatter={v => money(v)} width={70} />
                <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e4e7ec' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="due" name="Due" fill="#5B21B6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Received" fill="#039855" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header"><div><h3><FileBarChart2 size={18}/> {tab}</h3><p>{visible.length} record(s) · Due {money(total)} · Received {money(received)}</p></div><button className="btn ghost" onClick={()=>exportCsv(visible.map(r=>({person:r.member?.nickname,subscription:r.subscription?.name,due:r.due_date,amount_due:r.amount_due,amount_paid:r.amount_paid,status:r.status})),`subscription-report-${periodLabel}.csv`)}><Download size={16}/> CSV</button></div>
        <div className="table-wrap"><table><thead><tr><th>Person</th><th>Subscription</th><th>Due</th><th>Amount due</th><th>Received</th><th>Status</th></tr></thead><tbody>
          {visible.map((r,i)=><tr key={i}><td>{r.member?.nickname}</td><td>{r.subscription?.name}</td><td>{r.due_date}</td><td>{money(r.amount_due)}</td><td>{money(r.amount_paid)}</td><td><StatusBadge status={r.status} amountDue={r.amount_due} amountPaid={r.amount_paid}/></td></tr>)}
        </tbody></table>{!loading && !visible.length&&<div className="empty">No records for this report.</div>}</div>
      </section>
    </>
  )
}

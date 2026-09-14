import { useEffect, useMemo, useState } from 'react'
import { Download, FileBarChart2 } from 'lucide-react'
import { monthlySummary, exportCsv } from '../services/reports'
import { money } from '../utils/currency'
import { monthInputValue } from '../utils/dates'

const tabs = ['Monthly Summary', 'Payment History', 'Outstanding', 'Overdue']

export default function Reports() {
  const [month, setMonth] = useState(monthInputValue())
  const [tab, setTab] = useState(tabs[0])
  const [rows, setRows] = useState([])

  async function load() {
    const [y,m] = month.split('-').map(Number)
    setRows(await monthlySummary(y,m))
  }
  useEffect(() => { load() }, [month])

  const visible = useMemo(() => {
    if (tab === 'Outstanding') return rows.filter(r => !['PAID','WAIVED'].includes(r.status))
    if (tab === 'Overdue') return rows.filter(r => r.status === 'OVERDUE')
    return rows
  }, [rows, tab])

  const total = visible.reduce((a,r)=>a+Number(r.amount_due||0),0)
  const received = visible.reduce((a,r)=>a+Number(r.amount_paid||0),0)

  return (
    <>
      <div className="page-heading-row"><div><h2>Reports</h2><p>Review financial and payment history and export the current report.</p></div><input className="month-picker" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>
      <div className="report-tabs">{tabs.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
      <section className="panel">
        <div className="panel-header"><div><h3><FileBarChart2 size={18}/> {tab}</h3><p>{visible.length} record(s) · Due {money(total)} · Received {money(received)}</p></div><button className="btn ghost" onClick={()=>exportCsv(visible.map(r=>({person:r.member?.nickname,subscription:r.subscription?.name,due:r.due_date,amount_due:r.amount_due,amount_paid:r.amount_paid,status:r.status})),'subscription-report.csv')}><Download size={16}/> CSV</button></div>
        <div className="table-wrap"><table><thead><tr><th>Person</th><th>Subscription</th><th>Due</th><th>Amount due</th><th>Received</th><th>Status</th></tr></thead><tbody>
          {visible.map((r,i)=><tr key={i}><td>{r.member?.nickname}</td><td>{r.subscription?.name}</td><td>{r.due_date}</td><td>{money(r.amount_due)}</td><td>{money(r.amount_paid)}</td><td>{r.status}</td></tr>)}
        </tbody></table>{!visible.length&&<div className="empty">No records for this report.</div>}</div>
      </section>
    </>
  )
}

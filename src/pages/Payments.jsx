import { useEffect, useState } from 'react'
import { CheckCircle2, Upload } from 'lucide-react'
import { listPayments, updatePayment, uploadReceipt } from '../services/payments'
import StatusBadge from '../components/ui/StatusBadge'
import { money } from '../utils/currency'
import { formatDate, monthInputValue } from '../utils/dates'

export default function Payments() {
  const [month, setMonth] = useState(monthInputValue())
  const [payments, setPayments] = useState([])
  const [busy, setBusy] = useState('')

  async function load() {
    const [year, m] = month.split('-').map(Number)
    const last = new Date(year, m, 0).getDate()
    setPayments(await listPayments({ from: `${month}-01`, to: `${month}-${String(last).padStart(2,'0')}` }))
  }
  useEffect(() => { load() }, [month])

  async function status(id, next) {
    setBusy(id)
    const payload = { status: next }
    if (next === 'PAID') payload.payment_date = new Date().toISOString().slice(0,10)
    await updatePayment(id, payload); await load(); setBusy('')
  }

  async function receipt(id, file) {
    if (!file) return
    setBusy(id)
    await uploadReceipt(id, file)
    await load(); setBusy('')
  }

  return (
    <>
      <div className="page-heading-row"><div><h2>Payments</h2><p>Track what is pending, paid, overdue, or waived.</p></div><input className="month-picker" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Subscription</th><th>Due</th><th>Amount due</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {payments.map(p => <tr key={p.id}>
                <td><strong>{p.member?.nickname}</strong></td>
                <td>{p.subscription?.name}</td>
                <td>{formatDate(p.due_date)}</td>
                <td>{money(p.amount_due)}</td>
                <td>{money(p.amount_paid)}</td>
                <td><StatusBadge status={p.status}/></td>
                <td><div className="action-row">
                  {p.status !== 'PAID' && <button className="btn small success-btn" disabled={busy===p.id} onClick={()=>status(p.id,'PAID')}><CheckCircle2 size={14}/>Paid</button>}
                  {p.status !== 'WAIVED' && <button className="btn small ghost" disabled={busy===p.id} onClick={()=>status(p.id,'WAIVED')}>Waive</button>}
                  <label className="btn small ghost upload-btn"><Upload size={14}/>Receipt<input type="file" accept="image/*,.pdf" onChange={e=>receipt(p.id,e.target.files?.[0])}/></label>
                </div></td>
              </tr>)}
            </tbody>
          </table>
          {!payments.length && <div className="empty">No payment records for this month. Generate a billing period from a subscription.</div>}
        </div>
      </section>
    </>
  )
}

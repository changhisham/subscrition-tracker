import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Pencil, Upload, X } from 'lucide-react'
import { listPayments, updatePayment, uploadReceipt } from '../services/payments'
import StatusBadge from '../components/ui/StatusBadge'
import { money } from '../utils/currency'
import { formatDate, monthInputValue, todayIso } from '../utils/dates'

const statusOptions = ['PENDING', 'PAID', 'OVERDUE', 'WAIVED']

export default function Payments() {
  const [month, setMonth] = useState(monthInputValue())
  const [payments, setPayments] = useState([])
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ status: 'PENDING', payment_date: '' })

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

  function startEdit(p) {
    setEditing(p.id)
    setEditForm({ status: p.status, payment_date: p.payment_date || '' })
  }

  function cancelEdit() { setEditing(null) }

  async function saveEdit(id) {
    setBusy(id)
    const payload = {
      status: editForm.status,
      payment_date: editForm.status === 'PAID' ? (editForm.payment_date || todayIso()) : null,
    }
    await updatePayment(id, payload)
    setEditing(null); await load(); setBusy('')
  }

  const grouped = useMemo(() => {
    const map = new Map()
    payments.forEach(p => {
      const key = p.subscription_id
      if (!map.has(key)) map.set(key, { subscription: p.subscription, rows: [] })
      map.get(key).rows.push(p)
    })
    return Array.from(map.values()).sort((a, b) => (a.subscription?.name || '').localeCompare(b.subscription?.name || ''))
  }, [payments])

  function paymentRow(p) {
    return <tr key={p.id}>
      <td><strong>{p.member?.nickname}</strong></td>
      <td>{formatDate(p.due_date)}</td>
      <td>{money(p.amount_due)}</td>
      <td>{money(p.amount_paid)}</td>
      <td>
        {editing === p.id ? (
          <select className="edit-status-select" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : <StatusBadge status={p.status}/>}
      </td>
      <td><div className="action-row">
        {editing === p.id ? (
          <>
            {editForm.status === 'PAID' && <input type="date" className="edit-date-input" value={editForm.payment_date} onChange={e => setEditForm({...editForm, payment_date: e.target.value})}/>}
            <button className="btn small primary" disabled={busy===p.id} onClick={()=>saveEdit(p.id)}><CheckCircle2 size={14}/>Save</button>
            <button className="btn small ghost" disabled={busy===p.id} onClick={cancelEdit}><X size={14}/>Cancel</button>
          </>
        ) : (
          <>
            {p.status !== 'PAID' && <button className="btn small success-btn" disabled={busy===p.id} onClick={()=>status(p.id,'PAID')}><CheckCircle2 size={14}/>Paid</button>}
            {p.status !== 'WAIVED' && <button className="btn small ghost" disabled={busy===p.id} onClick={()=>status(p.id,'WAIVED')}>Waive</button>}
            <label className="btn small ghost upload-btn"><Upload size={14}/>Receipt<input type="file" accept="image/*,.pdf" onChange={e=>receipt(p.id,e.target.files?.[0])}/></label>
            <button className="icon-btn" disabled={busy===p.id} onClick={()=>startEdit(p)}><Pencil size={14}/></button>
          </>
        )}
      </div></td>
    </tr>
  }

  return (
    <>
      <div className="page-heading-row"><div><h2>Payments</h2><p>Track what is pending, paid, overdue, or waived.</p></div><input className="month-picker" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>

      <div className="grid-panels">
        {!grouped.length ? (
          <section className="panel"><div className="empty">No payment records for this month. Generate a billing period from a subscription.</div></section>
        ) : grouped.map(g => (
          <section className="panel" key={g.subscription?.id || g.subscription?.name}>
            <div className="panel-header"><div><h3>{g.subscription?.name || 'Unknown subscription'}</h3><p>{g.subscription?.provider || '—'}</p></div><span className="count">{g.rows.length}</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Person</th><th>Due</th><th>Amount due</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{g.rows.map(paymentRow)}</tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

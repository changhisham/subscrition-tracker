import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, History, Pencil, Search, Upload, X } from 'lucide-react'
import { listPaymentLog, listPayments, updatePayment, uploadReceipt } from '../services/payments'
import StatusBadge from '../components/ui/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { money } from '../utils/currency'
import { formatDate, monthInputValue, todayIso } from '../utils/dates'

const statusOptions = ['PENDING', 'PAID', 'OVERDUE', 'WAIVED']
const COLS = 7

export default function Payments() {
  const { user } = useAuth()
  const [month, setMonth] = useState(monthInputValue())
  const [payments, setPayments] = useState([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ status: 'PENDING', payment_date: '', amount_paid: '' })
  const [selected, setSelected] = useState(new Set())
  const [historyFor, setHistoryFor] = useState(null)
  const [historyRows, setHistoryRows] = useState([])

  async function load() {
    const [year, m] = month.split('-').map(Number)
    const last = new Date(year, m, 0).getDate()
    setPayments(await listPayments({ from: `${month}-01`, to: `${month}-${String(last).padStart(2,'0')}` }))
    setSelected(new Set())
  }
  useEffect(() => { load() }, [month])

  async function status(id, next, amountDue) {
    setBusy(id)
    const payload = { status: next }
    if (next === 'PAID') { payload.payment_date = todayIso(); payload.amount_paid = amountDue }
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
    setEditForm({ status: p.status, payment_date: p.payment_date || '', amount_paid: String(p.amount_paid ?? 0) })
  }
  function cancelEdit() { setEditing(null) }

  async function saveEdit(id, amountDue) {
    setBusy(id)
    let amountPaid = Number(editForm.amount_paid)
    if (Number.isNaN(amountPaid) || amountPaid < 0) amountPaid = 0
    if (amountPaid > Number(amountDue)) amountPaid = Number(amountDue)
    const nextStatus = editForm.status
    const payload = {
      status: nextStatus,
      amount_paid: nextStatus === 'PAID' ? Number(amountDue) : amountPaid,
      payment_date: nextStatus === 'PAID' ? (editForm.payment_date || todayIso()) : null,
    }
    await updatePayment(id, payload)
    setEditing(null); await load(); setBusy('')
  }

  function toggleSelect(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleGroup(ids) {
    const allSelected = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  async function bulkStatus(next) {
    setBusy('bulk')
    const targets = payments.filter(p => selected.has(p.id))
    await Promise.all(targets.map(p => updatePayment(p.id, next === 'PAID'
      ? { status: 'PAID', payment_date: todayIso(), amount_paid: p.amount_due }
      : { status: 'WAIVED' })))
    setSelected(new Set())
    await load(); setBusy('')
  }

  async function toggleHistory(id) {
    if (historyFor === id) { setHistoryFor(null); return }
    setHistoryFor(id)
    setHistoryRows(await listPaymentLog(id))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return payments
    return payments.filter(p => (p.member?.nickname || '').toLowerCase().includes(q) || (p.subscription?.name || '').toLowerCase().includes(q))
  }, [payments, search])

  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach(p => {
      const key = p.subscription_id
      if (!map.has(key)) map.set(key, { subscription: p.subscription, rows: [] })
      map.get(key).rows.push(p)
    })
    return Array.from(map.values()).sort((a, b) => (a.subscription?.name || '').localeCompare(b.subscription?.name || ''))
  }, [filtered])

  function paymentRow(p) {
    return [
      <tr key={p.id}>
        <td><input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} /></td>
        <td><strong>{p.member?.nickname}</strong></td>
        <td>{formatDate(p.due_date)}</td>
        <td>{money(p.amount_due)}</td>
        <td>{money(p.amount_paid)}</td>
        <td>
          {editing === p.id ? (
            <select className="edit-status-select" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : <StatusBadge status={p.status} amountDue={p.amount_due} amountPaid={p.amount_paid}/>}
        </td>
        <td><div className="action-row">
          {editing === p.id ? (
            <>
              {editForm.status !== 'PAID' && <input type="number" step="0.01" min="0" max={p.amount_due} className="edit-amount-input" placeholder="Amount paid" value={editForm.amount_paid} onChange={e => setEditForm({...editForm, amount_paid: e.target.value})}/>}
              {editForm.status === 'PAID' && <input type="date" className="edit-date-input" value={editForm.payment_date} onChange={e => setEditForm({...editForm, payment_date: e.target.value})}/>}
              <button className="btn small primary" disabled={busy===p.id} onClick={()=>saveEdit(p.id, p.amount_due)}><CheckCircle2 size={14}/>Save</button>
              <button className="btn small ghost" disabled={busy===p.id} onClick={cancelEdit}><X size={14}/>Cancel</button>
            </>
          ) : (
            <>
              {p.status !== 'PAID' && <button className="btn small success-btn" disabled={busy===p.id} onClick={()=>status(p.id,'PAID',p.amount_due)}><CheckCircle2 size={14}/>Paid</button>}
              {p.status !== 'WAIVED' && <button className="btn small ghost" disabled={busy===p.id} onClick={()=>status(p.id,'WAIVED')}>Waive</button>}
              <label className="btn small ghost upload-btn"><Upload size={14}/>Receipt<input type="file" accept="image/*,.pdf" onChange={e=>receipt(p.id,e.target.files?.[0])}/></label>
              <button className="icon-btn" disabled={busy===p.id} onClick={()=>startEdit(p)}><Pencil size={14}/></button>
              <button className="icon-btn" onClick={()=>toggleHistory(p.id)}><History size={14}/></button>
            </>
          )}
        </div></td>
      </tr>,
      historyFor === p.id && (
        <tr className="history-row" key={`${p.id}-history`}>
          <td colSpan={COLS}>
            {!historyRows.length ? <div className="empty small">No changes recorded yet.</div> : (
              <ul className="history-list">
                {historyRows.map(h => (
                  <li key={h.id}>
                    <span className="history-who">{h.changed_by === user?.id ? 'You' : 'Admin'}</span>
                    {h.old_status !== h.new_status && <span> changed status {h.old_status} → {h.new_status}</span>}
                    {Number(h.old_amount_paid) !== Number(h.new_amount_paid) && <span> · amount paid {money(h.old_amount_paid)} → {money(h.new_amount_paid)}</span>}
                    <span className="muted"> · {formatDate(h.changed_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ),
    ]
  }

  return (
    <>
      <div className="page-heading-row"><div><h2>Payments</h2><p>Track what is pending, paid, overdue, or waived.</p></div><input className="month-picker" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>

      <div className="search-row"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by friend or subscription…"/></div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>{selected.size} selected</span>
          <button className="btn small success-btn" disabled={busy==='bulk'} onClick={()=>bulkStatus('PAID')}><CheckCircle2 size={14}/>Mark Paid</button>
          <button className="btn small ghost" disabled={busy==='bulk'} onClick={()=>bulkStatus('WAIVED')}>Waive</button>
          <button className="btn small ghost" onClick={()=>setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="grid-panels">
        {!grouped.length ? (
          <section className="panel"><div className="empty">No payment records for this month. Generate a billing period from a subscription.</div></section>
        ) : grouped.map(g => {
          const ids = g.rows.map(r => r.id)
          const allSelected = ids.length > 0 && ids.every(id => selected.has(id))
          return (
            <section className="panel" key={g.subscription?.id || g.subscription?.name}>
              <div className="panel-header"><div><h3>{g.subscription?.name || 'Unknown subscription'}</h3><p>{g.subscription?.provider || '—'}</p></div><span className="count">{g.rows.length}</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th><input type="checkbox" checked={allSelected} onChange={()=>toggleGroup(ids)}/></th><th>Person</th><th>Due</th><th>Amount due</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>{g.rows.map(paymentRow)}</tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

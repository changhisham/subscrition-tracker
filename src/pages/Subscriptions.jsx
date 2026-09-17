import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard, Plus } from 'lucide-react'
import { createSubscription, listSubscriptions } from '../services/subscriptions'
import { money } from '../utils/currency'
import { colorFor } from '../utils/color'

const blank = { name: '', provider: '', price: '', billing_day: 1, billing_frequency: 'MONTHLY', status: 'ACTIVE', notes: '' }
const statusTabs = ['Active', 'Cancelled', 'All']

export default function Subscriptions() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Active')

  async function load() { setItems(await listSubscriptions()) }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault(); setBusy(true)
    await createSubscription({ ...form, price: Number(form.price), billing_day: Number(form.billing_day) })
    setForm(blank); await load(); setBusy(false)
  }

  const visible = items.filter(s => statusFilter === 'All' ? true : s.status === statusFilter.toUpperCase())

  return (
    <>
      <div className="page-heading-row"><div><h2>Subscriptions</h2><p>Track provider bills and the member amounts you collect.</p></div></div>
      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><h3>Add subscription</h3></div>
          <form className="form-stack" onSubmit={save}>
            <div className="form-grid"><label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Netflix" required/></label><label>Provider<input value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})} placeholder="Netflix"/></label></div>
            <div className="form-grid"><label>Bill price (MYR)<input type="number" step="0.01" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/></label><label>Billing day<input type="number" min="1" max="31" value={form.billing_day} onChange={e=>setForm({...form,billing_day:e.target.value})}/></label></div>
            <label>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional"/></label>
            <button className="btn primary" disabled={busy}><Plus size={16}/>Add subscription</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-header"><h3>Your subscriptions</h3><span className="count">{visible.length}</span></div>
          <div className="report-tabs sub-status-tabs">{statusTabs.map(t => <button key={t} className={statusFilter===t?'active':''} onClick={()=>setStatusFilter(t)}>{t}</button>)}</div>
          <div className="card-list">
            {visible.map(s => {
              const tint = colorFor(s.name)
              return <Link className="subscription-card" to={`/subscriptions/${s.id}`} key={s.id}>
                <div className="service-icon" style={{ background: tint.bg, color: tint.fg }}><CreditCard size={19}/></div>
                <div className="row-main"><strong>{s.name}</strong><span>{s.provider || 'No provider'} · {s.subscription_members?.length || 0} members</span></div>
                <div className="row-end"><strong>{money(s.price)}</strong><span className={`dot ${s.status === 'ACTIVE' ? 'green' : ''}`}>{s.status}</span></div>
                <ChevronRight size={18}/>
              </Link>
            })}
            {!visible.length && <div className="empty">{statusFilter === 'Active' ? 'No active subscriptions.' : 'Nothing here.'}</div>}
          </div>
        </section>
      </div>
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard, Layers, Plus, Users, Wallet, XCircle } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import { SkeletonList } from '../components/ui/Skeleton'
import { createSubscription, listSubscriptions } from '../services/subscriptions'
import { useToast } from '../context/ToastContext'
import { money } from '../utils/currency'
import { colorFor } from '../utils/color'

const blank = { name: '', provider: '', price: '', billing_day: 1, billing_frequency: 'MONTHLY', status: 'ACTIVE', notes: '' }
const statusTabs = ['Active', 'Cancelled', 'All']

export default function Subscriptions() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Active')

  async function load() { setLoading(true); setItems(await listSubscriptions()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault(); setBusy(true)
    try {
      await createSubscription({ ...form, price: Number(form.price), billing_day: Number(form.billing_day) })
      setForm(blank); await load()
      toast.success(`${form.name} added`)
    } catch (e) {
      toast.error(e.message)
    }
    setBusy(false)
  }

  const visible = items.filter(s => statusFilter === 'All' ? true : s.status === statusFilter.toUpperCase())

  const stats = useMemo(() => {
    const active = items.filter(s => s.status === 'ACTIVE')
    const cancelled = items.filter(s => s.status === 'CANCELLED')
    const billed = active.reduce((a, s) => a + Number(s.price || 0), 0)
    const allocated = active.reduce((a, s) => a + (s.subscription_members || []).reduce((x, m) => x + Number(m.monthly_amount || 0), 0), 0)
    return { activeCount: active.length, cancelledCount: cancelled.length, billed, allocated }
  }, [items])

  return (
    <>
      <div className="page-heading-row"><div><h2>Subscriptions</h2><p>Track provider bills and the member amounts you collect.</p></div></div>

      <div className="stats-grid">
        <StatCard label="Active services" value={String(stats.activeCount)} icon={Layers} />
        <StatCard label="Monthly billed" value={money(stats.billed)} icon={Wallet} tone="success" />
        <StatCard label="Allocated to friends" value={money(stats.allocated)} icon={Users} tone="warning" />
        <StatCard label="Cancelled" value={String(stats.cancelledCount)} icon={XCircle} tone="danger" />
      </div>

      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><div><h3><CreditCard size={17}/> Add subscription</h3><p>Register a new shared service.</p></div></div>
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
          {loading ? <SkeletonList rows={3} withAvatar={false} /> : (
            <div className="card-list">
              {visible.map(s => {
                const tint = colorFor(s.name)
                const memberCount = s.subscription_members?.length || 0
                return <Link className="subscription-card" to={`/subscriptions/${s.id}`} key={s.id}>
                  <div className="service-icon" style={{ background: tint.bg, color: tint.fg }}><CreditCard size={19}/></div>
                  <div className="row-main"><strong>{s.name}</strong><span>{s.provider || 'No provider'} · {memberCount} member{memberCount === 1 ? '' : 's'}</span></div>
                  <div className="row-end"><strong>{money(s.price)}</strong><span className={`status ${s.status === 'ACTIVE' ? 'status-paid' : 'status-waived'}`}>{s.status}</span></div>
                  <ChevronRight size={18}/>
                </Link>
              })}
              {!visible.length && <div className="empty">{statusFilter === 'Active' ? 'No active subscriptions.' : 'Nothing here.'}</div>}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

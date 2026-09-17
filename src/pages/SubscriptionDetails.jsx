import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CalendarPlus, Check, Pencil, Save, Scale, Trash2, UserPlus, Users, Wallet } from 'lucide-react'
import { getSubscription, listMembers, removeSubscriptionMember, saveSubscriptionMember, updateSubscription } from '../services/subscriptions'
import { generateBillingPeriod } from '../services/billing'
import { SkeletonList } from '../components/ui/Skeleton'
import StatCard from '../components/ui/StatCard'
import { useToast } from '../context/ToastContext'
import { money } from '../utils/currency'
import { formatDate, monthInputValue, todayIso } from '../utils/dates'
import { colorFor } from '../utils/color'

export default function SubscriptionDetails() {
  const { id } = useParams()
  const toast = useToast()
  const [subscription, setSubscription] = useState(null)
  const [members, setMembers] = useState([])
  const [memberId, setMemberId] = useState('')
  const [amount, setAmount] = useState('')
  const [joinDate, setJoinDate] = useState(todayIso())
  const [period, setPeriod] = useState(monthInputValue())
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('ok')

  const [subForm, setSubForm] = useState(null)
  const [subBusy, setSubBusy] = useState(false)
  const [subMessage, setSubMessage] = useState('')

  async function load() {
    const [s, m] = await Promise.all([getSubscription(id), listMembers()])
    setSubscription(s); setMembers(m)
  }
  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!subscription) return
    setSubForm({
      name: subscription.name,
      provider: subscription.provider || '',
      price: subscription.price,
      billing_day: subscription.billing_day,
      billing_frequency: subscription.billing_frequency,
      status: subscription.status,
      notes: subscription.notes || '',
    })
  }, [subscription])

  const charges = useMemo(() => (subscription?.subscription_members || []).reduce((a, x) => a + Number(x.monthly_amount || 0), 0), [subscription])

  async function addMember(e) {
    e.preventDefault()
    try {
      await saveSubscriptionMember({ subscription_id: id, member_id: memberId, monthly_amount: Number(amount), joined_date: joinDate, notes: '' })
      setMemberId(''); setAmount(''); setJoinDate(todayIso()); await load()
      toast.success('Friend added to subscription')
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function remove(id2) {
    try {
      await removeSubscriptionMember(id2); await load()
      toast.success('Friend removed from subscription')
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function generate() {
    setMessage('')
    try {
      const result = await generateBillingPeriod(id, `${period}-01`)
      const created = result?.created_count ?? 0
      if (created > 0) {
        setMessageType('ok')
        setMessage(`Billing period generated. ${created} payment record(s) created.`)
      } else {
        setMessageType('warn')
        setMessage("Billing period generated, but no payment records were created. This means no friend's Joined date (in Members & pricing, or the Friends tab) is on or before this month — or payments for this period already exist.")
      }
    } catch (e) { setMessageType('warn'); setMessage(e.message) }
  }

  async function saveSub(e) {
    e.preventDefault()
    setSubBusy(true); setSubMessage('')
    try {
      await updateSubscription(id, {
        ...subForm,
        price: Number(subForm.price),
        billing_day: Number(subForm.billing_day),
      })
      setSubMessage('Subscription updated.')
      await load()
    } catch (e) { setSubMessage(e.message) }
    setSubBusy(false)
  }

  if (!subscription || !subForm) return (
    <>
      <Link to="/subscriptions" className="back-link"><ArrowLeft size={16}/> Back to subscriptions</Link>
      <section className="panel"><SkeletonList rows={4} withAvatar={false} /></section>
    </>
  )

  return (
    <>
      <Link to="/subscriptions" className="back-link"><ArrowLeft size={16}/> Back to subscriptions</Link>
      <div className="page-heading-row">
        <div><h2>{subscription.name}</h2><p>{subscription.provider || 'No provider'} · Billing day {subscription.billing_day}</p></div>
        <span className={`status ${subscription.status === 'ACTIVE' ? 'status-paid' : 'status-pending'}`}>{subscription.status}</span>
      </div>

      <div className="stats-grid three">
        <StatCard label="Provider bill" value={money(subscription.price)} icon={Wallet} />
        <StatCard label="Member charges" value={money(charges)} icon={Users} tone="success" />
        <StatCard label="Difference" value={money(charges - Number(subscription.price))} icon={Scale} tone={Math.abs(Number(subscription.price) - charges) > 0.005 ? 'warning' : 'default'} />
      </div>

      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><div><h3><Pencil size={15}/> Edit subscription</h3><p>Update the details below and save.</p></div></div>
          <form className="form-stack" onSubmit={saveSub}>
            <div className="form-grid">
              <label>Name<input value={subForm.name} onChange={e=>setSubForm({...subForm,name:e.target.value})} required/></label>
              <label>Provider<input value={subForm.provider} onChange={e=>setSubForm({...subForm,provider:e.target.value})}/></label>
            </div>
            <div className="form-grid">
              <label>Bill price (MYR)<input type="number" step="0.01" min="0" value={subForm.price} onChange={e=>setSubForm({...subForm,price:e.target.value})} required/></label>
              <label>Billing day<input type="number" min="1" max="31" value={subForm.billing_day} onChange={e=>setSubForm({...subForm,billing_day:e.target.value})}/></label>
            </div>
            <div className="form-grid">
              <label>Billing frequency<select value={subForm.billing_frequency} onChange={e=>setSubForm({...subForm,billing_frequency:e.target.value})}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label>
              <label>Status<select value={subForm.status} onChange={e=>setSubForm({...subForm,status:e.target.value})}><option value="ACTIVE">Active</option><option value="CANCELLED">Cancelled</option></select></label>
            </div>
            <label>Notes<textarea value={subForm.notes} onChange={e=>setSubForm({...subForm,notes:e.target.value})} placeholder="Optional"/></label>
            <button className="btn primary" disabled={subBusy}><Save size={16}/>Save changes</button>
            {subMessage && <div className="alert"><Check size={16}/>{subMessage}</div>}
          </form>
        </section>

        <section className="panel">
          <div className="panel-header"><div><h3><CalendarPlus size={15}/> Generate billing period</h3><p>Creates payment snapshots using the members' current amounts.</p></div></div>
          <div className="form-stack">
            <label>Billing month<input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
            <button className="btn primary" onClick={generate} disabled={subscription.status !== 'ACTIVE'}><CalendarPlus size={16}/>Generate payments</button>
            {subscription.status !== 'ACTIVE' && <div className="alert error"><AlertTriangle size={16}/>This subscription is cancelled — reactivate it above to generate new billing periods. Existing payment history below is unaffected.</div>}
            {message && <div className={`alert ${messageType === 'warn' ? 'error' : ''}`}>{messageType === 'warn' ? <AlertTriangle size={16}/> : <Check size={16}/>}{message}</div>}
          </div>
          <div className="callout">
            <strong>Historical amounts are protected.</strong>
            <span>Changing a member's amount later will not modify payment records that have already been generated.</span>
            <strong>Only members who had already joined get billed.</strong>
            <span>A friend is only included in a billing period if their Joined date is on or before that month (and, if they left, before their Left date).</span>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header"><div><h3><Users size={15}/> Members &amp; pricing</h3><p>Amounts are individually configurable.</p></div></div>
        <div className="payment-list">
          {subscription.subscription_members?.map(sm => {
            const tint = colorFor(sm.member?.nickname)
            return <div className="payment-row" key={sm.id}>
              <div className="avatar soft" style={{ background: tint.bg, color: tint.fg }}>{sm.member?.nickname?.slice(0,1).toUpperCase()}</div>
              <div className="row-main"><strong>{sm.member?.nickname}</strong><span>Joined {formatDate(sm.joined_date)}</span></div>
              <div className="row-end"><strong>{money(sm.monthly_amount)}</strong><button className="icon-btn danger-icon" onClick={()=>remove(sm.id)}><Trash2 size={15}/></button></div>
            </div>
          })}
          {!subscription.subscription_members?.length && <div className="empty">No members added.</div>}
        </div>
        <form className="inline-form" onSubmit={addMember}>
          <select value={memberId} onChange={e=>setMemberId(e.target.value)} required><option value="">Select friend</option>{members.filter(m=>!subscription.subscription_members?.some(x=>x.member_id===m.id)).map(m=><option key={m.id} value={m.id}>{m.nickname}</option>)}</select>
          <input type="date" value={joinDate} onChange={e=>setJoinDate(e.target.value)} required title="Joined date"/>
          <input type="number" step="0.01" min="0" placeholder="MYR amount" value={amount} onChange={e=>setAmount(e.target.value)} required/>
          <button className="btn primary"><UserPlus size={16}/>Add</button>
        </form>
      </section>
    </>
  )
}

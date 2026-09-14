import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, Check, Trash2, UserPlus } from 'lucide-react'
import { getSubscription, listMembers, removeSubscriptionMember, saveSubscriptionMember, updateSubscription } from '../services/subscriptions'
import { generateBillingPeriod } from '../services/billing'
import { money } from '../utils/currency'
import { monthInputValue } from '../utils/dates'

export default function SubscriptionDetails() {
  const { id } = useParams()
  const [subscription, setSubscription] = useState(null)
  const [members, setMembers] = useState([])
  const [memberId, setMemberId] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState(monthInputValue())
  const [message, setMessage] = useState('')

  async function load() {
    const [s, m] = await Promise.all([getSubscription(id), listMembers()])
    setSubscription(s); setMembers(m)
  }
  useEffect(() => { load() }, [id])

  const charges = useMemo(() => (subscription?.subscription_members || []).reduce((a, x) => a + Number(x.monthly_amount || 0), 0), [subscription])

  async function addMember(e) {
    e.preventDefault()
    await saveSubscriptionMember({ subscription_id: id, member_id: memberId, monthly_amount: Number(amount), joined_date: `${period}-01`, notes: '' })
    setMemberId(''); setAmount(''); await load()
  }

  async function remove(id2) { await removeSubscriptionMember(id2); await load() }

  async function generate() {
    setMessage('')
    try {
      const result = await generateBillingPeriod(id, `${period}-01`)
      setMessage(`Billing period generated. ${result?.created_count ?? 'Payment'} record(s) created.`)
    } catch (e) { setMessage(e.message) }
  }

  if (!subscription) return <div className="empty">Loading…</div>

  return (
    <>
      <Link to="/subscriptions" className="back-link"><ArrowLeft size={16}/> Back to subscriptions</Link>
      <div className="page-heading-row">
        <div><h2>{subscription.name}</h2><p>{subscription.provider || 'No provider'} · Billing day {subscription.billing_day}</p></div>
        <span className={`status ${subscription.status === 'ACTIVE' ? 'status-paid' : 'status-pending'}`}>{subscription.status}</span>
      </div>

      <div className="stats-grid three">
        <div className="mini-card"><span>Provider bill</span><strong>{money(subscription.price)}</strong></div>
        <div className="mini-card"><span>Member charges</span><strong>{money(charges)}</strong></div>
        <div className={`mini-card ${Math.abs(Number(subscription.price) - charges) > 0.005 ? 'warning-card' : ''}`}><span>Difference</span><strong>{money(charges - Number(subscription.price))}</strong></div>
      </div>

      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><div><h3>Members & pricing</h3><p>Amounts are individually configurable.</p></div></div>
          <div className="payment-list">
            {subscription.subscription_members?.map(sm => <div className="payment-row" key={sm.id}>
              <div className="avatar soft">{sm.member?.nickname?.slice(0,1).toUpperCase()}</div>
              <div className="row-main"><strong>{sm.member?.nickname}</strong><span>Joined {sm.joined_date || '—'}</span></div>
              <div className="row-end"><strong>{money(sm.monthly_amount)}</strong><button className="icon-btn danger-icon" onClick={()=>remove(sm.id)}><Trash2 size={15}/></button></div>
            </div>)}
            {!subscription.subscription_members?.length && <div className="empty">No members added.</div>}
          </div>
          <form className="inline-form" onSubmit={addMember}>
            <select value={memberId} onChange={e=>setMemberId(e.target.value)} required><option value="">Select friend</option>{members.filter(m=>!subscription.subscription_members?.some(x=>x.member_id===m.id)).map(m=><option key={m.id} value={m.id}>{m.nickname}</option>)}</select>
            <input type="number" step="0.01" min="0" placeholder="MYR amount" value={amount} onChange={e=>setAmount(e.target.value)} required/>
            <button className="btn primary"><UserPlus size={16}/>Add</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header"><div><h3>Generate billing period</h3><p>Creates payment snapshots using the members' current amounts.</p></div></div>
          <div className="form-stack">
            <label>Billing month<input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
            <button className="btn primary" onClick={generate}><CalendarPlus size={16}/>Generate payments</button>
            {message && <div className="alert"><Check size={16}/>{message}</div>}
          </div>
          <div className="callout"><strong>Historical amounts are protected.</strong><span>Changing a member's amount later will not modify payment records that have already been generated.</span></div>
        </section>
      </div>
    </>
  )
}

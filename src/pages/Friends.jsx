import { useEffect, useState } from 'react'
import { CalendarPlus, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import {
  createMember,
  listMembersWithSubscriptions,
  listSubscriptions,
  removeSubscriptionMember,
  saveSubscriptionMember,
  updateMember,
} from '../services/subscriptions'
import { formatDate } from '../utils/dates'
import { colorFor } from '../utils/color'
import { SkeletonList } from '../components/ui/Skeleton'

const blank = { nickname: '', notes: '' }
const blankJoin = { subscriptionId: '', joinedDate: '', amount: '' }

export default function Friends() {
  const [members, setMembers] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  const [joinForms, setJoinForms] = useState({}) // memberId -> { subscriptionId, joinedDate, amount }
  const [editingJoin, setEditingJoin] = useState(null) // subscription_members.id
  const [joinEditForm, setJoinEditForm] = useState({ joinedDate: '', amount: '' })

  async function load() {
    setLoading(true)
    const [m, s] = await Promise.all([listMembersWithSubscriptions(), listSubscriptions()])
    setMembers(m); setSubscriptions(s)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    if (editing) await updateMember(editing, form)
    else await createMember(form)
    setForm(blank); setEditing(null); await load(); setBusy(false)
  }

  function edit(m) { setEditing(m.id); setForm({ nickname: m.nickname, notes: m.notes || '' }) }

  function joinFormFor(memberId) { return joinForms[memberId] || blankJoin }
  function setJoinForm(memberId, patch) {
    setJoinForms(f => ({ ...f, [memberId]: { ...joinFormFor(memberId), ...patch } }))
  }

  async function addJoin(memberId, e) {
    e.preventDefault()
    const jf = joinFormFor(memberId)
    if (!jf.subscriptionId || !jf.joinedDate || jf.amount === '') return
    await saveSubscriptionMember({
      subscription_id: jf.subscriptionId,
      member_id: memberId,
      joined_date: jf.joinedDate,
      monthly_amount: Number(jf.amount),
    })
    setJoinForms(f => ({ ...f, [memberId]: blankJoin }))
    await load()
  }

  function startEditJoin(sm) {
    setEditingJoin(sm.id)
    setJoinEditForm({ joinedDate: sm.joined_date || '', amount: sm.monthly_amount })
  }

  async function saveJoinEdit(sm, e) {
    e.preventDefault()
    await saveSubscriptionMember({
      subscription_id: sm.subscription_id,
      member_id: sm.member_id,
      joined_date: joinEditForm.joinedDate,
      monthly_amount: Number(joinEditForm.amount),
    })
    setEditingJoin(null); await load()
  }

  async function removeJoin(id) { await removeSubscriptionMember(id); await load() }

  return (
    <>
      <div className="page-heading-row"><div><h2>Friends</h2><p>Manage the people who participate in your subscriptions.</p></div></div>
      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><h3>{editing ? 'Edit friend' : 'Add friend'}</h3></div>
          <form className="form-stack" onSubmit={save}>
            <label>Nickname<input value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} placeholder="e.g. Ali" required /></label>
            <label>Notes<textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional notes" /></label>
            <div className="button-row">
              <button className="btn primary" disabled={busy}><Plus size={16}/>{editing ? 'Save changes' : 'Add friend'}</button>
              {editing && <button type="button" className="btn ghost" onClick={() => {setEditing(null);setForm(blank)}}>Cancel</button>}
            </div>
          </form>
        </section>
        <section className="panel">
          <div className="panel-header"><h3>Friend list</h3><span className="count">{members.length}</span></div>
          {loading ? <SkeletonList rows={3} /> : <div className="payment-list">
            {members.map(m => {
              const tint = colorFor(m.nickname)
              return (
              <div className="member-card" key={m.id}>
                <div className="payment-row no-border">
                  <div className="avatar soft" style={{ background: tint.bg, color: tint.fg }}><UserRound size={17}/></div>
                  <div className="row-main"><strong>{m.nickname}</strong><span>Joined app {formatDate(m.created_at)}</span></div>
                  <button className="icon-btn" onClick={() => edit(m)}><Pencil size={16}/></button>
                </div>

                <div className="member-subs">
                  {(m.subscription_members || []).map(sm => (
                    editingJoin === sm.id ? (
                      <form key={sm.id} className="sub-row edit-row" onSubmit={e => saveJoinEdit(sm, e)}>
                        <span className="sub-name">{sm.subscription?.name || 'Unknown subscription'}</span>
                        <input type="date" value={joinEditForm.joinedDate} onChange={e => setJoinEditForm({...joinEditForm, joinedDate: e.target.value})} required />
                        <input type="number" step="0.01" min="0" value={joinEditForm.amount} onChange={e => setJoinEditForm({...joinEditForm, amount: e.target.value})} required />
                        <div className="action-row">
                          <button className="btn small primary">Save</button>
                          <button type="button" className="btn small ghost" onClick={() => setEditingJoin(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="sub-row" key={sm.id}>
                        <span className="sub-name">{sm.subscription?.name || 'Unknown subscription'}</span>
                        <span className="sub-meta">Joined {formatDate(sm.joined_date)}{sm.left_date ? ` · Left ${formatDate(sm.left_date)}` : ''}</span>
                        <span className="sub-meta">RM {Number(sm.monthly_amount).toFixed(2)}/mo</span>
                        <div className="action-row">
                          <button className="icon-btn" onClick={() => startEditJoin(sm)}><Pencil size={14}/></button>
                          <button className="icon-btn danger-icon" onClick={() => removeJoin(sm.id)}><Trash2 size={14}/></button>
                        </div>
                      </div>
                    )
                  ))}
                  {!(m.subscription_members || []).length && <div className="sub-row empty-sub">Not part of any subscription yet.</div>}

                  <form className="sub-add-form" onSubmit={e => addJoin(m.id, e)}>
                    <select value={joinFormFor(m.id).subscriptionId} onChange={e => setJoinForm(m.id, {subscriptionId: e.target.value})} required>
                      <option value="">Select subscription</option>
                      {subscriptions
                        .filter(s => !(m.subscription_members || []).some(x => x.subscription_id === s.id))
                        .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input type="date" value={joinFormFor(m.id).joinedDate} onChange={e => setJoinForm(m.id, {joinedDate: e.target.value})} required />
                    <input type="number" step="0.01" min="0" placeholder="MYR amount" value={joinFormFor(m.id).amount} onChange={e => setJoinForm(m.id, {amount: e.target.value})} required />
                    <button className="btn small primary"><CalendarPlus size={14}/>Add</button>
                  </form>
                </div>
              </div>
              )
            })}
            {!members.length && <div className="empty">No friends yet.</div>}
          </div>}
        </section>
      </div>
    </>
  )
}

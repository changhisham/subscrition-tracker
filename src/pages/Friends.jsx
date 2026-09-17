import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, CreditCard, Pencil, Plus, Trash2, UserRound, Users, Wallet } from 'lucide-react'
import {
  createMember,
  deleteMember,
  listMembersWithSubscriptions,
  listSubscriptions,
  removeSubscriptionMember,
  saveSubscriptionMember,
  updateMember,
} from '../services/subscriptions'
import { useToast } from '../context/ToastContext'
import { formatDate } from '../utils/dates'
import { money } from '../utils/currency'
import { colorFor } from '../utils/color'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import { SkeletonList } from '../components/ui/Skeleton'

const blank = { nickname: '', notes: '' }
const blankJoin = { subscriptionId: '', joinedDate: '', amount: '' }

export default function Friends() {
  const toast = useToast()
  const [members, setMembers] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [editingId, setEditingId] = useState(null) // null closed, 'new', or a member id
  const [form, setForm] = useState(blank)

  const [joinForm, setJoinForm] = useState(blankJoin)
  const [editingJoin, setEditingJoin] = useState(null)
  const [joinEditForm, setJoinEditForm] = useState({ joinedDate: '', amount: '' })

  async function load() {
    setLoading(true)
    const [m, s] = await Promise.all([listMembersWithSubscriptions(), listSubscriptions()])
    setMembers(m); setSubscriptions(s)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const activeMember = editingId && editingId !== 'new' ? members.find(m => m.id === editingId) : null

  function openAdd() { setForm(blank); setConfirmDelete(false); setEditingId('new') }
  function openEdit(m) { setForm({ nickname: m.nickname, notes: m.notes || '' }); setJoinForm(blankJoin); setEditingJoin(null); setConfirmDelete(false); setEditingId(m.id) }
  function closeModal() { setEditingId(null) }

  async function saveMember(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (editingId === 'new') {
        await createMember(form)
        await load()
        toast.success(`${form.nickname} added`)
        closeModal()
      } else {
        await updateMember(editingId, form)
        await load()
        toast.success('Friend updated')
      }
    } catch (e) {
      toast.error(e.message)
    }
    setBusy(false)
  }

  async function deleteFriend() {
    if (!activeMember) return
    setDeleting(true)
    try {
      await deleteMember(activeMember.id)
      await load()
      toast.success(`${activeMember.nickname} deleted`)
      closeModal()
    } catch (e) {
      toast.error(e.code === '23503' || /foreign key/i.test(e.message)
        ? `Can't delete ${activeMember.nickname} — remove their subscriptions first.`
        : e.message)
    }
    setDeleting(false); setConfirmDelete(false)
  }

  async function addJoin(e) {
    e.preventDefault()
    if (!activeMember || !joinForm.subscriptionId || !joinForm.joinedDate || joinForm.amount === '') return
    try {
      await saveSubscriptionMember({
        subscription_id: joinForm.subscriptionId,
        member_id: activeMember.id,
        joined_date: joinForm.joinedDate,
        monthly_amount: Number(joinForm.amount),
      })
      setJoinForm(blankJoin)
      await load()
      toast.success('Subscription added')
    } catch (e) {
      toast.error(e.message)
    }
  }

  function startEditJoin(sm) {
    setEditingJoin(sm.id)
    setJoinEditForm({ joinedDate: sm.joined_date || '', amount: sm.monthly_amount })
  }

  async function saveJoinEdit(sm, e) {
    e.preventDefault()
    try {
      await saveSubscriptionMember({
        subscription_id: sm.subscription_id,
        member_id: sm.member_id,
        joined_date: joinEditForm.joinedDate,
        monthly_amount: Number(joinEditForm.amount),
      })
      setEditingJoin(null); await load()
      toast.success('Subscription updated')
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function removeJoin(id) {
    try {
      await removeSubscriptionMember(id); await load()
      toast.success('Removed from subscription')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const stats = useMemo(() => {
    const activeJoins = members.flatMap(m => (m.subscription_members || []).filter(sm => !sm.left_date))
    const committed = activeJoins.reduce((a, sm) => a + Number(sm.monthly_amount || 0), 0)
    return { total: members.length, activeJoins: activeJoins.length, committed }
  }, [members])

  return (
    <>
      <div className="page-heading-row">
        <div><h2>Friends</h2><p>Manage the people who participate in your subscriptions.</p></div>
        <button className="btn primary" onClick={openAdd}><Plus size={16}/>Add friend</button>
      </div>

      <div className="stats-grid three">
        <StatCard label="Friends" value={String(stats.total)} icon={Users} />
        <StatCard label="Active memberships" value={String(stats.activeJoins)} icon={CreditCard} tone="warning" />
        <StatCard label="Monthly committed" value={money(stats.committed)} icon={Wallet} tone="success" />
      </div>

      <section className="panel">
        <div className="panel-header"><h3>Friend list</h3><span className="count">{members.length}</span></div>
        {loading ? <SkeletonList rows={4} /> : (
          <div className="payment-list">
            {members.map(m => {
              const tint = colorFor(m.nickname)
              const activeSubs = (m.subscription_members || []).filter(sm => !sm.left_date)
              const memberTotal = activeSubs.reduce((a, sm) => a + Number(sm.monthly_amount || 0), 0)
              return (
                <div className="payment-row" key={m.id}>
                  <div className="avatar soft" style={{ background: tint.bg, color: tint.fg }}><UserRound size={17}/></div>
                  <div className="row-main">
                    <strong>{m.nickname}</strong>
                    <div className="chip-row">
                      {activeSubs.length
                        ? activeSubs.map(sm => <span className="chip" key={sm.id}>{sm.subscription?.name || 'Unknown'}</span>)
                        : <span className="chip chip-muted">No subscriptions</span>}
                    </div>
                  </div>
                  <div className="row-end"><strong>{money(memberTotal)}</strong><span className="muted">per month</span></div>
                  <button className="icon-btn" onClick={() => openEdit(m)}><Pencil size={16}/></button>
                </div>
              )
            })}
            {!members.length && <div className="empty">No friends yet.</div>}
          </div>
        )}
      </section>

      {editingId && (
        <Modal
          title={editingId === 'new' ? 'Add friend' : activeMember?.nickname || 'Edit friend'}
          subtitle={editingId === 'new' ? 'Create a new friend to add to subscriptions.' : 'Update details and manage subscriptions.'}
          onClose={closeModal}
        >
          <form className="form-stack" onSubmit={saveMember}>
            <label>Nickname<input value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} placeholder="e.g. Ali" required /></label>
            <label>Notes<textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional notes" /></label>
            <button className="btn primary" disabled={busy}><Plus size={16}/>{editingId === 'new' ? 'Add friend' : 'Save changes'}</button>
          </form>

          {activeMember && (
            <div className="modal-section">
              <h4>Subscriptions</h4>
              <div className="sub-list">
                {(activeMember.subscription_members || []).map(sm => (
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
                {!(activeMember.subscription_members || []).length && <div className="sub-row empty-sub">Not part of any subscription yet.</div>}

                <form className="sub-add-form" onSubmit={addJoin}>
                  <select value={joinForm.subscriptionId} onChange={e => setJoinForm({...joinForm, subscriptionId: e.target.value})} required>
                    <option value="">Select subscription</option>
                    {subscriptions
                      .filter(s => !(activeMember.subscription_members || []).some(x => x.subscription_id === s.id))
                      .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input type="date" value={joinForm.joinedDate} onChange={e => setJoinForm({...joinForm, joinedDate: e.target.value})} required />
                  <input type="number" step="0.01" min="0" placeholder="MYR amount" value={joinForm.amount} onChange={e => setJoinForm({...joinForm, amount: e.target.value})} required />
                  <button className="btn small primary"><CalendarPlus size={14}/>Add</button>
                </form>
              </div>
            </div>
          )}

          {activeMember && (
            <div className="modal-section">
              {confirmDelete ? (
                <div className="confirm-bar">
                  <AlertTriangle size={15}/>
                  <span>Delete {activeMember.nickname}? This can't be undone.</span>
                  <div className="action-row">
                    <button className="btn small danger-btn" disabled={deleting} onClick={deleteFriend}>Confirm delete</button>
                    <button className="btn small ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn small ghost danger-icon" onClick={() => setConfirmDelete(true)}><Trash2 size={14}/>Delete friend</button>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, AlertTriangle, Bell, CalendarPlus, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CreditCard, Download, MoreHorizontal, Pencil, Plus, Scale, Search, Sparkles, Trash2, Users, Wallet, X,
} from 'lucide-react'
import {
  createMember,
  deleteMember,
  listMembersWithSubscriptions,
  listSubscriptions,
  removeSubscriptionMember,
  saveSubscriptionMember,
  updateMember,
} from '../services/subscriptions'
import { listPayments } from '../services/payments'
import { exportCsv } from '../services/reports'
import { useToast } from '../context/ToastContext'
import { formatDate, formatRelative, todayIso } from '../utils/dates'
import { money } from '../utils/currency'
import { colorFor } from '../utils/color'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import ServiceIcon from '../components/ui/ServiceIcon'
import { SkeletonList } from '../components/ui/Skeleton'

const blank = { nickname: '', notes: '' }
const blankJoin = { subscriptionId: '', joinedDate: '', amount: '' }
const tabKeys = ['All', 'Active', 'Owing', 'Settled']
const PAGE_SIZE = 8

export default function Friends() {
  const toast = useToast()
  const [members, setMembers] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [editingId, setEditingId] = useState(null) // null closed, 'new', or a member id
  const [form, setForm] = useState(blank)

  const [joinForm, setJoinForm] = useState(blankJoin)
  const [editingJoin, setEditingJoin] = useState(null)
  const [joinEditForm, setJoinEditForm] = useState({ joinedDate: '', amount: '' })

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(1)

  async function load() {
    setLoading(true)
    const [m, s, p] = await Promise.all([listMembersWithSubscriptions(), listSubscriptions(), listPayments({})])
    setMembers(m); setSubscriptions(s); setPayments(p)
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

  const rows = useMemo(() => {
    const balMap = new Map()
    payments.forEach(p => {
      const key = p.member_id
      if (!balMap.has(key)) balMap.set(key, { due: 0, paid: 0, outstanding: 0, overdueCount: 0 })
      const e = balMap.get(key)
      const due = Number(p.amount_due || 0)
      const paid = Number(p.amount_paid || 0)
      e.due += due; e.paid += paid
      if (!['PAID', 'WAIVED'].includes(p.status)) e.outstanding += Math.max(0, due - paid)
      if (p.status === 'OVERDUE') e.overdueCount += 1
    })
    return members.map(m => {
      const activeSubs = (m.subscription_members || []).filter(sm => !sm.left_date)
      const committed = activeSubs.reduce((a, sm) => a + Number(sm.monthly_amount || 0), 0)
      const bal = balMap.get(m.id) || { due: 0, paid: 0, outstanding: 0, overdueCount: 0 }
      const moneyStatus = bal.outstanding <= 0 ? 'Settled' : bal.paid > 0 ? 'Partial' : 'Owing'
      return { member: m, activeSubs, committed, ...bal, isActive: activeSubs.length > 0, moneyStatus }
    })
  }, [members, payments])

  const totals = useMemo(() => {
    const activeFriends = rows.filter(r => r.isActive).length
    const activeMemberships = rows.reduce((a, r) => a + r.activeSubs.length, 0)
    const subsInUse = new Set(rows.flatMap(r => r.activeSubs.map(sm => sm.subscription_id))).size
    const committed = rows.reduce((a, r) => a + r.committed, 0)
    const outstanding = rows.reduce((a, r) => a + r.outstanding, 0)
    const owingCount = rows.filter(r => r.outstanding > 0).length
    const settledCount = rows.filter(r => r.outstanding <= 0).length
    return { total: rows.length, activeFriends, activeMemberships, subsInUse, committed, outstanding, owingCount, settledCount }
  }, [rows])

  const tabCounts = { All: totals.total, Active: totals.activeFriends, Owing: totals.owingCount, Settled: totals.settledCount }

  const visible = useMemo(() => {
    let list = rows
    if (filter === 'Active') list = list.filter(r => r.isActive)
    if (filter === 'Owing') list = list.filter(r => r.outstanding > 0)
    if (filter === 'Settled') list = list.filter(r => r.outstanding <= 0)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(r => (r.member.nickname || '').toLowerCase().includes(q))
    const sorted = [...list]
    if (sort === 'amount') sorted.sort((a, b) => b.outstanding - a.outstanding)
    else if (sort === 'overdue') sorted.sort((a, b) => b.overdueCount - a.overdueCount)
    else sorted.sort((a, b) => (a.member.nickname || '').localeCompare(b.member.nickname || ''))
    return sorted
  }, [rows, filter, search, sort])

  useEffect(() => { setPage(1) }, [filter, search, sort])
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activity = useMemo(() => {
    const paidEvents = payments.filter(p => ['PAID', 'WAIVED'].includes(p.status)).map(p => ({
      id: `${p.id}-paid`, date: p.updated_at, kind: p.status === 'WAIVED' ? 'waived' : 'paid',
      text: `${p.member?.nickname || 'Someone'} ${p.status === 'WAIVED' ? 'waived' : 'paid'} ${money(p.status === 'WAIVED' ? p.amount_due : p.amount_paid)}`,
      sub: `${p.subscription?.name || 'Unknown'} · ${formatRelative(p.updated_at)}`,
    }))
    const overdueEvents = payments.filter(p => p.status === 'OVERDUE').map(p => ({
      id: `${p.id}-overdue`, date: p.due_date, kind: 'overdue',
      text: `${p.member?.nickname || 'Someone'} became overdue`,
      sub: `${p.subscription?.name || 'Unknown'} · ${formatDate(p.due_date)}`,
    }))
    return [...paidEvents, ...overdueEvents].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6)
  }, [payments])

  function sendReminders() {
    toast.info("Bulk reminders aren't set up yet — use Remind on each friend's balance for now.")
  }

  function handleExport() {
    if (!rows.length) return
    exportCsv(rows.map(r => ({
      friend: r.member.nickname,
      subscriptions: r.activeSubs.length,
      monthly_commitment: r.committed,
      status: r.moneyStatus,
      outstanding: r.outstanding,
      overdue: r.overdueCount,
    })), `friends-${todayIso()}.csv`)
    toast.success('Friends list exported')
  }

  return (
    <>
      <div className="page-heading-row">
        <div className="heading-with-icon">
          <div className="page-icon-badge"><Users size={20} /></div>
          <div><h2>Friends</h2><p>Manage the people who participate in your subscriptions.</p></div>
        </div>
        <button className="btn primary" onClick={openAdd}><Plus size={16} />Add Friend</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Friends" value={String(totals.total)} icon={Users} hint={`${totals.activeFriends} active members`} />
        <StatCard label="Active memberships" value={String(totals.activeMemberships)} icon={CreditCard} tone="success" hint={`Across ${totals.subsInUse} subscription${totals.subsInUse === 1 ? '' : 's'}`} />
        <StatCard label="Monthly committed" value={money(totals.committed)} icon={Wallet} hint="Expected every month" />
        <StatCard label="Outstanding" value={money(totals.outstanding)} icon={AlertTriangle} tone={totals.outstanding > 0 ? 'danger' : 'success'} hint={`From ${totals.owingCount} friend${totals.owingCount === 1 ? '' : 's'}`} />
      </div>

      <div className="filter-row">
        <div className="search-row"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friends…" /></div>
        <div className="report-tabs" style={{ marginBottom: 0, border: 0 }}>
          {tabKeys.map(t => <button key={t} className={filter === t ? 'active' : ''} onClick={() => setFilter(t)}>{t} ({tabCounts[t]})</button>)}
        </div>
        <select className="select-input" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name">Sort: Name A-Z</option>
          <option value="amount">Sort: Amount owed</option>
          <option value="overdue">Sort: Most overdue</option>
        </select>
      </div>

      <div className="content-grid two friends-grid">
        <section className="panel">
          {loading ? <SkeletonList rows={4} /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Friend</th><th>Subscriptions</th><th>Monthly Commitment</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pageRows.map(r => {
                    const m = r.member
                    const tint = colorFor(m.nickname)
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="friend-cell">
                            <div className="avatar soft" style={{ background: tint.bg, color: tint.fg }}>{m.nickname.slice(0, 1).toUpperCase()}</div>
                            <div className="friend-cell-name">
                              <strong>{m.nickname}</strong>
                              <span className="joined">Joined {formatDate(m.created_at)}</span>
                              <span className={`status ${r.isActive ? 'status-paid' : 'status-waived'}`}>{r.isActive ? <Check size={10} /> : null} {r.isActive ? 'Active' : 'No subscriptions'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="sub-cell-list">
                            {r.activeSubs.length ? r.activeSubs.map(sm => (
                              <div className="sub-cell-item" key={sm.id}>
                                <ServiceIcon name={sm.subscription?.name} size={20} iconSize={11} />
                                {sm.subscription?.name || 'Unknown'}
                              </div>
                            )) : <span className="muted">None</span>}
                          </div>
                          {r.activeSubs.length > 0 && <div className="sub-cell-count">{r.activeSubs.length} subscription{r.activeSubs.length === 1 ? '' : 's'}</div>}
                        </td>
                        <td>
                          <div className="commitment-cell">
                            <strong>{money(r.committed)}</strong>
                            {r.activeSubs.length > 0 && <span>({r.activeSubs.map(sm => money(sm.monthly_amount)).join(' + ')})</span>}
                          </div>
                        </td>
                        <td>
                          <div className="status-cell">
                            <span className={`status ${r.moneyStatus === 'Settled' ? 'status-paid' : r.moneyStatus === 'Partial' ? 'status-pending' : 'status-overdue'}`}>
                              {r.moneyStatus === 'Settled' ? 'Settled' : r.moneyStatus === 'Partial' ? 'Partially owing' : 'Owing'}
                            </span>
                            {r.outstanding > 0
                              ? <span className="amt owing">{money(r.outstanding)}</span>
                              : <span className="amt">All paid</span>}
                            {r.overdueCount > 0 && <span className="sub">{r.overdueCount} overdue</span>}
                          </div>
                        </td>
                        <td>
                          <div className="actions-cell">
                            <Link className="btn small ghost" to={`/balances/${m.id}`}>View details</Link>
                            <button className="icon-btn" onClick={() => openEdit(m)} aria-label="More actions"><MoreHorizontal size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!pageRows.length && <div className="empty">{rows.length ? 'No friends match this filter.' : 'No friends yet.'}</div>}
            </div>
          )}
          {!!visible.length && (
            <div className="pagination-row">
              <span>Showing {pageRows.length} of {visible.length} friend{visible.length === 1 ? '' : 's'}</span>
              <div className="pagination-controls">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
                <button className="page-num">{page}</button>
                <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </section>

        <div>
          <section className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-header"><h3>Friend Activity</h3><Link className="btn ghost small" to="/balances">View all</Link></div>
            <div className="activity-list">
              {activity.map(a => (
                <div className="activity-item" key={a.id}>
                  <div className={`activity-icon ${a.kind}`}>{a.kind === 'waived' ? <X size={14} /> : a.kind === 'overdue' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}</div>
                  <div className="activity-body">
                    <strong>{a.text}</strong>
                    <span className="sub">{a.sub}</span>
                  </div>
                </div>
              ))}
              {!activity.length && <div className="empty small">No activity yet.</div>}
            </div>
          </section>

          <section className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-header"><h3>Quick Actions</h3></div>
            <div style={{ padding: '4px 10px 10px' }}>
              <Link className="quick-action-row" to="/balances">
                <div className="quick-action-icon"><Scale size={16} /></div>
                <div className="quick-action-body"><strong>View all balances</strong><span>See who owes you</span></div>
                <ChevronRight size={16} className="quick-action-chev" />
              </Link>
              <button className="quick-action-row" onClick={sendReminders}>
                <div className="quick-action-icon"><Bell size={16} /></div>
                <div className="quick-action-body"><strong>Send reminders</strong><span>Notify friends for payment</span></div>
                <ChevronRight size={16} className="quick-action-chev" />
              </button>
              <button className="quick-action-row" onClick={handleExport}>
                <div className="quick-action-icon"><Download size={16} /></div>
                <div className="quick-action-body"><strong>Export friends list</strong><span>Download as CSV</span></div>
                <ChevronRight size={16} className="quick-action-chev" />
              </button>
            </div>
          </section>

          <div className="cta-card">
            <div className="cta-icon"><Sparkles size={17} /></div>
            <strong>Better together</strong>
            <p>Add friends, track subscriptions, and keep everyone on the same page.</p>
            <button className="btn" onClick={openAdd}><Plus size={15} />Add Friend</button>
          </div>
        </div>
      </div>

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
                      <ServiceIcon name={sm.subscription?.name} size={24} iconSize={13} />
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

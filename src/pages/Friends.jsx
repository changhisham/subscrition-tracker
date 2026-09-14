import { useEffect, useState } from 'react'
import { Pencil, Plus, UserRound } from 'lucide-react'
import { createMember, listMembers, updateMember } from '../services/subscriptions'
import { formatDate } from '../utils/dates'

const blank = { nickname: '', notes: '' }

export default function Friends() {
  const [members, setMembers] = useState([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() { setMembers(await listMembers()) }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    if (editing) await updateMember(editing, form)
    else await createMember(form)
    setForm(blank); setEditing(null); await load(); setBusy(false)
  }

  function edit(m) { setEditing(m.id); setForm({ nickname: m.nickname, notes: m.notes || '' }) }

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
          <div className="payment-list">
            {members.map(m => <div className="payment-row" key={m.id}>
              <div className="avatar soft"><UserRound size={17}/></div>
              <div className="row-main"><strong>{m.nickname}</strong><span>Joined {formatDate(m.created_at)}</span></div>
              <button className="icon-btn" onClick={() => edit(m)}><Pencil size={16}/></button>
            </div>)}
            {!members.length && <div className="empty">No friends yet.</div>}
          </div>
        </section>
      </div>
    </>
  )
}

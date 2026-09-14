import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { user, profile, reloadProfile } = useAuth()
  const [name, setName] = useState(profile?.display_name || '')
  const [message, setMessage] = useState('')

  async function save(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', user.id)
    setMessage(error ? error.message : 'Profile updated.')
    if (!error) reloadProfile()
  }

  return (
    <>
      <div className="page-heading-row"><div><h2>Settings</h2><p>Account and application information.</p></div></div>
      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><h3>Profile</h3></div>
          <form className="form-stack" onSubmit={save}>
            <label>Display name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>
            <label>Email<input value={user?.email || ''} disabled/></label>
            <label>Role<input value={profile?.role || ''} disabled/></label>
            <button className="btn primary">Save changes</button>
            {message && <div className="alert">{message}</div>}
          </form>
        </section>
        <section className="panel">
          <div className="panel-header"><h3>Application</h3></div>
          <div className="detail-list"><div><span>Currency</span><strong>MYR</strong></div><div><span>Authentication</span><strong>Supabase Auth</strong></div><div><span>Storage</span><strong>Supabase Storage</strong></div><div><span>Reminders</span><strong>Not enabled</strong></div></div>
        </section>
      </div>
    </>
  )
}

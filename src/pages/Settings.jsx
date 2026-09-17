import { useState } from 'react'
import { BadgeCheck, Bell, Coins, Database, Lock, Play, Tag } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { runAutoGenerateBillingPeriods } from '../services/billing'
import { APP_VERSION, APP_COPYRIGHT, APP_TRADEMARK } from '../version'

export default function Settings() {
  const { user, profile, reloadProfile } = useAuth()
  const [name, setName] = useState(profile?.display_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [message, setMessage] = useState('')
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoMessage, setAutoMessage] = useState('')

  async function save(e) {
    e.preventDefault()
    setMessage('')
    const cleanUsername = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setMessage('Username must be 3–24 characters: lowercase letters, numbers, and underscores only.')
      return
    }
    const { error } = await supabase.from('profiles').update({ display_name: name, username: cleanUsername }).eq('id', user.id)
    if (error) {
      setMessage(error.code === '23505' || /duplicate/i.test(error.message) ? 'That username is already taken.' : error.message)
    } else {
      setUsername(cleanUsername)
      setMessage('Profile updated.')
      reloadProfile()
    }
  }

  async function runNow() {
    setAutoBusy(true); setAutoMessage('')
    try {
      await runAutoGenerateBillingPeriods()
      setAutoMessage('Done — billing periods generated for every active monthly subscription this month (skips ones already generated).')
    } catch (e) { setAutoMessage(e.message) }
    setAutoBusy(false)
  }

  return (
    <>
      <div className="page-heading-row"><div><h2>Settings</h2><p>Account and application information.</p></div></div>
      <div className="content-grid two">
        <section className="panel">
          <div className="panel-header"><h3>Profile</h3></div>
          <div className="profile-summary">
            <div className="avatar lg">{(profile?.display_name || user?.email || 'A').slice(0, 1).toUpperCase()}</div>
            <div><strong>{profile?.display_name || 'Admin'}</strong><span>{user?.email}</span></div>
          </div>
          <form className="form-stack" onSubmit={save}>
            <label>Display name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>
            <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="yourname" autoCapitalize="none" autoCorrect="off"/></label>
            <label>Email<input value={user?.email || ''} disabled/></label>
            <label>Role<input value={profile?.role || ''} disabled/></label>
            <button className="btn primary">Save changes</button>
            {message && <div className="alert">{message}</div>}
          </form>
        </section>
        <section className="panel">
          <div className="panel-header"><h3>Application</h3></div>
          <div className="detail-list">
            <div><span><Coins size={14}/> Currency</span><strong>MYR</strong></div>
            <div><span><Lock size={14}/> Authentication</span><strong>Supabase Auth</strong></div>
            <div><span><Database size={14}/> Storage</span><strong>Supabase Storage</strong></div>
            <div><span><Bell size={14}/> Reminders</span><strong>Not enabled</strong></div>
            <div><span><BadgeCheck size={14}/> Version</span><strong>{APP_VERSION}</strong></div>
            <div><span><Tag size={14}/> Trademark</span><strong>{APP_TRADEMARK}</strong></div>
            <div><span><Tag size={14}/> Copyright</span><strong>{APP_COPYRIGHT}</strong></div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header"><div><h3>Billing automation</h3><p>A daily job auto-generates this month's billing period for every active monthly subscription. Yearly subscriptions still need manual generation from their Subscription Details page.</p></div></div>
        <div className="form-stack">
          <button className="btn primary" onClick={runNow} disabled={autoBusy}><Play size={16}/>Run now</button>
          {autoMessage && <div className="alert">{autoMessage}</div>}
        </div>
        <div className="callout">
          <strong>Runs automatically once a day.</strong>
          <span>If the daily schedule isn't active on your Supabase project (some plans don't enable the pg_cron extension), use "Run now" instead — it's safe to click any time, already-generated periods are skipped.</span>
        </div>
      </section>
    </>
  )
}

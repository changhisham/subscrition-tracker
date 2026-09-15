import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CreditCard, Lock, Mail } from 'lucide-react'
import { APP_VERSION, APP_COPYRIGHT } from '../version'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
    setBusy(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand"><div className="brand-mark large"><img src="/logo-mark.png" alt="SubTrack" /></div><div><strong>SubTrack</strong><span>Subscription Payment Tracker</span></div></div>
        <div className="login-copy"><h1>Welcome back</h1><p>Sign in to manage your shared subscriptions and payments.</p></div>
        <form onSubmit={submit} className="form-stack">
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></label>
          {error && <div className="alert error"><Lock size={16}/>{error}</div>}
          <button className="btn primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="login-note"><Mail size={15}/> Accounts are managed through Supabase Auth.</div>
      </div>
      <div className="login-footer">v{APP_VERSION} · {APP_COPYRIGHT}</div>
    </div>
  )
}

import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, CreditCard, Users, Scale, Receipt, BarChart3, Settings, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { APP_VERSION, APP_COPYRIGHT } from '../../version'

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/balances', label: 'Balances', icon: Scale },
  { to: '/payments', label: 'Payments', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const current = items.find(item => item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to))?.label || 'Dashboard'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><img src="/logo-mark.png" alt="SubTrack" /></div>
          <div><strong>SubTrack</strong><span>Payment Tracker</span></div>
        </div>

        <nav className="nav">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">{(profile?.display_name || 'A').slice(0, 1).toUpperCase()}</div>
            <div className="truncate"><strong>{profile?.display_name || 'Admin'}</strong><span>{profile?.role || 'ADMIN'}</span></div>
          </div>
          <button className="nav-item logout" onClick={signOut}><LogOut size={18} /> Sign out</button>
          <div className="sidebar-footer">v{APP_VERSION} · {APP_COPYRIGHT}</div>
        </div>
      </aside>

      {open && <button className="sidebar-overlay" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setOpen(true)}><Menu size={21} /></button>
          <div><div className="eyebrow">Subscription Payment Tracker</div><h1>{current}</h1></div>
          <div className="topbar-spacer" />
        </header>
        <div className="page">{children}</div>
      </main>
    </div>
  )
}

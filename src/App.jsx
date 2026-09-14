import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Subscriptions from './pages/Subscriptions'
import SubscriptionDetails from './pages/SubscriptionDetails'
import Friends from './pages/Friends'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function Protected() {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading SubTrack…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <div className="loading-screen">Preparing your profile…</div>
  return <AppShell><Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/subscriptions" element={<Subscriptions />} />
    <Route path="/subscriptions/:id" element={<SubscriptionDetails />} />
    <Route path="/friends" element={<Friends />} />
    <Route path="/payments" element={<Payments />} />
    <Route path="/reports" element={<Reports />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AppShell>
}

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading SubTrack…</div>
  return session ? <Protected /> : <Routes><Route path="/login" element={<Login />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>
}

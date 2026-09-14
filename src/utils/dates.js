export function monthStart(date = new Date()) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function monthInputValue(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatMonth(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01`))
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

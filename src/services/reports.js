import { supabase } from '../lib/supabase'

export async function monthlySummary(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const toDate = new Date(year, month, 0)
  const to = `${year}-${String(month).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('payments')
    .select('amount_due, amount_paid, status, due_date, member:members(nickname), subscription:subscriptions(name)')
    .gte('due_date', from)
    .lte('due_date', to)
    .order('due_date')

  if (error) throw error
  return data || []
}

export async function yearlySummary(year) {
  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const { data, error } = await supabase
    .from('payments')
    .select('amount_due, amount_paid, status, due_date, member:members(nickname), subscription:subscriptions(name)')
    .gte('due_date', from)
    .lte('due_date', to)
    .order('due_date')

  if (error) throw error
  return data || []
}

export function exportCsv(rows, filename = 'report.csv') {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const value = row[h] ?? ''
      return `"${String(value).replaceAll('"', '""')}"`
    }).join(','))
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

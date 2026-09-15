import { supabase } from '../lib/supabase'

export async function listPayments(filters = {}) {
  let query = supabase
    .from('payments')
    .select('*, member:members(*), subscription:subscriptions(*), billing_period:billing_periods(*)')
    .order('due_date', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.memberId) query = query.eq('member_id', filters.memberId)
  if (filters.subscriptionId) query = query.eq('subscription_id', filters.subscriptionId)
  if (filters.from) query = query.gte('due_date', filters.from)
  if (filters.to) query = query.lte('due_date', filters.to)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function updatePayment(id, payload) {
  const { data, error } = await supabase.from('payments').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function listPaymentLog(paymentId) {
  const { data, error } = await supabase
    .from('payment_status_log')
    .select('*')
    .eq('payment_id', paymentId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function uploadReceipt(paymentId, file) {
  const extension = file.name.split('.').pop() || 'bin'
  const path = `${paymentId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('payment-receipts').upload(path, file, { upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase.from('payment_receipts').insert({
    payment_id: paymentId,
    storage_path: path,
    original_filename: file.name,
    content_type: file.type || 'application/octet-stream',
    file_size: file.size,
  }).select().single()
  if (error) throw error
  return data
}

export async function createReceiptUrl(path) {
  const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

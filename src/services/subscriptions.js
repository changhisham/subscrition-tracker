import { supabase } from '../lib/supabase'

export async function listSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_members(*, member:members(*)), subscription_price_history(*)')
    .order('name')
  if (error) throw error
  return data || []
}

export async function getSubscription(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_members(*, member:members(*)), subscription_price_history(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createSubscription(payload) {
  const { data, error } = await supabase.from('subscriptions').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateSubscription(id, payload) {
  const { data, error } = await supabase.from('subscriptions').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function listMembers() {
  const { data, error } = await supabase.from('members').select('*').order('nickname')
  if (error) throw error
  return data || []
}

export async function listMembersWithSubscriptions() {
  const { data, error } = await supabase
    .from('members')
    .select('*, subscription_members(*, subscription:subscriptions(id, name, status))')
    .order('nickname')
  if (error) throw error
  return data || []
}

export async function createMember(payload) {
  const { data, error } = await supabase.from('members').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateMember(id, payload) {
  const { data, error } = await supabase.from('members').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteMember(id) {
  const { error } = await supabase.from('members').delete().eq('id', id)
  if (error) throw error
}

export async function saveSubscriptionMember(payload) {
  const { data, error } = await supabase.from('subscription_members').upsert(payload, { onConflict: 'subscription_id,member_id' }).select().single()
  if (error) throw error
  return data
}

export async function removeSubscriptionMember(id) {
  const { error } = await supabase.from('subscription_members').delete().eq('id', id)
  if (error) throw error
}

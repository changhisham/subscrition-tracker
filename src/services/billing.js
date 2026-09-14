import { supabase } from '../lib/supabase'

export async function generateBillingPeriod(subscriptionId, periodStart) {
  const { data, error } = await supabase.rpc('generate_billing_period', {
    p_subscription_id: subscriptionId,
    p_period_start: periodStart,
  })
  if (error) throw error
  return data
}

import { supabase } from '../lib/supabase'

export async function generateBillingPeriod(subscriptionId, periodStart) {
  const { data, error } = await supabase.rpc('generate_billing_period', {
    p_subscription_id: subscriptionId,
    p_period_start: periodStart,
  })
  if (error) throw error
  return data
}

export async function runAutoGenerateBillingPeriods() {
  const { error } = await supabase.rpc('run_auto_generate_billing_periods')
  if (error) throw error
}

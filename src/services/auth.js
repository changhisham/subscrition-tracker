import { supabase } from '../lib/supabase'

// Looks up the email tied to a username so the login form can call
// signInWithPassword under the hood. Returns null if the username
// doesn't exist (caller should show a generic "invalid" message,
// not distinguish this from a wrong password).
export async function resolveUsernameToEmail(username) {
  const { data, error } = await supabase.rpc('get_email_for_username', {
    p_username: username.trim().toLowerCase(),
  })
  if (error) throw error
  return data || null
}

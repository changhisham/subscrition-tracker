import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.warn('Supabase environment variables are missing. Copy .env.example to .env.local.')
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key')

import { createClient } from '@supabase/supabase-js'

// Public browser client. It only carries the publishable key, so everything it can
// read or write is limited by the row-level security policies in Supabase.
// Public visitors can read published events and their ticket types, nothing else.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null

import { createClient } from '@supabase/supabase-js'

// Values come from Vercel environment variables (Vite inlines VITE_* at build time).
// Never hard-code keys here.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && anonKey) ? createClient(url, anonKey) : null

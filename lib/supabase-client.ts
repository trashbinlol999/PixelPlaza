"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let browserClient: SupabaseClient | null = null

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && key)
}

/**
 * Returns a singleton Supabase browser client if env vars are present.
 * If not configured, returns null and does NOT instantiate Supabase.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    if (browserClient) return browserClient
    // Do not construct supabase when config is missing (avoids runtime error).
    return null
  }
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  browserClient = createClient(url, key, { auth: { persistSession: false } })
  return browserClient
}

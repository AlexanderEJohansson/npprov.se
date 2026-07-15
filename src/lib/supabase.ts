import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function requireSupabaseUrl(): string {
  if (!supabaseUrl) {
    throw new Error(
      'Missing PUBLIC_SUPABASE_URL. Set it in Vercel → Environment Variables (Production).',
    );
  }
  return supabaseUrl;
}

// Browser / public client (RLS enforced). Null when env saknas vid build.
export const supabase: SupabaseClient<Database> | null =
  hasSupabaseConfig() ? createClient<Database>(supabaseUrl, supabaseAnonKey) : null;

// Server client with service role (full access, never expose to client)
export function createSupabaseServerClient(): SupabaseClient<Database> | null {
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !hasSupabaseConfig()) {
    return null;
  }
  return createClient<Database>(requireSupabaseUrl(), serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helpful type exports
export type Prov = Database['public']['Tables']['prov']['Row'];
export type Delprov = Database['public']['Tables']['delprov']['Row'];
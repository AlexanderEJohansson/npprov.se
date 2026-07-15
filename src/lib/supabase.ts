import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Browser / public client (RLS enforced)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Server client with service role (full access, never expose to client)
export function createSupabaseServerClient() {
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment");
  }
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helpful type exports
export type Prov = Database['public']['Tables']['prov']['Row'];
export type Delprov = Database['public']['Tables']['delprov']['Row'];

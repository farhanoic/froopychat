// src/services/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    anonKey: !!supabaseAnonKey
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

// Helper function to get current user ID
export const getCurrentUserId = () => {
  const { data: { user } } = supabase.auth.getUser();
  return user?.id;
}

// Helper function to check auth status
export const checkAuthStatus = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
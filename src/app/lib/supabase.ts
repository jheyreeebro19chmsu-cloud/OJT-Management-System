import { createClient } from '@supabase/supabase-js';

// Get environment variables (with default fallback to the real Supabase project!)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wooighmdckuoebsuegzz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2lnaG1kY2t1b2Vic3VlZ3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTE4MDcsImV4cCI6MjA4ODI2NzgwN30.ETVnzajdLNdezhh-lraSrubf1MC--VSyKKV3KUh9vWk';

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Create Supabase client only if configured
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string }
  | undefined;

/** Сначала EXPO_PUBLIC_* — Metro подмешивает их в бандл в dev; extra — запасной вариант из манифеста. */
const supabaseUrl = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  (extra?.supabaseUrl as string) ||
  ''
).trim();
const supabaseAnonKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  (extra?.supabaseAnonKey as string) ||
  ''
).trim();

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Клиент только если заданы URL и anon key; иначе `null` (createClient с пустым URL падает). */
export const supabase: SupabaseClient | null = isSupabaseAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

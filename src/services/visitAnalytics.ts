import { Platform } from 'react-native';
import { isSupabaseAuthConfigured, supabase } from '../lib/supabase';

/**
 * Запись одного посещения главной ленты (вызывать не чаще одного раза за монтирование ленты).
 * Требуется таблица public.app_visits и политики из backend/supabase/app_visits.sql.
 */
export async function recordAppVisitOncePerMount(userId: string | null): Promise<void> {
  if (!isSupabaseAuthConfigured || !supabase) return;

  const row: { user_id: string | null; platform: string } = {
    user_id: userId,
    platform: Platform.OS,
  };

  const { error } = await supabase.from('app_visits').insert(row);
  if (error) {
    console.warn('[visitAnalytics] insert failed:', error.message);
  }
}

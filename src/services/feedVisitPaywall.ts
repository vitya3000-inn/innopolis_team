import { isSupabaseAuthConfigured, supabase } from '../lib/supabase';
import { ymdUtcToday } from '../utils/archiveDate';

/** Сколько уникальных UTC-дней с актуальной лентой до показа оплаты. */
export const FREE_FEED_DAYS_BEFORE_PAYWALL = 7;

export type PaywallSyncResult = {
  distinctVisitDays: number;
  subscriptionActive: boolean;
  shouldShowPaywall: boolean;
};

function isDuplicateKeyError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '23505') return true;
  return /duplicate key|unique constraint/i.test(err.message || '');
}

/**
 * После успешной загрузки актуальной ленты: фиксирует сегодняшний UTC-день (не более одного раза в сутки),
 * считает число уникальных дней, читает subscription_active.
 */
export async function syncFeedVisitPaywall(userId: string): Promise<PaywallSyncResult | null> {
  if (!isSupabaseAuthConfigured || !supabase) return null;

  const visitYmd = ymdUtcToday();

  const entInsert = await supabase.from('user_entitlements').insert({
    user_id: userId,
    subscription_active: false,
  });
  if (entInsert.error && !isDuplicateKeyError(entInsert.error)) {
    console.warn('[feedVisitPaywall] user_entitlements insert:', entInsert.error.message);
  }

  const visitUpsert = await supabase.from('feed_visit_days').upsert(
    { user_id: userId, visit_ymd: visitYmd },
    { onConflict: 'user_id,visit_ymd' },
  );
  if (visitUpsert.error) {
    console.warn('[feedVisitPaywall] feed_visit_days upsert:', visitUpsert.error.message);
    return null;
  }

  const { count, error: countErr } = await supabase
    .from('feed_visit_days')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countErr) {
    console.warn('[feedVisitPaywall] count:', countErr.message);
    return null;
  }

  const { data: ent, error: readErr } = await supabase
    .from('user_entitlements')
    .select('subscription_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr) {
    console.warn('[feedVisitPaywall] read entitlement:', readErr.message);
    return null;
  }

  const distinctVisitDays = count ?? 0;
  const subscriptionActive = Boolean(ent?.subscription_active);
  const shouldShowPaywall =
    distinctVisitDays >= FREE_FEED_DAYS_BEFORE_PAYWALL && !subscriptionActive;

  return { distinctVisitDays, subscriptionActive, shouldShowPaywall };
}

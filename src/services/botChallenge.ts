import Constants from 'expo-constants';
import { getApiBaseUrl } from './newsApi';

export type VerifyChallengeResult = { ok: boolean; skipped?: boolean };

/**
 * Серверная проверка токена Cloudflare Turnstile (POST /auth/verify-challenge).
 * Секрет — только на backend (TURNSTILE_SECRET_KEY). Пустой token допустим, если проверка на сервере отключена.
 */
export async function verifyBotChallenge(token: string): Promise<VerifyChallengeResult> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/auth/verify-challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    skipped?: boolean;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Проверка не пройдена.');
  }
  return { ok: data.ok === true, skipped: data.skipped === true };
}

export function getTurnstileSiteKey(): string {
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY === 'string'
      ? process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY.trim()
      : '';
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = extra?.turnstileSiteKey;
  return typeof fromExtra === 'string' ? fromExtra.trim() : '';
}

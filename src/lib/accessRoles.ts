import builtinAdminEmails from '../../config/builtinAdminEmails.json';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Встроенные адреса + EXPO_PUBLIC_ADMIN_EMAILS (через запятую) + зеркало ADMIN_EMAILS из app.config. */
export function getAdminEmails(): string[] {
  const builtin = Array.isArray(builtinAdminEmails)
    ? (builtinAdminEmails as string[]).map((e) => normalizeEmail(String(e))).filter(Boolean)
    : [];
  const raw = typeof process.env.EXPO_PUBLIC_ADMIN_EMAILS === 'string'
    ? process.env.EXPO_PUBLIC_ADMIN_EMAILS
    : '';
  const fromEnv = raw
    .split(',')
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
  return [...new Set([...builtin, ...fromEnv])];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getAdminEmails();
  if (list.length === 0) return false;
  return list.includes(normalizeEmail(email));
}

export type AppRole = 'guest' | 'user' | 'admin';

export function getAppRole(
  authConfigured: boolean,
  userEmail: string | null | undefined,
): AppRole {
  if (!authConfigured) return 'guest';
  if (!userEmail) return 'guest';
  if (isAdminEmail(userEmail)) return 'admin';
  return 'user';
}

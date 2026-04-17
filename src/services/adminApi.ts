import { getApiBaseUrl } from './newsApi';

const REQUEST_TIMEOUT_MS = 300000;

export type AdminRefreshResult =
  | { ok: true; topics: number; meta?: unknown }
  | { ok: false; status: number; message: string };

export async function postAdminRefresh(accessToken: string, force: boolean): Promise<AdminRefreshResult> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const url = `${base}/admin/refresh${force ? '?force=1' : ''}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      body = { message: text || res.statusText };
    }
    if (!res.ok) {
      const msg =
        typeof body.message === 'string'
          ? body.message
          : typeof body.error === 'string'
            ? body.error
            : `HTTP ${res.status}`;
      return { ok: false, status: res.status, message: msg };
    }
    const topics = typeof body.topics === 'number' ? body.topics : 0;
    return { ok: true, topics, meta: body.meta };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Сеть недоступна';
    return { ok: false, status: 0, message: msg };
  } finally {
    clearTimeout(t);
  }
}

const STATS_TIMEOUT_MS = 25000;

export type VisitStatsResult =
  | { ok: true; count: number; fromUtc: string; toUtcExclusive: string }
  | { ok: false; status: number; message: string };

export async function getVisitStats(
  accessToken: string,
  fromYmd: string,
  toYmd: string,
): Promise<VisitStatsResult> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const q = new URLSearchParams({ from: fromYmd.trim(), to: toYmd.trim() }).toString();
  const url = `${base}/admin/visit-stats?${q}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      body = { message: text || res.statusText };
    }
    if (!res.ok) {
      const msg = typeof body.message === 'string' ? body.message : `HTTP ${res.status}`;
      return { ok: false, status: res.status, message: msg };
    }
    const count = typeof body.count === 'number' ? body.count : 0;
    const fromUtc = typeof body.fromUtc === 'string' ? body.fromUtc : '';
    const toUtcExclusive = typeof body.toUtcExclusive === 'string' ? body.toUtcExclusive : '';
    return { ok: true, count, fromUtc, toUtcExclusive };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Сеть недоступна';
    return { ok: false, status: 0, message: msg };
  } finally {
    clearTimeout(t);
  }
}

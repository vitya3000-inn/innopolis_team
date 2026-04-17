import { Event, Topic } from '../types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEFAULT_BACKEND_PORT = 8787;
/** LAN и cold start на телефоне иногда отвечают дольше 15 с */
const REQUEST_TIMEOUT_MS = 28000;

function parsePortFromBaseUrl(url: string): number | null {
  try {
    const normalized = url.includes('://') ? url : `http://${url}`;
    const u = new URL(normalized);
    if (u.port) return parseInt(u.port, 10);
  } catch {
    /* ignore */
  }
  return null;
}

function hostnameFromBaseUrl(base: string): string | null {
  try {
    const normalized = base.includes('://') ? base : `http://${base}`;
    const h = new URL(normalized).hostname;
    return h || null;
  } catch {
    return null;
  }
}

/** IP dev-машины из манифеста Expo (LAN). */
function inferLanHostFromExpo(): string | null {
  const c = Constants as Record<string, unknown>;
  const expoConfig = (c.expoConfig || {}) as Record<string, unknown>;
  const expoGo = (expoConfig.expoGoConfig || c.expoGoConfig || {}) as Record<string, unknown>;
  const manifest2 = (c.manifest2 || {}) as Record<string, unknown>;
  const extra = (manifest2.extra || {}) as Record<string, unknown>;
  const expoClient = (extra.expoClient || {}) as Record<string, unknown>;
  const manifest = (c.manifest || {}) as Record<string, unknown>;

  const candidates: unknown[] = [
    expoConfig.hostUri,
    expoGo.debuggerHost,
    expoClient.hostUri,
    manifest.hostUri,
    manifest.debuggerHost,
  ];

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    const cleaned = raw.replace(/^exp:\/\//, '').replace(/^https?:\/\//, '');
    const hostPort = cleaned.split('/')[0];
    if (!hostPort) continue;
    const host = hostPort.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }
  return null;
}

function getExtraApiUrl(): string {
  const fromConfig = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromManifest2 = (Constants.manifest2 as Record<string, unknown> | undefined)?.extra as
    | Record<string, unknown>
    | undefined;
  const expoClient = fromManifest2?.expoClient as Record<string, unknown> | undefined;
  const nestedExtra = expoClient?.extra as Record<string, unknown> | undefined;
  const v = fromConfig?.apiUrl ?? nestedExtra?.apiUrl;
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Базовый URL backend (без завершающего /).
 */
export function getApiBaseUrl(): string {
  const fromExtra = getExtraApiUrl();
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_API_URL === 'string'
      ? process.env.EXPO_PUBLIC_API_URL.trim()
      : '';
  const explicit = fromExtra || fromEnv;
  const port =
    parsePortFromExplicit(explicit) ??
    (() => {
      const p = process.env.EXPO_PUBLIC_API_PORT;
      if (p && /^\d+$/.test(String(p).trim())) return parseInt(String(p).trim(), 10);
      return DEFAULT_BACKEND_PORT;
    })();

  const lanHost = inferLanHostFromExpo();

  if (explicit) {
    if (explicit.includes('localhost') || explicit.includes('127.0.0.1')) {
      if (lanHost) {
        return `http://${lanHost}:${port}`;
      }
      if (Platform.OS === 'web') {
        return `http://127.0.0.1:${port}`;
      }
    } else {
      return explicit.replace(/\/+$/, '');
    }
  }

  if (lanHost) {
    return `http://${lanHost}:${port}`;
  }

  if (Platform.OS === 'web') {
    return `http://localhost:${port}`;
  }

  return `http://localhost:${port}`;
}

/**
 * Запасные базы URL: если в .env устаревший IP, а Expo уже подключился к Mac по другому адресу —
 * повторим запрос на host из debuggerHost (тот же, что у Metro).
 */
function getApiBaseUrlCandidates(): string[] {
  const primary = getApiBaseUrl();
  const list: string[] = [primary.replace(/\/+$/, '')];

  if (Platform.OS === 'web') {
    return list;
  }

  const lan = inferLanHostFromExpo();
  const hostPrimary = hostnameFromBaseUrl(primary);
  const port = parsePortFromBaseUrl(primary) ?? DEFAULT_BACKEND_PORT;

  if (
    lan &&
    hostPrimary &&
    lan !== hostPrimary &&
    hostPrimary !== 'localhost' &&
    hostPrimary !== '127.0.0.1'
  ) {
    list.push(`http://${lan}:${port}`);
  }

  return [...new Set(list)];
}

function parsePortFromExplicit(url: string): number | null {
  if (!url) return null;
  return parsePortFromBaseUrl(url);
}

interface TopicEventsResponse {
  topicId: string;
  events: Event[];
}

interface EventResponse {
  event: Event;
}

function isLikelyUnreachableError(err: Error): boolean {
  const m = err.message.toLowerCase();
  return (
    m.includes('таймаут') ||
    m.includes('timeout') ||
    m.includes('network request failed') ||
    m.includes('failed to connect') ||
    m.includes('запрос отменён') ||
    err.name === 'AbortError'
  );
}

async function requestOnce<T>(path: string, baseUrl: string): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(
        new Error(
          `Таймаут ${REQUEST_TIMEOUT_MS / 1000} с — нет ответа от ${url}.\n` +
            `Проверьте: backend запущен (npm run backend), Mac и телефон в одной Wi‑Fi сети (не «гостевая»), ` +
            `IP компьютера актуален (ifconfig / настройки сети), фаервол macOS разрешает входящие для Node.\n` +
            `С телефона в браузере откройте: ${baseUrl.replace(/\/+$/, '')}/health`,
        ),
      );
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      fetch(url, { signal: controller.signal }),
      timeoutPromise,
    ]);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`API ${response.status} ${response.statusText}\n${url}\n${text.slice(0, 240)}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `Ответ не JSON (${url}). Начало тела: ${text.slice(0, 180).replace(/\s+/g, ' ')}`,
      );
    }
  } catch (e: unknown) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Запрос отменён (таймаут).\n${url}`);
    }
    throw e;
  }
}

async function request<T>(path: string): Promise<T> {
  const bases = getApiBaseUrlCandidates();
  let lastError: Error | null = null;

  for (let i = 0; i < bases.length; i++) {
    try {
      return await requestOnce<T>(path, bases[i]);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const canRetry = i < bases.length - 1 && isLikelyUnreachableError(lastError);
      if (!canRetry) {
        if (bases.length > 1 && i === bases.length - 1) {
          lastError = new Error(
            `${lastError.message}\n\nПробовали адреса: ${bases.join(' → ')}`,
          );
        }
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('request failed');
}

function dateQuery(archiveDateUtc?: string | null): string {
  if (!archiveDateUtc || !/^\d{4}-\d{2}-\d{2}$/.test(archiveDateUtc.trim())) return '';
  return `?date=${encodeURIComponent(archiveDateUtc.trim())}`;
}

export async function fetchTopics(archiveDateUtc?: string | null): Promise<Topic[]> {
  const q = dateQuery(archiveDateUtc);
  const data = await request<Record<string, unknown>>(`/topics${q}`);
  const raw = data?.topics;
  return Array.isArray(raw) ? (raw as Topic[]) : [];
}

export async function fetchTopicEvents(
  topicId: string,
  archiveDateUtc?: string | null,
): Promise<Event[]> {
  const q = dateQuery(archiveDateUtc);
  const data = await request<TopicEventsResponse>(
    `/topics/${encodeURIComponent(topicId)}/events${q}`,
  );
  return data.events || [];
}

export async function fetchEvent(
  eventId: string,
  archiveDateUtc?: string | null,
): Promise<Event | null> {
  try {
    const q = dateQuery(archiveDateUtc);
    const data = await request<EventResponse>(`/events/${encodeURIComponent(eventId)}${q}`);
    return data.event || null;
  } catch (_error) {
    return null;
  }
}

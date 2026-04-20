const fs = require('fs');
const path = require('path');

/**
 * URL backend в манифест (Constants.expoConfig.extra.apiUrl), чтобы работало в Expo Go
 * даже когда process.env.EXPO_PUBLIC_* не попал в JS-бандл Metro.
 */
function readEnvValueFromFile(envKey) {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return '';
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const prefix = `${envKey}=`;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.startsWith(prefix)) continue;
    let v = trimmed.slice(prefix.length).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return '';
}

function loadExpoPublicKey(envKey) {
  const fromProcess = process.env[envKey];
  if (fromProcess && String(fromProcess).trim()) return String(fromProcess).trim();
  return readEnvValueFromFile(envKey);
}

function loadExpoPublicApiUrl() {
  return loadExpoPublicKey('EXPO_PUBLIC_API_URL');
}

/**
 * Для Expo в extra попадают те же значения, что вы уже можете иметь для backend:
 * SUPABASE_URL + публичный anon key (не service_role).
 */
function loadSupabaseUrlForApp() {
  const pub = loadExpoPublicKey('EXPO_PUBLIC_SUPABASE_URL');
  if (pub) return pub;
  const fromFile = readEnvValueFromFile('SUPABASE_URL');
  if (fromFile && String(fromFile).trim()) return String(fromFile).trim();
  const pe = process.env.SUPABASE_URL;
  return pe && String(pe).trim() ? String(pe).trim() : '';
}

function loadSupabaseAnonKeyForApp() {
  const pub = loadExpoPublicKey('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (pub) return pub;
  const fromFile = readEnvValueFromFile('SUPABASE_ANON_KEY');
  if (fromFile && String(fromFile).trim()) return String(fromFile).trim();
  const pe = process.env.SUPABASE_ANON_KEY;
  return pe && String(pe).trim() ? String(pe).trim() : '';
}

const appJson = require('./app.json');

/** Fallback из app.json, если нет EXPO_PUBLIC_API_URL (удобно для CI/Render без UI env). */
function apiUrlFromAppJsonExtra() {
  const extra = appJson.expo?.extra;
  if (extra && typeof extra.apiUrl === 'string' && extra.apiUrl.trim()) {
    return extra.apiUrl.trim();
  }
  return '';
}

const apiUrl = loadExpoPublicApiUrl() || apiUrlFromAppJsonExtra();

/** Чтобы Metro подставил URL в web-бандл, дублируем в process.env при отсутствии. */
if (apiUrl && !process.env.EXPO_PUBLIC_API_URL) {
  process.env.EXPO_PUBLIC_API_URL = apiUrl;
}
const supabaseUrl = loadSupabaseUrlForApp();
const supabaseAnonKey = loadSupabaseAnonKeyForApp();

/**
 * Metro в dev подставляет в бандл только EXPO_PUBLIC_* (см. environmentVariableSerializerPlugin).
 * SUPABASE_URL / SUPABASE_ANON_KEY из .env в клиенте недоступны — дублируем в EXPO_PUBLIC_ для процесса Metro,
 * чтобы src/lib/supabase.ts видел значения через process.env.
 */
if (supabaseUrl && !process.env.EXPO_PUBLIC_SUPABASE_URL) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = supabaseUrl;
}
if (supabaseAnonKey && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey;
}

const adminEmailsFromEnv =
  loadExpoPublicKey('EXPO_PUBLIC_ADMIN_EMAILS') ||
  readEnvValueFromFile('ADMIN_EMAILS') ||
  (process.env.ADMIN_EMAILS || '').trim();
if (adminEmailsFromEnv && !process.env.EXPO_PUBLIC_ADMIN_EMAILS) {
  process.env.EXPO_PUBLIC_ADMIN_EMAILS = adminEmailsFromEnv;
}

function loadTurnstileSiteKeyForApp() {
  const pub = loadExpoPublicKey('EXPO_PUBLIC_TURNSTILE_SITE_KEY');
  if (pub) return pub;
  const fromFile = readEnvValueFromFile('TURNSTILE_SITE_KEY');
  if (fromFile && String(fromFile).trim()) return String(fromFile).trim();
  return '';
}

const turnstileSiteKey = loadTurnstileSiteKeyForApp();
if (turnstileSiteKey && !process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY) {
  process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY = turnstileSiteKey;
}

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [...(appJson.expo.plugins || []), '@react-native-community/datetimepicker'],
    ios: {
      ...appJson.expo.ios,
      infoPlist: {
        ...(appJson.expo.ios?.infoPlist || {}),
        NSLocalNetworkUsageDescription:
          'Доступ к локальной сети нужен, чтобы загружать новости с backend на вашем компьютере (тот же Wi‑Fi, что и у телефона).',
      },
    },
    android: {
      ...appJson.expo.android,
      usesCleartextTraffic: true,
    },
    extra: {
      ...(appJson.expo.extra || {}),
      apiUrl,
      supabaseUrl,
      supabaseAnonKey,
      turnstileSiteKey,
    },
  },
};

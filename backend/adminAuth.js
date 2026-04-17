const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { CONFIG } = require('./config');

function loadBuiltinAdminEmails() {
  try {
    const p = path.join(__dirname, '..', 'config', 'builtinAdminEmails.json');
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!Array.isArray(raw)) return [];
    return raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function parseEnvAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Объединение встроенного списка и ADMIN_EMAILS из .env */
function getAdminEmailSet() {
  return new Set([...loadBuiltinAdminEmails(), ...parseEnvAdminEmails()]);
}

let supabaseAdminClient = null;
function getSupabaseServiceClient() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseServiceKey) return null;
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdminClient;
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
async function getUserFromBearer(req) {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {(res: import('http').ServerResponse, code: number, payload: object) => void} jsonFn
 * @returns {Promise<boolean>}
 */
/** Проверка JWT + списка админов (POST /admin/refresh, GET /admin/visit-stats и т.д.). */
async function assertAdminRequest(req, res, jsonFn) {
  if (process.env.ADMIN_REFRESH_OPEN === '1') {
    return true;
  }

  const admins = getAdminEmailSet();
  if (admins.size === 0) {
    return true;
  }

  if (!CONFIG.supabaseUrl || !CONFIG.supabaseServiceKey) {
    jsonFn(res, 503, {
      message:
        'Список админов не пуст, но на backend не заданы SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY — нельзя проверить JWT.',
    });
    return false;
  }

  const user = await getUserFromBearer(req);
  if (!user?.email) {
    jsonFn(res, 401, {
      message: 'Нужен заголовок Authorization: Bearer <access_token> (токен Supabase из приложения).',
    });
    return false;
  }

  if (!admins.has(user.email.trim().toLowerCase())) {
    jsonFn(res, 403, { message: 'Недостаточно прав: только администратор.' });
    return false;
  }

  return true;
}

const assertCanAdminRefresh = assertAdminRequest;

module.exports = {
  getAdminEmailSet,
  getUserFromBearer,
  getSupabaseServiceClient,
  assertAdminRequest,
  assertCanAdminRefresh,
};

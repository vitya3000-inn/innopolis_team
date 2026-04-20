const http = require('http');
const { URL } = require('url');
const { CONFIG } = require('./config');
const { readState } = require('./store');
const { refreshFromSources } = require('./pipeline');
const { getFixedTopicShellsForApi } = require('./cluster');
const {
  buildArchivedStateFromUtcDate,
  emptyArchiveResponse,
  isValidUtcDateParam,
} = require('./supabaseHistory');
const { assertCanAdminRefresh, assertAdminRequest } = require('./adminAuth');
const { countVisitsBetweenYmd } = require('./appVisitStats');
const { verifyTurnstile } = require('./turnstile');

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('payload too large'), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress || '';
}

/**
 * Без ?date — текущий store.json. С ?date=YYYY-MM-DD — последний ingestion за этот календарный день UTC.
 */
async function loadStateForQuery(parsed) {
  const dateParam = parsed.searchParams.get('date');
  if (!dateParam || !String(dateParam).trim()) {
    return readState();
  }
  if (!CONFIG.supabaseEnabled) {
    const err = new Error('Исторические даты: включите SUPABASE_ENABLED=1 и настройте Supabase.');
    err.statusCode = 503;
    throw err;
  }
  const d = String(dateParam).trim();
  if (!isValidUtcDateParam(d)) {
    const err = new Error('Некорректный date=YYYY-MM-DD (календарный день UTC).');
    err.statusCode = 400;
    throw err;
  }
  const archived = await buildArchivedStateFromUtcDate(d);
  return archived || emptyArchiveResponse(d, 'no_run');
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers':
        req.headers['access-control-request-headers'] || 'Content-Type, Authorization',
    });
    return res.end();
  }

  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const path = parsed.pathname;

  if (req.method === 'GET' && path === '/health') {
    return json(res, 200, { ok: true, service: 'newsmaker-backend' });
  }

  if (req.method === 'GET' && path === '/auth/turnstile-config') {
    const siteKey = CONFIG.turnstileSiteKey ? CONFIG.turnstileSiteKey : null;
    const requiresToken = Boolean(CONFIG.turnstileSecretKey) && !CONFIG.botCheckDisabled;
    return json(res, 200, { siteKey, requiresToken });
  }

  if (req.method === 'GET' && path === '/topics') {
    try {
      const state = await loadStateForQuery(parsed);
      let topics = Array.isArray(state.topics) ? state.topics : [];
      if (topics.length === 0) {
        topics = getFixedTopicShellsForApi();
      }
      return json(res, 200, { topics, meta: state.meta, metaBySource: state.metaBySource || {} });
    } catch (e) {
      const code = e.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 502;
      return json(res, code, { message: e.message || 'load state failed' });
    }
  }

  if (req.method === 'GET' && path.startsWith('/topics/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 3 && parts[2] === 'events') {
      const topicId = decodeURIComponent(parts[1]);
      try {
        const state = await loadStateForQuery(parsed);
        return json(res, 200, {
          topicId,
          events: state.eventsByTopic[topicId] || [],
          meta: state.meta,
        });
      } catch (e) {
        const code = e.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 502;
        return json(res, code, { message: e.message || 'load state failed' });
      }
    }
  }

  if (req.method === 'GET' && path.startsWith('/events/')) {
    const eventId = decodeURIComponent(path.split('/').filter(Boolean)[1]);
    try {
      const state = await loadStateForQuery(parsed);
      const event = state.eventsById[eventId];
      if (!event) return json(res, 404, { message: 'Event not found' });
      return json(res, 200, { event, meta: state.meta });
    } catch (e) {
      const code = e.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 502;
      return json(res, code, { message: e.message || 'load state failed' });
    }
  }

  if (req.method === 'GET' && path === '/admin/visit-stats') {
    const allowed = await assertAdminRequest(req, res, json);
    if (!allowed) return;
    try {
      const from = parsed.searchParams.get('from');
      const to = parsed.searchParams.get('to');
      const result = await countVisitsBetweenYmd(from, to);
      return json(res, 200, result);
    } catch (e) {
      const code = e.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 502;
      return json(res, code, { message: e.message || 'visit-stats failed' });
    }
  }

  if (req.method === 'POST' && path === '/auth/verify-challenge') {
    try {
      const body = await readJsonBody(req);
      const token = typeof body.token === 'string' ? body.token : '';

      if (CONFIG.botCheckDisabled) {
        return json(res, 200, { ok: true, skipped: true });
      }

      if (!CONFIG.turnstileSecretKey) {
        return json(res, 200, { ok: true, skipped: true });
      }

      if (!token.trim()) {
        return json(res, 400, {
          ok: false,
          message: 'Требуется токен Turnstile. Обновите страницу и пройдите проверку.',
        });
      }

      const ok = await verifyTurnstile(CONFIG.turnstileSecretKey, token, clientIp(req));
      if (!ok) {
        return json(res, 403, {
          ok: false,
          message: 'Проверка антибота не пройдена. Обновите страницу и попробуйте снова.',
        });
      }
      return json(res, 200, { ok: true });
    } catch (e) {
      const code = e.statusCode && Number.isFinite(e.statusCode) ? e.statusCode : 400;
      return json(res, code, { ok: false, message: e.message || 'invalid body' });
    }
  }

  if (req.method === 'POST' && path === '/admin/refresh') {
    const allowed = await assertCanAdminRefresh(req, res, json);
    if (!allowed) return;
    try {
      const force = parsed.searchParams.get('force') === '1';
      const state = await refreshFromSources({ force });
      return json(res, 200, { ok: true, meta: state.meta, topics: state.topics.length });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  return json(res, 404, { message: 'Not found' });
}

async function bootstrap() {
  // Сначала поднимаем HTTP-сервер, затем делаем ingestion в фоне.
  // Это критично для UX (Expo/health checks), иначе старт может "висеть" на сети/LLM.
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      if (!res.headersSent) {
        json(res, 500, { message: err.message || 'internal error' });
      }
    });
  });

  server.listen(CONFIG.port, '0.0.0.0', () => {
    console.log(
      `Backend is running on http://0.0.0.0:${CONFIG.port} (с телефона: http://<ваш-LAN-IP>:${CONFIG.port})`,
    );
  });

  try {
    refreshFromSources().catch((error) => {
      // Сервер может стартовать даже без первого успешного ingestion.
      console.warn('[bootstrap] initial refresh failed:', error.message);
    });
  } catch (error) {
    console.warn('[bootstrap] initial refresh failed:', error.message);
  }

  setInterval(async () => {
    try {
      await refreshFromSources();
      console.log('[refresh] successful');
    } catch (error) {
      console.warn('[refresh] failed:', error.message);
    }
  }, CONFIG.refreshIntervalMs);
}

bootstrap();

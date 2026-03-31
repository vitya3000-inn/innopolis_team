const http = require('http');
const { URL } = require('url');
const { CONFIG } = require('./config');
const { readState } = require('./store');
const { refreshFromSources } = require('./pipeline');

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers':
        req.headers['access-control-request-headers'] || 'Content-Type',
    });
    return res.end();
  }

  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const path = parsed.pathname;

  if (req.method === 'GET' && path === '/health') {
    return json(res, 200, { ok: true, service: 'newsmaker-backend' });
  }

  if (req.method === 'GET' && path === '/topics') {
    const state = readState();
    return json(res, 200, { topics: state.topics, meta: state.meta, metaBySource: state.metaBySource });
  }

  if (req.method === 'GET' && path.startsWith('/topics/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 3 && parts[2] === 'events') {
      const topicId = decodeURIComponent(parts[1]);
      const state = readState();
      return json(res, 200, {
        topicId,
        events: state.eventsByTopic[topicId] || [],
        meta: state.meta,
      });
    }
  }

  if (req.method === 'GET' && path.startsWith('/events/')) {
    const eventId = decodeURIComponent(path.split('/').filter(Boolean)[1]);
    const state = readState();
    const event = state.eventsById[eventId];
    if (!event) return json(res, 404, { message: 'Event not found' });
    return json(res, 200, { event, meta: state.meta });
  }

  if (req.method === 'POST' && path === '/admin/refresh') {
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
    handleRequest(req, res);
  });

  server.listen(CONFIG.port, () => {
    console.log(`Backend is running on http://localhost:${CONFIG.port}`);
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

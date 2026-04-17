const { CONFIG } = require('./config');
const { groupEventsIntoTopics, getFixedTopicShellsForApi } = require('./cluster');

function getSupabaseClient() {
  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch (e) {
    return { error: 'module', detail: e?.message || 'require failed' };
  }
  if (!CONFIG.supabaseUrl) return { error: 'env', detail: 'SUPABASE_URL is empty' };
  if (!CONFIG.supabaseServiceKey) return { error: 'env', detail: 'SUPABASE_SERVICE_ROLE_KEY is empty' };
  return createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Границы календарного дня UTC [start, end) в ISO.
 * @param {string} yyyyMmDd например 2025-04-03
 */
function utcDayBoundsIso(yyyyMmDd) {
  const parts = yyyyMmDd.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  if (
    start.getUTCFullYear() !== y ||
    start.getUTCMonth() !== m - 1 ||
    start.getUTCDate() !== d
  ) {
    return null;
  }
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function isValidUtcDateParam(s) {
  if (!s || typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  return utcDayBoundsIso(s.trim()) !== null;
}

function parsePayload(row) {
  const p = row?.payload;
  if (p == null) return null;
  if (typeof p === 'string') {
    try {
      return JSON.parse(p);
    } catch {
      return null;
    }
  }
  return typeof p === 'object' ? p : null;
}

/**
 * Последний ingestion_runs за календарный день UTC и события этого прогона.
 * Восстанавливает topics / eventsByTopic / eventsById как при live refresh.
 *
 * @param {string} utcDate YYYY-MM-DD (UTC)
 * @returns {Promise<object|null>} фрагмент state или null, если прогонов не было
 */
async function buildArchivedStateFromUtcDate(utcDate) {
  const bounds = utcDayBoundsIso(utcDate.trim());
  if (!bounds) return null;

  const clientOrErr = getSupabaseClient();
  if (clientOrErr?.error) {
    const err = new Error(
      clientOrErr.error === 'module'
        ? `supabase-js: ${clientOrErr.detail}`
        : clientOrErr.detail,
    );
    err.code = 'SUPABASE_CONFIG';
    throw err;
  }
  const supabase = clientOrErr;

  const { data: run, error: runErr } = await supabase
    .from('ingestion_runs')
    .select('id, started_at, finished_at, meta')
    .gte('started_at', bounds.startIso)
    .lt('started_at', bounds.endIso)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runErr) {
    const err = new Error(runErr.message);
    err.code = 'SUPABASE_QUERY';
    throw err;
  }

  if (!run?.id) return null;

  const pageSize = 500;
  let from = 0;
  const allRows = [];
  for (;;) {
    const { data: rows, error: evErr } = await supabase
      .from('events')
      .select('payload')
      .eq('run_id', run.id)
      .range(from, from + pageSize - 1);

    if (evErr) {
      const err = new Error(evErr.message);
      err.code = 'SUPABASE_QUERY';
      throw err;
    }
    if (!rows?.length) break;
    allRows.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const events = allRows.map(parsePayload).filter(Boolean);

  const topicsWithEvents = groupEventsIntoTopics(events);
  const topics = topicsWithEvents.map(({ events: _e, ...topic }) => topic);
  const eventsByTopic = {};
  const eventsById = {};
  topicsWithEvents.forEach((topic) => {
    eventsByTopic[topic.id] = topic.events;
    topic.events.forEach((event) => {
      eventsById[event.id] = event;
    });
  });

  const baseMeta = run.meta && typeof run.meta === 'object' && !Array.isArray(run.meta) ? run.meta : {};

  const meta = {
    ...baseMeta,
    historicalUtcDate: utcDate.trim(),
    ingestionRunId: run.id,
    ingestionStartedAt: run.started_at,
    ingestionFinishedAt: run.finished_at,
    source: 'supabase-archive',
    language: baseMeta.language || CONFIG.targetLanguage,
  };

  return {
    topics,
    eventsByTopic,
    eventsById,
    meta,
    metaBySource: {},
  };
}

/**
 * Как GET /topics при пустом прогоне: три фикс-темы-оболочки + meta.
 */
function emptyArchiveResponse(utcDate, reason) {
  return {
    topics: getFixedTopicShellsForApi(),
    eventsByTopic: {},
    eventsById: {},
    meta: {
      historicalUtcDate: utcDate,
      historicalMissing: true,
      historicalMissingReason: reason || 'no_run',
      source: 'supabase-archive',
      language: CONFIG.targetLanguage,
      updatedAt: null,
    },
    metaBySource: {},
  };
}

module.exports = {
  buildArchivedStateFromUtcDate,
  emptyArchiveResponse,
  isValidUtcDateParam,
  utcDayBoundsIso,
};

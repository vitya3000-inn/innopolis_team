const { getSupabaseServiceClient } = require('./adminAuth');

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string} ymd
 * @returns {Date} начало календарного дня UTC
 */
function utcStartOfDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/** Начало календарного дня UTC, следующего за днём ymd. */
function utcNextDayAfter(ymd) {
  const start = utcStartOfDay(ymd);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function isValidYmd(s) {
  return typeof s === 'string' && YMD.test(s.trim()) && !Number.isNaN(utcStartOfDay(s.trim()).getTime());
}

/**
 * Число строк в app_visits за [fromYmd 00:00 UTC, toYmd+1 00:00 UTC).
 * @param {string} fromYmd
 * @param {string} toYmd
 */
async function countVisitsBetweenYmd(fromYmd, toYmd) {
  const from = String(fromYmd).trim();
  const to = String(toYmd).trim();
  if (!isValidYmd(from) || !isValidYmd(to)) {
    const err = new Error('Нужны параметры from и to в формате YYYY-MM-DD (UTC календарные дни).');
    err.statusCode = 400;
    throw err;
  }
  const start = utcStartOfDay(from);
  const endExclusive = utcNextDayAfter(to);
  if (endExclusive.getTime() <= start.getTime()) {
    const err = new Error('Дата «по» должна быть не раньше даты «с».');
    err.statusCode = 400;
    throw err;
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    const err = new Error('Supabase не настроен на backend.');
    err.statusCode = 503;
    throw err;
  }

  const { count, error } = await supabase
    .from('app_visits')
    .select('*', { count: 'exact', head: true })
    .gte('visited_at', start.toISOString())
    .lt('visited_at', endExclusive.toISOString());

  if (error) {
    const err = new Error(error.message || 'count failed');
    err.statusCode = 502;
    throw err;
  }

  return {
    count: typeof count === 'number' ? count : 0,
    fromUtc: start.toISOString(),
    toUtcExclusive: endExclusive.toISOString(),
  };
}

module.exports = {
  countVisitsBetweenYmd,
  isValidYmd,
};

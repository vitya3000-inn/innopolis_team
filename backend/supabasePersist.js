const { CONFIG } = require('./config');
const { articleStableId, resolveFixedTopic } = require('./cluster');

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

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
 * Сохраняет прогон ingestion: статьи и события в том виде, в каком они попадают в UI
 * (после groupEventsIntoTopics: релевантность, лимиты на тему). Сырый пул NewsAPI сюда не передаётся.
 * Связи event ↔ article по opinion.articleUrl. История прогонов — по ingestion_runs.
 * Ошибки логируются, refresh не падает.
 *
 * @param {object[]} preparedArticles — статьи, упомянутые в сохраняемых событиях (полные payload из pipeline)
 * @param {object[]} eventsForTopics — события, реально попавшие в темы приложения
 * @param {object} meta — state.meta
 */
async function persistIngestionToSupabase(preparedArticles, eventsForTopics, meta) {
  if (!CONFIG.supabaseEnabled) return;

  const clientOrErr = getSupabaseClient();
  if (clientOrErr?.error) {
    if (clientOrErr.error === 'module') {
      console.warn('[supabase] install dependency: npm install @supabase/supabase-js —', clientOrErr.detail);
    } else {
      console.warn('[supabase]', clientOrErr.detail, '(check .env in project root next to package.json)');
    }
    return;
  }
  const supabase = clientOrErr;

  const started = new Date().toISOString();

  const { data: runRow, error: runErr } = await supabase
    .from('ingestion_runs')
    .insert({
      started_at: started,
      meta: jsonSafe(meta || {}),
    })
    .select('id')
    .single();

  if (runErr || !runRow?.id) {
    console.warn('[supabase] ingestion_runs insert failed:', runErr?.message || 'no id');
    return;
  }

  const runId = runRow.id;

  try {
    const articleRows = (preparedArticles || []).map((a) => ({
      stable_id: articleStableId(a),
      url: a.url || '',
      source_api_id: a.source?.id ?? null,
      source_name: a.source?.name ?? null,
      title: a.title ?? null,
      description: a.description ?? a.content ?? null,
      published_at: a.publishedAt ?? null,
      payload: jsonSafe(a),
      updated_at: new Date().toISOString(),
    })).filter((r) => r.url);

    for (const batch of chunkArray(articleRows, 80)) {
      const { error } = await supabase.from('articles').upsert(batch, { onConflict: 'stable_id' });
      if (error) {
        console.warn('[supabase] articles upsert batch failed:', error.message);
        throw error;
      }
    }

    const eventsList = Array.isArray(eventsForTopics) ? eventsForTopics : [];
    const eventInsertRows = eventsList.map((ev) => {
      const fixed = resolveFixedTopic(ev);
      const topicId = fixed ? `topic-fixed-${fixed.id}` : null;
      return {
        run_id: runId,
        client_event_id: ev.id,
        topic_id: topicId,
        published_at: ev.publishedAt ?? null,
        payload: jsonSafe(ev),
      };
    });

    const clientIdToUuid = new Map();

    for (const batch of chunkArray(eventInsertRows, 50)) {
      const { data: inserted, error } = await supabase
        .from('events')
        .insert(batch)
        .select('id, client_event_id');
      if (error) {
        console.warn('[supabase] events insert failed:', error.message);
        throw error;
      }
      (inserted || []).forEach((row) => {
        clientIdToUuid.set(row.client_event_id, row.id);
      });
    }

    const linkRows = [];
    for (const ev of eventsList) {
      const eventUuid = clientIdToUuid.get(ev.id);
      if (!eventUuid) continue;
      const seenStable = new Set();
      const opinions = Array.isArray(ev.opinions) ? ev.opinions : [];
      opinions.forEach((op, idx) => {
        const url = op?.articleUrl;
        if (!url || typeof url !== 'string') return;
        const stableId = articleStableId({ url });
        if (seenStable.has(stableId)) return;
        seenStable.add(stableId);
        linkRows.push({
          event_uuid: eventUuid,
          article_stable_id: stableId,
          sort_order: idx,
        });
      });
    }

    const stableInDb = new Set(articleRows.map((r) => r.stable_id));
    const urlByStable = new Map();
    for (const ev of eventsList) {
      for (const op of ev.opinions || []) {
        if (!op?.articleUrl) continue;
        const sid = articleStableId({ url: op.articleUrl });
        if (!urlByStable.has(sid)) {
          urlByStable.set(sid, {
            url: op.articleUrl,
            source_name: op.sourceName,
            description: op.summary,
          });
        }
      }
    }

    const missingStables = [...new Set(linkRows.map((l) => l.article_stable_id))].filter(
      (sid) => !stableInDb.has(sid),
    );
    if (missingStables.length > 0) {
      const stubs = missingStables.map((stableId) => {
        const info = urlByStable.get(stableId) || {};
        const u = info.url && String(info.url).trim() ? info.url : `urn:article:${stableId}`;
        return {
          stable_id: stableId,
          url: u,
          source_api_id: null,
          source_name: info.source_name ?? null,
          title: null,
          description: info.description ?? null,
          published_at: null,
          payload: jsonSafe({ stub: true }),
          updated_at: new Date().toISOString(),
        };
      });
      for (const batch of chunkArray(stubs, 80)) {
        const { error: stubErr } = await supabase.from('articles').upsert(batch, {
          onConflict: 'stable_id',
        });
        if (stubErr) console.warn('[supabase] article stubs upsert:', stubErr.message);
      }
    }

    for (const batch of chunkArray(linkRows, 100)) {
      const { error } = await supabase.from('event_articles').insert(batch);
      if (error) {
        console.warn('[supabase] event_articles insert failed:', error.message);
        throw error;
      }
    }

    await supabase
      .from('ingestion_runs')
      .update({
        finished_at: new Date().toISOString(),
        article_count: articleRows.length,
        event_count: eventsList.length,
      })
      .eq('id', runId);

    console.log(
      `[supabase] ingestion run ${runId}: articles=${articleRows.length}, events=${eventsList.length}, links=${linkRows.length}`,
    );
  } catch (err) {
    console.warn('[supabase] persist aborted:', err.message);
    await supabase
      .from('ingestion_runs')
      .update({
        finished_at: new Date().toISOString(),
        meta: jsonSafe({ ...(meta || {}), error: err.message }),
      })
      .eq('id', runId);
  }
}

module.exports = { persistIngestionToSupabase, getSupabaseClient };

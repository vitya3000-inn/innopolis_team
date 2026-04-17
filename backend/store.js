const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config');

function ensureStorageDir() {
  const dir = path.dirname(CONFIG.storagePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createEmptyState() {
  return {
    meta: {
      updatedAt: null,
      source: 'newsapi',
      language: 'ru',
      sourceIds: CONFIG.sourceIds,
    },
    topics: [],
    eventsByTopic: {},
    eventsById: {},
  };
}

function readState() {
  ensureStorageDir();
  if (!fs.existsSync(CONFIG.storagePath)) {
    return createEmptyState();
  }

  try {
    const content = fs.readFileSync(CONFIG.storagePath, 'utf8');
    const raw = JSON.parse(content);
    return normalizeState(raw);
  } catch (error) {
    return createEmptyState();
  }
}

function normalizeState(raw) {
  const empty = createEmptyState();
  if (!raw || typeof raw !== 'object') return empty;
  return {
    ...empty,
    ...raw,
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    eventsByTopic:
      raw.eventsByTopic && typeof raw.eventsByTopic === 'object' && !Array.isArray(raw.eventsByTopic)
        ? raw.eventsByTopic
        : {},
    eventsById:
      raw.eventsById && typeof raw.eventsById === 'object' && !Array.isArray(raw.eventsById)
        ? raw.eventsById
        : {},
    meta: raw.meta && typeof raw.meta === 'object' ? { ...empty.meta, ...raw.meta } : empty.meta,
    metaBySource:
      raw.metaBySource && typeof raw.metaBySource === 'object' && !Array.isArray(raw.metaBySource)
        ? raw.metaBySource
        : {},
  };
}

function writeState(state) {
  ensureStorageDir();
  fs.writeFileSync(CONFIG.storagePath, JSON.stringify(state, null, 2), 'utf8');
}

module.exports = {
  readState,
  writeState,
  createEmptyState,
};

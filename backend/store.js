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
    return JSON.parse(content);
  } catch (error) {
    return createEmptyState();
  }
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

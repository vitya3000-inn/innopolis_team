const { CONFIG } = require('./config');

const translationCache = new Map();

function cleanupText(input) {
  return (input || '').replace(/\s+/g, ' ').trim();
}

async function translateEnToRu(text) {
  const normalized = cleanupText(text);
  if (!normalized) return '';

  if (translationCache.has(normalized)) {
    return translationCache.get(normalized);
  }

  try {
    const url = `${CONFIG.translation.googleTranslateEndpoint}${encodeURIComponent(normalized)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translate API error: ${response.status}`);
    }

    const payload = await response.json();
    const translated = Array.isArray(payload?.[0])
      ? payload[0].map((part) => part?.[0] || '').join('').trim()
      : normalized;

    const safeTranslated = translated || normalized;
    translationCache.set(normalized, safeTranslated);
    return safeTranslated;
  } catch (_error) {
    // Fallback гарантирует, что событие не пропадет из-за ошибки перевода.
    return normalized;
  }
}

module.exports = { translateEnToRu };

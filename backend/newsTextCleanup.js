/**
 * NewsAPI отдаёт усечённый content с хвостом вида [+1234 chars] или после перевода [+318 символов].
 * Убираем маркер и при необходимости заканчиваем текст на последнем целом предложении.
 */

function stripNewsApiTruncationMeta(text) {
  let s = String(text || '');
  const hadMeta = /\[\+\d+/.test(s);
  // Любой суффикс [+число ...] — EN/RU и варианты перевода.
  s = s.replace(/\s*\[\+\d+[^\]]*\]\s*/g, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  // NewsAPI почти всегда ставит «…» прямо перед маркером — убираем обрывочное многоточие.
  if (hadMeta) {
    s = s.replace(/\s*…\s*$/u, '').replace(/\s*\.\.\.\s*$/, '').trim();
  }
  return s;
}

function plainTextFromHtml(html) {
  return stripNewsApiTruncationMeta(
    String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/**
 * Если после среза API остался обрывок без точки — обрезаем до последнего . ! ? (не раньше minKeep).
 */
function trimBodyToLastCompleteSentence(body, minKeep = 100) {
  const t = String(body || '').trim();
  if (t.length <= minKeep) return t;

  let best = -1;
  for (let i = minKeep; i < t.length; i += 1) {
    const c = t[i];
    if (c !== '.' && c !== '!' && c !== '?' && c !== '…') continue;
    const next = t[i + 1];
    if (next === undefined || /\s/.test(next)) {
      best = i;
    }
  }

  if (best >= minKeep) return t.slice(0, best + 1).trim();
  return t;
}

function looksTruncatedNewsApiContent(raw) {
  const s = String(raw || '');
  return /\[\+\d+/.test(s);
}

/**
 * Грубое извлечение основного текста со страницы (без новых npm-зависимостей).
 */
function extractParagraphsFromHtml(html) {
  const parts = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let chunk = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (chunk.length > 35) parts.push(chunk);
  }
  const joined = parts.join('\n\n').trim();
  return joined.length > 200 ? joined.slice(0, 14000) : '';
}

module.exports = {
  stripNewsApiTruncationMeta,
  plainTextFromHtml,
  trimBodyToLastCompleteSentence,
  looksTruncatedNewsApiContent,
  extractParagraphsFromHtml,
};

import { makeId } from '../data/schema';

// Слова, которые ничего не говорят о сути записи — при сравнении заголовков
// они только создают ложные совпадения.
const STOP_WORDS = new Set([
  'и', 'в', 'на', 'для', 'по', 'с', 'от', 'до', 'из', 'о', 'об', 'к', 'у', 'за',
  'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'and', 'with',
]);

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[«»"'`(),.:;!?—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normTitle(bilingual) {
  return normalizeText(bilingual?.ru || bilingual?.en || '');
}

function tokenSet(text) {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/** Схожесть Жаккара: доля общих значимых слов. 1 — полное совпадение. */
function similarity(a, b) {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  setA.forEach((w) => {
    if (setB.has(w)) shared += 1;
  });
  return shared / (setA.size + setB.size - shared);
}

/**
 * Ищет уже существующую запись, похожую на импортируемую.
 * Сначала точное совпадение, потом — совпадение по смыслу, чтобы
 * «Медали в плавании» и «Плавание, медали» не завелись как две звезды.
 */
function findDuplicate(rawTitle, existingNodes) {
  const norm = normTitle(rawTitle);
  if (!norm) return null;

  const exact = existingNodes.find((n) => normTitle(n.title) === norm);
  if (exact) return exact;

  let best = null;
  let bestScore = 0;
  existingNodes.forEach((n) => {
    const score = Math.max(
      similarity(rawTitle?.ru || '', n.title?.ru || ''),
      similarity(rawTitle?.en || '', n.title?.en || '')
    );
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  });
  return bestScore >= 0.6 ? best : null;
}

/**
 * Отсеивает записи, которые не показывают развитие: разовые бытовые действия,
 * догадки AI с низкой уверенностью и совсем мелкие факты.
 * Возвращает причину или null, если запись стоит импортировать.
 */
function noiseReason(raw) {
  if (raw.confidence === 'low') return 'lowConfidence';

  const level = Number(raw.level) || 0;
  const text = normalizeText(
    `${raw.title?.ru || ''} ${raw.title?.en || ''} ${raw.description?.ru || ''}`
  );

  // Разовые «починил/настроил/установил» — это не веха развития.
  const choreWords = [
    'исправил', 'исправление', 'починил', 'решил проблему', 'устранил',
    'установка', 'установил', 'настроил звук', 'fixed', 'installed',
  ];
  const looksLikeChore = choreWords.some((w) => text.includes(w));
  if (looksLikeChore && level <= 2) return 'chore';

  // Мелкие бытовые интересы без прогресса.
  if (level <= 1 && raw.status !== 'done') return 'trivial';

  return null;
}

/** Парсит и валидирует вставленный JSON. Бросает Error с кодом в message. */
export function parseImportJson(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('INVALID_JSON');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('INVALID_SHAPE');
  }
  const galaxies = Array.isArray(obj.galaxies) ? obj.galaxies : [];
  const nodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  if (nodes.length === 0) throw new Error('NO_NODES');
  return { galaxies, nodes };
}

/**
 * Строит строки для экрана предпросмотра. Дубли и шум сразу помечаются
 * «пропустить» с объяснением — пользователю остаётся только просмотреть,
 * а не вычищать список вручную.
 */
export function buildReviewRows(parsed, existingData) {
  const seenInBatch = [];

  return parsed.nodes.map((raw, index) => {
    // Дубль ищем и среди уже сохранённых, и среди строк этого же импорта.
    const duplicateOf =
      findDuplicate(raw.title, existingData.nodes) ||
      findDuplicate(raw.title, seenInBatch);
    if (!duplicateOf) seenInBatch.push(raw);

    const noise = duplicateOf ? null : noiseReason(raw);

    return {
      index,
      raw,
      galaxyTitle: raw.galaxy || '',
      duplicateOf,
      noiseReason: noise,
      decision: duplicateOf || noise ? 'skip' : 'add',
    };
  });
}

function resolveGalaxyId(galaxyTitle, existingData, newGalaxies, importGalaxies) {
  const norm = normalizeText(galaxyTitle);
  if (!norm) return null;

  const existing = existingData.galaxies.find((g) => normTitle(g.title) === norm);
  if (existing) return existing.id;

  const alreadyCreated = newGalaxies.find((g) => normTitle(g.title) === norm);
  if (alreadyCreated) return alreadyCreated.id;

  const declared = importGalaxies.find((g) => normTitle(g.title) === norm);
  const id = makeId('g');
  const galaxy = declared
    ? { id, title: declared.title, color: declared.color || '#6fd3ff', position: [0, 0, 0] }
    : { id, title: { ru: galaxyTitle, en: galaxyTitle }, color: '#6fd3ff', position: [0, 0, 0] };
  newGalaxies.push(galaxy);
  return id;
}

/** Применяет решения пользователя (add/merge/skip) к текущим данным. Возвращает новый data + сводку. */
export function applyImport(existingData, parsed, rows, sourceLabel) {
  const newGalaxies = [];
  let nodes = [...existingData.nodes];
  let added = 0;
  let merged = 0;
  let skipped = 0;

  rows.forEach((row) => {
    if (row.decision === 'skip') {
      skipped += 1;
      return;
    }

    if (row.decision === 'merge' && row.duplicateOf) {
      nodes = nodes.map((n) => {
        if (n.id !== row.duplicateOf.id) return n;
        return {
          ...n,
          description: {
            ru: n.description?.ru || row.raw.description?.ru || '',
            en: n.description?.en || row.raw.description?.en || '',
          },
          tags: Array.from(new Set([...(n.tags || []), ...(row.raw.tags || [])])),
        };
      });
      merged += 1;
      return;
    }

    const galaxyId = resolveGalaxyId(row.galaxyTitle, existingData, newGalaxies, parsed.galaxies);
    if (!galaxyId) return;

    nodes.push({
      id: makeId('n'),
      galaxyId,
      type: row.raw.type || 'achievement',
      title: { ru: row.raw.title?.ru || '', en: row.raw.title?.en || '' },
      description: { ru: row.raw.description?.ru || '', en: row.raw.description?.en || '' },
      startedAt: row.raw.startedAt || null,
      completedAt: row.raw.completedAt || null,
      progress: Number(row.raw.progress) || 0,
      level: Number(row.raw.level) || 3,
      status: row.raw.status || 'planned',
      weight: 1,
      tags: Array.isArray(row.raw.tags) ? row.raw.tags : [],
      nextSteps: [],
      source: sourceLabel,
    });
    added += 1;
  });

  const newData = {
    ...existingData,
    galaxies: [...existingData.galaxies, ...newGalaxies],
    nodes,
    updatedAt: new Date().toISOString(),
  };

  return { data: newData, added, merged, skipped };
}

/** Находит дубли среди уже сохранённых записей — для разовой чистки вселенной. */
export function findExistingDuplicates(data) {
  const groups = [];
  const used = new Set();

  data.nodes.forEach((node, i) => {
    if (used.has(node.id)) return;
    const group = [node];
    for (let j = i + 1; j < data.nodes.length; j++) {
      const other = data.nodes[j];
      if (used.has(other.id)) continue;
      const sameTitle = normTitle(node.title) === normTitle(other.title);
      const close =
        similarity(node.title?.ru || '', other.title?.ru || '') >= 0.6 ||
        similarity(node.title?.en || '', other.title?.en || '') >= 0.6;
      if (sameTitle || close) {
        group.push(other);
        used.add(other.id);
      }
    }
    if (group.length > 1) groups.push(group);
  });

  return groups;
}

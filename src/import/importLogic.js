import { makeId } from '../data/schema';

function normTitle(bilingual) {
  return (bilingual?.ru || bilingual?.en || '').trim().toLowerCase();
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

/** Строит строки для экрана предпросмотра: для каждой найденной записи ищет дубликат в текущих данных. */
export function buildReviewRows(parsed, existingData) {
  return parsed.nodes.map((raw, index) => {
    const title = normTitle(raw.title);
    const duplicateOf = title
      ? existingData.nodes.find((n) => normTitle(n.title) === title) ?? null
      : null;
    return {
      index,
      raw,
      galaxyTitle: raw.galaxy || '',
      duplicateOf,
      decision: duplicateOf ? 'skip' : 'add', // 'add' | 'merge' | 'skip'
    };
  });
}

function resolveGalaxyId(galaxyTitle, existingData, newGalaxies, importGalaxies) {
  const norm = (galaxyTitle || '').trim().toLowerCase();
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

  rows.forEach((row) => {
    if (row.decision === 'skip') return;

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

  return { data: newData, added, merged };
}

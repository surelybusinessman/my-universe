// Модель данных "vault" — см. план проекта. Версионируется отдельно от контейнера шифрования.
export const SCHEMA_VERSION = 1;

export function createEmptyVault() {
  return {
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    profile: { name: '', tagline: { ru: '', en: '' } },
    galaxies: [],
    nodes: [],
    edges: [],
  };
}

export function makeId(prefix = 'n') {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `${prefix}_${rand}`;
}

export const NODE_TYPES = ['achievement', 'skill', 'goal', 'learning', 'failure'];
export const NODE_STATUSES = ['done', 'in_progress', 'planned', 'abandoned'];
export const EDGE_KINDS = ['leads_to', 'requires'];

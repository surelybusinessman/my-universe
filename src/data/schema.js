// Модель данных "vault" — см. план проекта. Версионируется отдельно от контейнера шифрования.
// v2: добавлен уровень иерархии над галактиками — "кластер" (в интерфейсе
// называется "План"), контейнер, который группирует несколько галактик так,
// чтобы они читались как единое целое, но сохраняли внутреннее деление.
// У галактики появилось поле clusterId (nullable) — null означает "вне
// контейнера", раскладка и поведение в этом случае идентичны версии 1.
export const SCHEMA_VERSION = 2;

export function createEmptyVault() {
  return {
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    profile: { name: '', tagline: { ru: '', en: '' } },
    clusters: [],
    galaxies: [],
    nodes: [],
    edges: [],
  };
}

/**
 * Приводит расшифрованные данные к текущей версии схемы. Вызывается сразу
 * после расшифровки — до того, как данные попадут в состояние приложения.
 * Миграция только ДОБАВЛЯЕТ недостающие поля: clusters по умолчанию [],
 * у каждой галактики clusterId по умолчанию null. Ни одна запись не
 * удаляется, не переименовывается и не перемещается — это боевые данные
 * пользователя, потеря которых недопустима ни при каком сценарии.
 * Идемпотентна: безопасно вызывать при каждой разблокировке, а не только
 * один раз при первой встрече со старым форматом.
 */
export function migrateVaultData(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyVault();
  return {
    ...raw,
    version: SCHEMA_VERSION,
    clusters: Array.isArray(raw.clusters) ? raw.clusters : [],
    galaxies: Array.isArray(raw.galaxies)
      ? raw.galaxies.map((g) => ('clusterId' in g ? g : { ...g, clusterId: null }))
      : [],
    nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
    edges: Array.isArray(raw.edges) ? raw.edges : [],
  };
}

export function makeId(prefix = 'n') {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `${prefix}_${rand}`;
}

export const NODE_TYPES = ['achievement', 'skill', 'goal', 'learning', 'failure'];
export const NODE_STATUSES = ['done', 'in_progress', 'planned', 'abandoned'];
export const EDGE_KINDS = ['leads_to', 'requires'];

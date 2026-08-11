import { describe, it, expect } from 'vitest';
import { migrateVaultData, createEmptyVault, SCHEMA_VERSION } from './schema';

// v1-форма vault: именно так выглядели данные до появления "Плана" — без
// поля clusters вообще и без clusterId на галактиках. Это боевые данные
// пользователя, поэтому миграция обязана не потерять из них ни байта.
const V1_DATA = {
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  profile: { name: 'Test', tagline: { ru: '', en: '' } },
  galaxies: [
    { id: 'g_1', title: { ru: 'Карьера', en: 'Career' }, color: '#4FC3F7', position: [0, 0, 0] },
    { id: 'g_2', title: { ru: 'Здоровье', en: 'Health' }, color: '#66BB6A', position: [0, 0, 0] },
  ],
  nodes: [
    { id: 'n_1', galaxyId: 'g_1', title: { ru: 'Веха', en: 'Milestone' }, type: 'achievement', status: 'done' },
  ],
  edges: [{ from: 'n_1', to: 'n_1', kind: 'leads_to' }],
};

describe('migrateVaultData: v1 -> v2 (появление "Плана")', () => {
  it('adds an empty clusters array', () => {
    const migrated = migrateVaultData(V1_DATA);
    expect(migrated.clusters).toEqual([]);
  });

  it('adds clusterId: null to every galaxy that lacks it', () => {
    const migrated = migrateVaultData(V1_DATA);
    expect(migrated.galaxies.every((g) => g.clusterId === null)).toBe(true);
  });

  it('bumps version to the current schema version', () => {
    const migrated = migrateVaultData(V1_DATA);
    expect(migrated.version).toBe(SCHEMA_VERSION);
  });

  it('does not lose or reorder a single galaxy, node or edge', () => {
    const migrated = migrateVaultData(V1_DATA);
    expect(migrated.galaxies.map((g) => g.id)).toEqual(['g_1', 'g_2']);
    expect(migrated.nodes).toEqual(V1_DATA.nodes);
    expect(migrated.edges).toEqual(V1_DATA.edges);
  });

  it('preserves every other field untouched (profile, updatedAt, galaxy title/color/position)', () => {
    const migrated = migrateVaultData(V1_DATA);
    expect(migrated.updatedAt).toBe(V1_DATA.updatedAt);
    expect(migrated.profile).toEqual(V1_DATA.profile);
    expect(migrated.galaxies[0]).toMatchObject({
      id: 'g_1',
      title: { ru: 'Карьера', en: 'Career' },
      color: '#4FC3F7',
      position: [0, 0, 0],
    });
  });

  it('is idempotent — running it twice in a row changes nothing further', () => {
    const once = migrateVaultData(V1_DATA);
    const twice = migrateVaultData(once);
    expect(twice).toEqual(once);
  });

  it('leaves already-migrated data (with real clusterId values) untouched', () => {
    const v2Data = {
      ...V1_DATA,
      version: 2,
      clusters: [{ id: 'cl_1', title: { ru: 'План', en: 'Plan' }, color: '#FFD54F' }],
      galaxies: [{ ...V1_DATA.galaxies[0], clusterId: 'cl_1' }, { ...V1_DATA.galaxies[1], clusterId: null }],
    };
    const migrated = migrateVaultData(v2Data);
    expect(migrated.galaxies[0].clusterId).toBe('cl_1');
    expect(migrated.clusters).toEqual(v2Data.clusters);
  });
});

describe('migrateVaultData: defensive fallbacks', () => {
  it('returns an empty vault for null/undefined input instead of throwing', () => {
    expect(migrateVaultData(null)).toMatchObject({ galaxies: [], nodes: [], edges: [], clusters: [] });
    expect(migrateVaultData(undefined)).toMatchObject({ galaxies: [], nodes: [], edges: [], clusters: [] });
  });

  it('falls back to empty arrays if galaxies/nodes/edges are missing or malformed', () => {
    const migrated = migrateVaultData({ version: 1, updatedAt: 'x', profile: {} });
    expect(migrated.galaxies).toEqual([]);
    expect(migrated.nodes).toEqual([]);
    expect(migrated.edges).toEqual([]);
    expect(migrated.clusters).toEqual([]);
  });
});

describe('createEmptyVault', () => {
  it('already matches the current schema shape (clusters included)', () => {
    const empty = createEmptyVault();
    expect(empty.version).toBe(SCHEMA_VERSION);
    expect(empty.clusters).toEqual([]);
    expect(migrateVaultData(empty)).toEqual(empty);
  });
});

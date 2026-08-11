import { describe, it, expect } from 'vitest';
import { layoutGalaxies, layoutNodesForGalaxy, galaxyRadius, clusterBounds } from './layout';

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// Копия формулы, которая жила в layoutGalaxies ДО появления контейнеров —
// эталон для проверки, что раскладка без кластеров не изменилась ни на бит.
function legacyLayoutGalaxies(galaxies) {
  const positions = {};
  const n = galaxies.length;
  if (n === 0) return positions;
  const radius = Math.max(70, n * 24);
  const golden = Math.PI * (3 - Math.sqrt(5));
  galaxies.forEach((g, i) => {
    if (Array.isArray(g.position) && g.position.some((v) => v !== 0)) {
      positions[g.id] = { x: g.position[0], y: g.position[1], z: g.position[2] };
      return;
    }
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    positions[g.id] = {
      x: Math.cos(theta) * r * radius,
      y: y * radius * 0.42,
      z: Math.sin(theta) * r * radius,
    };
  });
  return positions;
}

function makeGalaxies(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `g_${i}`,
    title: { ru: `Г${i}`, en: `G${i}` },
    color: '#6fd3ff',
    position: [0, 0, 0],
  }));
}

describe('layoutGalaxies: обратная совместимость без контейнеров', () => {
  it('returns {} for an empty list', () => {
    expect(layoutGalaxies([])).toEqual({});
  });

  it.each([1, 2, 3, 5, 13])('matches the pre-cluster formula exactly for n=%i galaxies', (n) => {
    const galaxies = makeGalaxies(n);
    expect(layoutGalaxies(galaxies, [])).toEqual(legacyLayoutGalaxies(galaxies));
    // Аргумент clusters вообще не передан — второй сигнатурный кейс для старых вызовов.
    expect(layoutGalaxies(galaxies)).toEqual(legacyLayoutGalaxies(galaxies));
  });

  it('tolerates galaxies that predate the clusterId field entirely (raw v1 shape)', () => {
    const galaxies = [
      { id: 'g_1', title: { ru: 'A', en: 'A' }, color: '#fff', position: [0, 0, 0] },
      { id: 'g_2', title: { ru: 'B', en: 'B' }, color: '#fff', position: [0, 0, 0] },
    ];
    expect(() => layoutGalaxies(galaxies)).not.toThrow();
    expect(layoutGalaxies(galaxies)).toEqual(legacyLayoutGalaxies(galaxies));
  });

  it('still honours a manually pinned position (g.position override)', () => {
    const galaxies = [
      { id: 'g_1', position: [111, 22, 3] },
      { id: 'g_2', position: [0, 0, 0] },
    ];
    const positions = layoutGalaxies(galaxies, []);
    expect(positions.g_1).toEqual({ x: 111, y: 22, z: 3 });
  });
});

describe('layoutGalaxies: группировка галактик внутри контейнера ("План")', () => {
  const clusters = [{ id: 'cl_1', title: { ru: 'План', en: 'Plan' }, color: '#FFD54F' }];

  function scenario() {
    const solo = makeGalaxies(3); // g_0, g_1, g_2 — без контейнера
    const members = [
      { id: 'm_0', position: [0, 0, 0], clusterId: 'cl_1' },
      { id: 'm_1', position: [0, 0, 0], clusterId: 'cl_1' },
      { id: 'm_2', position: [0, 0, 0], clusterId: 'cl_1' },
    ];
    return { galaxies: [...solo, ...members], solo, members };
  }

  it('places every galaxy, grouped and solo alike, at a distinct position', () => {
    const { galaxies } = scenario();
    const positions = layoutGalaxies(galaxies, clusters);
    galaxies.forEach((g) => expect(positions[g.id]).toBeTruthy());
    // Ни одна пара не должна оказаться в одной точке.
    const keys = Object.keys(positions);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        expect(dist(positions[keys[i]], positions[keys[j]])).toBeGreaterThan(0.01);
      }
    }
  });

  it('keeps galaxies of the same container noticeably closer to each other than to outside galaxies', () => {
    const { galaxies, solo, members } = scenario();
    const positions = layoutGalaxies(galaxies, clusters);

    const withinClusterDistances = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        withinClusterDistances.push(dist(positions[members[i].id], positions[members[j].id]));
      }
    }
    const avgWithin = withinClusterDistances.reduce((a, b) => a + b, 0) / withinClusterDistances.length;

    const crossDistances = [];
    members.forEach((m) => {
      solo.forEach((s) => {
        crossDistances.push(dist(positions[m.id], positions[s.id]));
      });
    });
    const avgCross = crossDistances.reduce((a, b) => a + b, 0) / crossDistances.length;

    // Внутри контейнера — компактная группа; расстояние до чужих галактик
    // должно быть в разы больше, иначе "План" не будет читаться как единое целое.
    expect(avgWithin).toBeLessThan(avgCross * 0.5);
  });

  it('a galaxy pointing at a non-existent clusterId is treated as ungrouped (no crash, no orphan slot)', () => {
    const galaxies = [...makeGalaxies(2), { id: 'g_ghost', position: [0, 0, 0], clusterId: 'does_not_exist' }];
    const positions = layoutGalaxies(galaxies, clusters);
    expect(positions.g_ghost).toBeTruthy();
  });

  it('an empty container (declared but with no member galaxies) does not break the layout', () => {
    const galaxies = makeGalaxies(3);
    expect(() => layoutGalaxies(galaxies, clusters)).not.toThrow();
    expect(Object.keys(layoutGalaxies(galaxies, clusters))).toHaveLength(3);
  });

  it('a manually pinned position inside a container still wins over the auto layout', () => {
    const { galaxies } = scenario();
    const galaxiesWithPin = galaxies.map((g) =>
      g.id === 'm_0' ? { ...g, position: [500, 500, 500] } : g
    );
    const positions = layoutGalaxies(galaxiesWithPin, clusters);
    expect(positions.m_0).toEqual({ x: 500, y: 500, z: 500 });
  });
});

describe('clusterBounds', () => {
  it('returns null when none of the members have a computed position', () => {
    expect(clusterBounds([{ id: 'g_missing' }], {}, {})).toBeNull();
  });

  it('computes a center roughly at the average of member positions, with a positive radius', () => {
    const members = [{ id: 'g_1' }, { id: 'g_2' }];
    const galaxyPositions = { g_1: { x: -10, y: 0, z: 0 }, g_2: { x: 10, y: 0, z: 0 } };
    const nodesByGalaxy = { g_1: [], g_2: [] };
    const bounds = clusterBounds(members, galaxyPositions, nodesByGalaxy);
    expect(bounds.center).toEqual({ x: 0, y: 0, z: 0 });
    expect(bounds.radius).toBeGreaterThan(10); // минимум расстояние до края + собственный радиус галактики
  });

  it('grows with the node count of member galaxies (bigger galaxies need more room)', () => {
    const members = [{ id: 'g_1' }];
    const galaxyPositions = { g_1: { x: 0, y: 0, z: 0 } };
    const small = clusterBounds(members, galaxyPositions, { g_1: [] });
    const big = clusterBounds(members, galaxyPositions, { g_1: Array.from({ length: 30 }, () => ({})) });
    expect(big.radius).toBeGreaterThan(small.radius);
    expect(small.radius).toBeCloseTo(galaxyRadius(0) + 12, 5);
  });
});

describe('layoutNodesForGalaxy (regression: unaffected by cluster changes)', () => {
  it('still places nodes only within their own galaxy, unchanged by clustering', () => {
    const nodes = [
      { id: 'n_1', galaxyId: 'g_1' },
      { id: 'n_2', galaxyId: 'g_2' },
    ];
    const placed = layoutNodesForGalaxy(nodes, 'g_1', { x: 0, y: 0, z: 0 });
    expect(placed).toHaveLength(1);
    expect(placed[0].node.id).toBe('n_1');
  });
});

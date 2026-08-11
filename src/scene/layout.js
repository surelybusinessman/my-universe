// Позиции галактик и звёзд не хранятся в vault — вычисляются детерминированно
// из id, чтобы карта была стабильной между перезагрузками без лишних полей в данных.

const ARMS = 2;
const SPIRAL_TURNS = 2.3;

function hash01(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Детерминированный ГПСЧ — одинаковая галактика при каждой загрузке. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Радиус диска галактики — растёт от количества звёзд, но не бесконечно. */
export function galaxyRadius(nodeCount) {
  return 9 + Math.min(nodeCount, 40) * 0.42;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Точка на сфере Фибоначчи радиуса `radius`, i-я из n — общая формула для
 *  верхнего уровня (галактики/контейнеры) и для галактик внутри контейнера. */
function fibonacciPoint(i, n, radius) {
  const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = GOLDEN_ANGLE * i;
  return {
    x: Math.cos(theta) * r * radius,
    y: y * radius * 0.42,
    z: Math.sin(theta) * r * radius,
  };
}

/** Раскладывает галактики одного контейнера маленькой сферой вокруг его центра —
 *  заметно теснее, чем расстояние между контейнерами, чтобы группа читалась
 *  как единое целое. Каждая галактика по-прежнему может быть закреплена
 *  вручную через g.position, как и на верхнем уровне. */
function layoutClusterMembers(members, center, positions) {
  const m = members.length;
  const localRadius = Math.max(16, 9 + m * 9);
  members.forEach((g, i) => {
    if (Array.isArray(g.position) && g.position.some((v) => v !== 0)) {
      positions[g.id] = { x: g.position[0], y: g.position[1], z: g.position[2] };
      return;
    }
    if (m === 1) {
      positions[g.id] = center;
      return;
    }
    const p = fibonacciPoint(i, m, localRadius);
    positions[g.id] = { x: center.x + p.x, y: center.y + p.y, z: center.z + p.z };
  });
}

/**
 * Раскладывает галактики по сфере Фибоначчи вокруг центра вселенной.
 * Галактики без контейнера (clusterId === null/не задан или ссылается на
 * несуществующий кластер) ведут себя ровно как раньше — каждая занимает свой
 * слот на общей сфере. Галактики одного контейнера делят на этой сфере ОДИН
 * общий слот и раскладываются плотной мини-сферой вокруг его центра — так
 * контейнер визуально читается как единое целое, отдельное от остальных
 * галактик, но не теряет внутреннего деления.
 *
 * Позиции по-прежнему не хранятся в vault и вычисляются только из порядка
 * элементов и их id: без контейнеров результат побайтово совпадает с
 * версией функции до появления кластеров (обратная совместимость раскладки).
 */
export function layoutGalaxies(galaxies, clusters = []) {
  const positions = {};
  if (galaxies.length === 0) return positions;

  const clusterIds = new Set(clusters.map((c) => c.id));
  const byCluster = new Map();
  const solo = [];

  galaxies.forEach((g) => {
    if (g.clusterId && clusterIds.has(g.clusterId)) {
      if (!byCluster.has(g.clusterId)) byCluster.set(g.clusterId, []);
      byCluster.get(g.clusterId).push(g);
    } else {
      solo.push(g);
    }
  });

  const slots = [
    ...solo.map((g) => ({ kind: 'galaxy', galaxy: g, weight: 1 })),
    ...[...byCluster.values()].map((members) => ({
      kind: 'cluster',
      members,
      // Контейнеру с несколькими галактиками нужно больше личного пространства
      // на общей сфере, иначе его мини-сфера налезет на соседний слот.
      weight: 1 + Math.sqrt(members.length),
    })),
  ];

  const n = slots.length;
  const totalWeight = slots.reduce((sum, slot) => sum + slot.weight, 0);
  const radius = Math.max(70, totalWeight * 24);

  slots.forEach((slot, i) => {
    const center = fibonacciPoint(i, n, radius);

    if (slot.kind === 'galaxy') {
      const g = slot.galaxy;
      if (Array.isArray(g.position) && g.position.some((v) => v !== 0)) {
        positions[g.id] = { x: g.position[0], y: g.position[1], z: g.position[2] };
      } else {
        positions[g.id] = center;
      }
      return;
    }

    layoutClusterMembers(slot.members, center, positions);
  });

  return positions;
}

/**
 * Центр и радиус контейнера по фактическим позициям его галактик и их
 * видимым размерам — единая точка правды для мягкой границы в сцене и для
 * полёта камеры к контейнеру целиком.
 */
export function clusterBounds(members, galaxyPositions, nodesByGalaxy) {
  const points = members.map((g) => galaxyPositions[g.id]).filter(Boolean);
  if (points.length === 0) return null;

  const center = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length, z: acc.z + p.z / points.length }),
    { x: 0, y: 0, z: 0 }
  );

  let radius = 0;
  members.forEach((g) => {
    const p = galaxyPositions[g.id];
    if (!p) return;
    const count = (nodesByGalaxy[g.id] ?? []).length;
    const dist = Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z) + galaxyRadius(count);
    if (dist > radius) radius = dist;
  });

  return { center, radius: radius + 12 };
}

/**
 * Раскладывает звёзды одной галактики по спиральным рукавам.
 * Каждая звезда садится на свой виток, плюс небольшой детерминированный разброс,
 * чтобы рукава не выглядели нарисованными по линейке.
 */
export function layoutNodesForGalaxy(nodes, galaxyId, center) {
  const galaxyNodes = nodes.filter((n) => n.galaxyId === galaxyId);
  const count = galaxyNodes.length;
  if (count === 0) return [];

  const radius = galaxyRadius(count);

  return galaxyNodes.map((node, i) => {
    const hx = hash01(node.id, 1);
    const hy = hash01(node.id, 2);
    const hz = hash01(node.id, 3);

    // Позиция вдоль рукава: 0 — у ядра, 1 — на краю диска.
    const t = count === 1 ? 0.45 : Math.pow(i / (count - 1), 0.85);
    const arm = i % ARMS;
    const angle =
      (arm / ARMS) * Math.PI * 2 + t * SPIRAL_TURNS * Math.PI * 2 + (hx - 0.5) * 0.45;
    const dist = 3 + t * radius;

    // Разброс растёт к краю — так галактика выглядит естественно «распушённой».
    const spread = 1.1 + t * 2.6;

    return {
      node,
      position: {
        x: center.x + Math.cos(angle) * dist + (hx - 0.5) * spread,
        y: center.y + (hy - 0.5) * spread * 0.55,
        z: center.z + Math.sin(angle) * dist + (hz - 0.5) * spread,
      },
    };
  });
}

/** Вычисляет позиции всех звёзд разом — единый источник правды для сцены, рёбер и полёта камеры. */
export function layoutAllNodes(data, galaxyPositions) {
  const list = [];
  const byId = {};
  const byGalaxy = {};
  data.galaxies.forEach((galaxy) => {
    const center = galaxyPositions[galaxy.id];
    if (!center) return;
    const placed = layoutNodesForGalaxy(data.nodes, galaxy.id, center);
    byGalaxy[galaxy.id] = placed;
    placed.forEach((p) => {
      list.push(p);
      byId[p.node.id] = p.position;
    });
  });
  return { list, byId, byGalaxy };
}

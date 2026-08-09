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

/** Раскладывает галактики по сфере Фибоначчи вокруг центра вселенной. */
export function layoutGalaxies(galaxies) {
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

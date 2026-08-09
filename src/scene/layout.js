// Позиции галактик и звёзд не хранятся в vault — вычисляются детерминированно
// из id, чтобы карта была стабильной между перезагрузками без лишних полей в данных.

function hash01(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Раскладывает галактики по сфере Фибоначчи вокруг центра вселенной. */
export function layoutGalaxies(galaxies) {
  const positions = {};
  const n = galaxies.length;
  if (n === 0) return positions;
  const radius = Math.max(40, n * 18);
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
      y: y * radius * 0.4,
      z: Math.sin(theta) * r * radius,
    };
  });
  return positions;
}

/** Раскладывает звёзды одной галактики вокруг её центра, стабильно по id узла. */
export function layoutNodesForGalaxy(nodes, galaxyId, center) {
  const galaxyNodes = nodes.filter((n) => n.galaxyId === galaxyId);
  const clusterRadius = 6 + Math.min(galaxyNodes.length, 40) * 0.15;

  return galaxyNodes.map((node) => {
    const hx = hash01(node.id, 1);
    const hy = hash01(node.id, 2);
    const hz = hash01(node.id, 3);
    const theta = hx * Math.PI * 2;
    const phi = Math.acos(2 * hy - 1);
    const r = clusterRadius * Math.cbrt(hz);
    return {
      node,
      position: {
        x: center.x + r * Math.sin(phi) * Math.cos(theta),
        y: center.y + r * Math.sin(phi) * Math.sin(theta) * 0.6,
        z: center.z + r * Math.cos(phi),
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

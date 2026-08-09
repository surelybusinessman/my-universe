// Чистые функции аналитики над данными vault — никакого состояния, только вычисления.

function nodeWeight(node) {
  return typeof node.weight === 'number' && node.weight > 0 ? node.weight : 1;
}

/** Взвешенное среднее progress по списку узлов, 0-100. */
export function weightedProgress(nodes) {
  if (nodes.length === 0) return 0;
  let sumWeighted = 0;
  let sumWeights = 0;
  nodes.forEach((n) => {
    const w = nodeWeight(n);
    sumWeighted += (n.progress ?? 0) * w;
    sumWeights += w;
  });
  return sumWeights === 0 ? 0 : Math.round(sumWeighted / sumWeights);
}

export function overallProgress(data) {
  return weightedProgress(data.nodes);
}

export function galaxyProgress(data, galaxyId) {
  return weightedProgress(data.nodes.filter((n) => n.galaxyId === galaxyId));
}

export function statusCounts(nodes) {
  const counts = { done: 0, in_progress: 0, planned: 0, abandoned: 0 };
  nodes.forEach((n) => {
    if (counts[n.status] !== undefined) counts[n.status] += 1;
  });
  return counts;
}

/** Запланировано, но ни разу не начато. */
export function gapsList(nodes) {
  return nodes.filter((n) => n.status === 'planned');
}

/** Незавершённые навыки + то, что стало доступно благодаря уже сделанному. */
export function developNextList(data) {
  const { nodes, edges } = data;
  const result = new Map();

  nodes
    .filter((n) => n.type === 'skill' && n.status !== 'done' && n.status !== 'abandoned')
    .forEach((n) => result.set(n.id, n));

  const doneIds = new Set(nodes.filter((n) => n.status === 'done').map((n) => n.id));
  edges
    .filter((e) => e.kind === 'leads_to' && doneIds.has(e.from))
    .forEach((e) => {
      const target = nodes.find((n) => n.id === e.to);
      if (target && target.status !== 'done') result.set(target.id, target);
    });

  return Array.from(result.values());
}

/** Группировка узлов по году (сперва завершение, иначе начало). */
export function timelineByYear(nodes) {
  const map = new Map();
  nodes.forEach((n) => {
    const year = (n.completedAt || n.startedAt || '').slice(0, 4);
    if (!/^\d{4}$/.test(year)) return;
    if (!map.has(year)) map.set(year, []);
    map.get(year).push(n);
  });
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

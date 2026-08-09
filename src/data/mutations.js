// Чистые функции над данными vault — каждая возвращает новый объект,
// не мутируя исходный (данные живут в React state, а не где-то ещё).

function touched(data) {
  return { ...data, updatedAt: new Date().toISOString() };
}

export function addGalaxy(data, galaxy) {
  return touched({ ...data, galaxies: [...data.galaxies, galaxy] });
}

export function updateGalaxy(data, galaxyId, patch) {
  return touched({
    ...data,
    galaxies: data.galaxies.map((g) => (g.id === galaxyId ? { ...g, ...patch } : g)),
  });
}

export function deleteGalaxy(data, galaxyId) {
  const removedNodeIds = new Set(data.nodes.filter((n) => n.galaxyId === galaxyId).map((n) => n.id));
  return touched({
    ...data,
    galaxies: data.galaxies.filter((g) => g.id !== galaxyId),
    nodes: data.nodes.filter((n) => n.galaxyId !== galaxyId),
    edges: data.edges.filter((e) => !removedNodeIds.has(e.from) && !removedNodeIds.has(e.to)),
  });
}

export function addNode(data, node) {
  return touched({ ...data, nodes: [...data.nodes, node] });
}

export function updateNode(data, nodeId, patch) {
  return touched({
    ...data,
    nodes: data.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
  });
}

export function deleteNode(data, nodeId) {
  return touched({
    ...data,
    nodes: data.nodes.filter((n) => n.id !== nodeId),
    edges: data.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
  });
}

export function addEdge(data, edge) {
  const exists = data.edges.some(
    (e) => e.from === edge.from && e.to === edge.to && e.kind === edge.kind
  );
  if (exists) return data;
  return touched({ ...data, edges: [...data.edges, edge] });
}

export function deleteEdgeAt(data, index) {
  return touched({ ...data, edges: data.edges.filter((_, i) => i !== index) });
}

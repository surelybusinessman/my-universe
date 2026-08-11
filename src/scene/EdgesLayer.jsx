import { useMemo, memo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

const CURVE_SEGMENTS = 48;

/**
 * Связи рисуются дугами, а не прямыми: прямые линии в 3D читаются как ошибка
 * рендера, а дуга сразу выглядит как траектория между двумя точками.
 */
function buildArc(a, b) {
  const start = new THREE.Vector3(a.x, a.y, a.z);
  const end = new THREE.Vector3(b.x, b.y, b.z);
  const mid = start.clone().add(end).multiplyScalar(0.5);

  // Приподнимаем середину пропорционально длине — короткие связи почти прямые,
  // длинные выгибаются заметной дугой.
  const distance = start.distanceTo(end);
  const lift = Math.min(distance * 0.22, 14);
  mid.y += lift;

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  return curve.getPoints(CURVE_SEGMENTS);
}

function EdgesLayer({ edges, nodePositionsById }) {
  const arcs = useMemo(() => {
    return edges
      .map((edge, i) => {
        const a = nodePositionsById[edge.from];
        const b = nodePositionsById[edge.to];
        if (!a || !b) return null;
        return {
          key: `${edge.from}-${edge.to}-${i}`,
          points: buildArc(a, b),
          color: edge.kind === 'requires' ? '#c9a6ff' : '#7fdcff',
        };
      })
      .filter(Boolean);
  }, [edges, nodePositionsById]);

  return (
    <group>
      {arcs.map((arc) => (
        <group key={arc.key}>
          {/* Широкая мягкая подложка даёт ощущение свечения вокруг линии */}
          <Line
            points={arc.points}
            color={arc.color}
            transparent
            opacity={0.12}
            lineWidth={4}
            depthWrite={false}
            toneMapped={false}
          />
          {/* Яркая тонкая сердцевина */}
          <Line
            points={arc.points}
            color={arc.color}
            transparent
            opacity={0.55}
            lineWidth={1.1}
            depthWrite={false}
            toneMapped={false}
          />
        </group>
      ))}
    </group>
  );
}

// edges/nodePositionsById стабильны между тиками адаптивного dpr — memo
// избавляет от пересборки дуг связей на каждый такой тик.
export default memo(EdgesLayer);

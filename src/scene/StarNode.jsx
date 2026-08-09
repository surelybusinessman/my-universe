import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const STATUS_STYLE = {
  done: { opacity: 1, pulse: true, gray: false },
  in_progress: { opacity: 0.9, pulse: false, gray: false },
  planned: { opacity: 0.3, pulse: false, gray: false },
  abandoned: { opacity: 0.22, pulse: false, gray: true },
};

export default function StarNode({ node, position, color, isFocused, onClick }) {
  const meshRef = useRef();
  const style = STATUS_STYLE[node.status] ?? STATUS_STYLE.planned;
  const baseSize = 0.32 + (node.level ?? 1) * 0.16;
  const finalColor = style.gray ? '#6b7280' : color;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (style.pulse) {
      const t = clock.getElapsedTime();
      meshRef.current.scale.setScalar(1 + Math.sin(t * 1.6 + position.x) * 0.08);
    } else {
      meshRef.current.scale.setScalar(1);
    }
  });

  const progressFraction = Math.max(0, Math.min(100, node.progress ?? 0)) / 100;

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[baseSize, 14, 14]} />
        <meshBasicMaterial color={finalColor} transparent opacity={style.opacity} />
      </mesh>

      {isFocused && (
        <mesh>
          <sphereGeometry args={[baseSize * 1.6, 14, 14]} />
          <meshBasicMaterial color={finalColor} transparent opacity={0.12} />
        </mesh>
      )}

      {node.status === 'in_progress' && progressFraction > 0 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[baseSize * 1.5, baseSize * 1.7, 32, 1, 0, Math.PI * 2 * progressFraction]}
          />
          <meshBasicMaterial color={finalColor} transparent opacity={0.9} side={2} />
        </mesh>
      )}

      {node.status === 'planned' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[baseSize * 1.5, baseSize * 1.62, 24]} />
          <meshBasicMaterial color={finalColor} transparent opacity={0.4} wireframe side={2} />
        </mesh>
      )}
    </group>
  );
}

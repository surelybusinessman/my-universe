import { Line } from '@react-three/drei';

export default function EdgesLayer({ edges, nodePositionsById }) {
  return (
    <group>
      {edges.map((edge, i) => {
        const a = nodePositionsById[edge.from];
        const b = nodePositionsById[edge.to];
        if (!a || !b) return null;
        return (
          <Line
            key={`${edge.from}-${edge.to}-${i}`}
            points={[
              [a.x, a.y, a.z],
              [b.x, b.y, b.z],
            ]}
            color={edge.kind === 'requires' ? '#b98bff' : '#6fd3ff'}
            transparent
            opacity={0.3}
            lineWidth={1}
          />
        );
      })}
    </group>
  );
}

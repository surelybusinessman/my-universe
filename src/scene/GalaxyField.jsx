import { Html } from '@react-three/drei';
import StarNode from './StarNode';
import { pickLang } from '../i18n/pickLang';

export default function GalaxyField({ data, lang, galaxyPositions, nodesByGalaxy, focus, onGalaxyClick, onNodeClick }) {
  return (
    <group>
      {data.galaxies.map((galaxy) => {
        const center = galaxyPositions[galaxy.id];
        if (!center) return null;
        const placedNodes = nodesByGalaxy[galaxy.id] ?? [];
        const showLabel = focus.level === 'universe';

        return (
          <group key={galaxy.id}>
            {showLabel && (
              <Html position={[center.x, center.y + 7, center.z]} center distanceFactor={45} zIndexRange={[0, 0]}>
                <button
                  type="button"
                  className="mu-galaxy-label"
                  style={{ '--mu-galaxy-color': galaxy.color }}
                  onClick={() => onGalaxyClick(galaxy.id)}
                >
                  {pickLang(galaxy.title, lang)}
                </button>
              </Html>
            )}

            <mesh position={[center.x, center.y, center.z]} onClick={() => onGalaxyClick(galaxy.id)}>
              <sphereGeometry args={[1.4, 16, 16]} />
              <meshBasicMaterial
                color={galaxy.color}
                transparent
                opacity={focus.level === 'universe' ? 0.85 : 0.12}
              />
            </mesh>

            {placedNodes.map(({ node, position }) => (
              <StarNode
                key={node.id}
                node={node}
                position={position}
                color={galaxy.color}
                isFocused={focus.nodeId === node.id}
                onClick={() => onNodeClick(node, position)}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

import { Html } from '@react-three/drei';
import Galaxy from './Galaxy';
import StarNode from './StarNode';
import { galaxyRadius } from './layout';
import { pickLang } from '../i18n/pickLang';

export default function GalaxyField({
  data,
  lang,
  galaxyPositions,
  nodesByGalaxy,
  focus,
  onGalaxyClick,
  onNodeClick,
}) {
  return (
    <group>
      {data.galaxies.map((galaxy) => {
        const center = galaxyPositions[galaxy.id];
        if (!center) return null;

        const placedNodes = nodesByGalaxy[galaxy.id] ?? [];
        const atUniverse = focus.level === 'universe';
        // В режиме галактики остальные приглушаются — фокус на выбранной.
        const isOther = !atUniverse && focus.galaxyId !== galaxy.id;

        return (
          <group key={galaxy.id}>
            <Galaxy
              galaxy={galaxy}
              center={center}
              nodeCount={placedNodes.length}
              dimmed={isOther}
              onClick={(e) => {
                e.stopPropagation();
                onGalaxyClick(galaxy.id);
              }}
            />

            {atUniverse && (
              // Без distanceFactor подпись держит постоянный размер на экране —
              // на карте название галактики должно читаться с любого расстояния.
              <Html
                position={[center.x, center.y + galaxyRadius(placedNodes.length) * 1.15, center.z]}
                center
                zIndexRange={[0, 0]}
                style={{ pointerEvents: 'auto' }}
              >
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

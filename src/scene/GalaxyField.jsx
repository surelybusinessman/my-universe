import { memo } from 'react';
import Galaxy from './Galaxy';
import StarNode from './StarNode';
import SceneLabel from './SceneLabel';
import { galaxyRadius } from './layout';
import { pickLang } from '../i18n/pickLang';

function GalaxyField({
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
        // Если мы зашли внутрь контейнера ("План"), все его галактики остаются
        // яркими — приглушается только всё, что снаружи текущего контейнера.
        const inFocusedCluster =
          focus.level === 'cluster' && Boolean(focus.clusterId) && galaxy.clusterId === focus.clusterId;
        // В режиме галактики остальные приглушаются — фокус на выбранной.
        const isOther = !atUniverse && !inFocusedCluster && focus.galaxyId !== galaxy.id;
        // Своя подпись у галактики в контейнере — только когда мы уже внутри
        // этого контейнера (снаружи контейнер представлен одной общей подписью,
        // чтобы "План" читался как единое целое, а не россыпь одинаковых имён).
        const showLabel = galaxy.clusterId ? inFocusedCluster : atUniverse;

        return (
          <group key={galaxy.id}>
            <Galaxy
              galaxy={galaxy}
              center={center}
              nodeCount={placedNodes.length}
              dimmed={isOther}
              // Внутри самой галактики её область клика не нужна и мешает —
              // там кликают по звёздам, а не по галактике целиком.
              pickable={focus.galaxyId !== galaxy.id}
              onClick={(e) => {
                e.stopPropagation();
                onGalaxyClick(galaxy.id);
              }}
            />

            {showLabel && (
              // Без distanceFactor подпись держит постоянный размер на экране —
              // на карте название галактики должно читаться с любого расстояния.
              <SceneLabel
                position={[center.x, center.y + galaxyRadius(placedNodes.length) * 1.15, center.z]}
              >
                <button
                  type="button"
                  className="mu-galaxy-label"
                  style={{ '--mu-galaxy-color': galaxy.color }}
                  onClick={() => onGalaxyClick(galaxy.id)}
                >
                  {pickLang(galaxy.title, lang)}
                </button>
              </SceneLabel>
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

// Пропсы стабильны между тиками адаптивного dpr (см. UniverseScene) — без memo
// каждый такой тик заново рендерил бы все 66+ StarNode, хотя ни данные, ни
// раскладка, ни фокус не менялись.
export default memo(GalaxyField);

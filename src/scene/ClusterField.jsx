import { useMemo } from 'react';
import * as THREE from 'three';
import { getGlowTexture } from './textures';
import { clusterBounds } from './layout';
import SceneLabel from './SceneLabel';
import { pickLang } from '../i18n/pickLang';

// Мягкая граница контейнера — тот же приём, что и ядро галактики (сфера-спрайт
// с радиальным градиентом на аддитивном блендинге), но очень разрежённая и
// крупная, чтобы читаться как область пространства, а не как объект.
function ClusterHalo({ color, radius, dimmed }) {
  const glowTexture = useMemo(() => getGlowTexture(), []);
  return (
    <sprite scale={radius * 2.5}>
      <spriteMaterial
        map={glowTexture}
        color={color}
        transparent
        opacity={dimmed ? 0.035 : 0.075}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

/**
 * Рисует контейнеры ("Планы") поверх обычных галактик: мягкий общий ореол
 * вокруг всех галактик контейнера плюс единая подпись, видимая только
 * снаружи (пока мы не зашли внутрь конкретной галактики контейнера).
 * Один компонент на весь список — контейнеров всегда мало (единицы), так что
 * это не создаёт заметной дополнительной нагрузки даже на телефоне.
 */
export default function ClusterField({ data, lang, galaxyPositions, nodesByGalaxy, focus, onClusterClick }) {
  const membersByCluster = useMemo(() => {
    const map = new Map();
    data.galaxies.forEach((g) => {
      if (!g.clusterId) return;
      if (!map.has(g.clusterId)) map.set(g.clusterId, []);
      map.get(g.clusterId).push(g);
    });
    return map;
  }, [data.galaxies]);

  // Вне режима "вселенная целиком" и "внутри контейнера" ореолы только мешают —
  // при рассматривании одной галактики или звезды фокус должен быть на них.
  const visible = focus.level === 'universe' || focus.level === 'cluster';
  if (!visible) return null;

  return (
    <group>
      {data.clusters.map((cluster) => {
        const members = membersByCluster.get(cluster.id) ?? [];
        if (members.length === 0) return null; // контейнер создан, но пуст — рисовать нечего

        const bounds = clusterBounds(members, galaxyPositions, nodesByGalaxy);
        if (!bounds) return null;

        const dimmed = focus.level === 'cluster' && focus.clusterId !== cluster.id;

        return (
          <group key={cluster.id}>
            <group position={[bounds.center.x, bounds.center.y, bounds.center.z]}>
              <ClusterHalo color={cluster.color} radius={bounds.radius} dimmed={dimmed} />
            </group>

            {focus.level === 'universe' && (
              // Общая подпись контейнера видна только снаружи — как только мы
              // внутри, каждая галактика уже подписана сама (см. GalaxyField).
              // Позиция абсолютная, а не относительно группы: SceneLabel сам
              // проецирует точку камерой, чтобы прятать подпись за спиной.
              <SceneLabel
                position={[
                  bounds.center.x,
                  bounds.center.y + bounds.radius * 1.1,
                  bounds.center.z,
                ]}
              >
                <button
                  type="button"
                  className="mu-cluster-label"
                  style={{ '--mu-cluster-color': cluster.color }}
                  onClick={() => onClusterClick(cluster.id)}
                >
                  {pickLang(cluster.title, lang)}
                </button>
              </SceneLabel>
            )}
          </group>
        );
      })}
    </group>
  );
}

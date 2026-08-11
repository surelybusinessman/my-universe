import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Stars, Sparkles, Preload, PerformanceMonitor } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import GalaxyField from './GalaxyField';
import ClusterField from './ClusterField';
import EdgesLayer from './EdgesLayer';
import { layoutGalaxies, layoutAllNodes, galaxyRadius, clusterBounds } from './layout';
import SceneHUD from '../ui/SceneHUD';
import { makeId } from '../data/schema';
import {
  addCluster,
  updateCluster,
  deleteCluster,
  addGalaxy,
  updateGalaxy,
  deleteGalaxy,
  addNode,
  updateNode,
  deleteNode,
  addEdge,
  deleteEdgeAt,
} from '../data/mutations';
import './UniverseScene.css';


export default function UniverseScene({
  data,
  lang,
  onLockNow,
  onUpdateData,
  onExportBackup,
  lastBackupAt,
  autoBackupOn,
  onSetupAutoBackup,
}) {
  const controlsRef = useRef();
  // level: 'universe' | 'cluster' | 'galaxy' | 'star'. clusterId хранится и на
  // уровне 'galaxy'/'star', если эта галактика внутри контейнера — иначе
  // "Назад" не знал бы, что нужно вернуться не сразу во вселенную, а в контейнер.
  const [focus, setFocus] = useState({ level: 'universe', clusterId: null, galaxyId: null, nodeId: null });
  // Телефоны часто имеют devicePixelRatio 2-3: без потолка это втрое больше
  // пикселей на кадр при заведомо более слабом GPU, чем у настольной машины.
  const [isMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  // Плотность пикселей подстраивается под реальную частоту кадров: на мощной
  // машине картинка рендерится в 4K, на слабой — мягко опускается вместо рывков.
  const [dpr, setDpr] = useState(() => {
    const base = Math.min(1.5, window.devicePixelRatio || 1);
    return isMobile ? Math.min(1.25, base) : base;
  });

  const galaxyPositions = useMemo(
    () => layoutGalaxies(data.galaxies, data.clusters),
    [data.galaxies, data.clusters]
  );
  const { byId: nodePositionsById, byGalaxy: nodesByGalaxy } = useMemo(
    () => layoutAllNodes(data, galaxyPositions),
    [data, galaxyPositions]
  );

  const focusedNode = useMemo(
    () => (focus.nodeId ? data.nodes.find((n) => n.id === focus.nodeId) ?? null : null),
    [data.nodes, focus.nodeId]
  );
  const currentGalaxy = focus.galaxyId ? data.galaxies.find((g) => g.id === focus.galaxyId) : null;
  const currentCluster = focus.clusterId ? data.clusters.find((c) => c.id === focus.clusterId) : null;

  const universeDistance = useMemo(
    () => Math.max(70, data.galaxies.length * 24) * 1.25 + 60,
    [data.galaxies.length]
  );

  const flyToUniverse = useCallback(() => {
    controlsRef.current?.setLookAt(
      0,
      universeDistance * 0.32,
      universeDistance,
      0,
      0,
      0,
      true
    );
    setFocus({ level: 'universe', clusterId: null, galaxyId: null, nodeId: null });
  }, [universeDistance]);

  const flyToCluster = useCallback(
    (clusterId) => {
      const members = data.galaxies.filter((g) => g.clusterId === clusterId);
      const bounds = clusterBounds(members, galaxyPositions, nodesByGalaxy);
      if (!bounds) {
        flyToUniverse();
        return;
      }
      const r = bounds.radius;
      controlsRef.current?.setLookAt(
        bounds.center.x + r * 1.4,
        bounds.center.y + r * 0.9,
        bounds.center.z + r * 1.4,
        bounds.center.x,
        bounds.center.y,
        bounds.center.z,
        true
      );
      setFocus({ level: 'cluster', clusterId, galaxyId: null, nodeId: null });
    },
    [data.galaxies, galaxyPositions, nodesByGalaxy, flyToUniverse]
  );

  const flyToGalaxy = useCallback(
    (galaxyId) => {
      const pos = galaxyPositions[galaxyId];
      if (!pos) {
        flyToUniverse();
        return;
      }
      // Отлетаем от галактики на расстояние, пропорциональное её размеру,
      // и смотрим слегка сверху — так спираль читается лучше всего.
      const count = (nodesByGalaxy[galaxyId] ?? []).length;
      const r = galaxyRadius(count);
      controlsRef.current?.setLookAt(
        pos.x + r * 1.5,
        pos.y + r * 1.05,
        pos.z + r * 1.5,
        pos.x,
        pos.y,
        pos.z,
        true
      );
      const galaxy = data.galaxies.find((g) => g.id === galaxyId);
      setFocus({ level: 'galaxy', clusterId: galaxy?.clusterId ?? null, galaxyId, nodeId: null });
    },
    [data.galaxies, galaxyPositions, nodesByGalaxy, flyToUniverse]
  );

  const flyToNode = useCallback(
    (node, position) => {
      controlsRef.current?.setLookAt(
        position.x + 4.2,
        position.y + 2.4,
        position.z + 5.4,
        position.x,
        position.y,
        position.z,
        true
      );
      const galaxy = data.galaxies.find((g) => g.id === node.galaxyId);
      setFocus((f) => ({
        level: 'star',
        clusterId: galaxy?.clusterId ?? f.clusterId ?? null,
        galaxyId: f.galaxyId ?? node.galaxyId,
        nodeId: node.id,
      }));
    },
    [data.galaxies]
  );

  const handleBack = useCallback(() => {
    if (focus.level === 'star') {
      flyToGalaxy(focus.galaxyId);
    } else if (focus.level === 'galaxy') {
      if (focus.clusterId) flyToCluster(focus.clusterId);
      else flyToUniverse();
    } else if (focus.level === 'cluster') {
      flyToUniverse();
    }
  }, [focus, flyToGalaxy, flyToCluster, flyToUniverse]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBack]);

  // CameraControls при монтировании берёт камеру под свой контроль, поэтому
  // стартовый кадр выставляем через них же, как только ref заполнен.
  // CameraControls монтируется внутри Canvas асинхронно, поэтому ref может быть
  // ещё пустым на первом кадре — ждём его появления и только тогда ставим кадр.
  useEffect(() => {
    let raf;
    const apply = () => {
      if (controlsRef.current) {
        controlsRef.current.setLookAt(
          0,
          universeDistance * 0.32,
          universeDistance,
          0,
          0,
          0,
          false
        );
        return;
      }
      raf = requestAnimationFrame(apply);
    };
    apply();
    return () => cancelAnimationFrame(raf);
  }, [universeDistance]);

  const handleSearchSelect = useCallback(
    (node) => {
      const pos = nodePositionsById[node.id];
      if (pos) flyToNode(node, pos);
    },
    [nodePositionsById, flyToNode]
  );

  // --- Мутации данных: каждая строит новый снимок и тут же отправляет его на сохранение ---

  const handleCreateCluster = useCallback(
    (clusterPatch) => {
      const cluster = { id: makeId('cl'), ...clusterPatch };
      onUpdateData(addCluster(data, cluster));
    },
    [data, onUpdateData]
  );

  const handleUpdateCluster = useCallback(
    (clusterId, patch) => {
      onUpdateData(updateCluster(data, clusterId, patch));
    },
    [data, onUpdateData]
  );

  const handleDeleteCluster = useCallback(
    (clusterId) => {
      onUpdateData(deleteCluster(data, clusterId));
      flyToUniverse();
    },
    [data, onUpdateData, flyToUniverse]
  );

  const handleCreateGalaxy = useCallback(
    (galaxyPatch) => {
      const galaxy = { id: makeId('g'), position: [0, 0, 0], clusterId: null, ...galaxyPatch };
      onUpdateData(addGalaxy(data, galaxy));
    },
    [data, onUpdateData]
  );

  const handleUpdateGalaxy = useCallback(
    (galaxyId, patch) => {
      onUpdateData(updateGalaxy(data, galaxyId, patch));
    },
    [data, onUpdateData]
  );

  const handleDeleteGalaxy = useCallback(
    (galaxyId) => {
      onUpdateData(deleteGalaxy(data, galaxyId));
      flyToUniverse();
    },
    [data, onUpdateData, flyToUniverse]
  );

  const handleCreateNode = useCallback(
    (nodePatch) => {
      if (!focus.galaxyId) return;
      const node = {
        id: makeId('n'),
        galaxyId: focus.galaxyId,
        weight: 1,
        source: 'manual',
        ...nodePatch,
      };
      onUpdateData(addNode(data, node));
    },
    [data, focus.galaxyId, onUpdateData]
  );

  const handleUpdateNode = useCallback(
    (nodeId, patch) => {
      onUpdateData(updateNode(data, nodeId, patch));
    },
    [data, onUpdateData]
  );

  const handleDeleteNode = useCallback(
    (nodeId) => {
      onUpdateData(deleteNode(data, nodeId));
      flyToGalaxy(focus.galaxyId);
    },
    [data, focus.galaxyId, onUpdateData, flyToGalaxy]
  );

  const handleAddEdge = useCallback(
    (edge) => {
      onUpdateData(addEdge(data, edge));
    },
    [data, onUpdateData]
  );

  const handleDeleteEdge = useCallback(
    (index) => {
      onUpdateData(deleteEdgeAt(data, index));
    },
    [data, onUpdateData]
  );

  return (
    <div className="mu-universe-wrap">
      <Canvas
        dpr={dpr}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        }}
        onCreated={({ gl }) => {
          // ACES даёт кинематографичную передачу ярких участков: свечение звёзд
          // не выгорает в плоское белое пятно, а сохраняет цвет.
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        camera={{ position: [0, 140, 430], fov: 55, near: 0.5, far: 8000 }}
      >
        {/* Разрешение подбирается шагами, а не рывком: при стабильно высоком fps
            картинка становится чётче, при просадке мягко отступает. flipflops
            не даёт зациклиться на границе, onFallback — аварийный минимум. */}
        <PerformanceMonitor
          bounds={() => [55, 95]}
          flipflops={3}
          onIncline={() => setDpr((d) => Math.min(isMobile ? 1.5 : 2.5, +(d + 0.25).toFixed(2)))}
          onDecline={() => setDpr((d) => Math.max(1, +(d - 0.25).toFixed(2)))}
          onFallback={() => setDpr(1)}
        />

        <color attach="background" args={['#02030a']} />
        <ambientLight intensity={0.6} />

        <Stars radius={1200} depth={420} count={6000} factor={7} saturation={0} fade speed={0.3} />
        <Sparkles count={160} scale={700} size={3.6} speed={0.12} color="#9fd8ff" opacity={0.18} />

        {/* Рисуется до GalaxyField — ореол контейнера фон, галактики и звёзды поверх него. */}
        <ClusterField
          data={data}
          lang={lang}
          galaxyPositions={galaxyPositions}
          nodesByGalaxy={nodesByGalaxy}
          focus={focus}
          onClusterClick={flyToCluster}
        />
        <GalaxyField
          data={data}
          lang={lang}
          galaxyPositions={galaxyPositions}
          nodesByGalaxy={nodesByGalaxy}
          focus={focus}
          onGalaxyClick={flyToGalaxy}
          onNodeClick={flyToNode}
        />
        <EdgesLayer edges={data.edges} nodePositionsById={nodePositionsById} />

        <CameraControls
          ref={controlsRef}
          minDistance={2.5}
          maxDistance={1600}
          smoothTime={0.6}
          draggingSmoothTime={0.18}
        />

        {/* MSAA поверх bloom почти не даёт разницы, но стоит целого прохода
            по буферу — сглаживание берут на себя свечение и высокий dpr.
            На телефоне убираем хроматическую аберрацию и зерно — это чисто
            декоративные проходы, а GPU там обычно заметно слабее. */}
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            intensity={0.95}
            luminanceThreshold={0.22}
            luminanceSmoothing={0.7}
            mipmapBlur
            radius={0.78}
          />
          {!isMobile && (
            // Лёгкая хроматическая аберрация по краям — «стекло объектива»
            <ChromaticAberration
              offset={[0.0005, 0.0007]}
              blendFunction={BlendFunction.NORMAL}
              radialModulation
              modulationOffset={0.45}
            />
          )}
          <Vignette offset={0.22} darkness={0.72} blendFunction={BlendFunction.NORMAL} />
          {!isMobile && (
            // Едва заметное зерно убирает полосы на тёмных градиентах космоса
            <Noise opacity={0.025} blendFunction={BlendFunction.OVERLAY} />
          )}
        </EffectComposer>

        <Preload all />
      </Canvas>

      <SceneHUD
        data={data}
        lang={lang}
        focus={focus}
        currentCluster={currentCluster}
        currentGalaxy={currentGalaxy}
        focusedNode={focusedNode}
        onBack={handleBack}
        onHome={flyToUniverse}
        onGoToCluster={flyToCluster}
        onSearchSelect={handleSearchSelect}
        onLockNow={onLockNow}
        onCreateCluster={handleCreateCluster}
        onUpdateCluster={handleUpdateCluster}
        onDeleteCluster={handleDeleteCluster}
        onCreateGalaxy={handleCreateGalaxy}
        onUpdateGalaxy={handleUpdateGalaxy}
        onDeleteGalaxy={handleDeleteGalaxy}
        onCreateNode={handleCreateNode}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        onAddEdge={handleAddEdge}
        onDeleteEdge={handleDeleteEdge}
        onImportData={onUpdateData}
        onExportBackup={onExportBackup}
        lastBackupAt={lastBackupAt}
        autoBackupOn={autoBackupOn}
        onSetupAutoBackup={onSetupAutoBackup}
      />
    </div>
  );
}

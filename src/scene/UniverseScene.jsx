import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import GalaxyField from './GalaxyField';
import EdgesLayer from './EdgesLayer';
import { layoutGalaxies, layoutAllNodes } from './layout';
import SceneHUD from '../ui/SceneHUD';
import { makeId } from '../data/schema';
import {
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

const UNIVERSE_VIEW = { px: 0, py: 45, pz: 150, tx: 0, ty: 0, tz: 0 };

export default function UniverseScene({ data, lang, onLockNow, onUpdateData }) {
  const controlsRef = useRef();
  const [focus, setFocus] = useState({ level: 'universe', galaxyId: null, nodeId: null });

  const galaxyPositions = useMemo(() => layoutGalaxies(data.galaxies), [data.galaxies]);
  const { byId: nodePositionsById, byGalaxy: nodesByGalaxy } = useMemo(
    () => layoutAllNodes(data, galaxyPositions),
    [data, galaxyPositions]
  );

  const focusedNode = useMemo(
    () => (focus.nodeId ? data.nodes.find((n) => n.id === focus.nodeId) ?? null : null),
    [data.nodes, focus.nodeId]
  );
  const currentGalaxy = focus.galaxyId ? data.galaxies.find((g) => g.id === focus.galaxyId) : null;

  const flyToUniverse = useCallback(() => {
    controlsRef.current?.setLookAt(
      UNIVERSE_VIEW.px,
      UNIVERSE_VIEW.py,
      UNIVERSE_VIEW.pz,
      UNIVERSE_VIEW.tx,
      UNIVERSE_VIEW.ty,
      UNIVERSE_VIEW.tz,
      true
    );
    setFocus({ level: 'universe', galaxyId: null, nodeId: null });
  }, []);

  const flyToGalaxy = useCallback(
    (galaxyId) => {
      const pos = galaxyPositions[galaxyId];
      if (!pos) {
        flyToUniverse();
        return;
      }
      controlsRef.current?.setLookAt(
        pos.x + 20,
        pos.y + 12,
        pos.z + 20,
        pos.x,
        pos.y,
        pos.z,
        true
      );
      setFocus({ level: 'galaxy', galaxyId, nodeId: null });
    },
    [galaxyPositions, flyToUniverse]
  );

  const flyToNode = useCallback((node, position) => {
    controlsRef.current?.setLookAt(
      position.x + 3.5,
      position.y + 2,
      position.z + 4.5,
      position.x,
      position.y,
      position.z,
      true
    );
    setFocus((f) => ({ level: 'star', galaxyId: f.galaxyId ?? node.galaxyId, nodeId: node.id }));
  }, []);

  const handleBack = useCallback(() => {
    if (focus.level === 'star') {
      flyToGalaxy(focus.galaxyId);
    } else if (focus.level === 'galaxy') {
      flyToUniverse();
    }
  }, [focus, flyToGalaxy, flyToUniverse]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBack]);

  const handleSearchSelect = useCallback(
    (node) => {
      const pos = nodePositionsById[node.id];
      if (pos) flyToNode(node, pos);
    },
    [nodePositionsById, flyToNode]
  );

  // --- Мутации данных: каждая строит новый снимок и тут же отправляет его на сохранение ---

  const handleCreateGalaxy = useCallback(
    (galaxyPatch) => {
      const galaxy = { id: makeId('g'), position: [0, 0, 0], ...galaxyPatch };
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
      <Canvas camera={{ position: [UNIVERSE_VIEW.px, UNIVERSE_VIEW.py, UNIVERSE_VIEW.pz], fov: 50, near: 0.1, far: 3000 }}>
        <color attach="background" args={['#03040a']} />
        <ambientLight intensity={0.5} />
        <Stars radius={320} depth={90} count={4500} factor={4} saturation={0} fade speed={0.35} />
        <Sparkles count={200} scale={220} size={2.2} speed={0.15} color="#6fd3ff" opacity={0.12} />

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

        <CameraControls ref={controlsRef} minDistance={2.5} maxDistance={280} smoothTime={0.55} />

        <EffectComposer multisampling={4}>
          <Bloom intensity={0.85} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </Canvas>

      <SceneHUD
        data={data}
        lang={lang}
        focus={focus}
        currentGalaxy={currentGalaxy}
        focusedNode={focusedNode}
        onBack={handleBack}
        onHome={flyToUniverse}
        onSearchSelect={handleSearchSelect}
        onLockNow={onLockNow}
        onCreateGalaxy={handleCreateGalaxy}
        onUpdateGalaxy={handleUpdateGalaxy}
        onDeleteGalaxy={handleDeleteGalaxy}
        onCreateNode={handleCreateNode}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        onAddEdge={handleAddEdge}
        onDeleteEdge={handleDeleteEdge}
        onImportData={onUpdateData}
      />
    </div>
  );
}

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlowTexture, getNebulaTexture, getDustTexture } from './textures';
import { mulberry32, seedFromId, galaxyRadius } from './layout';

const DUST_COUNT = 850;
const ARMS = 2;
const SPIRAL_TURNS = 2.3;

/**
 * Фоновая пыль галактики — те же спиральные рукава, что и у настоящих звёзд,
 * но тысячи мелких точек. Именно они превращают горстку узлов в галактику.
 */
function GalaxyDust({ color, radius, seed }) {
  const pointsRef = useRef();
  const dustTexture = useMemo(() => getDustTexture(), []);

  const { positions, colors, sizes } = useMemo(() => {
    const rng = mulberry32(seed);
    const pos = new Float32Array(DUST_COUNT * 3);
    const col = new Float32Array(DUST_COUNT * 3);
    const siz = new Float32Array(DUST_COUNT);

    const base = new THREE.Color(color);
    const hot = base.clone().lerp(new THREE.Color('#ffffff'), 0.75);
    const cold = base.clone().multiplyScalar(0.55);
    const tmp = new THREE.Color();

    for (let i = 0; i < DUST_COUNT; i++) {
      // Ядро плотнее краёв — отсюда степень меньше единицы.
      const t = Math.pow(rng(), 0.55);
      const arm = i % ARMS;
      const armJitter = (rng() - 0.5) * 0.55 * (0.35 + t);
      const angle = (arm / ARMS) * Math.PI * 2 + t * SPIRAL_TURNS * Math.PI * 2 + armJitter;
      const dist = 1.2 + t * radius;

      const spread = 0.9 + t * 3.2;
      pos[i * 3] = Math.cos(angle) * dist + (rng() - 0.5) * spread;
      pos[i * 3 + 1] = (rng() - 0.5) * spread * 0.42;
      pos[i * 3 + 2] = Math.sin(angle) * dist + (rng() - 0.5) * spread;

      // Ближе к ядру — горячее и белее, к краю — холоднее и темнее.
      tmp.copy(hot).lerp(cold, Math.min(1, t * 1.15));
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;

      siz[i] = 0.12 + rng() * rng() * 0.5;
    }
    return { positions: pos, colors: col, sizes: siz };
  }, [color, radius, seed]);

  useFrame((_, delta) => {
    // Очень медленное вращение — галактика ощущается живой, но не крутится волчком.
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.012;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        map={dustTexture}
        vertexColors
        size={0.42}
        sizeAttenuation
        transparent
        opacity={0.75}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

/** Слоистая туманность — несколько развёрнутых полотен создают объём. */
function Nebula({ color, radius, seed }) {
  const nebulaTexture = useMemo(() => getNebulaTexture(), []);
  const groupRef = useRef();

  const layers = useMemo(() => {
    const rng = mulberry32(seed + 7919);
    return Array.from({ length: 3 }, () => ({
      scale: radius * (1.9 + rng() * 1.5),
      rotation: rng() * Math.PI * 2,
      offset: [(rng() - 0.5) * radius * 0.5, (rng() - 0.5) * radius * 0.2, (rng() - 0.5) * radius * 0.5],
      opacity: 0.03 + rng() * 0.045,
    }));
  }, [radius, seed]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.006;
  });

  return (
    <group ref={groupRef}>
      {layers.map((layer, i) => (
        <sprite key={i} position={layer.offset} scale={layer.scale}>
          <spriteMaterial
            map={nebulaTexture}
            color={color}
            transparent
            opacity={layer.opacity}
            rotation={layer.rotation}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Ядро галактики — яркий центр, видимый с любого расстояния. */
function GalaxyCore({ color, radius, dimmed }) {
  const glowTexture = useMemo(() => getGlowTexture(), []);
  const coreColor = useMemo(
    () => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(1.5),
    [color]
  );

  return (
    <group>
      <sprite scale={radius * 1.5}>
        <spriteMaterial
          map={glowTexture}
          color={color}
          transparent
          opacity={dimmed ? 0.1 : 0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite scale={radius * 0.55}>
        <spriteMaterial
          map={glowTexture}
          color={coreColor}
          transparent
          opacity={dimmed ? 0.18 : 0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

export default function Galaxy({ galaxy, center, nodeCount, dimmed, onClick }) {
  const seed = useMemo(() => seedFromId(galaxy.id), [galaxy.id]);
  const radius = useMemo(() => galaxyRadius(nodeCount), [nodeCount]);

  return (
    <group position={[center.x, center.y, center.z]}>
      <Nebula color={galaxy.color} radius={radius} seed={seed} />
      <GalaxyDust color={galaxy.color} radius={radius} seed={seed} />
      <GalaxyCore color={galaxy.color} radius={radius} dimmed={dimmed} />

      {/* Невидимая сфера для клика по галактике целиком */}
      <mesh onClick={onClick} visible={false}>
        <sphereGeometry args={[radius * 0.5, 8, 8]} />
      </mesh>
    </group>
  );
}

import { useMemo, useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlowTexture, getNebulaTexture, getDustTexture } from './textures';
import { mulberry32, seedFromId, galaxyRadius } from './layout';
import { dampOpacity } from './dimSmoothing';

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

// Целевая непрозрачность ядра галактики в приглушённом и обычном состоянии.
// Внутреннее ядро замешано на 55% в белый и ещё умножено на 1.5 — оно
// специально overdriven, чтобы после bloom читаться как раскалённый центр.
const CORE_OUTER_OPACITY = { dimmed: 0.1, normal: 0.28 };
const CORE_INNER_OPACITY = { dimmed: 0.18, normal: 0.6 };

/** Ядро галактики — яркий центр, видимый с любого расстояния. */
function GalaxyCore({ color, radius, dimmed }) {
  const glowTexture = useMemo(() => getGlowTexture(), []);
  const coreColor = useMemo(
    () => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(1.5),
    [color]
  );
  const outerMatRef = useRef();
  const innerMatRef = useRef();

  // Почему плавно, а не мгновенной подменой opacity — см. dimSmoothing.js:
  // это овердрайвенный почти-белый спрайт, и мгновенный скачок его яркости
  // ровно в момент смены уровня фокуса — источник "белой вспышки".
  useFrame((_, delta) => {
    const outerTarget = dimmed ? CORE_OUTER_OPACITY.dimmed : CORE_OUTER_OPACITY.normal;
    const innerTarget = dimmed ? CORE_INNER_OPACITY.dimmed : CORE_INNER_OPACITY.normal;
    if (outerMatRef.current) {
      outerMatRef.current.opacity = dampOpacity(outerMatRef.current.opacity, outerTarget, delta);
    }
    if (innerMatRef.current) {
      innerMatRef.current.opacity = dampOpacity(innerMatRef.current.opacity, innerTarget, delta);
    }
  });

  return (
    <group>
      <sprite scale={radius * 1.5}>
        <spriteMaterial
          ref={outerMatRef}
          map={glowTexture}
          color={color}
          transparent
          opacity={dimmed ? CORE_OUTER_OPACITY.dimmed : CORE_OUTER_OPACITY.normal}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite scale={radius * 0.55}>
        <spriteMaterial
          ref={innerMatRef}
          map={glowTexture}
          color={coreColor}
          transparent
          opacity={dimmed ? CORE_INNER_OPACITY.dimmed : CORE_INNER_OPACITY.normal}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

function Galaxy({ galaxy, center, nodeCount, dimmed, pickable = true, onClick }) {
  const seed = useMemo(() => seedFromId(galaxy.id), [galaxy.id]);
  const radius = useMemo(() => galaxyRadius(nodeCount), [nodeCount]);

  return (
    <group position={[center.x, center.y, center.z]}>
      <Nebula color={galaxy.color} radius={radius} seed={seed} />
      <GalaxyDust color={galaxy.color} radius={radius} seed={seed} />
      <GalaxyCore color={galaxy.color} radius={radius} dimmed={dimmed} />

      {/* Невидимая сфера для клика по галактике целиком. Радиус подобран под
          видимое свечение (ядро рисуется спрайтом radius * 1.5): при меньшей
          сфере попасть по галактике с общего вида почти невозможно — она
          занимает считанные пиксели, и промах читается как "не нажимается".
          Особенно это било по галактикам внутри контейнера: у них снаружи нет
          подписи, и клик по телу — единственный способ войти.

          Сфера охватывает и сами звёзды, поэтому у галактики, внутри которой мы
          сейчас находимся, её не рисуем вовсе — иначе она перехватывала бы
          клики по звёздам, оказываясь ближе к камере. */}
      {pickable && (
        <mesh onClick={onClick} visible={false}>
          <sphereGeometry args={[radius * 1.2, 12, 12]} />
        </mesh>
      )}
    </group>
  );
}

// dpr — отдельное React-состояние в UniverseScene (адаптивный рендер по fps) и
// меняется независимо от данных сцены; без memo каждый его тик перерисовывал бы
// все галактики заново, хотя их собственные пропсы (galaxy/center/dimmed/...)
// не менялись.
export default memo(Galaxy);

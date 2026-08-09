import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlowTexture, getStarburstTexture } from './textures';

// Визуальный язык статусов: яркость и «живость» звезды сразу говорят,
// на каком этапе дело, ещё до открытия панели.
const STATUS_STYLE = {
  done: { core: 1.0, glow: 1.0, burst: 1.0, twinkle: 1.0, gray: false },
  in_progress: { core: 0.92, glow: 0.72, burst: 0.42, twinkle: 0.55, gray: false },
  planned: { core: 0.22, glow: 0.3, burst: 0.0, twinkle: 0.18, gray: false },
  abandoned: { core: 0.14, glow: 0.16, burst: 0.0, twinkle: 0.0, gray: true },
};

export default function StarNode({ node, position, color, isFocused, onClick }) {
  const groupRef = useRef();
  const coreRef = useRef();
  const glowRef = useRef();
  const burstRef = useRef();
  const coronaRef = useRef();

  const glowTexture = useMemo(() => getGlowTexture(), []);
  const burstTexture = useMemo(() => getStarburstTexture(), []);

  const style = STATUS_STYLE[node.status] ?? STATUS_STYLE.planned;
  const level = Math.max(1, Math.min(5, node.level ?? 3));
  const coreSize = 0.22 + level * 0.11;

  // Ядро светится ярче собственного цвета галактики — так оно читается
  // как раскалённая звезда, а не просто окрашенный шар.
  const { coreColor, haloColor } = useMemo(() => {
    const base = new THREE.Color(style.gray ? '#7a828f' : color);
    // Ядро светлее цвета галактики, но не уходит в чистый белый — иначе после
    // bloom все звёзды сливаются в одинаковые выгоревшие пятна без оттенка.
    const core = base.clone().lerp(new THREE.Color('#ffffff'), style.gray ? 0.1 : 0.28);
    core.multiplyScalar(style.gray ? 0.85 : 1.1);
    return { coreColor: core, haloColor: base };
  }, [color, style.gray]);

  const progressFraction = Math.max(0, Math.min(100, node.progress ?? 0)) / 100;

  // Каждая звезда мерцает в своём ритме — иначе всё поле пульсирует синхронно.
  const phase = useMemo(() => (position.x * 3.1 + position.z * 1.7) % (Math.PI * 2), [position]);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    const twinkle = 1 + Math.sin(t * 1.5 + phase) * 0.14 * style.twinkle;
    const breathe = 1 + Math.sin(t * 0.8 + phase * 1.3) * 0.07 * style.twinkle;

    if (coreRef.current) coreRef.current.scale.setScalar(twinkle);
    if (glowRef.current) glowRef.current.scale.setScalar(breathe);
    if (coronaRef.current) coronaRef.current.scale.setScalar(1 + (twinkle - 1) * 0.5);

    // Блик всегда развёрнут к камере и слегка вращается — оживляет картинку.
    if (burstRef.current) {
      burstRef.current.quaternion.copy(camera.quaternion);
      burstRef.current.rotation.z += 0.0006;
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Ореол — самый большой мягкий слой, даёт основное свечение */}
      <sprite ref={glowRef} scale={coreSize * 11} onClick={handleClick}>
        <spriteMaterial
          map={glowTexture}
          color={haloColor}
          transparent
          opacity={0.45 * style.glow}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {/* Плотная корона у самого ядра — красится цветом галактики, а не белым,
          иначе слои additive-смешения складываются в бесцветное пятно */}
      <sprite ref={coronaRef} scale={coreSize * 4}>
        <spriteMaterial
          map={glowTexture}
          color={haloColor}
          transparent
          opacity={0.5 * style.glow}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {/* Лучи-искра — только у ярких, завершённых звёзд */}
      {style.burst > 0 && (
        <sprite ref={burstRef} scale={coreSize * 11}>
          <spriteMaterial
            map={burstTexture}
            color={haloColor}
            transparent
            opacity={0.16 * style.burst}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      )}

      {/* Само тело звезды */}
      <mesh ref={coreRef} onClick={handleClick}>
        <sphereGeometry args={[coreSize, 32, 32]} />
        <meshBasicMaterial color={coreColor} toneMapped={false} transparent opacity={style.core} />
      </mesh>

      {/* Кольцо прогресса — сколько пройдено по этому делу */}
      {node.status === 'in_progress' && progressFraction > 0 && (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry args={[coreSize * 1.9, coreSize * 2.05, 64]} />
            <meshBasicMaterial
              color={haloColor}
              transparent
              opacity={0.12}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <ringGeometry
              args={[coreSize * 1.9, coreSize * 2.05, 64, 1, 0, Math.PI * 2 * progressFraction]}
            />
            <meshBasicMaterial
              color={coreColor}
              transparent
              opacity={0.95}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}

      {/* Запланированное — пунктирный контур будущей звезды */}
      {node.status === 'planned' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[coreSize * 1.9, coreSize * 1.97, 48]} />
          <meshBasicMaterial
            color={haloColor}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Выделение выбранной звезды */}
      {isFocused && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[coreSize * 2.7, coreSize * 2.82, 64]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <sprite scale={coreSize * 22}>
            <spriteMaterial
              map={glowTexture}
              color="#ffffff"
              transparent
              opacity={0.16}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        </>
      )}
    </group>
  );
}

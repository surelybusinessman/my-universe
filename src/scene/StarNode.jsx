import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlowTexture, getStarburstTexture } from './textures';

// Визуальный язык статусов: яркость и «живость» звезды сразу говорят,
// на каком этапе дело, ещё до открытия панели.
// corona: тусклым звёздам плотная корона не нужна — она всё равно не видна,
// а каждый спрайт это отдельный вызов отрисовки на все 45 звёзд сцены.
const STATUS_STYLE = {
  done: { core: 1.0, glow: 1.0, corona: true, burst: 1.0, twinkle: 1.0, gray: false },
  in_progress: { core: 0.92, glow: 0.72, corona: true, burst: 0.42, twinkle: 0.55, gray: false },
  planned: { core: 0.22, glow: 0.3, corona: false, burst: 0.0, twinkle: 0.18, gray: false },
  abandoned: { core: 0.14, glow: 0.16, corona: false, burst: 0.0, twinkle: 0.0, gray: true },
};

function StarNode({ node, position, color, isFocused, onClick }) {
  const coreRef = useRef();
  const glowRef = useRef();
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

  useFrame(({ clock }) => {
    // Совсем погасшие звёзды не мерцают — нет смысла считать для них анимацию.
    if (style.twinkle === 0) return;

    const t = clock.getElapsedTime();
    const twinkle = 1 + Math.sin(t * 1.5 + phase) * 0.14 * style.twinkle;

    if (coreRef.current) coreRef.current.scale.setScalar(twinkle);
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(t * 0.8 + phase * 1.3) * 0.07 * style.twinkle);
    }
    if (coronaRef.current) coronaRef.current.scale.setScalar(1 + (twinkle - 1) * 0.5);
  });

  const handleClick = (e) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <group position={[position.x, position.y, position.z]}>
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
      {style.corona && (
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
      )}

      {/* Лучи-искра — только у ярких, завершённых звёзд.
          Sprite сам всегда развёрнут к камере, доворачивать его вручную не нужно. */}
      {style.burst > 0 && (
        <sprite scale={coreSize * 11}>
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

      {/* Само тело звезды. Крупные звёзды получают больше сегментов, мелкие —
          меньше: на экране они всё равно занимают считанные пиксели. */}
      <mesh ref={coreRef} onClick={handleClick}>
        <sphereGeometry args={[coreSize, level >= 4 ? 24 : 16, level >= 4 ? 24 : 16]} />
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

// Звёзд может быть много (десятки), а GalaxyField перерисовывается на каждый
// тик адаптивного dpr (PerformanceMonitor). memo не даёт этому каскадом
// доходить до каждой звезды, когда её собственные пропсы не менялись — правда,
// это не спасает от смены focus.nodeId: onClick пересоздаётся в GalaxyField на
// каждый его рендер, так что при реальной смене фокуса компонент всё равно
// перерисуется целиком (это ожидаемо и дёшево — узлов десятки, а не тысячи).
export default memo(StarNode);

import { useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Насколько далеко за краем экрана подпись ещё считается живой. Небольшой
// запас нужен, чтобы подпись у самой кромки не мигала на границе.
const MARGIN = 1.4;

/**
 * Подпись объекта сцены поверх canvas.
 *
 * drei рисует <Html> независимо от того, видна ли её точка: когда точка уходит
 * за камеру, проекция переворачивается и подпись отлетает в произвольное место
 * экрана. При облёте камеры это выглядит как светлые полосы, прочерчивающие
 * экран (замерено: до 67 таких выбросов за один перелёт). Поэтому проверяем
 * проекцию сами и просто не рисуем подпись, пока её точка не перед камерой.
 */
export default function SceneLabel({ position, children }) {
  const [hidden, setHidden] = useState(false);
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    projected.set(position[0], position[1], position[2]).project(camera);
    // z > 1 в нормализованных координатах означает "за камерой".
    const offscreen =
      projected.z > 1 || Math.abs(projected.x) > MARGIN || Math.abs(projected.y) > MARGIN;
    if (offscreen !== hidden) setHidden(offscreen);
  });

  if (hidden) return null;

  return (
    <Html position={position} center zIndexRange={[0, 0]} style={{ pointerEvents: 'auto' }}>
      {children}
    </Html>
  );
}

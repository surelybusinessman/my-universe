import * as THREE from 'three';

// Текстуры рисуются в canvas прямо в браузере — никаких внешних файлов,
// значит сайт остаётся полностью самодостаточным и грузится мгновенно.

const cache = new Map();

function makeTexture(key, size, draw) {
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

/** Мягкое круглое свечение — ореол вокруг звезды. */
export function getGlowTexture() {
  return makeTexture('glow', 512, (ctx, size) => {
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0.0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.08, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.16)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.04)');
    gradient.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Четырёхлучевая «искра» — блик, как на ярких звёздах в телескопе. */
export function getStarburstTexture() {
  return makeTexture('starburst', 512, (ctx, size) => {
    const half = size / 2;
    ctx.translate(half, half);

    const drawSpike = (length, width) => {
      const gradient = ctx.createLinearGradient(0, 0, length, 0);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.25, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, -width);
      ctx.lineTo(length, 0);
      ctx.lineTo(0, width);
      ctx.closePath();
      ctx.fill();
    };

    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      drawSpike(half * 0.95, half * 0.035);
    }
    // Диагональные лучи короче — так блик выглядит естественнее.
    ctx.rotate(Math.PI / 4);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      drawSpike(half * 0.45, half * 0.018);
    }

    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, half * 0.12);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.12, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Клякса туманности — несколько наложенных пятен, чтобы форма была неровной. */
export function getNebulaTexture() {
  return makeTexture('nebula', 512, (ctx, size) => {
    const half = size / 2;

    const blob = (cx, cy, r, alpha) => {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(0.4, `rgba(255,255,255,${alpha * 0.35})`);
      gradient.addColorStop(0.75, `rgba(255,255,255,${alpha * 0.08})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    };

    blob(half, half, half * 0.95, 0.32);
    blob(half * 0.72, half * 0.82, half * 0.5, 0.2);
    blob(half * 1.28, half * 1.12, half * 0.45, 0.18);
    blob(half * 1.1, half * 0.7, half * 0.32, 0.14);
    blob(half * 0.85, half * 1.3, half * 0.36, 0.12);
  });
}

/** Маленькая мягкая точка — пыль и фоновые звёзды галактики. */
export function getDustTexture() {
  return makeTexture('dust', 128, (ctx, size) => {
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.12)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

import { describe, it, expect } from 'vitest';
import { dampOpacity } from './dimSmoothing';

describe('dampOpacity', () => {
  it('регрессия белой вспышки: за один обычный кадр не долетает до цели мгновенно', () => {
    // Раньше opacity менялась прямой подменой (dimmed ? off : on) в тот же
    // React-рендер, что и focus — то есть за 0 кадров. Если этот тест
    // когда-нибудь снова начнёт возвращать ровно target за один кадр,
    // значит сглаживание убрали и вспышка может вернуться.
    const oneFrameAt60fps = 1 / 60;
    const result = dampOpacity(0.1, 0.6, oneFrameAt60fps);
    expect(result).toBeGreaterThan(0.1);
    expect(result).toBeLessThan(0.6);
  });

  it('сходится к цели за достаточное время (не залипает навсегда)', () => {
    const result = dampOpacity(0.1, 0.6, 5); // 5 секунд — заведомо много кадров
    expect(result).toBeCloseTo(0.6, 3);
  });

  it('не меняет значение, если оно уже равно цели', () => {
    expect(dampOpacity(0.28, 0.28, 1 / 30)).toBeCloseTo(0.28, 6);
  });

  it('симметрично работает в обе стороны (яркеет и гаснет)', () => {
    const brightening = dampOpacity(0.1, 0.6, 1 / 60);
    const dimming = dampOpacity(0.6, 0.1, 1 / 60);
    expect(brightening).toBeGreaterThan(0.1);
    expect(dimming).toBeLessThan(0.6);
  });
});

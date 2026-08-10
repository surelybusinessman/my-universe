import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pullRemoteVault, pushRemoteVault, createDebouncedPusher } from './sync';

function mockFetchOnce(status, body) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    })
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('pullRemoteVault', () => {
  it('returns the container on 200', async () => {
    const container = { updatedAt: '2026-08-10T00:00:00.000Z' };
    mockFetchOnce(200, container);
    const result = await pullRemoteVault();
    expect(result).toEqual({ ok: true, container });
  });

  it('returns container: null on 404 (nothing synced yet)', async () => {
    mockFetchOnce(404, { error: 'NOT_FOUND' });
    const result = await pullRemoteVault();
    expect(result).toEqual({ ok: true, container: null });
  });

  it('reports NOT_CONFIGURED on 501 without throwing', async () => {
    mockFetchOnce(501, { error: 'SYNC_NOT_CONFIGURED' });
    const result = await pullRemoteVault();
    expect(result).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
  });

  it('reports NETWORK when fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('offline'))
    );
    const result = await pullRemoteVault();
    expect(result).toEqual({ ok: false, reason: 'NETWORK' });
  });
});

describe('pushRemoteVault', () => {
  it('returns the new updatedAt on success', async () => {
    mockFetchOnce(200, { updatedAt: '2026-08-10T01:00:00.000Z' });
    const result = await pushRemoteVault({ updatedAt: 'x' }, 'base');
    expect(result).toEqual({ ok: true, updatedAt: '2026-08-10T01:00:00.000Z' });
  });

  it('surfaces the server current container on 409', async () => {
    const current = { updatedAt: '2026-08-10T02:00:00.000Z' };
    mockFetchOnce(409, { error: 'CONFLICT', current });
    const result = await pushRemoteVault({ updatedAt: 'x' }, 'stale-base');
    expect(result).toEqual({ ok: false, reason: 'CONFLICT', current });
  });

  it('reports NOT_CONFIGURED on 501 without throwing', async () => {
    mockFetchOnce(501, { error: 'SYNC_NOT_CONFIGURED' });
    const result = await pushRemoteVault({ updatedAt: 'x' }, null);
    expect(result).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
  });
});

describe('createDebouncedPusher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only pushes once for rapid successive calls, using the last arguments', async () => {
    mockFetchOnce(200, { updatedAt: 'final' });
    const schedule = createDebouncedPusher(3000);
    const onSettled = vi.fn();

    schedule({ updatedAt: 'first-attempt' }, 'base', onSettled);
    vi.advanceTimersByTime(1000);
    schedule({ updatedAt: 'final' }, 'base', onSettled);
    vi.advanceTimersByTime(2999);
    expect(fetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body).container.updatedAt).toBe('final');
  });

  it('cancel() prevents a pending push from firing', async () => {
    mockFetchOnce(200, { updatedAt: 'x' });
    const schedule = createDebouncedPusher(3000);
    const onSettled = vi.fn();

    schedule({ updatedAt: 'x' }, 'base', onSettled);
    schedule.cancel();
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetch).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });
});

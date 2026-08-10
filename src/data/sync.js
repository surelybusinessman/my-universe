// Клиент для functions/api/vault.js: тянет и отправляет тот же зашифрованный
// контейнер, что лежит в IndexedDB. Сервер (GitHub Pages) может вообще не
// иметь этого эндпоинта — тогда просто работаем без синхронизации, молча.

const SYNC_ENDPOINT = '/api/vault';
const PUSH_DEBOUNCE_MS = 3000;

export async function pullRemoteVault() {
  let res;
  try {
    res = await fetch(SYNC_ENDPOINT);
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
  if (res.status === 501) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (res.status === 404) return { ok: true, container: null };
  if (!res.ok) return { ok: false, reason: 'ERROR' };
  const container = await res.json();
  return { ok: true, container };
}

export async function pushRemoteVault(container, baseUpdatedAt) {
  let res;
  try {
    res = await fetch(SYNC_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ container, baseUpdatedAt }),
    });
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
  if (res.status === 501) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (res.status === 409) {
    const body = await res.json();
    return { ok: false, reason: 'CONFLICT', current: body.current };
  }
  if (!res.ok) return { ok: false, reason: 'ERROR' };
  const body = await res.json();
  return { ok: true, updatedAt: body.updatedAt };
}

/**
 * Планирует push с задержкой в PUSH_DEBOUNCE_MS: правки в редакторе не должны
 * порождать запрос на каждое нажатие клавиши. Каждый новый вызов schedule()
 * отменяет ещё не выполненный предыдущий.
 */
export function createDebouncedPusher(delayMs = PUSH_DEBOUNCE_MS) {
  let timer = null;
  function schedule(container, baseUpdatedAt, onSettled) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      const result = await pushRemoteVault(container, baseUpdatedAt);
      onSettled(result);
    }, delayMs);
  }
  schedule.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return schedule;
}

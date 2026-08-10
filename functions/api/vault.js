// Хранит зашифрованный контейнер вселенной в Cloudflare KV, чтобы новое
// устройство могло получить его при входе без ручного выбора файла копии.
// Сервер работает только с шифротекстом — ни пароль, ни masterKey, ни
// расшифрованные данные сюда не попадают. Доступ уже закрыт паролем хостинга
// через functions/_middleware.js, который применяется ко всем маршрутам.
//
// Требует KV namespace, привязанный в дашборде Cloudflare Pages
// (Settings → Functions → KV namespace bindings) под именем VAULT_KV.
// Это ручной шаг, из кода он не выполняется.

const KV_KEY = 'vault';
const MAX_BODY_BYTES = 1024 * 1024; // 1 МБ — с большим запасом для реалистичной вселенной

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function looksLikeContainer(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      value.kdf?.salt &&
      value.passwordWrap?.data &&
      value.data?.data &&
      typeof value.updatedAt === 'string'
  );
}

async function handleGet(env) {
  if (!env.VAULT_KV) return json({ error: 'SYNC_NOT_CONFIGURED' }, 501);
  const stored = await env.VAULT_KV.get(KV_KEY, { type: 'json' });
  if (!stored) return json({ error: 'NOT_FOUND' }, 404);
  return json(stored);
}

async function handlePut(request, env) {
  if (!env.VAULT_KV) return json({ error: 'SYNC_NOT_CONFIGURED' }, 501);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'TOO_LARGE' }, 413);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const { container, baseUpdatedAt } = body || {};
  if (!looksLikeContainer(container)) return json({ error: 'INVALID_CONTAINER' }, 400);

  // Клиент присылает updatedAt версии, от которой отталкивался. Если на сервере
  // уже лежит что-то другое — значит, правки разошлись, и автослияние не делаем:
  // отдаём текущую серверную версию, решение — за пользователем на клиенте.
  const current = await env.VAULT_KV.get(KV_KEY, { type: 'json' });
  if (current && current.updatedAt !== baseUpdatedAt) {
    return json({ error: 'CONFLICT', current }, 409);
  }

  await env.VAULT_KV.put(KV_KEY, JSON.stringify(container));
  return json({ updatedAt: container.updatedAt });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'GET') return handleGet(env);
  if (request.method === 'PUT') return handlePut(request, env);
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
}

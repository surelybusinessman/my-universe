// Cloudflare Pages Function: закрывает весь сайт HTTP Basic Auth поверх
// собственного пароля приложения. Пароль задаётся как секрет SITE_PASSWORD
// в настройках проекта Cloudflare Pages (Settings → Environment variables) —
// сюда, в код, он не попадает.

function unauthorizedResponse() {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="My Universe", charset="UTF-8"',
    },
  });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const sitePassword = env.SITE_PASSWORD;

  // Если секрет не задан (например, в превью-сборках) — пропускаем без проверки.
  if (!sitePassword) return next();

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  let decoded;
  try {
    decoded = atob(authHeader.slice(6));
  } catch {
    return unauthorizedResponse();
  }

  const separatorIndex = decoded.indexOf(':');
  const password = separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);

  if (!timingSafeEqual(password, sitePassword)) {
    return unauthorizedResponse();
  }

  return next();
}

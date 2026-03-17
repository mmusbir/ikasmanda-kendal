const COOKIE_NAME = 'ika_admin_session';

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const sepIdx = pair.indexOf('=');
      if (sepIdx < 0) return acc;
      const key = pair.slice(0, sepIdx).trim();
      const value = pair.slice(sepIdx + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function isSecureRequest(req) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return req?.secure || forwardedProto === 'https';
}

function buildCookie(value, maxAgeSeconds, secure = false) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function setSessionCookie(req, res, token, maxAgeSeconds) {
  res.setHeader('Set-Cookie', buildCookie(token, maxAgeSeconds, isSecureRequest(req)));
}

function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', buildCookie('', 0, isSecureRequest(req)));
}

function readSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[COOKIE_NAME] || null;
}

module.exports = {
  COOKIE_NAME,
  parseCookies,
  isSecureRequest,
  setSessionCookie,
  clearSessionCookie,
  readSessionTokenFromRequest,
};

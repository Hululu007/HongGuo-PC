const ALLOWED_EXTERNAL_HOSTS = new Set(['github.com', 'qm.qq.com', 'www.kuaikaw.cn']);

function parseExternalUrl(value) {
  if (!value) return null;
  try {
    const target = new URL(String(value));
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
    if (!ALLOWED_EXTERNAL_HOSTS.has(target.hostname.toLowerCase())) return null;
    return target;
  } catch (_) {
    return null;
  }
}

module.exports = { ALLOWED_EXTERNAL_HOSTS, parseExternalUrl };

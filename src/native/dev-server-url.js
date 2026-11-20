function getTrustedDevServerUrl(value, isPackaged = false) {
  if (isPackaged || typeof value !== 'string' || !value || value.length > 2048) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())) return '';
    return url.origin;
  } catch (_) {
    return '';
  }
}

module.exports = { getTrustedDevServerUrl };

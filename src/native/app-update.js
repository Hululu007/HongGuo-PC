const RELEASES_URL = 'https://github.com/yuchen0x1/HongGuo-PC/releases';

function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(value || ''));
  if (!match) return null;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function availableRelease(data, currentVersion) {
  if (!data || data.draft || data.prerelease) return null;
  const tagName = String(data.tag_name || '').trim();
  const next = versionParts(tagName), current = versionParts(currentVersion);
  if (!next || !current) return null;
  const difference = next.findIndex((part, i) => part !== current[i]);
  if (difference < 0 || next[difference] < current[difference]) return null;
  const releaseNotes = String(data.body || '').replace(/\u0000/g, '').trim().slice(0, 12000);
  const assets = Array.isArray(data.assets) ? data.assets.slice(0, 20).map(asset => ({
    name: String(asset?.name || '').slice(0, 180),
    size: Number.isSafeInteger(asset?.size) && asset.size >= 0 ? asset.size : null,
  })).filter(asset => asset.name) : [];
  // Keep the UI anchored to the actual Windows x64 installer when a release
  // also contains source archives or unrelated platform assets. The full
  // asset list remains available for release notes and diagnostics.
  const installer = assets.find(asset => /(?:^|-)win-x64-setup\.exe$/i.test(asset.name))
    || assets.find(asset => /setup\.exe$/i.test(asset.name))
    || null;
  const metadata = assets.find(asset => asset.name.toLowerCase() === 'latest.yml') || null;
  const publishedAt = String(data.published_at || data.created_at || '').trim();
  return {
    version: tagName.replace(/^v/, '').replace(/^(\d+\.\d+)\.0$/, '$1'),
    // Never open a remote-provided URL; only this project's release page.
    url: `${RELEASES_URL}/tag/${encodeURIComponent(tagName)}`,
    channel: 'stable',
    mandatory: false,
    releaseDate: /^\d{4}-\d{2}-\d{2}T/.test(publishedAt) ? publishedAt : '',
    releaseNotes,
    assets,
    installer,
    metadata,
  };
}

module.exports = { availableRelease };

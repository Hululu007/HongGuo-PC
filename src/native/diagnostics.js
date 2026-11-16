const fs = require('node:fs');

const DIAGNOSTICS_SCHEMA_VERSION = 1;

function countByStatus(items) {
  const result = {};
  for (const item of Array.isArray(items) ? items : []) {
    const status = String(item?.status || 'unknown');
    result[status] = (result[status] || 0) + 1;
  }
  return result;
}

function inspectDirectory(directory) {
  const value = String(directory || '').trim();
  if (!value) return { configured: false, exists: false, directory: false };
  try {
    const stat = fs.statSync(value);
    const result = { configured: true, exists: true, directory: stat.isDirectory() };
    if (typeof fs.statfsSync === 'function' && stat.isDirectory()) {
      const fsStat = fs.statfsSync(value);
      const blockSize = Number(fsStat.bsize) || 0;
      const availableBlocks = Number(fsStat.bavail) || 0;
      const totalBlocks = Number(fsStat.blocks) || 0;
      if (blockSize > 0) {
        result.freeBytes = Math.max(0, Math.floor(blockSize * availableBlocks));
        result.totalBytes = Math.max(0, Math.floor(blockSize * totalBlocks));
      }
    }
    return result;
  } catch (error) {
    return { configured: true, exists: false, directory: false, errorCode: String(error?.code || 'unavailable') };
  }
}

function buildDiagnostics({
  app = {},
  processInfo = {},
  settings = {},
  tasks = [],
  series = [],
  playback = {},
  mergeTasks = [],
  storageError = null,
  updaterState = null,
  ffmpeg = null,
  ffprobe = null,
  downloadRoot = '',
  generatedAt = new Date(),
} = {}) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  const seriesList = Array.isArray(series) ? series : [];
  const mergeList = Array.isArray(mergeTasks) ? mergeTasks : [];
  const playbackMap = playback && typeof playback === 'object' ? playback : {};
  const safeApp = {
    version: String(app.version || 'unknown'),
    platform: String(app.platform || 'unknown'),
    arch: String(app.arch || 'unknown'),
    electron: String(app.electron || 'unknown'),
    chrome: String(app.chrome || 'unknown'),
    node: String(app.node || 'unknown'),
    preview: app.preview === true,
    configMode: String(app.configMode || 'default'),
  };
  const proxyMode = String(settings.proxy_mode || 'system');
  const safeUpdater = updaterState && typeof updaterState === 'object' ? {
    status: String(updaterState.status || 'idle'),
    version: updaterState.version ? String(updaterState.version) : null,
    percent: Number.isFinite(Number(updaterState.percent)) ? Math.max(0, Math.min(100, Number(updaterState.percent))) : 0,
    downloaded: updaterState.downloaded === true,
    supported: updaterState.supported !== false,
    hasError: Boolean(updaterState.error),
  } : null;
  return {
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    redaction: {
      secrets: 'omitted',
      proxyPassword: 'omitted',
      mediaUrls: 'omitted',
      localPaths: 'omitted',
      releaseNotes: 'omitted',
    },
    app: safeApp,
    runtime: {
      uptimeSeconds: Number.isFinite(Number(processInfo.uptime)) ? Math.max(0, Math.round(Number(processInfo.uptime))) : null,
      pid: Number.isSafeInteger(Number(processInfo.pid)) ? Number(processInfo.pid) : null,
    },
    storage: {
      readWriteHealthy: !storageError,
      errorCode: storageError?.code ? String(storageError.code) : null,
      downloadRoot: inspectDirectory(downloadRoot),
      taskCount: taskList.length,
      taskStatuses: countByStatus(taskList),
      seriesCount: seriesList.length,
      playbackRecordCount: Object.keys(playbackMap).length,
      mergeTaskCount: mergeList.length,
    },
    network: {
      proxyEnabled: settings.proxy_enabled === true,
      proxyMode,
      customProxyConfigured: proxyMode === 'custom' && Boolean(String(settings.proxy_host || '').trim()),
      proxyPortConfigured: proxyMode === 'custom' && Number.isInteger(Number(settings.proxy_port)) && Number(settings.proxy_port) > 0,
    },
    mediaTools: {
      ffmpegAvailable: Boolean(ffmpeg),
      ffprobeAvailable: Boolean(ffprobe),
    },
    updater: safeUpdater,
  };
}

module.exports = { DIAGNOSTICS_SCHEMA_VERSION, buildDiagnostics, inspectDirectory };

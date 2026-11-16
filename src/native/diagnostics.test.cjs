const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const pkg = require('../../package.json');
const { buildDiagnostics, DIAGNOSTICS_SCHEMA_VERSION, inspectDirectory } = require('./diagnostics');

test('diagnostics omit secrets, media URLs and local paths while retaining useful health data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hongguo-diagnostics-'));
  try {
    const report = buildDiagnostics({
      app: { version: pkg.version, platform: 'win32', arch: 'x64', electron: '44.9.1', node: '22', configMode: 'portable' },
      processInfo: { uptime: 91, pid: 12 },
      settings: { proxy_enabled: true, proxy_mode: 'custom', proxy_host: '127.0.0.1', proxy_port: 7890, proxy_password: 'must-not-appear' },
      tasks: [{ status: 'completed' }, { status: 'failed' }, { status: 'failed' }],
      series: [{ id: 'series-1' }],
      playback: { 'series-1': { currentTime: 3 } },
      mergeTasks: [{ status: 'running' }],
      storageError: null,
      updaterState: { status: 'downloaded', version: '6.12', percent: 100, downloaded: true, error: 'private error' },
      ffmpeg: 'C:\\private\\ffmpeg.exe',
      ffprobe: 'C:\\private\\ffprobe.exe',
      downloadRoot: root,
    });
    assert.equal(report.schemaVersion, DIAGNOSTICS_SCHEMA_VERSION);
    assert.equal(report.storage.downloadRoot.exists, true);
    assert.deepEqual(report.storage.taskStatuses, { completed: 1, failed: 2 });
    assert.equal(report.network.customProxyConfigured, true);
    assert.equal(report.mediaTools.ffmpegAvailable, true);
    assert.equal(report.updater.hasError, true);
    assert.doesNotMatch(JSON.stringify(report), /must-not-appear|private\\\\ffmpeg|private error/);
    assert.equal(report.redaction.mediaUrls, 'omitted');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missing diagnostic directory is reported without throwing', () => {
  const result = inspectDirectory(path.join(os.tmpdir(), 'hongguo-diagnostics-missing', 'nope'));
  assert.equal(result.configured, true);
  assert.equal(result.exists, false);
  assert.equal(result.directory, false);
});

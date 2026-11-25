const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createHash } = require('node:crypto');
const { CancellationToken } = require('builder-util-runtime');
const { availableRelease } = require('../src/native/app-update');
const { createUpdateInstaller } = require('../src/native/app-update-installer');
const { MacUpdater } = require('electron-updater/out/MacUpdater');
const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const preload = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
const notice = fs.readFileSync(path.join(__dirname, '../src/components/AppUpdateNotice.jsx'), 'utf8');

function fixture() {
  const updater = new EventEmitter();
  let enabled = true, blocker = '', checks = 0, downloads = 0, installs = 0;
  let finishCheck, finishDownload;
  const token = { cancelled: false, cancel() { this.cancelled = true; } };
  updater.setFeedURL = feed => { updater.feed = feed; };
  updater.checkForUpdates = () => { checks++; return new Promise(resolve => { finishCheck = (version = '1.81.0') => resolve({ updateInfo: { version }, cancellationToken: token }); }); };
  updater.downloadUpdate = received => { downloads++; assert.equal(received, token); return new Promise((resolve, reject) => { finishDownload = error => {
    if (error) { updater.emit('error', error); reject(error); }
    else { updater.emit('update-downloaded', { version: '1.81.0' }); resolve(['/synthetic/update.zip']); }
  }; }); };
  updater.quitAndInstall = () => { installs++; };
  const events = [];
  const controller = createUpdateInstaller({ updater, currentVersion: '1.80.0', isEnabled: () => enabled, installBlocker: () => blocker, emit: state => events.push(state) });
  return { updater, controller, events, token, checked: version => finishCheck(version), downloaded: error => finishDownload(error), counts: () => ({ checks, downloads, installs }), enable: value => { enabled = value; }, block: value => { blocker = value; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function macFixture() {
  const f = fixture(), native = new EventEmitter();
  let checks = 0, quits = 0;
  f.updater.nativeUpdater = native;
  f.updater.squirrelDownloadedUpdate = false;
  f.updater.autoRunAppAfterInstall = true;
  f.updater.closeServerIfExists = () => {};
  f.updater.handleUpdateDownloaded = MacUpdater.prototype.handleUpdateDownloaded;
  f.updater.quitAndInstall = MacUpdater.prototype.quitAndInstall;
  native.on('error', error => f.updater.emit('error', error));
  native.on('update-downloaded', () => { f.updater.squirrelDownloadedUpdate = true; });
  native.checkForUpdates = () => { checks++; };
  native.quitAndInstall = () => { quits++; };
  return { ...f, native, nativeCounts: () => ({ checks, quits }), ready: async () => {
    const pending = f.controller.download('1.81'); f.checked(); await tick(); f.downloaded();
    assert.equal((await pending).success, true);
  } };
}

function routeFixture({ allowProxy = () => true, fileUrl, manifestSha256, releaseSha256, tagOnly = false } = {}) {
  const fixtureDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'hongguo-update-integration-'));
  const pendingDir = path.join(fixtureDir, 'pending');
  fs.mkdirSync(pendingDir);
  const bytes = Buffer.from('trusted installer');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const sha512 = createHash('sha512').update(bytes).digest('base64');
  const name = 'hongguo-downloader-1.81-win-x64-setup.exe';
  const requests = [], routes = [];
  let originalDownloads = 0, nativeDownloads = 0;
  const executor = {
    download: async () => { originalDownloads++; return '/native-update'; },
    createRequest(options) {
      requests.push(options);
      const request = new EventEmitter();
      request.end = () => request.emit('error', new Error('synthetic route unavailable'));
      request.abort = () => {};
      return request;
    },
  };
  const updater = new EventEmitter();
  updater.httpExecutor = executor;
  updater.setFeedURL = () => {};
  updater.checkForUpdates = async () => ({
    updateInfo: {
      version: '1.81.0',
      tag: 'v1.81',
      files: [{
        url: fileUrl || name,
        sha512,
        sha2: manifestSha256 === undefined ? sha256 : manifestSha256,
        size: bytes.length,
      }],
    },
    cancellationToken: new CancellationToken(),
  });
  updater.downloadUpdate = async token => {
    nativeDownloads++;
    return executor.download(
      new URL(`https://github.com/yuchen0x1/HongGuo-PC/releases/download/v1.81/${name}`),
      path.join(pendingDir, `temp-${name}`),
      { sha512, cancellationToken: token, headers: { accept: '*/*', 'x-user-staging-id': 'private-user-id' } },
    );
  };
  const controller = createUpdateInstaller({
    updater,
    currentVersion: '1.80.0',
    isEnabled: () => true,
    installBlocker: () => '',
    emit: state => { if (state.route) routes.push(state.route); },
    allowProxy,
  });
  const release = {
    version: '1.81',
    tagName: 'v1.81',
    installer: tagOnly ? null : { name, size: bytes.length, sha256: releaseSha256 === undefined ? sha256 : releaseSha256 },
  };
  return {
    controller, updater, executor, requests, release,
    counts: () => ({ originalDownloads, nativeDownloads }),
    hosts: () => requests.map(options => `${options.protocol}//${options.hostname}`),
    routes,
    dispose: () => {
      controller.dispose();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    },
  };
}

assert.equal(availableRelease({ tag_name: 'v6.7', draft: false, prerelease: false }, '6.6.0')?.version, '6.7', '6.6 clients must recognize 6.7 as newer');
assert.equal(availableRelease({ tag_name: 'v6.6', draft: false, prerelease: false }, '6.6.0'), null, 'same version is not an update');
assert.equal(availableRelease({ tag_name: 'v6.7-beta.1', draft: false, prerelease: false }, '6.6.0'), null, 'prerelease tags are rejected');
assert.match(main, /electron-updater/);
assert.match(main, /download-app-update/);
assert.match(main, /cancel-app-update/);
assert.match(main, /install-app-update/);
assert.match(preload, /downloadAppUpdate|cancelAppUpdate|installAppUpdate|onAppUpdateState/);
assert.match(notice, /下载更新/);
assert.match(notice, /重启并安装/);

// v6.2–v6.6 的安装版仍内置 electron-updater，下载更新前必须先取 Release 里的
// latest.yml；缺少该元数据会让这些旧客户端点「下载更新」直接失败。
{
  const { buildMetadata } = require('./write-latest-yml.cjs');
  const os = require('node:os');
  const { createHash } = require('node:crypto');
  const pkg = require('../package.json');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hongguo-latest-yml-'));
  try {
    const installer = path.join(temp, `hongguo-downloader-${pkg.version.replace(/^(\d+\.\d+)\.0$/, '$1')}-win-x64-setup.exe`);
    const bytes = Buffer.from('synthetic installer payload');
    fs.writeFileSync(installer, bytes);
    const digest = createHash('sha512').update(bytes).digest('base64');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const yml = buildMetadata(installer, Date.UTC(2026, 10, 10));
    assert.match(yml, new RegExp(`^version: ${pkg.version.replace(/\./g, '\\.')}$`, 'm'), 'latest.yml must carry the package version');
    assert.match(yml, new RegExp(`^path: ${path.basename(installer)}$`, 'm'), 'latest.yml must point at the installer filename');
    assert.match(yml, new RegExp(`^    size: ${bytes.length}$`, 'm'), 'latest.yml must carry the exact installer size');
    assert.match(yml, new RegExp(`^    sha2: ${sha256}$`, 'm'), 'latest.yml must carry the SHA-256 for the exact installer');
    assert.equal(yml.split(`sha512: ${digest}`).length - 1, 2, 'latest.yml must carry the installer SHA512 for both file and top-level entries');
    assert.match(yml, /^releaseDate: '\d{4}-\d{2}-\d{2}T/m, 'latest.yml must carry a release date');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  const windowsWorkflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/windows.yml'), 'utf8');
  const publishWorkflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/publish-windows-release.yml'), 'utf8');
  assert.match(windowsWorkflow, /write-latest-yml\.cjs/, 'candidate workflow must generate latest.yml next to the installer');
  assert.match(publishWorkflow, /latest\.yml/, 'publish workflow must validate latest.yml before publishing');
}

(async () => {
const f = fixture();
assert.equal(f.updater.autoDownload, false);
assert.equal(f.updater.autoInstallOnAppQuit, false);
assert.equal(f.updater.allowDowngrade, false);
assert.equal(f.updater.allowPrerelease, false);
assert.equal(f.updater.disableWebInstaller, true);
assert.equal(f.updater.disableDifferentialDownload, true);
assert.equal(f.updater.feed.provider, 'github');
assert.equal(f.updater.feed.owner, 'yuchen0x1');
assert.equal(f.updater.feed.repo, 'HongGuo-PC');
assert.equal(f.controller.install().success, false);
const first = f.controller.download('1.81');
const duplicate = f.controller.download('1.81');
assert.equal(f.counts().checks, 1);
f.checked(); await tick();
assert.equal(f.counts().downloads, 1);
f.updater.emit('download-progress', { percent: 46.7, bytesPerSecond: 1536 });
assert.equal(f.controller.getState().percent, 46);
assert.equal(f.controller.getState().bytesPerSecond, 1536);
f.updater.emit('download-progress', { percent: 46.7, bytesPerSecond: 2048 });
assert.equal(f.controller.getState().bytesPerSecond, 2048);
f.downloaded();
assert.equal((await first).success, true);
assert.equal((await duplicate).success, true);
assert.equal(f.controller.getState().status, 'downloaded');
assert.equal(f.counts().installs, 0);
f.block('请先暂停下载');
assert.equal(f.controller.install().success, false);
f.block('');
assert.equal(f.controller.install().success, true);
assert.equal(f.controller.install().success, false);
await tick(); assert.equal(f.counts().installs, 1);
f.updater.emit('error', Error('PRIVATE_NATIVE_DIAGNOSTIC'));
assert.equal(f.controller.getState().status, 'error');
assert.ok(!f.controller.getState().error.includes('PRIVATE_NATIVE_DIAGNOSTIC'));

for (const version of ['1.80.0', '1.79.0', '1.82.0', '1.81.0-beta.1']) {
  const sample = fixture(), pending = sample.controller.download('1.81');
  sample.checked(version);
  assert.equal((await pending).success, false, version);
  assert.equal(sample.counts().downloads, 0);
}
const failure = fixture(), pending = failure.controller.download('1.81');
failure.checked(); await tick(); failure.downloaded(Error('sha512 mismatch: PRIVATE_URL'));
assert.equal((await pending).success, false);
assert.equal(failure.controller.install().success, false);
assert.equal(failure.counts().installs, 0);
assert.ok(!JSON.stringify(failure.events).includes('PRIVATE_URL'));

const disabled = fixture(); disabled.enable(false);
assert.equal((await disabled.controller.download('1.81')).success, false);
assert.equal(disabled.counts().checks, 0);
const cancelled = fixture(), operation = cancelled.controller.download('1.81');
cancelled.enable(false); cancelled.controller.cancel(); cancelled.checked();
assert.equal((await operation).success, false);
assert.equal(cancelled.counts().downloads, 0);
assert.equal(cancelled.controller.getState().status, 'idle');
const inFlight = fixture(), downloading = inFlight.controller.download('1.81');
inFlight.checked(); await tick(); inFlight.enable(false); inFlight.controller.cancel();
assert.equal(inFlight.token.cancelled, true);
inFlight.downloaded();
assert.equal((await downloading).success, false);
assert.equal(inFlight.controller.getState().status, 'idle');
assert.equal(inFlight.controller.install().success, false);

const manual = fixture(), oldDownload = manual.controller.download('1.81');
manual.checked(); await tick();
assert.equal(manual.controller.cancel()?.success, true);
assert.equal(manual.token.cancelled, true);
const retry = manual.controller.download('1.81');
manual.updater.emit('download-progress', { percent: 99 });
manual.updater.emit('update-downloaded', { version: '1.81.0' });
assert.equal(manual.controller.getState().status, 'idle');
assert.equal(manual.controller.install().success, false);
assert.equal(manual.counts().checks, 1);
manual.downloaded(Error('cancelled'));
assert.equal((await oldDownload).success, false); await tick();
assert.equal(manual.counts().checks, 2);
manual.checked(); await tick();
manual.updater.emit('update-downloaded', { version: '1.81.0' });
assert.equal(manual.controller.getState().status, 'downloading');
assert.equal(manual.controller.install().success, false);
manual.downloaded(); assert.equal((await retry).success, true);
assert.equal(manual.controller.getState().status, 'downloaded');

const queued = fixture(), checking = queued.controller.download('1.81');
queued.controller.cancel();
const queuedRetry = queued.controller.download('1.81');
queued.controller.cancel(); queued.checked();
assert.equal((await checking).success, false); await tick();
assert.equal(queued.counts().checks, 1);
assert.equal((await queuedRetry).success, false);
assert.equal(queued.token.cancelled, true);

const mac = macFixture();
await mac.ready(); mac.controller.install(); await tick();
assert.equal(mac.nativeCounts().quits, 0);
mac.native.emit('error', Error('native preparation failed'));
assert.equal(mac.controller.getState().status, 'error');
await mac.ready(); mac.controller.install(); await tick();
mac.native.emit('update-downloaded');
assert.equal(mac.nativeCounts().checks, 2);
assert.equal(mac.nativeCounts().quits, 1);

const blockedMac = macFixture();
await blockedMac.ready(); blockedMac.controller.install(); await tick();
blockedMac.block('正在保存设置'); blockedMac.native.emit('update-downloaded');
assert.equal(blockedMac.nativeCounts().quits, 0);
assert.equal(blockedMac.controller.getState().status, 'downloaded');
blockedMac.block(''); blockedMac.controller.install(); await tick();
assert.equal(blockedMac.nativeCounts().checks, 1);
assert.equal(blockedMac.nativeCounts().quits, 1);
const cancelledMac = macFixture();
await cancelledMac.ready(); cancelledMac.controller.install(); await tick();
cancelledMac.enable(false); cancelledMac.controller.cancel();
cancelledMac.native.emit('update-downloaded');
assert.equal(cancelledMac.nativeCounts().quits, 0);
assert.equal(cancelledMac.controller.getState().status, 'idle');
const throwingMac = macFixture();
await throwingMac.ready();
throwingMac.native.checkForUpdates = () => { throw Error('native preparation unavailable'); };
throwingMac.controller.install(); await tick(); throwingMac.native.emit('update-downloaded');
assert.equal(throwingMac.controller.getState().status, 'error');
assert.equal(throwingMac.nativeCounts().quits, 0);

const directOnly = routeFixture({ allowProxy: () => false });
try {
  assert.equal((await directOnly.controller.download(directOnly.release)).success, false);
  assert.deepEqual(directOnly.hosts(), ['https://github.com', 'https://github.com']);
  assert.ok(directOnly.routes.length >= 2 && directOnly.routes.every(route => route === 'official'));
  assert.equal(directOnly.counts().originalDownloads, 0, 'verified target downloads must stay inside the guarded route');
} finally { directOnly.dispose(); }

const malformedManifest = routeFixture({ fileUrl: 'https://evil.invalid/hongguo-downloader-1.81-win-x64-setup.exe' });
try {
  assert.equal((await malformedManifest.controller.download(malformedManifest.release)).success, false);
  assert.equal(malformedManifest.requests.length, 0, 'non-filename installer URLs must fail before network download');
  assert.equal(malformedManifest.counts().originalDownloads, 0, 'malformed metadata must not bypass the guarded route');
} finally { malformedManifest.dispose(); }

const mismatchedDigest = routeFixture({ manifestSha256: 'f'.repeat(64) });
try {
  assert.equal((await mismatchedDigest.controller.download(mismatchedDigest.release)).success, false);
  assert.equal(mismatchedDigest.requests.length, 0, 'a manifest/API SHA-256 conflict must fail closed');
} finally { mismatchedDigest.dispose(); }

const legacyManifest = routeFixture({ manifestSha256: '', releaseSha256: null });
try {
  assert.equal((await legacyManifest.controller.download(legacyManifest.release)).success, true);
  assert.equal(legacyManifest.requests.length, 0, 'legacy metadata without SHA-256 must not use GH-Proxy');
  assert.equal(legacyManifest.counts().originalDownloads, 1, 'legacy metadata must retain electron-updater direct downloads');
} finally { legacyManifest.dispose(); }

const tagOnlyFallback = routeFixture({ tagOnly: true });
try {
  assert.equal((await tagOnlyFallback.controller.download(tagOnlyFallback.release)).success, false);
  assert.deepEqual(tagOnlyFallback.hosts(), [
    'https://github.com',
    'https://gh-proxy.org',
    'https://gh-proxy.com',
    'https://github.com',
  ], 'new official manifests may safely supply SHA-256 when the Release API fallback only supplied a tag');
  assert.equal(tagOnlyFallback.counts().originalDownloads, 0);
} finally { tagOnlyFallback.dispose(); }

const tagOnlyLegacyFallback = routeFixture({ tagOnly: true, manifestSha256: '', releaseSha256: null });
try {
  assert.equal((await tagOnlyLegacyFallback.controller.download(tagOnlyLegacyFallback.release)).success, true);
  assert.equal(tagOnlyLegacyFallback.requests.length, 0, 'legacy tag-only fallback must not use GH-Proxy without SHA-256');
  assert.equal(tagOnlyLegacyFallback.counts().originalDownloads, 1);
} finally { tagOnlyLegacyFallback.dispose(); }

for (const variant of ['valid', 'wrong-size', 'wrong-content', 'wrong-return-path']) {
  const cached = routeFixture();
  const cacheDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'hongguo-cached-update-'));
  try {
    const expected = Buffer.from('trusted installer');
    const corrupted = Buffer.from(expected);
    corrupted[0] ^= 1;
    const file = path.join(cacheDir, cached.release.installer.name);
    fs.writeFileSync(file, variant === 'wrong-size' ? expected.subarray(1) : variant === 'wrong-content' ? corrupted : expected);
    cached.updater.downloadUpdate = async () => variant === 'wrong-return-path' ? [path.join(cacheDir, 'unrelated.exe')] : [file];
    const result = await cached.controller.download(cached.release);
    assert.equal(result.success, variant === 'valid', `cached ${variant} must be verified before enabling installation`);
    assert.equal(cached.requests.length, 0, 'cache validation must not require a replacement network download');
    assert.equal(cached.controller.getState().downloaded, variant === 'valid');
    if (variant !== 'valid') assert.equal(cached.controller.install().success, false, `cached ${variant} must never install`);
  } finally {
    cached.dispose();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

const syncFailure = fixture(); let syncChecks = 0;
syncFailure.updater.checkForUpdates = () => { syncChecks++; throw Error('synchronous check failure'); };
assert.equal((await syncFailure.controller.download('1.81')).success, false);
assert.equal((await syncFailure.controller.download('1.81')).success, false);
assert.equal(syncChecks, 2);
console.log('PASS update installer legacy safety regressions plus simplified 6.6 to 6.7 delivery checks');
})().catch(error => { console.error(error); process.exitCode = 1; });

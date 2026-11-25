// Uses real Electron net streams; it downloads installers but never executes them.
// Usage: node scripts/verify-update-download-network.cjs v6.31
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const RECEIPT = path.join(ROOT, 'dist', 'update-download-network.json');
const REPOSITORY = 'yuchen0x1/HongGuo-PC';
const MAX_DURATION_MS = 590000;
const OFFICIAL_HOSTS = new Set([
  'api.github.com', 'github.com', 'release-assets.githubusercontent.com',
  'objects.githubusercontent.com', 'github-cloud.s3.amazonaws.com',
]);
const args = process.argv.slice(2);
const tag = args[0] || '';

function saveReceipt(receipt) {
  fs.mkdirSync(path.dirname(RECEIPT), { recursive: true });
  fs.writeFileSync(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
}

function errorDetails(error) {
  return {
    name: String(error?.name || 'Error'),
    code: String(error?.code || ''),
    message: String(error?.message || error).replace(/https?:\/\/[^\s"'<>]+/g, '[URL omitted]').slice(0, 500),
    ...(Array.isArray(error?.routeErrors) ? { routeErrors: error.routeErrors } : {}),
  };
}

function baseReceipt() {
  return {
    schemaVersion: 1,
    releaseTag: tag,
    startedAt: new Date().toISOString(),
    status: 'running',
    environment: {
      platform: process.platform,
      node: process.versions.node,
      runner: process.env.GITHUB_ACTIONS === 'true' ? 'GitHub Actions' : 'local machine',
      limitation: 'This is real-network correctness validation, not mainland China speed validation.',
    },
    isolation: {
      disposableProfileAndDownloads: true,
      browserWindowsCreated: 0,
      installerExecution: false,
      mediaPlayback: false,
      credentialsSentToProxy: false,
    },
    trust: { apiHost: 'api.github.com', manifestRoute: 'official GitHub HTTPS only' },
    metadataRequests: [],
    scenarios: [],
  };
}

function requireSafeTag() {
  assert.match(tag, /^v\d+\.\d+(?:\.\d+)?$/, 'Specify a public release tag such as v6.31.');
}

function assertOwnedTemp(runRoot) {
  const resolved = path.resolve(runRoot);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()), 'Temporary root must be directly inside the OS temporary directory.');
  assert.match(path.basename(resolved), /^hongguo-update-network-[A-Za-z0-9_-]+$/);
  const stat = fs.lstatSync(resolved);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Temporary root must be a real directory.');
  return resolved;
}

async function launchElectron() {
  const receipt = baseReceipt();
  let runRoot;
  try {
    requireSafeTag();
    runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hongguo-update-network-'));
    const profile = path.join(runRoot, 'profile');
    fs.mkdirSync(profile);
    saveReceipt(receipt);
    const { spawn } = require('node:child_process');
    const env = { ...process.env };
    env.HONGGUO_UPDATE_VERIFY_API_TOKEN = env.GITHUB_TOKEN || '';
    for (const name of ['ELECTRON_RUN_AS_NODE', 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN']) delete env[name];
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(require('electron'), [__filename, tag, '--run-root', runRoot], {
        cwd: ROOT, env, stdio: 'inherit', windowsHide: true,
      });
      const timer = setTimeout(() => {
        receipt.status = 'failed';
        receipt.failure = { code: 'ERR_NETWORK_VERIFY_DEADLINE', message: 'Electron verification exceeded the 590 second total deadline.' };
        try {
          const current = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'));
          Object.assign(receipt, current, { status: 'failed', failure: receipt.failure });
        } catch {}
        saveReceipt(receipt);
        child.kill();
      }, MAX_DURATION_MS);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); resolve(code === 0 ? 0 : 1); });
    });
    process.exitCode = exitCode;
    if (exitCode) {
      try {
        const current = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'));
        if (current.status === 'running') {
          current.status = 'failed';
          current.failure = { code: 'ERR_ELECTRON_CHILD_EXIT', message: 'Electron exited before completing network verification.' };
          current.finishedAt = new Date().toISOString();
          saveReceipt(current);
        }
      } catch {}
    }
  } catch (error) {
    receipt.status = 'failed';
    receipt.failure = errorDetails(error);
    receipt.finishedAt = new Date().toISOString();
    saveReceipt(receipt);
    console.error(`FAIL update network verification: ${receipt.failure.message}`);
    process.exitCode = 1;
  } finally {
    if (runRoot) {
      try {
        fs.rmSync(assertOwnedTemp(runRoot), { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
        const current = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'));
        current.isolation.temporaryDirectoryRemoved = true;
        saveReceipt(current);
      } catch (error) {
        console.error(`FAIL isolated temporary directory cleanup: ${errorDetails(error).message}`);
        try {
          const current = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'));
          current.status = 'failed';
          current.cleanupError = errorDetails(error);
          saveReceipt(current);
        } catch {}
        process.exitCode = 1;
      }
    }
    console.log(`UPDATE_DOWNLOAD_NETWORK_RECEIPT=${RECEIPT}`);
  }
}

async function verifyInElectron() {
  const { app, BrowserWindow } = require('electron');
  const receipt = baseReceipt();
  let runRoot;
  let currentRouter;
  let currentToken;
  let totalBodyBytes = 0;
  let transferBudget = Infinity;
  const pendingRequests = new Set();
  try {
    requireSafeTag();
    const rootIndex = args.indexOf('--run-root');
    assert(rootIndex >= 0 && args[rootIndex + 1], 'Electron child requires a disposable temporary root.');
    runRoot = assertOwnedTemp(args[rootIndex + 1]);
    const profile = path.join(runRoot, 'profile');
    assert(fs.lstatSync(profile).isDirectory() && !fs.lstatSync(profile).isSymbolicLink());
    app.commandLine.appendSwitch('user-data-dir', profile);
    app.commandLine.appendSwitch('autoplay-policy', 'document-user-activation-required');
    app.setPath('userData', profile);
    app.disableHardwareAcceleration();
    app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
    await app.whenReady();
    const { ElectronHttpExecutor, getNetSession } = require('electron-updater/out/electronHttpExecutor');
    const { CancellationToken, CancellationError, configureRequestUrl } = require('builder-util-runtime');
    const yaml = require('js-yaml');
    const routerPath = require.resolve('../src/native/app-update-download');
    receipt.sourceHashes = {
      harnessSha256: createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
      routerSha256: createHash('sha256').update(fs.readFileSync(routerPath)).digest('hex'),
    };
    const { createUpdateDownloadRouter } = require(routerPath);
    const executor = new ElectronHttpExecutor();
    executor.cachedSession = getNetSession();
    await executor.cachedSession.clearStorageData();
    receipt.environment.electron = process.versions.electron;
    receipt.environment.chromium = process.versions.chrome;
    receipt.environment.transport = 'real electron-updater ElectronHttpExecutor / electron.net';
    receipt.environment.sessionProxyPolicy = 'Electron isolated session using system proxy configuration';
    receipt.trust.apiAuthenticated = Boolean(process.env.HONGGUO_UPDATE_VERIFY_API_TOKEN);
    receipt.timeouts = { parentTotalMs: MAX_DURATION_MS, metadataTotalMs: 45000, scenarioTotalMs: 500000 };
    const metadataDeadline = Date.now() + receipt.timeouts.metadataTotalMs;

    async function metadata(urlValue, limit) {
      let url = new URL(urlValue);
      for (let redirects = 0; redirects <= 5; redirects++) {
        assert(Date.now() < metadataDeadline, 'Official metadata exceeded its total deadline.');
        assert(url.protocol === 'https:' && !url.username && !url.password && !url.port && OFFICIAL_HOSTS.has(url.hostname), 'Metadata must remain on official HTTPS hosts.');
        const entry = { host: url.hostname, actualNetwork: true, startedAt: new Date().toISOString(), bytes: 0 };
        receipt.metadataRequests.push(entry);
        const result = await new Promise((resolve, reject) => {
          let request;
          let settled = false;
          const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (request) pendingRequests.delete(request);
            entry.durationMs = Date.now() - started;
            if (error) { entry.error = errorDetails(error); reject(error); }
            else resolve(value);
          };
          const started = Date.now();
          const timer = setTimeout(() => {
            finish(Object.assign(new Error('Official metadata request timed out.'), { code: 'ERR_METADATA_TIMEOUT' }));
            request?.abort();
          }, Math.max(1, Math.min(20000, metadataDeadline - started)));
          try {
            const options = {
              method: 'GET', redirect: 'manual', useSessionCookies: false,
              headers: { Accept: 'application/vnd.github+json', 'Accept-Encoding': 'identity', 'User-Agent': 'HongGuo-PC-update-network-verification' },
            };
            if (url.hostname === 'api.github.com' && process.env.HONGGUO_UPDATE_VERIFY_API_TOKEN) {
              options.headers.Authorization = `Bearer ${process.env.HONGGUO_UPDATE_VERIFY_API_TOKEN}`;
            }
            configureRequestUrl(url, options);
            request = executor.createRequest(options, response => {
              entry.statusCode = response.statusCode;
              const responseHeader = name => {
                const value = response.headers[name];
                return String(Array.isArray(value) ? value[0] || '' : value || '');
              };
              if (url.hostname === 'api.github.com') {
                entry.rateLimitRemaining = responseHeader('x-ratelimit-remaining');
                entry.rateLimitReset = responseHeader('x-ratelimit-reset');
              }
              if (response.statusCode !== 200) {
                finish(Object.assign(new Error(`Official metadata returned HTTP ${response.statusCode}.`), { code: 'ERR_METADATA_HTTP' }));
                request.abort();
                return;
              }
              const chunks = [];
              response.on('data', chunk => {
                entry.bytes += chunk.length;
                if (entry.bytes > limit) {
                  finish(Object.assign(new Error('Official metadata exceeded its size limit.'), { code: 'ERR_METADATA_SIZE' }));
                  request.abort();
                } else chunks.push(Buffer.from(chunk));
              });
              response.on('error', error => finish(error));
              response.on('end', () => finish(null, { text: Buffer.concat(chunks).toString('utf8') }));
            });
            pendingRequests.add(request);
            request.on('redirect', (statusCode, _method, location) => {
              const target = new URL(location, url);
              entry.statusCode = statusCode;
              entry.redirectHost = target.hostname;
              finish(null, { redirect: target });
              request.abort();
            });
            request.on('error', error => finish(error));
            request.end();
          } catch (error) { finish(error); }
        });
        if (result.redirect) { url = result.redirect; continue; }
        return result.text;
      }
      throw new Error('Official metadata redirected too many times.');
    }

    const release = JSON.parse(await metadata(`https://api.github.com/repos/${REPOSITORY}/releases/tags/${tag}`, 2 * 1024 * 1024));
    assert.equal(release.tag_name, tag, 'GitHub must return the requested tag.');
    assert(!release.draft && !release.prerelease, 'Select a public stable release.');
    const installers = release.assets.filter(asset => /^hongguo-downloader-[0-9.]+-win-x64-setup\.exe$/.test(asset.name));
    assert.equal(installers.length, 1, 'Release must contain exactly one Windows x64 installer.');
    const asset = installers[0];
    const officialUrl = `https://github.com/${REPOSITORY}/releases/download/${tag}/${asset.name}`;
    assert.equal(asset.browser_download_url, officialUrl);
    assert(Number.isSafeInteger(asset.size) && asset.size > 2 * 1024 * 1024);
    assert.match(asset.digest || '', /^sha256:[a-f0-9]{64}$/i, 'Official GitHub SHA-256 is required.');
    const manifestUrl = `https://github.com/${REPOSITORY}/releases/download/${tag}/latest.yml`;
    assert(release.assets.some(item => item.name === 'latest.yml' && item.browser_download_url === manifestUrl), 'Release must provide an official latest.yml.');
    const manifest = yaml.load(await metadata(manifestUrl, 128 * 1024), { schema: yaml.JSON_SCHEMA });
    const versionParts = tag.slice(1).split('.');
    while (versionParts.length < 3) versionParts.push('0');
    assert.equal(String(manifest.version), versionParts.join('.'));
    const manifestFile = manifest.files?.find(item => item.url === asset.name);
    assert(manifestFile, 'Official manifest must list the selected installer.');
    assert.equal(Number(manifestFile.size), asset.size, 'Official manifest and GitHub API sizes must agree.');
    assert.match(String(manifestFile.sha512 || ''), /^[A-Za-z0-9+/]{86}==$/, 'Official manifest SHA-512 is required.');
    if (manifest.path) assert.equal(manifest.path, asset.name);
    if (manifest.sha512) assert.equal(manifest.sha512, manifestFile.sha512);
    const identity = { tag, name: asset.name, size: asset.size, sha256: asset.digest.slice(7).toLowerCase() };
    const sha512 = manifestFile.sha512;
    receipt.trust.asset = { ...identity, sha512 };
    transferBudget = 4 * asset.size + 8 * 1024 * 1024;
    receipt.transferBudgetBytes = transferBudget;
    saveReceipt(receipt);

    async function verifyFile(file) {
      const stat = await fs.promises.lstat(file);
      assert(stat.isFile() && !stat.isSymbolicLink());
      assert.equal(stat.size, identity.size);
      const hashes = { sha256: createHash('sha256'), sha512: createHash('sha512') };
      for await (const chunk of fs.createReadStream(file)) {
        hashes.sha256.update(chunk);
        hashes.sha512.update(chunk);
      }
      const actual = { size: stat.size, sha256: hashes.sha256.digest('hex'), sha512: hashes.sha512.digest('base64') };
      assert.equal(actual.sha256, identity.sha256);
      assert.equal(actual.sha512, sha512);
      return { ...actual, matchesOfficialApiSha256: true, matchesOfficialManifestSha512: true };
    }

    const originalCreateRequest = executor.createRequest.bind(executor);
    async function scenario(name, { injectOfficialFailure = false, injectPrimaryProxyFailure = false, interrupt = false, timeoutMs = 110000 } = {}) {
      const entry = { name, status: 'running', timeoutMs, startedAt: new Date().toISOString(), phase: 'download', routes: [], requests: [], faultsInjected: [] };
      receipt.scenarios.push(entry);
      const started = Date.now();
      const cacheRoot = path.join(runRoot, name, 'cache');
      const pending = path.join(cacheRoot, 'pending');
      await fs.promises.mkdir(pending, { recursive: true });
      const destination = path.join(pending, `temp-${asset.name}`);
      let currentRoute = '';
      let interruptScheduled = false;
      let deadlineExpired = false;
      const timer = setTimeout(() => { deadlineExpired = true; currentToken?.cancel(); }, timeoutMs);
      executor.createRequest = (options, callback) => {
        const host = String(options.hostname || options.host || '').toLowerCase();
        const range = String(Object.entries(options.headers || {}).find(([key]) => key.toLowerCase() === 'range')?.[1] || '');
        const isProbe = /^bytes=0-\d+$/.test(range);
        const requestEntry = {
          host, route: isProbe || ['gh-proxy.org', 'gh-proxy.com'].includes(host) ? 'proxy' : currentRoute,
          purpose: isProbe ? 'proxy-probe' : 'installer',
          phase: entry.phase, actualNetwork: true, bytes: 0, range,
          startedAfterMs: Date.now() - started,
        };
        entry.requests.push(requestEntry);
        assert(!Object.keys(options.headers || {}).some(key => /^(authorization|proxy-authorization|cookie|private-token|x-api-key)$/i.test(key)), 'Verification must not send credentials.');
        if (injectOfficialFailure && currentRoute === 'official' && host === 'github.com') {
          const failure = Object.assign(new Error('Explicit verification injection: official connection unavailable.'), { code: 'ERR_VERIFY_INJECTED_OFFICIAL_CONNECTION' });
          requestEntry.actualNetwork = false;
          requestEntry.error = errorDetails(failure);
          entry.faultsInjected.push({ type: 'official_connection_error', code: failure.code, phase: entry.phase });
          throw failure;
        }
        if (injectPrimaryProxyFailure && host === 'gh-proxy.org') {
          const failure = Object.assign(new Error('Explicit verification injection: primary GH-Proxy endpoint unavailable.'), { code: 'ERR_VERIFY_INJECTED_PRIMARY_PROXY_CONNECTION' });
          requestEntry.actualNetwork = false;
          requestEntry.error = errorDetails(failure);
          entry.faultsInjected.push({ type: 'gh_proxy_org_connection_error', host, code: failure.code, purpose: requestEntry.purpose, phase: entry.phase });
          throw failure;
        }
        const request = originalCreateRequest(options, response => {
          requestEntry.statusCode = response.statusCode;
          const header = key => {
            const value = response.headers[key];
            return String(Array.isArray(value) ? value[0] || '' : value || '');
          };
          requestEntry.contentRange = header('content-range');
          requestEntry.contentLength = header('content-length');
          // Observe emitted bytes without adding a data listener that starts the stream early.
          const originalEmit = response.emit;
          response.emit = function (event, ...values) {
            if (event === 'data') {
              const count = Buffer.byteLength(values[0]);
              requestEntry.bytes += count;
              totalBodyBytes += count;
            }
            if (event === 'end' || event === 'close') requestEntry.durationMs = Date.now() - started - requestEntry.startedAfterMs;
            if (event === 'error') requestEntry.error = errorDetails(values[0]);
            const result = originalEmit.call(this, event, ...values);
            if (event === 'data' && totalBodyBytes > transferBudget) currentToken?.cancel();
            if (event === 'data' && interrupt && entry.phase === 'download' && !interruptScheduled && requestEntry.bytes >= 2 * 1024 * 1024) {
              interruptScheduled = true;
              entry.faultsInjected.push({ type: 'client_cancel_during_real_official_stream', receivedBytes: requestEntry.bytes });
              setImmediate(() => currentToken?.cancel());
            }
            return result;
          };
          callback(response);
        });
        pendingRequests.add(request);
        request.on('redirect', (statusCode, _method, location) => {
          requestEntry.statusCode = statusCode;
          requestEntry.redirectHost = new URL(location).hostname;
        });
        request.on('error', error => { requestEntry.error = errorDetails(error); });
        request.once('close', () => pendingRequests.delete(request));
        return request;
      };
      currentRouter = createUpdateDownloadRouter({
        executor, allowProxy: () => injectOfficialFailure,
        minSpeedBytesPerSecond: 0, idleTimeoutMs: 20000, probeTimeoutMs: 15000, backoff: [100, 200],
        onRoute: (route, details) => {
          currentRoute = route;
          entry.routes.push({
            route, host: details?.host || '', phase: entry.phase, afterMs: Date.now() - started,
            ...(Number.isFinite(details?.score) ? { score: details.score } : {}),
          });
          saveReceipt(receipt);
        },
      });
      currentRouter.setAsset(identity);
      const download = async () => {
        currentToken = new CancellationToken();
        try {
          return await executor.download(new URL(officialUrl), destination, {
            cancellationToken: currentToken, sha512,
            headers: { 'User-Agent': 'HongGuo-PC-update-network-verification', Accept: 'application/octet-stream' },
          });
        } finally { currentToken.dispose(); currentToken = null; }
      };
      console.log(`RUN real Electron download: ${name}`);
      try {
        if (interrupt) {
          let firstFailure;
          try { await download(); } catch (error) { firstFailure = error; }
          assert(interruptScheduled, 'A genuine official response must transfer at least 2 MiB before interruption.');
          assert(firstFailure instanceof CancellationError, 'First genuine stream must stop by explicit client cancellation.');
          assert(!fs.existsSync(destination), 'Interrupted installer must not be published as complete.');
          const key = createHash('sha256').update(JSON.stringify([identity.tag, identity.name, identity.size, identity.sha256])).digest('hex');
          const partial = path.join(cacheRoot, '.hongguo-update-parts', key, 'installer.partial');
          const partialStat = await fs.promises.lstat(partial);
          assert(partialStat.isFile() && !partialStat.isSymbolicLink() && partialStat.size > 0 && partialStat.size < identity.size, 'Cancellation must preserve a genuine incomplete file.');
          entry.partialBytesBeforeResume = partialStat.size;
          entry.interruptionError = errorDetails(firstFailure);
          entry.phase = 'resume';
          await download();
          const resume = entry.requests.find(item => item.phase === 'resume' && item.statusCode === 206 && item.range === `bytes=${partialStat.size}-`);
          assert(resume && resume.contentRange.startsWith(`bytes ${partialStat.size}-`), 'Real official server must accept the exact persisted Range and return HTTP 206.');
          entry.rangeResumeConfirmed = true;
        } else await download();
        assert(!deadlineExpired, 'Scenario exceeded its network deadline.');
        assert(totalBodyBytes <= transferBudget, 'Verification exceeded its bounded transfer budget.');
        entry.verification = await verifyFile(destination);
        assert(!deadlineExpired, 'Scenario exceeded its complete download and verification deadline.');
        entry.completedRoute = currentRoute;
        if (injectOfficialFailure) {
          assert.equal(currentRoute, 'proxy', 'Proxy scenario must complete from the proxy route.');
          assert(entry.requests.some(item => ['gh-proxy.org', 'gh-proxy.com'].includes(item.host) && item.actualNetwork && [200, 206].includes(item.statusCode) && item.bytes > 0), 'Proxy must return genuine public-network bytes.');
          if (injectPrimaryProxyFailure) {
            assert(entry.faultsInjected.some(item => item.type === 'official_connection_error'), 'Official failure must be an explicit recorded injection.');
            assert(entry.faultsInjected.some(item => item.type === 'gh_proxy_org_connection_error'), 'Primary proxy failure must be an explicit recorded injection.');
            assert(entry.requests.filter(item => item.host === 'gh-proxy.org').every(item => !item.actualNetwork), 'Primary proxy must remain intentionally unavailable in this scenario.');
            assert(entry.requests.some(item => item.host === 'gh-proxy.com' && item.purpose === 'proxy-probe' && item.actualNetwork && item.statusCode === 206 && item.bytes > 0), 'Same-provider backup must pass a genuine bounded HTTP 206 probe.');
            assert(entry.requests.some(item => item.host === 'gh-proxy.com' && item.purpose === 'installer' && item.actualNetwork && item.statusCode === 200 && item.bytes === identity.size), 'Same-provider backup must return the genuine complete installer.');
            assert.equal(entry.routes.at(-1)?.host, 'gh-proxy.com', 'Completed proxy route must identify the same-provider backup endpoint.');
            entry.sameProviderBackupConfirmed = true;
            entry.evidenceType = 'hybrid: explicitly injected official and gh-proxy.org connection failures; genuine gh-proxy.com probe, full download and checksum verification';
          } else entry.evidenceType = 'hybrid: injected official connection failure; genuine proxy probe, download and checksum verification';
        } else {
          assert(entry.routes.every(item => item.route === 'official'));
          assert(entry.requests.every(item => OFFICIAL_HOSTS.has(item.host)), 'Official scenario must contact only official hosts.');
          assert(entry.requests.some(item => item.host === 'github.com' && item.actualNetwork));
          entry.evidenceType = interrupt ? 'genuine official network stream with explicit client interruption, then genuine HTTP Range resume' : 'genuine official public-network download';
        }
        entry.status = 'passed';
        console.log(`PASS ${name}: size, official SHA-256 and official SHA-512 verified`);
      } catch (error) {
        entry.status = 'failed';
        entry.error = errorDetails(error);
        if (injectOfficialFailure) entry.evidenceType = 'hybrid test attempted; proxy availability or completion was not established';
        console.error(`FAIL ${name}: ${entry.error.message}`);
      } finally {
        clearTimeout(timer);
        currentRouter.dispose();
        currentRouter = null;
        executor.createRequest = originalCreateRequest;
        entry.durationMs = Date.now() - started;
        entry.networkBodyBytes = entry.requests.reduce((sum, item) => sum + item.bytes, 0);
        receipt.totalNetworkBodyBytes = totalBodyBytes;
        saveReceipt(receipt);
      }
    }

    await scenario('official-full');
    await scenario('proxy-after-injected-official-error', { injectOfficialFailure: true, timeoutMs: 140000 });
    await scenario('same-provider-backup-after-injected-official-and-primary-errors', { injectOfficialFailure: true, injectPrimaryProxyFailure: true, timeoutMs: 140000 });
    await scenario('official-interruption-resume', { interrupt: true });
    assert.equal(BrowserWindow.getAllWindows().length, 0, 'Network verification must never create application windows.');
    assert(receipt.scenarios.length === 4 && receipt.scenarios.every(item => item.status === 'passed'), 'All four real-network scenarios are required; unavailable proxy is a failed acceptance, not a skipped success.');
    receipt.status = 'passed';
  } catch (error) {
    receipt.status = 'failed';
    receipt.failure = errorDetails(error);
    console.error(`FAIL update network verification: ${receipt.failure.message}`);
  } finally {
    currentToken?.cancel();
    currentRouter?.dispose();
    for (const request of pendingRequests) { try { request.abort(); } catch {} }
    receipt.totalNetworkBodyBytes = totalBodyBytes;
    receipt.finishedAt = new Date().toISOString();
    receipt.durationMs = Date.now() - Date.parse(receipt.startedAt);
    saveReceipt(receipt);
    app.exit(receipt.status === 'passed' ? 0 : 1);
  }
}

if (process.versions.electron) void verifyInElectron();
else void launchElectron();

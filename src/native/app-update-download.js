const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { CancellationError, CancellationToken, configureRequestUrl } = require('builder-util-runtime');

const OFFICIAL_HOST = 'github.com';
const PROXY_HOSTS = ['gh-proxy.org', 'gh-proxy.com'];
const REPOSITORY_PATH = '/yuchen0x1/HongGuo-PC';
const SAFE_PROXY_HEADERS = new Set(['accept', 'accept-encoding', 'user-agent', 'cache-control', 'range', 'if-range']);
const ALLOWED_REDIRECT_HOSTS = new Set([
  OFFICIAL_HOST,
  ...PROXY_HOSTS,
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
  'github-cloud.s3.amazonaws.com',
]);

function getHeader(headers, name) {
  const value = headers?.[name.toLowerCase()] ?? headers?.[name];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function normalizeSha256(value) {
  const match = /^(?:sha256:)?([a-f0-9]{64})$/i.exec(String(value || '').trim());
  return match ? match[1].toLowerCase() : '';
}

function isValidSha512(value) {
  const digest = String(value || '').trim();
  if (/^[a-f0-9]{128}$/i.test(digest)) return true;
  if (!/^[A-Za-z0-9+/]{86}==$/.test(digest)) return false;
  try { return Buffer.from(digest, 'base64').length === 64 && Buffer.from(digest, 'base64').toString('base64') === digest; }
  catch { return false; }
}

function safeAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const tag = String(asset.tag || '');
  const name = String(asset.name || '');
  const size = Number(asset.size);
  const sha256 = normalizeSha256(asset.sha256 || asset.digest);
  if (!/^v?\d+\.\d+(?:\.\d+)?$/.test(tag)
      || !/^[A-Za-z0-9._-]+\.exe$/i.test(name)
      || !Number.isSafeInteger(size) || size <= 0
      || !sha256) return null;
  return { tag, name, size, sha256 };
}

function officialAssetMatch(value, asset) {
  let url;
  try { url = value instanceof URL ? value : new URL(String(value)); }
  catch { return false; }
  if (url.hostname.toLowerCase() !== OFFICIAL_HOST) return false;
  if (url.username || url.password || url.port || url.search || url.hash) return false;
  const expectedPath = `${REPOSITORY_PATH}/releases/download/${asset.tag}/${asset.name}`;
  if (url.pathname !== expectedPath) return false;
  if (url.protocol !== 'https:') throw new Error('拒绝通过非 HTTPS 地址下载更新。');
  return true;
}

function buildProxyUrl(officialUrl, proxyHost = PROXY_HOSTS[0]) {
  const source = officialUrl instanceof URL ? officialUrl : new URL(String(officialUrl));
  if (source.protocol !== 'https:' || source.hostname.toLowerCase() !== OFFICIAL_HOST
      || source.username || source.password || source.port || source.search || source.hash
      || !source.pathname.startsWith(`${REPOSITORY_PATH}/releases/download/`)
      || !PROXY_HOSTS.includes(proxyHost)) {
    throw new Error('拒绝代理不安全的更新地址。');
  }
  return new URL(`https://${proxyHost}/${source.href}`);
}

function proxyHeaders(headers = {}) {
  const result = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (SAFE_PROXY_HEADERS.has(name.toLowerCase()) && value != null) result[name] = value;
  }
  return result;
}

function isAllowedRedirect(value) {
  let url;
  try { url = value instanceof URL ? value : new URL(String(value)); }
  catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return !url.port && ALLOWED_REDIRECT_HOSTS.has(host);
}

function sameAsset(left, right) {
  return !!left && !!right && left.tag === right.tag && left.name === right.name
    && left.size === right.size && left.sha256 === right.sha256;
}

function normalizeRouteError(message, code = 'ERR_UPDATE_ROUTE') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createUpdateDownloadRouter({
  executor,
  onRoute = () => {},
  allowProxy = () => true,
  minSpeedBytesPerSecond = 96 * 1024,
  slowWindowMs = 10000,
  idleTimeoutMs = 30000,
  probeTimeoutMs = 5000,
  probeBytes = 64 * 1024,
  backoff = [350, 900],
  now = Date.now,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  if (!executor || typeof executor.download !== 'function' || typeof executor.createRequest !== 'function') {
    throw new TypeError('A compatible electron-updater HTTP executor is required.');
  }

  const previousDownload = executor.download;
  const originalDownload = previousDownload.bind(executor);
  const routeHealth = {
    official: { successes: 0, failures: 0, averageBytesPerSecond: 0 },
    ...Object.fromEntries(PROXY_HOSTS.map(host => [host, {
      successes: 0, failures: 0, averageBytesPerSecond: 0, probeBytesPerSecond: 0, cooldownUntil: 0,
    }])),
  };
  let asset = null;
  let disposed = false;
  const activeTokens = new Set();

  const reportRoute = (route, proxyHost) => {
    try { onRoute(route, { host: proxyHost || OFFICIAL_HOST, score: routeScore(routeHealth[proxyHost || 'official']) }); } catch {}
  };

  function routeScore(stats) {
    return Math.round((stats.probeBytesPerSecond || stats.averageBytesPerSecond || 0) / ((1 + stats.failures) ** 2));
  }

  function updateRouteHealth(route, success, bytesPerSecond = 0, proxyHost) {
    const stats = routeHealth[proxyHost || route];
    if (!stats) return;
    if (success) {
      stats.successes++;
      stats.failures = 0;
      if (bytesPerSecond > 0) stats.averageBytesPerSecond = stats.averageBytesPerSecond
        ? Math.round(stats.averageBytesPerSecond * 0.7 + bytesPerSecond * 0.3)
        : Math.round(bytesPerSecond);
      if (route === 'proxy') stats.cooldownUntil = 0;
      return;
    }
    stats.failures++;
    if (route === 'proxy' && stats.failures >= 2) {
      const cooldown = Math.min(15 * 60 * 1000, 30000 * (2 ** Math.min(stats.failures - 2, 4)));
      stats.cooldownUntil = now() + cooldown;
    }
  }

  async function readResume(partialPath, metadataPath, identity) {
    let metadata = null, stat = null;
    try {
      metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
      const lstat = await fs.promises.lstat(partialPath);
      if (!lstat.isFile() || lstat.isSymbolicLink()) throw new Error('Invalid partial file');
      stat = lstat;
    } catch {
      metadata = null;
      stat = null;
    }
    if (!sameAsset(metadata, identity) || !stat || stat.size > identity.size) {
      await removeOwnedFiles(partialPath, metadataPath);
      metadata = null;
      stat = null;
    }
    if (!metadata) {
      metadata = { ...identity, etag: '', lastModified: '' };
      await writeMetadata(metadataPath, metadata);
    }
    return { metadata, offset: stat?.size || 0 };
  }

  async function writeMetadata(metadataPath, metadata) {
    const tempPath = `${metadataPath}.tmp`;
    await fs.promises.unlink(tempPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await fs.promises.writeFile(tempPath, JSON.stringify(metadata), { mode: 0o600, flag: 'wx' });
    try {
      await fs.promises.rename(tempPath, metadataPath);
    } catch (error) {
      await fs.promises.unlink(metadataPath).catch(() => {});
      await fs.promises.rename(tempPath, metadataPath);
    }
    await fs.promises.chmod(metadataPath, 0o600).catch(() => {});
  }

  async function removeOwnedFiles(partialPath, metadataPath) {
    await fs.promises.unlink(partialPath).catch(() => {});
    await fs.promises.unlink(metadataPath).catch(() => {});
    await fs.promises.unlink(`${metadataPath}.tmp`).catch(() => {});
  }

  async function pruneResumeCache(root, keep) {
    const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => []);
    const cutoff = now() - 7 * 24 * 60 * 60 * 1000;
    for (const entry of entries.slice(0, 64)) {
      if (entry.name === keep || !/^[a-f0-9]{64}$/.test(entry.name) || !entry.isDirectory()) continue;
      const directory = path.join(root, entry.name);
      const stat = await fs.promises.lstat(directory).catch(() => null);
      if (!stat || !stat.isDirectory() || stat.isSymbolicLink() || stat.mtimeMs >= cutoff) continue;
      for (const name of ['installer.partial', 'installer.partial.json', 'installer.partial.json.tmp']) {
        await fs.promises.unlink(path.join(directory, name)).catch(() => {});
      }
      // Never recursively remove a cache directory containing unrecognized files.
      await fs.promises.rmdir(directory).catch(() => {});
    }
  }

  function makeRequest(url, headers, token) {
    let request;
    let settled = false;
    let resolvePromise, rejectPromise;
    const responsePromise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const settle = (action, value) => {
      if (settled) return;
      settled = true;
      if (token && cancelHandler) token.removeListener('cancel', cancelHandler);
      action(value);
    };
    let cancelHandler = null;
    try {
      const requestHeaders = { ...headers };
      if (!Object.keys(requestHeaders).some(name => name.toLowerCase() === 'accept-encoding')) {
        requestHeaders['Accept-Encoding'] = 'identity';
      }
      const requestOptions = { method: 'GET', headers: requestHeaders, redirect: 'manual', useSessionCookies: false };
      configureRequestUrl(url, requestOptions);
      request = executor.createRequest(requestOptions, response => {
        response.on?.('error', () => {});
        if (settled) { response.destroy?.(); return; }
        response.pause?.();
        settle(resolvePromise, { response });
      });
      request.on('redirect', (statusCode, method, redirectUrl) => {
        settle(resolvePromise, { redirectUrl, statusCode });
        try { request.abort(); } catch {}
      });
      request.on('error', error => settle(rejectPromise, error));
      if (token?.once) {
        cancelHandler = () => {
          try { request.abort(); } catch {}
          settle(rejectPromise, new CancellationError());
        };
        token.once('cancel', cancelHandler);
        if (token.cancelled) {
          cancelHandler();
          return {
            responsePromise,
            abort: () => { try { request?.abort(); } catch {} },
          };
        }
      }
      request.end();
    } catch (error) {
      settle(rejectPromise, error);
    }
    return {
      responsePromise,
      abort: () => { try { request?.abort(); } catch {} },
    };
  }

  async function receiveResponse(url, headers, token, connectionTimeoutMs, setActiveAbort) {
    const pending = makeRequest(url, headers, token);
    setActiveAbort(pending.abort);
    let timeout;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeoutFn(() => {
          reject(normalizeRouteError('Update source connection timed out.', 'ERR_UPDATE_TIMEOUT'));
          pending.abort();
        }, connectionTimeoutMs);
      });
      const result = await Promise.race([pending.responsePromise, timeoutPromise]);
      if (result.redirectUrl) {
        const redirect = new URL(result.redirectUrl, url);
        if (!isAllowedRedirect(redirect)) throw normalizeRouteError('Update source returned an unsafe redirect.', 'ERR_UPDATE_REDIRECT');
        return { redirect };
      }
      return { response: result.response };
    } finally {
      if (timeout) clearTimeoutFn(timeout);
    }
  }

  function parseContentRange(value) {
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(String(value || '').trim());
    if (!match) return null;
    const [, start, end, total] = match.map(Number);
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && Number.isSafeInteger(total)
      && start <= end && end < total ? { start, end, total } : null;
  }

  async function probeProxy(officialUrl, proxyHost, identity, options, token, setActiveAbort) {
    const started = now();
    const deadline = started + Math.max(1, Math.min(probeTimeoutMs, idleTimeoutMs));
    const sampleSize = Math.min(identity.size, Math.max(1, Math.floor(probeBytes)));
    const headers = proxyHeaders(options.headers);
    for (const key of Object.keys(headers)) {
      if (['range', 'if-range'].includes(key.toLowerCase())) delete headers[key];
    }
    headers.Range = `bytes=0-${sampleSize - 1}`;
    let url = buildProxyUrl(officialUrl, proxyHost);
    let response = null;
    let requestAbort = null;
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (token.cancelled) throw new CancellationError();
      const remaining = deadline - now();
      if (remaining <= 0) throw normalizeRouteError('Update proxy probe timed out.', 'ERR_UPDATE_TIMEOUT');
      const result = await receiveResponse(url, headers, token, remaining, abort => {
        requestAbort = abort;
        setActiveAbort(abort);
      });
      if (result.redirect) {
        url = result.redirect;
        continue;
      }
      response = result.response;
      break;
    }
    if (!response) throw normalizeRouteError('Update proxy probe redirected too many times.', 'ERR_UPDATE_REDIRECT');
    try {
      const status = Number(response.statusCode);
      const length = getHeader(response.headers, 'content-length');
      if (status === 206) {
        const range = parseContentRange(getHeader(response.headers, 'content-range'));
        if (!range || range.start !== 0 || range.end !== sampleSize - 1 || range.total !== identity.size
            || (length && Number(length) !== sampleSize)) {
          throw normalizeRouteError('Update proxy probe returned an invalid range.', 'ERR_UPDATE_RANGE');
        }
      } else if (status !== 200 || (length && Number(length) !== identity.size)) {
        throw normalizeRouteError('Update proxy probe did not return the trusted asset.', 'ERR_UPDATE_HTTP');
      }
      const received = await new Promise((resolve, reject) => {
        let count = 0;
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeoutFn(timer);
          token.removeListener('cancel', cancel);
          response.removeListener('data', data);
          response.removeListener('end', ended);
          response.removeListener('error', failed);
          // Aborting a sampled 200 response is intentional; do not expose its late error.
          response.on('error', () => {});
          if (error) reject(error);
          else resolve(count);
        };
        const cancel = () => finish(new CancellationError());
        const failed = () => finish(normalizeRouteError('Update proxy probe was interrupted.', 'ERR_UPDATE_INTERRUPTED'));
        const ended = () => finish(count >= sampleSize ? null : normalizeRouteError('Update proxy probe was incomplete.', 'ERR_UPDATE_SIZE'));
        const data = chunk => {
          count += Math.min(chunk.length, sampleSize - count);
          if (count >= sampleSize) finish();
        };
        const timer = setTimeoutFn(() => finish(normalizeRouteError('Update proxy probe timed out.', 'ERR_UPDATE_TIMEOUT')), Math.max(1, deadline - now()));
        token.once('cancel', cancel);
        response.on('error', failed);
        response.on('end', ended);
        response.on('data', data);
        if (token.cancelled) cancel();
        else response.resume();
      });
      const speed = received / Math.max(0.001, (now() - started) / 1000);
      const stats = routeHealth[proxyHost];
      // Only real HTTP samples qualify fallbacks and inform later candidate ordering.
      stats.probeBytesPerSecond = Math.round(speed);
      return received === sampleSize;
    } finally {
      try { requestAbort?.(); } catch {}
      response.destroy?.();
      setActiveAbort(null);
    }
  }

  async function verifyFile(file, expected) {
    const identity = expected.identity || expected;
    let stat;
    try {
      stat = await fs.promises.lstat(file);
    } catch {
      throw normalizeRouteError('Downloaded update file is missing.', 'ERR_UPDATE_SIZE');
    }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== identity.size) {
      throw normalizeRouteError('Downloaded update file size does not match the trusted release asset.', 'ERR_UPDATE_SIZE');
    }
    const digest256 = createHash('sha256');
    const digest512 = createHash('sha512');
    for await (const chunk of fs.createReadStream(file)) {
      digest256.update(chunk);
      digest512.update(chunk);
    }
    const sha256 = digest256.digest('hex');
    if (sha256 !== identity.sha256) throw normalizeRouteError('Downloaded update file SHA-256 does not match.', 'ERR_UPDATE_SHA256');
    const sha512Encoding = /^[a-f0-9]{128}$/i.test(expected.sha512) ? 'hex' : 'base64';
    const sha512 = digest512.digest(sha512Encoding);
    if (sha512 !== expected.sha512) throw normalizeRouteError('Downloaded update file SHA-512 does not match the official update manifest.', 'ERR_UPDATE_SHA512');
  }

  async function downloadFromSource({
    source,
    proxyHost,
    officialUrl,
    destination,
    partialPath,
    metadataPath,
    metadata,
    expected,
    options,
    token,
    setActiveAbort,
  }) {
    let currentUrl = source === 'proxy' ? buildProxyUrl(officialUrl, proxyHost) : new URL(officialUrl.href);
    let redirectedCrossOrigin = false;
    let redirectCount = 0;
    let attemptBytes = 0;
    const attemptStarted = now();
    let lastProgressAt = attemptStarted;
    let sampleStarted = attemptStarted;
    let sampleBytes = 0;
    let lowSpeedSince = null;
    let routeAbortError = null;
    let monitor = null;
    let activeResponse = null;
    let activeRequestAbort = null;
    const progress = options.onProgress;

    const checkToken = () => {
      if (token?.cancelled) throw new CancellationError();
    };
    checkToken();

    try {
      while (true) {
        checkToken();
        const resume = await readResume(partialPath, metadataPath, expected.identity);
        let offset = resume.offset;
        metadata = resume.metadata;

        const headers = source === 'proxy' || redirectedCrossOrigin
          ? proxyHeaders(options.headers)
          : { ...options.headers };
        if (offset > 0) {
          headers.Range = `bytes=${offset}-`;
          const validator = metadata.etag || metadata.lastModified;
          if (validator) headers['If-Range'] = validator;
        }

        const responseResult = await receiveResponse(currentUrl, headers, token, idleTimeoutMs, abort => {
          activeRequestAbort = abort;
          setActiveAbort(abort);
        });
        if (responseResult.redirect) {
          if (++redirectCount > 10) throw normalizeRouteError('Update source redirected too many times.', 'ERR_UPDATE_REDIRECT');
          if (source === 'official' && PROXY_HOSTS.includes(responseResult.redirect.hostname.toLowerCase())) {
            throw normalizeRouteError('The official update source redirected to an untrusted proxy route.', 'ERR_UPDATE_REDIRECT');
          }
          if (currentUrl.hostname.toLowerCase() !== responseResult.redirect.hostname.toLowerCase()) {
            redirectedCrossOrigin = true;
          }
          currentUrl = responseResult.redirect;
          continue;
        }

        const response = responseResult.response;
        activeResponse = response;
        const status = Number(response?.statusCode);
        if (status === 416) {
          if (offset === expected.identity.size) {
            await verifyFile(partialPath, expected);
            checkToken();
            await fs.promises.rename(partialPath, destination);
            await fs.promises.unlink(metadataPath).catch(() => {});
            if (options.onProgress) options.onProgress({
              total: expected.identity.size,
              transferred: expected.identity.size,
              percent: 100,
              bytesPerSecond: Math.round(attemptBytes / Math.max(0.001, (now() - attemptStarted) / 1000)),
              delta: 0,
            });
            return { bytesPerSecond: attemptBytes / Math.max(1, (now() - attemptStarted) / 1000) };
          }
          await removeOwnedFiles(partialPath, metadataPath);
          throw normalizeRouteError('Update source rejected the resume range.', 'ERR_UPDATE_RANGE');
        }
        if (status !== 200 && status !== 206) {
          response.destroy?.();
          throw normalizeRouteError(`Update source returned HTTP ${Number.isFinite(status) ? status : 'unknown'}.`, 'ERR_UPDATE_HTTP');
        }

        let append = false;
        if (offset > 0 && status === 206) {
          const range = parseContentRange(getHeader(response.headers, 'content-range'));
          if (!range || range.start !== offset || range.end !== expected.identity.size - 1
              || range.total !== expected.identity.size) {
            response.destroy?.();
            throw normalizeRouteError('Update source returned an invalid partial range.', 'ERR_UPDATE_RANGE');
          }
          const contentLength = getHeader(response.headers, 'content-length');
          if (contentLength && Number(contentLength) !== range.end - range.start + 1) {
            response.destroy?.();
            throw normalizeRouteError('Update source returned an inconsistent partial length.', 'ERR_UPDATE_RANGE');
          }
          const responseEtag = getHeader(response.headers, 'etag');
          const responseModified = getHeader(response.headers, 'last-modified');
          if ((metadata.etag && responseEtag && metadata.etag !== responseEtag)
              || (!metadata.etag && metadata.lastModified && responseModified && metadata.lastModified !== responseModified)) {
            response.destroy?.();
            await removeOwnedFiles(partialPath, metadataPath);
            throw normalizeRouteError('Update source changed while resuming the file.', 'ERR_UPDATE_RANGE');
          }
          append = true;
        } else if (status === 206) {
          response.destroy?.();
          throw normalizeRouteError('Update source returned an unexpected partial response.', 'ERR_UPDATE_RANGE');
        }

        if (offset > 0 && status === 200) {
          // Some endpoints ignore Range; a 200 is the complete representation, so restart safely.
          offset = 0;
          append = false;
        }

        const contentLength = getHeader(response.headers, 'content-length');
        if (contentLength) {
          const declared = Number(contentLength);
          const range = status === 206 ? parseContentRange(getHeader(response.headers, 'content-range')) : null;
          const expectedLength = range ? range.end - range.start + 1 : expected.identity.size;
          if (!Number.isSafeInteger(declared) || declared !== expectedLength) {
            response.destroy?.();
            throw normalizeRouteError('Update source returned an unexpected file length.', 'ERR_UPDATE_SIZE');
          }
        }

        const etag = getHeader(response.headers, 'etag');
        const lastModified = getHeader(response.headers, 'last-modified');
        if (etag || lastModified) {
          metadata = { ...metadata, etag: etag || (append ? metadata.etag : '') || '', lastModified: lastModified || (append ? metadata.lastModified : '') || '' };
          await writeMetadata(metadataPath, metadata);
        } else if (!append && (metadata.etag || metadata.lastModified)) {
          metadata = { ...metadata, etag: '', lastModified: '' };
          await writeMetadata(metadataPath, metadata);
        }

        const controller = new AbortController();
        activeResponse = response;
        let outputBytes = offset;
        let emittedAt = 0;
        const sizeGuard = new Transform({
          transform(chunk, encoding, callback) {
            outputBytes += chunk.length;
            attemptBytes += chunk.length;
            sampleBytes += chunk.length;
            lastProgressAt = now();
            if (outputBytes > expected.identity.size) {
              callback(normalizeRouteError('Downloaded update file exceeds its trusted size.', 'ERR_UPDATE_SIZE'));
              return;
            }
            const elapsed = Math.max(1, now() - emittedAt);
            if (progress && (elapsed >= 250 || outputBytes === expected.identity.size)) {
              const elapsedSeconds = Math.max(0.001, (now() - attemptStarted) / 1000);
              progress({
                total: expected.identity.size,
                transferred: outputBytes,
                percent: Math.min(100, outputBytes / expected.identity.size * 100),
                bytesPerSecond: Math.round(attemptBytes / elapsedSeconds),
                delta: chunk.length,
              });
              emittedAt = now();
            }
            callback(null, chunk);
          },
        });
        const output = fs.createWriteStream(partialPath, { flags: append ? 'a' : 'w', mode: 0o600 });
        response.pause();

        const abortController = error => {
          routeAbortError = error;
          try { activeRequestAbort?.(); } catch {}
          try { controller.abort(error); } catch {}
          try { response.destroy(error); } catch {}
        };
        const tick = Math.max(250, Math.min(1000, Math.floor(idleTimeoutMs / 4)));
        const warmupMs = Math.max(1000, Math.min(12000, slowWindowMs));
        monitor = setIntervalFn(() => {
          const current = now();
          if (token?.cancelled) {
            abortController(new CancellationError());
            return;
          }
          if (current - lastProgressAt >= idleTimeoutMs) {
            abortController(normalizeRouteError('Update source stopped sending data.', 'ERR_UPDATE_TIMEOUT'));
            return;
          }
          const sampleElapsed = current - sampleStarted;
          if (sampleElapsed < tick) return;
          const speed = sampleBytes / Math.max(0.001, sampleElapsed / 1000);
          if (current - attemptStarted >= warmupMs && speed < minSpeedBytesPerSecond) {
            if (lowSpeedSince == null) lowSpeedSince = current;
            if (current - lowSpeedSince >= slowWindowMs) {
              abortController(normalizeRouteError('Update source is consistently too slow.', 'ERR_UPDATE_SLOW'));
            }
          } else {
            lowSpeedSince = null;
          }
          sampleBytes = 0;
          sampleStarted = current;
        }, tick);

        try {
          await pipeline(response, sizeGuard, output, { signal: controller.signal });
        } catch (error) {
          if (token?.cancelled) throw new CancellationError();
          if (routeAbortError) throw routeAbortError;
          if (error?.code === 'ERR_UPDATE_SIZE') {
            await removeOwnedFiles(partialPath, metadataPath);
            throw error;
          }
          // A broken stream is resumable on the next route attempt.
          throw normalizeRouteError('Update source transfer was interrupted.', 'ERR_UPDATE_INTERRUPTED');
        } finally {
          if (monitor) clearIntervalFn(monitor);
          monitor = null;
          activeResponse = null;
          activeRequestAbort = null;
          setActiveAbort(null);
        }

        const size = await fs.promises.stat(partialPath).then(stat => stat.size).catch(() => 0);
        if (size !== expected.identity.size) {
          throw normalizeRouteError('Update source ended before the complete file arrived.', 'ERR_UPDATE_INTERRUPTED');
        }
        await verifyFile(partialPath, expected);
        checkToken();
        await fs.promises.rename(partialPath, destination);
        await fs.promises.unlink(metadataPath).catch(() => {});
        if (progress) progress({
          total: expected.identity.size,
          transferred: expected.identity.size,
          percent: 100,
          bytesPerSecond: Math.round(attemptBytes / Math.max(0.001, (now() - attemptStarted) / 1000)),
          delta: 0,
        });
        return { bytesPerSecond: attemptBytes / Math.max(0.001, (now() - attemptStarted) / 1000) };
      }
    } catch (error) {
      if (monitor) clearIntervalFn(monitor);
      if (options.cancellationToken?.cancelled || error instanceof CancellationError) throw new CancellationError();
      throw error;
    } finally {
      if (activeResponse && !activeResponse.destroyed) activeResponse.destroy();
      activeResponse = null;
      activeRequestAbort = null;
      setActiveAbort(null);
    }
  }

  async function waitBackoff(index, token) {
    const delay = Array.isArray(backoff) ? Number(backoff[index] || 0) : Number(backoff || 0);
    if (!Number.isFinite(delay) || delay <= 0) {
      if (token?.cancelled) throw new CancellationError();
      return;
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeoutFn(done, delay);
      function done() {
        token?.removeListener?.('cancel', cancel);
        resolve();
      }
      function cancel() {
        clearTimeoutFn(timer);
        token?.removeListener?.('cancel', cancel);
        reject(new CancellationError());
      }
      if (token?.once) token.once('cancel', cancel);
      if (token?.cancelled) cancel();
    });
  }

  async function routeDownload(url, destination, options, expected) {
    const officialUrl = url instanceof URL ? new URL(url.href) : new URL(String(url));
    if (options.cancellationToken?.cancelled || disposed) throw new CancellationError();
    if (!isValidSha512(options.sha512)) {
      throw normalizeRouteError('The official update manifest does not contain a valid SHA-512 digest.', 'ERR_UPDATE_MANIFEST');
    }
    const identity = { ...expected.asset, sha256: expected.asset.sha256 };
    const pendingDir = path.dirname(destination);
    const cacheRoot = path.dirname(pendingDir);
    const identityKey = createHash('sha256')
      .update(JSON.stringify([identity.tag, identity.name, identity.size, identity.sha256]))
      .digest('hex');
    const partialDir = path.join(cacheRoot, '.hongguo-update-parts', identityKey);
    await fs.promises.mkdir(path.dirname(partialDir), { recursive: true, mode: 0o700 });
    const stateRoot = await fs.promises.lstat(path.dirname(partialDir));
    if (!stateRoot.isDirectory() || stateRoot.isSymbolicLink()) {
      throw normalizeRouteError('The update resume cache is not a trusted directory.', 'ERR_UPDATE_CACHE');
    }
    await pruneResumeCache(path.dirname(partialDir), identityKey);
    await fs.promises.mkdir(partialDir, { recursive: true, mode: 0o700 });
    const stateDir = await fs.promises.lstat(partialDir);
    if (!stateDir.isDirectory() || stateDir.isSymbolicLink()) {
      throw normalizeRouteError('The update resume data is not a trusted directory.', 'ERR_UPDATE_CACHE');
    }
    await fs.promises.chmod(path.dirname(partialDir), 0o700).catch(() => {});
    await fs.promises.chmod(partialDir, 0o700).catch(() => {});
    const partialPath = path.join(partialDir, 'installer.partial');
    const metadataPath = `${partialPath}.json`;
    const rawSha512 = String(options.sha512).trim();
    const sha512 = /^[a-f0-9]{128}$/i.test(rawSha512) ? rawSha512.toLowerCase() : rawSha512;
    const verification = { identity, sha512 };
    const proxyCandidates = [...PROXY_HOSTS].sort((left, right) => routeScore(routeHealth[right]) - routeScore(routeHealth[left]));
    const attempts = [
      { source: 'official' },
      ...proxyCandidates.map(proxyHost => ({ source: 'proxy', proxyHost })),
      { source: 'official' },
    ];
    const failures = [];
    if (disposed || options.cancellationToken?.cancelled) throw new CancellationError();
    const token = new CancellationToken(options.cancellationToken);
    activeTokens.add(token);
    let activeAbort = null;
    const cancelActive = () => { try { activeAbort?.(); } catch {} };
    if (token?.once) token.once('cancel', cancelActive);
    try {
      for (let index = 0; index < attempts.length; index++) {
        const { source, proxyHost } = attempts[index];
        if (token?.cancelled) throw new CancellationError();
        if (source === 'proxy') {
          let enabled = false;
          try { enabled = allowProxy() === true; } catch {}
          if (!enabled || !identity.sha256 || now() < routeHealth[proxyHost].cooldownUntil) continue;
        }
        if (index > 0) await waitBackoff(Math.min(index - 1, 1), token);
        let transferStarted = false;
        try {
          if (source === 'proxy' && !await probeProxy(officialUrl, proxyHost, identity, options, token, abort => { activeAbort = abort; })) continue;
          transferStarted = true;
          reportRoute(source, proxyHost);
          const result = await downloadFromSource({
            source,
            proxyHost,
            officialUrl,
            destination,
            partialPath,
            metadataPath,
            metadata: null,
            expected: verification,
            options,
            token,
            setActiveAbort: abort => { activeAbort = abort; },
          });
          updateRouteHealth(source, true, result.bytesPerSecond, proxyHost);
          await fs.promises.rmdir(partialDir).catch(() => {});
          return destination;
        } catch (error) {
          if (token?.cancelled || error instanceof CancellationError) throw new CancellationError();
          updateRouteHealth(source, false, 0, proxyHost);
          failures.push(error);
          if (transferStarted && ['ERR_UPDATE_SHA256', 'ERR_UPDATE_SHA512', 'ERR_UPDATE_SIZE', 'ERR_UPDATE_RANGE'].includes(error?.code)) {
            await removeOwnedFiles(partialPath, metadataPath);
          }
        }
      }
      const failure = normalizeRouteError('All trusted update download routes failed.', 'ERR_UPDATE_ROUTES_FAILED');
      failure.routeErrors = failures.map(error => error?.code || error?.name || 'unknown');
      throw failure;
    } finally {
      if (token?.removeListener) token.removeListener('cancel', cancelActive);
      activeTokens.delete(token);
      token.dispose();
      activeAbort = null;
    }
  }

  const wrappedDownload = (url, destination, options = {}) => {
    if (disposed || !asset) return originalDownload(url, destination, options);
    const destinationName = path.basename(String(destination || ''));
    const targetPrefix = `temp-${asset.name}`;
    const isTargetAsset = destinationName === targetPrefix
      || new RegExp(`^\\d+-${targetPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).test(destinationName);
    let matched = false;
    try { matched = officialAssetMatch(url, asset); }
    catch (error) { return Promise.reject(error); }
    if (!matched) {
      if (isTargetAsset) return Promise.reject(normalizeRouteError(
        'The installer URL does not match the trusted GitHub release asset.',
        'ERR_UPDATE_URL',
      ));
      return originalDownload(url, destination, options);
    }
    if (!isValidSha512(options.sha512)) {
      return Promise.reject(normalizeRouteError('The official update manifest SHA-512 is required.', 'ERR_UPDATE_MANIFEST'));
    }
    return routeDownload(url, destination, options, { asset });
  };

  executor.download = wrappedDownload;

  return {
    setAsset(value) {
      asset = value == null ? null : safeAsset(value);
      if (value != null && !asset) throw new TypeError('Invalid trusted GitHub release asset metadata.');
    },
    async verifyDownloadedFile(file, sha512) {
      if (!asset || !isValidSha512(sha512)) {
        throw normalizeRouteError('Trusted release metadata is required to verify the cached installer.', 'ERR_UPDATE_MANIFEST');
      }
      const raw = String(sha512).trim();
      await verifyFile(file, { identity: { ...asset }, sha512: /^[a-f0-9]{128}$/i.test(raw) ? raw.toLowerCase() : raw });
    },
    dispose() {
      disposed = true;
      asset = null;
      for (const token of activeTokens) token.cancel();
      if (executor.download === wrappedDownload) executor.download = previousDownload;
    },
  };
}

module.exports = {
  createUpdateDownloadRouter,
  buildProxyUrl,
  proxyHeaders,
  isAllowedRedirect,
};

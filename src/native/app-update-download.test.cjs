const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { CancellationError, CancellationToken } = require('builder-util-runtime');
const { createUpdateDownloadRouter, buildProxyUrl, proxyHeaders, isAllowedRedirect } = require('./app-update-download');

const body = Buffer.from('trusted installer');
const sha256 = createHash('sha256').update(body).digest('hex');
const sha512 = createHash('sha512').update(body).digest('base64');
const officialUrl = new URL('https://github.com/yuchen0x1/HongGuo-PC/releases/download/v2.0/hongguo-downloader-2.0-win-x64-setup.exe');
const asset = {
  tag: 'v2.0',
  name: 'hongguo-downloader-2.0-win-x64-setup.exe',
  size: body.length,
  sha256,
};

function makeResponse({ statusCode = 200, headers = {}, chunks = [body], delay = 0, errorAfter = -1, neverEnd = false } = {}) {
  const response = new Readable({ read() {} });
  response.on('error', () => {});
  response.statusCode = statusCode;
  response.headers = { ...headers };
  let index = 0;
  const pushNext = () => {
    if (response.destroyed) return;
    if (index === errorAfter) {
      response.destroy(new Error('synthetic interrupted response'));
      return;
    }
    if (index >= chunks.length) {
      if (!neverEnd) response.push(null);
      return;
    }
    response.push(chunks[index++]);
    if (delay > 0) setTimeout(pushNext, delay);
    else setImmediate(pushNext);
  };
  setImmediate(pushNext);
  return response;
}

class FakeRequest extends EventEmitter {
  constructor(options, callback, scenario) {
    super();
    this.options = options;
    this.callback = callback;
    this.scenario = scenario;
    this.response = null;
    this.aborted = false;
  }
  end() {
    this.scenario(this);
  }
  abort() {
    if (this.aborted) return;
    this.aborted = true;
    if (this.response && !this.response.destroyed) this.response.destroy(new Error('synthetic request aborted'));
    else this.emit('error', new Error('synthetic request aborted'));
  }
  respond(options) {
    this.response = makeResponse(options);
    this.callback(this.response);
  }
}

function fakeExecutor(scenarios = [], { probeScenarios = {} } = {}) {
  const calls = [];
  const probeCalls = [];
  let originalDownloads = 0;
  return {
    calls,
    probeCalls,
    get originalDownloads() { return originalDownloads; },
    download: async () => { originalDownloads++; return 'original'; },
    createRequest(options, callback) {
      const range = /^bytes=0-(\d+)$/.exec(options.headers?.Range || '');
      const isProbe = !!range;
      const scenario = isProbe
        ? probeScenarios[options.hostname]?.shift() || (options.hostname === 'gh-proxy.com'
          ? request => request.emit('error', new Error('backup probe unavailable in fixture'))
          : request => request.respond({
          statusCode: 206,
          headers: { 'content-length': String(Number(range[1]) + 1), 'content-range': `bytes 0-${range[1]}/${body.length}` },
          chunks: [body.subarray(0, Number(range[1]) + 1)],
        }))
        : scenarios.shift() || (request => request.emit('error', new Error('no fixture response')));
      const request = new FakeRequest(options, callback, request => {
        (isProbe ? probeCalls : calls).push({ options, request });
        scenario(request, options);
      });
      return request;
    },
  };
}

function fullResponse(request, bytes = body, extra = {}) {
  request.respond({
    statusCode: 200,
    headers: { 'content-length': String(bytes.length), etag: '"release-v2"', ...extra.headers },
    chunks: [bytes],
    ...extra,
  });
}

function settings(destination, token = new CancellationToken(), extra = {}) {
  return {
    sha512,
    cancellationToken: token,
    headers: {
      accept: '*/*',
      'User-Agent': 'Hongguo-Update-Test',
      'Cache-Control': 'no-cache',
      authorization: 'token must-not-leak',
      cookie: 'private=must-not-leak',
      'x-user-staging-id': 'private-user-id',
      'x-private-token': 'must-not-leak',
    },
    onProgress() {},
    ...extra,
  };
}

function makeTemp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hongguo-update-router-'));
  const pendingDir = path.join(dir, 'pending');
  fs.mkdirSync(pendingDir);
  return { dir, pendingDir, destination: path.join(pendingDir, `temp-${asset.name}`) };
}

function partialPath(temp) {
  const key = createHash('sha256')
    .update(JSON.stringify([asset.tag, asset.name, asset.size, asset.sha256]))
    .digest('hex');
  return path.join(temp.dir, '.hongguo-update-parts', key, 'installer.partial');
}

function routeUrl(call) {
  return new URL(`${call.options.protocol}//${call.options.hostname}${call.options.path}`);
}

async function run(executor, destination, extra = {}, routerOptions = {}) {
  const routes = [];
  const router = createUpdateDownloadRouter({
    executor,
    onRoute: route => routes.push(route),
    backoff: 0,
    ...routerOptions,
  });
  router.setAsset(asset);
  try {
    const result = await executor.download(officialUrl, destination, settings(destination, new CancellationToken(), extra));
    return { result, routes };
  } finally {
    router.dispose();
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack || error}`);
    process.exitCode = 1;
  }
}

(async () => {
  assert.equal(buildProxyUrl(officialUrl).href, `https://gh-proxy.org/${officialUrl.href}`);
  assert.deepEqual(proxyHeaders({
    Accept: '*/*',
    'Accept-Encoding': 'identity',
    authorization: 'secret',
    Cookie: 'secret',
    'x-user-staging-id': 'private',
    Range: 'bytes=4-',
    'If-Range': '"e1"',
    'User-Agent': 'app',
  }), {
    Accept: '*/*',
    'Accept-Encoding': 'identity',
    Range: 'bytes=4-',
    'If-Range': '"e1"',
    'User-Agent': 'app',
  });
  assert.equal(isAllowedRedirect('https://release-assets.githubusercontent.com/file.exe'), true);
  assert.equal(isAllowedRedirect('https://user-content.githubusercontent.com/file.exe'), false);
  assert.equal(isAllowedRedirect('https://release-assets.githubusercontent.com:8443/file.exe'), false);
  assert.throws(() => buildProxyUrl('https://github.com:8443/yuchen0x1/HongGuo-PC/releases/download/v2.0/setup.exe'), /不安全/);
  assert.throws(() => buildProxyUrl('https://github.com/private-owner/private-repo/releases/download/v2.0/setup.exe'), /不安全/);
  assert.throws(() => buildProxyUrl(officialUrl, 'unverified.invalid'), /不安全/);

  await test('official release downloads first and verifies both trusted digests', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([request => fullResponse(request)]);
    try {
      const { result, routes } = await run(executor, temp.destination);
      assert.equal(result, temp.destination);
      assert.deepEqual(routes, ['official']);
      assert.equal(routeUrl(executor.calls[0]).hostname, 'github.com');
      assert.equal(executor.calls[0].options.redirect, 'manual');
      assert.equal(executor.calls[0].options.useSessionCookies, false);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('official CDN redirects strip private headers before the cross-origin request', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([
      request => request.emit('redirect', 302, 'GET', 'https://release-assets.githubusercontent.com/public-installer.exe'),
      request => fullResponse(request),
    ]);
    try {
      const { result, routes } = await run(executor, temp.destination);
      assert.equal(result, temp.destination);
      assert.deepEqual(routes, ['official']);
      assert.equal(routeUrl(executor.calls[1]).hostname, 'release-assets.githubusercontent.com');
      assert.equal(JSON.stringify(executor.calls[1].options.headers).includes('must-not-leak'), false);
      assert.equal(JSON.stringify(executor.calls[1].options.headers).includes('private-user-id'), false);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('official redirects cannot silently route a request through GH-Proxy', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([
      request => request.emit('redirect', 302, 'GET', 'https://gh-proxy.org/private-target'),
      request => request.emit('error', new Error('proxy unavailable')),
      request => request.emit('error', new Error('official unavailable')),
    ]);
    const router = createUpdateDownloadRouter({ executor, backoff: 0 });
    router.setAsset(asset);
    try {
      await assert.rejects(
        () => executor.download(officialUrl, temp.destination, settings(temp.destination)),
        /routes failed/,
      );
      assert.deepEqual(executor.calls.map(routeUrl).map(url => url.hostname), ['github.com', 'gh-proxy.org', 'github.com']);
      assert.equal(executor.calls[1].options.path.includes('private-target'), false);
      assert.equal(JSON.stringify(executor.calls[1].options.headers).includes('must-not-leak'), false);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('official failure falls back to GH-Proxy without sensitive headers', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([
      request => request.emit('error', new Error('official unavailable')),
      request => fullResponse(request),
    ]);
    try {
      const { result, routes } = await run(executor, temp.destination);
      assert.equal(result, temp.destination);
      assert.deepEqual(routes, ['official', 'proxy']);
      assert.equal(executor.probeCalls.length, 1);
      assert.equal(executor.probeCalls[0].options.headers.Range, `bytes=0-${body.length - 1}`);
      assert.equal(JSON.stringify(executor.probeCalls[0].options.headers).includes('must-not-leak'), false);
      const proxy = executor.calls[1];
      assert.equal(routeUrl(proxy).hostname, 'gh-proxy.org');
      assert.ok(routeUrl(proxy).pathname.startsWith('/https://github.com/yuchen0x1/HongGuo-PC/releases/download/'));
      for (const key of Object.keys(proxy.options.headers)) {
        assert.ok(['accept', 'accept-encoding', 'user-agent', 'cache-control'].includes(key.toLowerCase()), `unexpected proxy header ${key}`);
      }
      assert.equal(JSON.stringify(proxy.options.headers).includes('must-not-leak'), false);
      assert.equal(JSON.stringify(proxy.options.headers).includes('private-user-id'), false);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('proxy failure returns to one bounded official retry', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([
      request => request.emit('error', new Error('official unavailable')),
      request => request.emit('error', new Error('proxy unavailable')),
      request => fullResponse(request),
    ]);
    try {
      const { result, routes } = await run(executor, temp.destination);
      assert.equal(result, temp.destination);
      assert.deepEqual(routes, ['official', 'proxy', 'official']);
      assert.deepEqual(executor.calls.map(routeUrl).map(url => url.hostname), ['github.com', 'gh-proxy.org', 'github.com']);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('documented proxy host failure tries the verified same-provider backup', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([
      request => request.emit('error', new Error('official unavailable')),
      request => request.emit('error', new Error('primary proxy interrupted')),
      request => fullResponse(request),
    ], { probeScenarios: { 'gh-proxy.com': [request => fullResponse(request)] } });
    try {
      const { routes } = await run(executor, temp.destination);
      assert.deepEqual(routes, ['official', 'proxy', 'proxy']);
      assert.deepEqual(executor.calls.map(routeUrl).map(url => url.hostname), ['github.com', 'gh-proxy.org', 'gh-proxy.com']);
      assert.deepEqual(executor.probeCalls.map(routeUrl).map(url => url.hostname), ['gh-proxy.org', 'gh-proxy.com']);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('proxy qualification rejects wrong ranges and bounded body timeouts before full download', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([
      request => request.emit('error', new Error('official unavailable')),
      request => fullResponse(request),
    ], { probeScenarios: {
      'gh-proxy.org': [request => request.respond({
        statusCode: 206,
        headers: { 'content-range': `bytes 0-${body.length - 1}/${body.length + 1}` },
      })],
      'gh-proxy.com': [request => request.respond({
        statusCode: 206,
        headers: { 'content-range': `bytes 0-${body.length - 1}/${body.length}`, 'content-length': String(body.length) },
        chunks: [], neverEnd: true,
      })],
    } });
    try {
      const { routes } = await run(executor, temp.destination, {}, { probeTimeoutMs: 30 });
      assert.deepEqual(routes, ['official', 'official']);
      assert.deepEqual(executor.calls.map(routeUrl).map(url => url.hostname), ['github.com', 'github.com']);
      assert.equal(executor.probeCalls.length, 2);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('failed proxy hosts cool down across retries while official stays first', async () => {
    const temp = makeTemp();
    const fail = request => request.emit('error', new Error('route unavailable'));
    const executor = fakeExecutor([fail, fail, fail, fail, fail, fail, fail, request => fullResponse(request)]);
    const router = createUpdateDownloadRouter({ executor, backoff: 0 });
    router.setAsset(asset);
    try {
      const requestOptions = settings(temp.destination);
      await assert.rejects(() => executor.download(officialUrl, temp.destination, requestOptions), { code: 'ERR_UPDATE_ROUTES_FAILED' });
      await assert.rejects(() => executor.download(officialUrl, temp.destination, requestOptions), { code: 'ERR_UPDATE_ROUTES_FAILED' });
      assert.equal(executor.probeCalls.filter(call => routeUrl(call).hostname === 'gh-proxy.org').length, 2);
      await executor.download(officialUrl, temp.destination, requestOptions);
      assert.equal(executor.probeCalls.filter(call => routeUrl(call).hostname === 'gh-proxy.org').length, 2);
      assert.deepEqual(executor.calls.map(routeUrl).map(url => url.hostname), [
        'github.com', 'gh-proxy.org', 'github.com',
        'github.com', 'gh-proxy.org', 'github.com',
        'github.com', 'github.com',
      ]);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('measured healthy backup is preferred on the next fallback while GitHub remains first', async () => {
    const temp = makeTemp();
    const fail = request => request.emit('error', new Error('route unavailable'));
    const executor = fakeExecutor([
      fail, fail, request => fullResponse(request),
      fail, request => fullResponse(request),
    ], { probeScenarios: { 'gh-proxy.com': [request => fullResponse(request), request => fullResponse(request)] } });
    let clock = Date.now();
    const selected = [];
    const router = createUpdateDownloadRouter({
      executor, backoff: 0, now: () => clock += 5,
      onRoute: (route, details) => selected.push({ route, ...details }),
    });
    router.setAsset(asset);
    try {
      await executor.download(officialUrl, temp.destination, settings(temp.destination));
      await executor.download(officialUrl, temp.destination, settings(temp.destination));
      assert.deepEqual(selected.map(item => item.host), ['github.com', 'gh-proxy.org', 'gh-proxy.com', 'github.com', 'gh-proxy.com']);
      assert(selected[2].score > 0);
      assert(selected[4].score > 0);
      assert.equal(executor.probeCalls.filter(call => routeUrl(call).hostname === 'gh-proxy.org').length, 1);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('official connection timeout switches to GH-Proxy', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([
      request => { request.abort = () => { request.aborted = true; }; },
      request => fullResponse(request),
    ]);
    try {
      const { result, routes } = await run(executor, temp.destination, {}, { idleTimeoutMs: 25 });
      assert.equal(result, temp.destination);
      assert.deepEqual(routes, ['official', 'proxy']);
      assert.deepEqual(executor.calls.map(routeUrl).map(url => url.hostname), ['github.com', 'gh-proxy.org']);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('midstream failure resumes with a validated Range response', async () => {
    const temp = makeTemp();
    const first = body.subarray(0, 5), remainder = body.subarray(5);
    const executor = fakeExecutor([
      request => request.respond({
        statusCode: 200,
        headers: { 'content-length': String(body.length), etag: '"release-v2"' },
        chunks: [first],
        delay: 25,
        errorAfter: 1,
      }),
      (request, options) => {
        assert.equal(options.headers.Range, `bytes=${first.length}-`);
        assert.equal(options.headers['If-Range'], '"release-v2"');
        request.respond({
          statusCode: 206,
          headers: {
            'content-length': String(remainder.length),
            'content-range': `bytes ${first.length}-${body.length - 1}/${body.length}`,
            etag: '"release-v2"',
          },
          chunks: [remainder],
        });
      },
    ]);
    try {
      const { result, routes } = await run(executor, temp.destination);
      assert.equal(result, temp.destination);
      assert.deepEqual(routes, ['official', 'proxy']);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('invalid proxy probes preserve valid official partial bytes for the final direct retry', async () => {
    const temp = makeTemp();
    const first = body.subarray(0, 5);
    const remainder = body.subarray(first.length);
    const executor = fakeExecutor([
      request => request.respond({
        statusCode: 200,
        headers: { 'content-length': String(body.length), etag: '"release-v2"' },
        chunks: [first], delay: 20, errorAfter: 1,
      }),
      (request, options) => {
        assert.equal(options.headers.Range, `bytes=${first.length}-`);
        request.respond({
          statusCode: 206,
          headers: {
            'content-length': String(remainder.length),
            'content-range': `bytes ${first.length}-${body.length - 1}/${body.length}`,
            etag: '"release-v2"',
          },
          chunks: [remainder],
        });
      },
    ], { probeScenarios: { 'gh-proxy.org': [request => request.respond({
      statusCode: 206,
      headers: { 'content-range': `bytes 0-${body.length - 1}/${body.length + 1}` },
    })] } });
    try {
      const { routes } = await run(executor, temp.destination);
      assert.deepEqual(routes, ['official', 'official']);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('partial file remains bound to asset metadata and resumes on the next operation', async () => {
    const temp = makeTemp();
    const first = body.subarray(0, 4);
    const executor = fakeExecutor([
      request => request.respond({ statusCode: 200, headers: { 'content-length': String(body.length) }, chunks: [first], delay: 25, errorAfter: 1 }),
      request => request.emit('error', new Error('proxy interrupted')),
      request => request.emit('error', new Error('official retry interrupted')),
      (request, options) => {
        assert.equal(options.headers.Range, `bytes=${first.length}-`);
        request.respond({
          statusCode: 206,
          headers: {
            'content-length': String(body.length - first.length),
            'content-range': `bytes ${first.length}-${body.length - 1}/${body.length}`,
          },
          chunks: [body.subarray(first.length)],
        });
      },
    ]);
    const router = createUpdateDownloadRouter({ executor, backoff: 0 });
    router.setAsset(asset);
    const requestOptions = settings(temp.destination);
    try {
      await assert.rejects(() => executor.download(officialUrl, temp.destination, requestOptions), error => error.code === 'ERR_UPDATE_ROUTES_FAILED');
      assert.equal(fs.statSync(partialPath(temp)).size, first.length);
      fs.rmSync(temp.pendingDir, { recursive: true, force: true });
      fs.mkdirSync(temp.pendingDir);
      await executor.download(officialUrl, temp.destination, requestOptions);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('invalid Content-Range discards the resume offset before the next route', async () => {
    const temp = makeTemp();
    const first = body.subarray(0, 4), remainder = body.subarray(4);
    const executor = fakeExecutor([
      request => request.respond({
        statusCode: 200,
        headers: { 'content-length': String(body.length), etag: '"release-v2"' },
        chunks: [first],
        delay: 25,
        errorAfter: 1,
      }),
      (request, options) => {
        assert.equal(options.headers.Range, `bytes=${first.length}-`);
        request.respond({
          statusCode: 206,
          headers: {
            'content-length': String(remainder.length),
            'content-range': `bytes ${first.length - 1}-${body.length - 1}/${body.length}`,
          },
          chunks: [remainder],
        });
      },
      (request, options) => {
        assert.equal(options.headers.Range, undefined, 'an invalid partial response must reset the next attempt to byte zero');
        fullResponse(request);
      },
    ]);
    try {
      const { result, routes } = await run(executor, temp.destination);
      assert.equal(result, temp.destination);
      assert.deepEqual(routes, ['official', 'proxy', 'official']);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
      assert.equal(fs.existsSync(partialPath(temp)), false);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('truncated open-ended Content-Range is rejected before it can be resumed', async () => {
    const temp = makeTemp();
    const first = body.subarray(0, 4), remainder = body.subarray(4);
    const executor = fakeExecutor([
      request => request.respond({
        statusCode: 200,
        headers: { 'content-length': String(body.length), etag: '"release-v2"' },
        chunks: [first],
        delay: 25,
        errorAfter: 1,
      }),
      (request, options) => {
        assert.equal(options.headers.Range, `bytes=${first.length}-`);
        request.respond({
          statusCode: 206,
          headers: {
            'content-range': `bytes ${first.length}-${body.length - 2}/${body.length}`,
          },
          chunks: [remainder.subarray(0, remainder.length - 1)],
        });
      },
      (request, options) => {
        assert.equal(options.headers.Range, undefined);
        fullResponse(request);
      },
    ]);
    try {
      const { result, routes } = await run(executor, temp.destination);
      assert.equal(result, temp.destination);
      assert.deepEqual(routes, ['official', 'proxy', 'official']);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('sustained slow official transfer switches to GH-Proxy', async () => {
    const temp = makeTemp();
    const pieces = [...body].map(byte => Buffer.from([byte]));
    const executor = fakeExecutor([
      request => request.respond({
        statusCode: 200,
        headers: { 'content-length': String(body.length) },
        chunks: pieces,
        delay: 300,
      }),
      request => fullResponse(request),
    ]);
    try {
      const { result, routes } = await run(executor, temp.destination, {}, {
        minSpeedBytesPerSecond: 100000,
        slowWindowMs: 250,
        idleTimeoutMs: 1500,
      });
      assert.equal(result, temp.destination);
      assert.deepEqual(routes.slice(0, 2), ['official', 'proxy']);
      assert.deepEqual(fs.readFileSync(temp.destination), body);
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  await test('HTTP update URLs are rejected and unmatched files keep the original updater', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([]);
    const router = createUpdateDownloadRouter({ executor });
    router.setAsset(asset);
    try {
      await assert.rejects(() => executor.download(
        new URL(officialUrl.href.replace('https:', 'http:')),
        temp.destination,
        settings(temp.destination),
      ), error => /非 HTTPS/.test(error.message));
      assert.equal(executor.originalDownloads, 0);
      await assert.rejects(() => executor.download(
        officialUrl.href.replace('github.com/', 'github.com:8443/'),
        temp.destination,
        settings(temp.destination),
      ), { code: 'ERR_UPDATE_URL' });
      assert.equal(executor.originalDownloads, 0);
      assert.equal(await executor.download(
        'https://github.com/other/repo/releases/download/v2.0/demo.exe',
        path.join(temp.pendingDir, 'other.exe'),
        {},
      ), 'original');
      assert.equal(executor.originalDownloads, 1);
      await assert.rejects(() => executor.download(
        'https://github.com/yuchen0x1/HongGuo-PC/releases/download/v2.0/other-setup.exe',
        path.join(temp.pendingDir, `temp-${asset.name}`),
        settings(temp.destination),
      ), { code: 'ERR_UPDATE_URL' });
      assert.equal(executor.originalDownloads, 1);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('unsafe redirects are never followed to untrusted hosts', async () => {
    const temp = makeTemp();
    const redirect = request => request.emit('redirect', 302, 'GET', 'https://evil.invalid/payload.exe');
    const executor = fakeExecutor([redirect, redirect, redirect]);
    const router = createUpdateDownloadRouter({ executor, backoff: 0 });
    router.setAsset(asset);
    try {
      await assert.rejects(() => executor.download(officialUrl, temp.destination, settings(temp.destination)), /routes failed/);
      assert.deepEqual(executor.calls.map(routeUrl).map(url => url.hostname), ['github.com', 'gh-proxy.org', 'github.com']);
      assert.equal(executor.calls.some(call => routeUrl(call).hostname === 'evil.invalid'), false);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('invalid ranges, wrong sizes, and digest mismatches cannot produce an installable file', async () => {
    const temp = makeTemp();
    const wrong = Buffer.from('untrusted installer');
    const wrongSize = Buffer.from('short');
    const executor = fakeExecutor([
      request => fullResponse(request, wrong),
      request => fullResponse(request, wrong),
      request => fullResponse(request, wrong),
    ]);
    const router = createUpdateDownloadRouter({ executor, backoff: 0 });
    router.setAsset(asset);
    try {
      await assert.rejects(() => executor.download(officialUrl, temp.destination, settings(temp.destination)), /routes failed/);
      assert.equal(fs.existsSync(temp.destination), false);
      assert.equal(fs.existsSync(partialPath(temp)), false);
      const rangeExecutor = fakeExecutor([
        request => request.emit('error', new Error('official unavailable')),
        request => request.respond({
          statusCode: 206,
          headers: { 'content-length': '1', 'content-range': `bytes 1-1/${body.length}` },
          chunks: [Buffer.from('x')],
        }),
        request => fullResponse(request, wrongSize),
      ]);
      const rangeRouter = createUpdateDownloadRouter({ executor: rangeExecutor, backoff: 0 });
      rangeRouter.setAsset(asset);
      await assert.rejects(() => rangeExecutor.download(officialUrl, temp.destination, settings(temp.destination)), /routes failed/);
      assert.equal(fs.existsSync(temp.destination), false);
      rangeRouter.dispose();
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('cancellation stops transfer without trying another route or marking a file ready', async () => {
    const temp = makeTemp();
    const token = new CancellationToken();
    const executor = fakeExecutor([
      request => request.respond({
        statusCode: 200,
        headers: { 'content-length': String(body.length) },
        chunks: [body.subarray(0, 2)],
        delay: 1000,
        neverEnd: true,
      }),
    ]);
    const router = createUpdateDownloadRouter({ executor, backoff: 0 });
    router.setAsset(asset);
    try {
      const pending = executor.download(officialUrl, temp.destination, settings(temp.destination, token));
      setTimeout(() => token.cancel(), 50);
      await assert.rejects(pending, error => error instanceof CancellationError);
      assert.equal(executor.calls.length, 1);
      assert.equal(fs.existsSync(temp.destination), false);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('disposing an active router cancels transfer and restores the original method', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([request => request.respond({
      statusCode: 200,
      headers: { 'content-length': String(body.length) },
      chunks: [body.subarray(0, 2)],
      delay: 1000,
      neverEnd: true,
    })]);
    const previous = executor.download;
    const router = createUpdateDownloadRouter({ executor, backoff: 0 });
    router.setAsset(asset);
    try {
      const pending = executor.download(officialUrl, temp.destination, settings(temp.destination));
      setTimeout(() => router.dispose(), 30);
      await assert.rejects(pending, error => error instanceof CancellationError);
      assert.equal(executor.download, previous);
      assert.equal(executor.calls.length, 1);
      assert.equal(fs.existsSync(temp.destination), false);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('cached installers require exact size and both trusted digests before becoming ready', async () => {
    const temp = makeTemp();
    const executor = fakeExecutor([]);
    const router = createUpdateDownloadRouter({ executor });
    router.setAsset(asset);
    try {
      fs.writeFileSync(temp.destination, body);
      await router.verifyDownloadedFile(temp.destination, sha512);
      await assert.rejects(() => router.verifyDownloadedFile(temp.destination, createHash('sha512').update('wrong manifest').digest('base64')), { code: 'ERR_UPDATE_SHA512' });
      const corrupted = Buffer.from(body);
      corrupted[0] ^= 1;
      fs.writeFileSync(temp.destination, corrupted);
      await assert.rejects(() => router.verifyDownloadedFile(temp.destination, sha512), { code: 'ERR_UPDATE_SHA256' });
      fs.writeFileSync(temp.destination, body.subarray(0, 3));
      await assert.rejects(() => router.verifyDownloadedFile(temp.destination, sha512), { code: 'ERR_UPDATE_SIZE' });
      router.setAsset(null);
      await assert.rejects(() => router.verifyDownloadedFile(temp.destination, sha512), { code: 'ERR_UPDATE_MANIFEST' });
      assert.equal(executor.calls.length, 0);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('same-size SHA-256 corruption is refused on every route without changing an existing destination', async () => {
    const temp = makeTemp();
    const corrupted = Buffer.from(body);
    corrupted[0] ^= 1;
    const executor = fakeExecutor([
      request => fullResponse(request, corrupted),
      request => fullResponse(request, corrupted),
      request => fullResponse(request, corrupted),
    ]);
    const router = createUpdateDownloadRouter({ executor, backoff: 0 });
    router.setAsset(asset);
    fs.writeFileSync(temp.destination, 'previous verified destination');
    try {
      await assert.rejects(() => executor.download(officialUrl, temp.destination, settings(temp.destination)), error =>
        error.code === 'ERR_UPDATE_ROUTES_FAILED' && error.routeErrors.includes('ERR_UPDATE_SHA256'));
      assert.equal(fs.readFileSync(temp.destination, 'utf8'), 'previous verified destination');
      assert.equal(fs.existsSync(partialPath(temp)), false);
    } finally {
      router.dispose();
      fs.rmSync(temp.dir, { recursive: true, force: true });
    }
  });

  await test('old cache cleanup removes only owned files from stale hash directories', async () => {
    const temp = makeTemp();
    const cache = path.join(temp.dir, '.hongguo-update-parts');
    const stale = path.join(cache, 'a'.repeat(64));
    const withUnrecognized = path.join(cache, 'b'.repeat(64));
    const unrelated = path.join(cache, 'user-files');
    for (const directory of [stale, withUnrecognized, unrelated]) {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'installer.partial'), 'old part');
    }
    fs.writeFileSync(path.join(withUnrecognized, 'keep.txt'), 'do not remove');
    const old = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
    for (const directory of [stale, withUnrecognized, unrelated]) fs.utimesSync(directory, old, old);
    const executor = fakeExecutor([request => fullResponse(request)]);
    try {
      await run(executor, temp.destination);
      assert.equal(fs.existsSync(stale), false);
      assert.equal(fs.readFileSync(path.join(withUnrecognized, 'keep.txt'), 'utf8'), 'do not remove');
      assert.equal(fs.readFileSync(path.join(unrelated, 'installer.partial'), 'utf8'), 'old part');
    } finally { fs.rmSync(temp.dir, { recursive: true, force: true }); }
  });

  console.log('App update download router tests complete.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

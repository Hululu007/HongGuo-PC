// Offline regression: real HTTP streams, isolated main process, no GUI/user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
require('./fixtures/direct-http.cjs'); // 本地回环回归必须直连，见文件内说明
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hongguo-stream-'));
const source = path.resolve(__dirname, '../main.js');
const req = createRequire(source);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function load(fetchPlayUrlSingle, overrides = {}) {
  const handlers = {}, protocols = {}, rendererEvents = [], app = new EventEmitter();
  Object.assign(app, { getVersion: () => 'test', getPath: () => root, commandLine: { appendSwitch() {} }, requestSingleInstanceLock: () => true, whenReady: () => ({ then() {} }) });
  const electron = { app, ipcMain: { handle: (n, f) => handlers[n] = f }, protocol: { registerSchemesAsPrivileged() {}, handle: (n, f) => protocols[n] = f } };
  const native = { fetchPlayUrlSingle, UA: 'test', WEB_UA: 'browser-test', WEB_REFERER: 'https://hongguoduanju.com/', VIDEO_REFERER: 'https://example.com/', deriveKey: () => Buffer.alloc(16), decryptMp4Buffer: b => b };
  // These transport fixtures intentionally use a loopback server; the real guard has its own boundary tests.
  const mediaGuard = req('./src/native/web-media-guard');
  overrides = { './src/native/web-media-guard': { webMediaRequestOptions: value => {
    if (new URL(value).hostname === '127.0.0.1') return {};
    return mediaGuard.webMediaRequestOptions(value);
  } }, ...overrides };
  const context = vm.createContext({ require: n => overrides[n] || (n === 'electron' ? electron : n === './src/native/hongguo' ? native : n === './src/store' ? { saveTasks() {}, getSettings: () => ({ root }) } : req(n)), __dirname: path.dirname(source), console: { log() {}, warn() {}, error() {} }, process, Buffer, URL, Response, Request, Headers, AbortController, rendererEvents, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(source, 'utf8'), context, { filename: source });
  vm.runInContext('mainWindow = { webContents: { isDestroyed: () => false, send: (channel, payload) => rendererEvents.push({ channel, payload }) } }', context);
  require('./fixtures/trusted-ipc.cjs')(context, handlers);
  // These transport/decryption fixtures are synthetic; real media validity is checked separately.
  context.probeVideoInfo = async () => ({ w: 1080, h: 1920, duration: 12, codec: 'h264' });
  context.verifyDownloadDecode = async () => {};
  context.resolveFfmpeg = () => '/fixture/ffprobe';
  context.registerStreamProtocol();
  context.registerLocalProtocol();
  return { context, handlers, protocols, rendererEvents, run: s => vm.runInContext(s, context) };
}

(async () => {
  const hits = [];
  const server = http.createServer((r, s) => {
    hits.push({url:r.url, headers:r.headers});
    if (r.url.split('?')[0] === '/missing') { s.writeHead(404); s.end(); return; }
    if (r.url === '/unauthorized') { s.writeHead(401); s.end(); return; }
    if (r.url === '/forbidden') { s.writeHead(403); s.end(); return; }
    if (r.url === '/limited') { s.writeHead(429); s.end(); return; }
    if (r.url === '/html') { s.setHeader('Content-Type','text/html'); s.end('bad'); return; }
    if (r.url === '/broken') { s.writeHead(200, {'Content-Length':'999'}); s.write('partial'); setTimeout(() => s.destroy(), 5); return; }
    if (r.url === '/race') {
      if(r.headers.range==='bytes=0-1') {s.writeHead(206,{'Content-Range':'bytes 0-1/14','Content-Length':'2'});s.end('co');}
      else setTimeout(()=>{s.writeHead(404);s.end();},30);
      return;
    }
    if(r.url==='/head-race') {
      if(r.method==='HEAD'){s.writeHead(404);s.end();}
      else setTimeout(()=>{s.writeHead(206,{'Content-Range':'bytes 0-1/14','Content-Length':'2'});s.end('co');},700);
      return;
    }
    if (r.url === '/identity' && (r.headers['user-agent'] !== 'app-provider' || r.headers.referer !== 'https://novel.snssdk.com/')) { s.writeHead(404); s.end(); return; }
    const bytes = Buffer.from('complete-media');
    if (r.headers.range === 'bytes=2-5') { s.writeHead(206, {'Content-Type':'video/mp4','Content-Range':`bytes 2-5/${bytes.length}`,'Content-Length':'4'}); s.end(bytes.subarray(2,6)); }
    else { s.writeHead(200, {'Content-Type':'video/mp4','Content-Length':bytes.length}); s.end(bytes); }
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const info = (url, source='app') => ({url:base+url,source,vid:'11'});
  let failures=0; const harnesses=[];
  const harness = (fn, overrides) => { const h=load(fn, overrides); harnesses.push(h); return h; };
  const task = id => ({id, type:'hongguo',filename:id+'.mp4',customDir:root,hongguoInfo:{vid:'11',series_id:'1'}});
  async function check(name, fn) { try { await fn(); console.log('PASS '+name); } catch(e) { failures++; console.error('FAIL '+name+': '+e.message+'\n'+e.stack); } }
  await check('download refreshes a failed address without another click',async()=>{
    const calls=[]; const h=harness(async(_v,_s,o)=>{ calls.push(o); return calls.length===1?info('/missing','web'):info('/ok'); });
    const t=task('refresh'); await h.context.executeHongguoDownload(t);
    assert.equal(t.status,'completed',t.error); assert.equal(fs.readFileSync(t.savePath,'utf8'),'complete-media');
    assert.equal(calls[1].force,true);
  });
  await check('download tries valid backup after primary HTTP 404',async()=>{
    let lookups=0; const first=info('/missing'); first.variants=[first,info('/ok')];
    const h=harness(async()=>{ lookups++; return first; }); const t=task('backup');
    await h.context.executeHongguoDownload(t); assert.equal(t.status,'completed',t.error); assert.equal(lookups,1);
  });
  await check('transient network source is refreshed during playback preparation',async()=>{
    let lookups=0; const h=harness(async()=>++lookups===1?{url:null,code:'SOURCE_UNAVAILABLE',sources:[{source:'app',code:'NETWORK_ERROR'}],error:'temporary'}:info('/ok'));
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'});
    assert.equal(p.success,true,p.error); assert.equal(lookups,2);
  });
  await check('empty source stops playback preparation without another lookup',async()=>{
    let lookups=0; const h=harness(async()=>{lookups++;return {url:null,code:'SOURCE_UNAVAILABLE',sources:[{source:'app',code:'EMPTY_RESPONSE'}],error:'empty response'};});
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'});
    assert.equal(p.success,false); assert.equal(p.error,'当前内容暂时无法播放，请稍后重试。'); assert.equal(lookups,1);
  });
  await check('terminal media failure retains only the sanitized provider route',async()=>{
    const h=harness(async()=>info('/ok','app'));
    await assert.rejects(h.context.withMediaRecovery('11','1',{playInfo:info('/ok','app')},async()=>{
      throw Object.assign(new Error('https://private.invalid/?token=secret'),{code:'LOCAL_MEDIA_TOOL_ERROR'});
    }),error=>{
      assert.equal(error.playbackDiagnostics.stage,'media');
      assert.equal(error.playbackDiagnostics.routes[0].source,'app');
      assert.equal(error.playbackDiagnostics.routes[0].status,'media-failed');
      assert.equal(error.playbackDiagnostics.routes[0].code,'LOCAL_MEDIA_TOOL_ERROR');
      assert.doesNotMatch(JSON.stringify(error.playbackDiagnostics),/private\.invalid|token=secret/);
      return true;
    });
  });
  await check('media refusal retains its route and safe HTTP status without provider fallback',async()=>{
    for (const status of [401, 403, 429]) {
      const vid='xifan:jiuzhou:1:11', sid='xifan:jiuzhou:1';
      const h=harness(async()=>info('/unauthorized','app'));
      await assert.rejects(h.context.withMediaRecovery(vid,sid,{playInfo:info(status===401?'/unauthorized':status===403?'/forbidden':'/limited','app')},
        value=>h.context.requestMedia(value)),error=>{
          assert.equal(error.playbackDiagnostics.stage,'media');
          assert.equal(error.playbackDiagnostics.mediaRead,'failed');
          assert.equal(error.playbackDiagnostics.routes.at(-1).status,'media-failed');
          assert.equal(error.playbackDiagnostics.routes.at(-1).code,`HTTP_${status}`);
          return true;
        });
    }
  });
  await check('stream diagnostics report full and ranged reads without exposing media URLs',async()=>{
    const h=harness(async()=>info('/ok','app'));
    const full=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1',requestId:'diag-full'});
    const fullResponse=await h.protocols['hongguo-stream'](new Request(full.url));
    assert.equal(await fullResponse.text(),'complete-media');
    const fullEvent=h.rendererEvents.filter(event=>event.channel==='online-play-diagnostics').at(-1);
    assert.equal(fullEvent.payload.requestId,'diag-full');
    assert.equal(fullEvent.payload.streamId,full.streamId);
    assert.equal(fullEvent.payload.diagnostics.stage,'media');
    assert.equal(fullEvent.payload.diagnostics.mediaRead,'complete');
    assert.doesNotMatch(JSON.stringify(fullEvent),/127\.0\.0\.1|token=|secret|complete-media/);

    h.rendererEvents.length=0;
    const ranged=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1',requestId:'diag-range'});
    const rangedResponse=await h.protocols['hongguo-stream'](new Request(ranged.url,{headers:{Range:'bytes=2-5'}}));
    assert.equal(await rangedResponse.text(),'mple');
    const rangeEvent=h.rendererEvents.filter(event=>event.channel==='online-play-diagnostics').at(-1);
    assert.equal(rangeEvent.payload.requestId,'diag-range');
    assert.equal(rangeEvent.payload.streamId,ranged.streamId);
    assert.equal(rangeEvent.payload.diagnostics.mediaRead,'partial');
    assert.doesNotMatch(JSON.stringify(rangeEvent),/127\.0\.0\.1|token=|secret/);
  });
  await check('interrupted stream body emits a sanitized failed-read diagnostic',async()=>{
    const h=harness(async()=>info('/broken','app'));
    const prepared=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1',requestId:'diag-failed'});
    const response=await h.protocols['hongguo-stream'](new Request(prepared.url));
    await assert.rejects(response.text());
    await sleep(10);
    const event=h.rendererEvents.filter(item=>item.channel==='online-play-diagnostics').at(-1);
    assert.equal(event.payload.requestId,'diag-failed');
    assert.equal(event.payload.streamId,prepared.streamId);
    assert.equal(event.payload.diagnostics.stage,'media');
    assert.equal(event.payload.diagnostics.mediaRead,'failed');
    assert.equal(event.payload.diagnostics.routes.at(-1).status,'media-failed');
    assert.doesNotMatch(JSON.stringify(event),/127\.0\.0\.1|token=|secret/);
  });
  await check('playback IPC omits unrecognized and potentially sensitive error codes',async()=>{
    const axios=async()=>{
      throw Object.assign(new Error('https://private.invalid/?token=TOP_SECRET'),{code:'API_TOKEN:TOP_SECRET'});
    };
    axios.isCancel=()=>false;
    const h=harness(async()=>({...info('/ok','app'),spadeA:'encrypted'}),{axios});
    const result=await h.handlers['prepare-online-play']({}, {
      vid:'11',seriesId:'1',requestId:'diag-unsafe-code',prefetch:true,
    });
    assert.equal(result.success,false);
    assert.equal(result.code,undefined);
    assert.doesNotMatch(JSON.stringify(result),/private\.invalid|TOP_SECRET|API_TOKEN/);
    assert.equal(result.diagnostics.routes.at(-1).code,undefined);
  });
  await check('stream recovers before headers and preserves requested Range',async()=>{
    let lookups=0; const h=harness(async()=>++lookups===1?info('/missing','web'):info('/ok'));
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'});
    const r=await h.protocols['hongguo-stream'](new Request(p.url,{headers:{Range:'bytes=2-5'}}));
    assert.equal(r.status,206); assert.equal(await r.text(),'mple');
  });
  await check('broken prefetch body retries complete transfer and caches only final bytes',async()=>{
    let lookups=0; const h=harness(async()=>++lookups===1?info('/broken'):info('/ok'));
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1',prefetch:true});
    assert.equal(p.success,true,p.error);
    const r=await h.protocols['hongguo-stream'](new Request(p.url)); assert.equal(await r.text(),'complete-media');
  });
  await check('broken download retries without keeping partial bytes',async()=>{
    let lookups=0; const h=harness(async()=>++lookups===1?info('/broken'):info('/ok')), t=task('broken');
    await h.context.executeHongguoDownload(t); assert.equal(t.status,'completed',t.error);
    assert.equal(fs.readFileSync(t.savePath,'utf8'),'complete-media');
    assert.ok(!fs.existsSync(t.savePath+'.enc.tmp'));
  });
  await check('stream fallback decrypts a new candidate before serving Range',async()=>{
    let lookups=0; const h=harness(async()=>++lookups===1?info('/missing','web'):{...info('/ok'),spadeA:'test'}, {
      './src/native/decrypt-worker.cjs':{decryptInWorker:async({buffer})=>Buffer.from(buffer)},
    });
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'});
    const r=await h.protocols['hongguo-stream'](new Request(p.url,{headers:{Range:'bytes=2-5'}}));
    assert.equal(r.status,206);assert.equal(await r.text(),'mple');
    assert.equal(hits.at(-1).headers.range,undefined,'encrypted candidate must be fetched completely');
  });
  await check('a stream never mixes byte offsets from different media after first response',async()=>{
    let lookups=0; const h=harness(async()=>{lookups++;return info('/ok');});
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'});
    const first=await h.protocols['hongguo-stream'](new Request(p.url,{headers:{Range:'bytes=2-5'}}));await first.text();
    h.run(`onlineSessions.get(${JSON.stringify(p.streamId)}).entry.playInfo.url = ${JSON.stringify(base+'/missing')}`);
    const next=await h.protocols['hongguo-stream'](new Request(p.url,{headers:{Range:'bytes=2-5'}}));
    assert.equal(next.status,502,'must reconnect with time-based seek instead of changing media under same URL');assert.equal(lookups,1);
  });
  await check('late stream interruption marks Web failed before a time-based reconnect',async()=>{
    let failed=false;
    const native={fetchPlayUrlSingle:async()=>failed?info('/ok'):info('/broken','web'),UA:'test',WEB_UA:'browser-test',WEB_REFERER:'https://hongguoduanju.com/',markWebMediaFailure:()=>{failed=true;}};
    const h=harness(native.fetchPlayUrlSingle,{'./src/native/hongguo':native});
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'});
    const r=await h.protocols['hongguo-stream'](new Request(p.url));await assert.rejects(r.text());
    assert.equal(failed,true,'reconnect must know that the old Web body failed');
    const p2=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1',force:true});
    assert.equal(await (await h.protocols['hongguo-stream'](new Request(p2.url))).text(),'complete-media');
  });
  await check('concurrent first Range requests cannot race into two media representations',async()=>{
    let lookups=0; const h=harness(async()=>++lookups===1?info('/race'):info('/ok'));
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'});
    const early=h.protocols['hongguo-stream'](new Request(p.url,{headers:{Range:'bytes=0-1'}}));
    const late=h.protocols['hongguo-stream'](new Request(p.url,{headers:{Range:'bytes=2-5'}}));
    const r1=await early;assert.equal(await r1.text(),'co');
    assert.equal((await late).status,502,'late candidate must not replace the source already handed to the player');
  });
  await check('HEAD fallback and pending GET stay on one media representation',async()=>{
    let lookups=0;const h=harness(async()=>++lookups===1?info('/head-race'):{...info('/ok'),spadeA:'test'},{
      './src/native/decrypt-worker.cjs':{decryptInWorker:async()=>Buffer.from('different-media')},
    });
    const p=await h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'});
    const get=h.protocols['hongguo-stream'](new Request(p.url,{headers:{Range:'bytes=0-1'}}));
    const head=h.protocols['hongguo-stream'](new Request(p.url,{method:'HEAD'}));
    assert.equal((await head).status,200);
    assert.equal((await get).status,502,'GET cannot publish the pre-fallback source after HEAD fixed another representation');
  });
  await check('two sessions sharing preparation never mutate each other media entry',async()=>{
    let lookups=0;const h=harness(async()=>++lookups===1?info('/ok'):{...info('/ok'),spadeA:'test'},{
      './src/native/decrypt-worker.cjs':{decryptInWorker:async()=>Buffer.from('different-media')},
    });
    const [a,b]=await Promise.all([h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'}),h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1'})]);
    assert.equal(await(await h.protocols['hongguo-stream'](new Request(a.url,{headers:{Range:'bytes=2-5'}}))).text(),'mple');
    h.run(`onlineSessions.get(${JSON.stringify(b.streamId)}).entry.playInfo = ${JSON.stringify(info('/missing'))}`);
    assert.equal(await(await h.protocols['hongguo-stream'](new Request(b.url))).text(),'different-media');
    assert.equal(await(await h.protocols['hongguo-stream'](new Request(a.url,{headers:{Range:'bytes=2-5'}}))).text(),'mple');
  });
  await check('HTML error page tries backup and never becomes completed media',async()=>{
    const first=info('/html'); first.variants=[info('/ok')]; const h=harness(async()=>first), t=task('html');
    await h.context.executeHongguoDownload(t); assert.equal(t.status,'completed',t.error); assert.equal(fs.readFileSync(t.savePath,'utf8'),'complete-media');
  });
  await check('media request retains provider UA and Referer',async()=>{
    const h=harness(async()=>({...info('/identity'), userAgent:'app-provider',referer:'https://novel.snssdk.com/'})), t=task('identity');
    await h.context.executeHongguoDownload(t); assert.equal(t.status,'completed',t.error);
  });
  await check('permanent failure stops within bounded attempts and leaves no file',async()=>{
    let lookups=0; const before=hits.length; const h=harness(async()=>{lookups++;return info('/missing','web');}),t=task('permanent');
    await h.context.executeHongguoDownload(t); assert.equal(t.status,'failed');
    assert.ok(lookups<=3); assert.ok(hits.length-before<=8); assert.ok(!fs.existsSync(t.savePath)); assert.ok(!fs.existsSync(t.savePath+'.enc.tmp'));
  });
  await check('stop during retry wait cancels all later requests',async()=>{
    let lookups=0;const h=harness(async()=>{lookups++;return info('/missing','web');}),t=task('cancel');
    const pending=h.context.executeHongguoDownload(t); await sleep(40);
    t.cancelled=true; t.cancelSource?.cancel('stop'); await pending; const after=lookups; await sleep(40);
    assert.equal(t.status,'stopped'); assert.equal(lookups,after); assert.ok(!fs.existsSync(t.savePath));
  });
  await check('unresponsive source lookup has a finite wait instead of leaving playback loading',async()=>{
    const h=harness(()=>new Promise(()=>{}));
    const deadlines=[];
    h.context.setTimeout=(fn,ms)=>{ deadlines.push(ms); assert.ok(ms>0 && ms<=30000); return setTimeout(fn,Math.min(ms,5)); };
    const pending=h.handlers['prepare-online-play']({}, {vid:'11',seriesId:'1',requestId:'timeout'});
    // Several scaled retries run here; Windows CI timer granularity is not the source timeout.
    const result=await Promise.race([pending,sleep(2000).then(()=>({unbounded:true}))]);
    await h.handlers['release-online-play']({}, {requestId:'timeout'});await pending;
    assert.ok(deadlines.includes(30000),'source lookup must retain its 30-second deadline');
    assert.ok(!result.unbounded,'source lookup never settled within its time budget');assert.equal(result.success,false);assert.equal(result.error,'当前内容暂时无法播放，请稍后重试。');
  });
  await check('removed Hema IDs fail before any recovery lookup', async () => {
    const h = harness(async () => { throw new Error('unexpected provider request'); });
    await assert.rejects(h.context.withMediaRecovery('hema:1:11', 'hema:1', { playInfo: info('/expired') }, async () => 'unexpected'), /河马来源已移除/);
  });
  const refreshProviders = [
    { source: 'xifan', vid: 'xifan:jiuzhou:1:11', sid: 'xifan:jiuzhou:1' },
    { source: 'custom', vid: 'custom:a1e93f2c-6b47-4d58-9c30-2f4a6d8e0b11:1:0:0', sid: 'custom:a1e93f2c-6b47-4d58-9c30-2f4a6d8e0b11:1' },
  ];
  for (const provider of refreshProviders) {
    const overrides = { './src/native/custom-source': { assertEnabled() {} } };
    const playInfo = route => ({ ...info(route, provider.source), vid: provider.vid });
    const consume = h => async value => {
      const response = await h.context.requestMedia(value);
      const chunks = [];
      for await (const chunk of response.data) chunks.push(chunk);
      return Buffer.concat(chunks).toString('utf8');
    };
    await check(`${provider.source} refreshes an expired media address with the same episode and fresh access check`, async () => {
      const calls = [];
      const h = harness(async (vid, sid, options) => { calls.push({ vid, sid, options }); return playInfo('/ok'); }, overrides);
      const result = await h.context.withMediaRecovery(provider.vid, provider.sid, { playInfo: playInfo('/missing') }, consume(h));
      assert.equal(result, 'complete-media');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].vid, provider.vid); assert.equal(calls[0].sid, provider.sid);
      assert.equal(calls[0].options.force, true);
    });
    await check(`${provider.source} refreshed access denial stops before another media transfer`, async () => {
      let lookups = 0, transfers = 0;
      const h = harness(async () => { lookups++; return { url: null, locked: true, error: 'episode now locked' }; }, overrides);
      await assert.rejects(h.context.withMediaRecovery(provider.vid, provider.sid, { playInfo: playInfo('/missing') }, async value => { transfers++; return consume(h)(value); }), /now locked/);
      assert.equal(lookups, 1); assert.equal(transfers, 1);
    });
    await check(`${provider.source} repeated expired addresses stop after three bounded rounds`, async () => {
      let lookups = 0, transfers = 0;
      const h = harness(async () => { lookups++; return playInfo('/missing'); }, overrides);
      await assert.rejects(h.context.withMediaRecovery(provider.vid, provider.sid, { playInfo: playInfo('/missing') }, async value => { transfers++; return consume(h)(value); }), /HTTP 404/);
      assert.equal(lookups, 2); assert.equal(transfers, 3);
    });
    for (const route of ['/unauthorized', '/forbidden', '/limited']) await check(`${provider.source} ${route.slice(1)} media never refreshes or switches lines`, async () => {
      let lookups = 0;
      const h = harness(async () => { lookups++; return playInfo('/ok'); }, overrides);
      const denied = playInfo(route); denied.candidates = [playInfo('/ok')];
      await assert.rejects(h.context.withMediaRecovery(provider.vid, provider.sid, { playInfo: denied }, consume(h)), /HTTP (401|403|429)/);
      assert.equal(lookups, 0);
    });
  }
  await check('stale custom backup lines leave one transfer for a fresh same-episode address', async () => {
    const provider = refreshProviders.find(item => item.source === 'custom'); let lookups = 0, transfers = 0;
    const h = harness(async () => { lookups++; return { ...info('/ok', 'custom'), vid: provider.vid }; },
      { './src/native/custom-source': { assertEnabled() {} } });
    const stale = { ...info('/missing?line=0', 'custom'), vid: provider.vid };
    stale.candidates = [1, 2, 3, 4].map(line => ({ ...info(`/missing?line=${line}`, 'custom'), vid: provider.vid }));
    const result = await h.context.withMediaRecovery(provider.vid, provider.sid, { playInfo: stale }, async value => {
      transfers++; const response = await h.context.requestMedia(value); const chunks = [];
      for await (const chunk of response.data) chunks.push(chunk);
      return Buffer.concat(chunks).toString('utf8');
    });
    assert.equal(result, 'complete-media'); assert.equal(lookups, 1); assert.equal(transfers, 4);
  });
  for (const status of [401, 403, 429]) await check(`HLS HTTP ${status} stops without a backup or provider refresh`, async () => {
    const provider = refreshProviders.find(item => item.source === 'custom'); let lookups = 0, remuxes = 0;
    const h = harness(async () => { lookups++; return info('/ok', 'custom'); }, {
      './src/native/custom-source': { assertEnabled() {} },
      './src/native/hls-media': { remuxHls: async () => { remuxes++; throw Object.assign(new Error('HLS refused'), { mediaStatus: status }); } },
    });
    const denied = { ...info('/missing', 'custom'), vid: provider.vid, format: 'hls' };
    denied.candidates = [{ ...info('/ok', 'custom'), vid: provider.vid, format: 'hls' }];
    await assert.rejects(h.context.withMediaRecovery(provider.vid, provider.sid, { playInfo: denied },
      value => h.context.prepareHlsFile(value, path.join(root, 'refused.mp4'))), /HLS refused/);
    assert.equal(lookups, 0); assert.equal(remuxes, 1);
  });
  await check('unknown provider identities never acquire automatic refresh', async () => {
    let lookups = 0;
    const h = harness(async () => { lookups++; return info('/ok'); });
    await assert.rejects(h.context.withMediaRecovery('other:11', 'other:1', { playInfo: info('/missing') }, async value => h.context.requestMedia(value)), /HTTP 404/);
    assert.equal(lookups, 0);
  });
  for(const h of harnesses) {
    h.context.clearOnlineCache();
    h.run('for (const timer of sourceRetryTimers.values()) clearTimeout(timer); sourceRetryTimers.clear();');
  }
  server.closeAllConnections(); await new Promise(r=>server.close(r));
  assert.equal(failures,0,`${failures} recovery regressions`);
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));

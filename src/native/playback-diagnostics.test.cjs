const assert = require('node:assert/strict');
const { test } = require('node:test');
const { routeDiagnostic, safeCode, sanitizePlaybackDiagnostics, updatePlaybackRoute, playbackFailureMessage } = require('./playback-diagnostics');

test('route diagnostics preserve only known source and playback-stage fields', () => {
  const diagnostic = sanitizePlaybackDiagnostics({
    source: 'app',
    stage: 'first-frame',
    mediaRead: 'complete',
    mediaDecoded: 'passed',
    firstFrame: 'passed',
    sourceTrace: [
      routeDiagnostic('web', { attempted: true, status: 'failed', code: 'PREVIEW_ONLY' }),
      routeDiagnostic('app', {
        attempted: true, status: 'ready', initialization: 'completed',
        anonymousAccess: 'request-accepted', mediaAddress: true, mediaRead: 'complete',
      }),
    ],
    url: 'https://signed.invalid/video?token=secret',
    deviceId: 'private-device',
  });

  assert.equal(diagnostic.source, 'app');
  assert.equal(diagnostic.stage, 'first-frame');
  assert.equal(diagnostic.routes[0].code, 'PREVIEW_ONLY');
  assert.equal(diagnostic.routes[1].initialization, 'completed');
  assert.equal(diagnostic.routes[1].anonymousAccess, 'request-accepted');
  assert.doesNotMatch(JSON.stringify(diagnostic), /signed\.invalid|token=|secret|private-device/);
});

test('playback errors use evidence-based user text without guessing auth or signature causes', () => {
  for (const error of [
    { code: 'EMPTY_RESPONSE' },
    { code: 'DEVICE_REGISTRATION_FAILED' },
    { code: 'BUSINESS_REJECTED' },
    { code: 'SOURCE_UNAVAILABLE', sources: [{ source: 'app', code: 'EMPTY_RESPONSE', message: '签名失败 https://secret.invalid' }] },
  ]) {
    const message = playbackFailureMessage(error);
    assert.equal(message, '当前内容暂时无法播放，请稍后重试。');
    assert.doesNotMatch(message, /签名|设备鉴权|空响应|secret\.invalid/);
  }

  assert.equal(playbackFailureMessage({ code: 'ACCOUNT_REQUIRED' }), '当前内容需要红果官方账号授权。');
  assert.equal(playbackFailureMessage({ code: 'SOURCE_REMOVED' }), '该来源已移除，无法继续播放。');
  assert.equal(playbackFailureMessage({ code: 'PREVIEW_ONLY' }), '官网目前只提供预览，无法作为完整一集播放。');
  assert.equal(playbackFailureMessage({ code: 'NO_COMPATIBLE_SOURCE' }), '当前内容暂不支持此设备可用的视频格式。');
  assert.equal(playbackFailureMessage({ code: 'ETIMEDOUT' }), '网络连接失败，请检查网络后重试。');
  assert.equal(playbackFailureMessage({ code: 'TRANSCODE_FAILED' }), '本机未能生成兼容视频，请重新连接片源或稍后重试。');
});

test('media and first-frame results update only the matching provider route', () => {
  const initial = {
    source: 'app',
    routes: [routeDiagnostic('web', { attempted: true, status: 'failed', code: 'PREVIEW_ONLY' }),
      routeDiagnostic('app', { attempted: true, status: 'address-found', mediaAddress: true })],
  };
  const updated = updatePlaybackRoute(initial, 'app', {
    status: 'ready', mediaRead: 'partial', mediaDecoded: 'passed', firstFrame: 'passed',
  }, { stage: 'first-frame', mediaRead: 'partial', mediaDecoded: 'passed', firstFrame: 'passed' });

  assert.equal(updated.routes[0].status, 'failed');
  assert.equal(updated.routes[1].status, 'ready');
  assert.equal(updated.routes[1].firstFrame, 'passed');
  assert.equal(updated.stage, 'first-frame');
});

test('updating a provider preserves an earlier skipped route with the same source label', () => {
  const initial = {
    routes: [
      routeDiagnostic('web', { status: 'skipped' }),
      routeDiagnostic('app', { attempted: true, status: 'failed', code: 'EMPTY_RESPONSE' }),
      routeDiagnostic('web', { attempted: true, status: 'address-found', mediaAddress: true }),
    ],
  };
  const updated = updatePlaybackRoute(initial, 'web', { status: 'ready', mediaRead: 'partial' });

  assert.deepEqual(updated.routes.map(route => route.status), ['skipped', 'failed', 'ready']);
  assert.equal(updated.routes[0].attempted, false);
});

test('updating a provider keeps earlier failed attempts immutable', () => {
  const initial = {
    routes: [
      routeDiagnostic('web', { attempted: true, status: 'failed', code: 'HTTP_404' }),
      routeDiagnostic('app', { attempted: true, status: 'failed', code: 'EMPTY_RESPONSE' }),
      routeDiagnostic('web', { attempted: true, status: 'address-found', mediaAddress: true }),
    ],
  };
  const updated = updatePlaybackRoute(initial, 'web', { status: 'media-failed', code: 'MEDIA_TRANSFER_ERROR' });

  assert.deepEqual(updated.routes.map(route => route.status), ['failed', 'failed', 'media-failed']);
  assert.equal(updated.routes[0].code, 'HTTP_404');
  assert.equal(updated.routes[2].code, 'MEDIA_TRANSFER_ERROR');
});

test('only known diagnostic codes cross the renderer boundary', () => {
  assert.equal(safeCode('MEDIA_DECODE_ERROR'), 'MEDIA_DECODE_ERROR');
  assert.equal(safeCode('ERR_STREAM_PREMATURE_CLOSE'), 'ERR_STREAM_PREMATURE_CLOSE');
  assert.equal(safeCode('API_TOKEN:TOP_SECRET'), '');
  assert.equal(safeCode('https://signed.invalid'), '');
  assert.equal(sanitizePlaybackDiagnostics({ code: 'API_TOKEN:TOP_SECRET' }).code, undefined);
});

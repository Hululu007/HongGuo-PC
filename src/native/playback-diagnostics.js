const SOURCES = new Set(['web', 'app', 'api', 'xifan', 'custom']);
const ROUTE_STATUSES = new Set(['skipped', 'failed', 'address-found', 'media-failed', 'ready']);
const INITIALIZATION = new Set(['not-required', 'attempted', 'completed', 'failed', 'unknown']);
const ANONYMOUS_ACCESS = new Set(['explicitly-allowed', 'request-accepted', 'denied', 'unknown']);
const MEDIA_READ = new Set(['not-requested', 'partial', 'complete', 'failed', 'unknown']);
const CHECK_STATUS = new Set(['not-tested', 'passed', 'failed']);
const SAFE_CODES = new Set([
  'ACCOUNT_REQUIRED', 'ABORT_ERR', 'BUSINESS_REJECTED', 'DEVICE_REGISTRATION_FAILED',
  'EACCES', 'EBUSY', 'ECONNABORTED', 'ECONNRESET', 'EDQUOT', 'EEXIST', 'EFBIG', 'EIO',
  'EISDIR', 'EMFILE', 'EMLINK', 'ENAMETOOLONG', 'ENETUNREACH', 'ENFILE', 'ENOENT',
  'ENOTDIR', 'ENOSPC', 'ENOTFOUND', 'EPIPE', 'EROFS', 'ETIMEDOUT', 'EAI_AGAIN', 'EPERM',
  'EMPTY_RESPONSE', 'ERR_BAD_RESPONSE', 'ERR_CANCELED', 'ERR_NETWORK',
  'ERR_STREAM_PREMATURE_CLOSE', 'ERR_WEB_MEDIA_ADDRESS',
  'HTTP_300', 'HTTP_301', 'HTTP_302', 'HTTP_303', 'HTTP_304', 'HTTP_305', 'HTTP_307', 'HTTP_308',
  'HTTP_400', 'HTTP_401', 'HTTP_402', 'HTTP_403', 'HTTP_404', 'HTTP_405', 'HTTP_408',
  'HTTP_409', 'HTTP_410', 'HTTP_413', 'HTTP_416', 'HTTP_422', 'HTTP_429',
  'HTTP_500', 'HTTP_501', 'HTTP_502', 'HTTP_503', 'HTTP_504', 'HTTP_505',
  'INVALID_RESPONSE', 'LOCAL_MEDIA_TOOL_ERROR', 'MEDIA_DECODE_ERROR', 'MEDIA_TOO_LARGE',
  'MEDIA_TRANSFER_ERROR', 'MISSING_MODEL', 'NETWORK_ERROR', 'NO_COMPATIBLE_SOURCE',
  'NO_PLAYABLE_SOURCE', 'PREVIEW_ONLY', 'QUALITY_UNAVAILABLE', 'SECURITY_BLOCKED', 'TRANSCODE_FAILED',
  'SOURCE_REMOVED', 'SOURCE_UNAVAILABLE', 'TIMEOUT',
]);

function safeCode(value) {
  const code = String(value || '');
  return SAFE_CODES.has(code) || /^HTTP_[345]\d{2}$/.test(code) ? code : '';
}

function routeDiagnostic(source, values = {}) {
  const name = SOURCES.has(source) ? source : 'unknown';
  const status = ROUTE_STATUSES.has(values.status) ? values.status : 'skipped';
  const initialization = INITIALIZATION.has(values.initialization) ? values.initialization : 'unknown';
  const anonymousAccess = ANONYMOUS_ACCESS.has(values.anonymousAccess) ? values.anonymousAccess : 'unknown';
  return {
    source: name,
    attempted: values.attempted === true,
    status,
    initialization,
    anonymousAccess,
    mediaAddress: values.mediaAddress === true,
    mediaRead: MEDIA_READ.has(values.mediaRead) ? values.mediaRead : 'not-requested',
    mediaDecoded: CHECK_STATUS.has(values.mediaDecoded) ? values.mediaDecoded : 'not-tested',
    firstFrame: CHECK_STATUS.has(values.firstFrame) ? values.firstFrame : 'not-tested',
    ...(safeCode(values.code) ? { code: safeCode(values.code) } : {}),
  };
}

function sanitizePlaybackDiagnostics(value = {}) {
  const routes = Array.isArray(value.routes || value.sourceTrace)
    ? (value.routes || value.sourceTrace).map(route => routeDiagnostic(route?.source, route))
    : [];
  const source = SOURCES.has(value.source) ? value.source : routes.find(route => route.status === 'address-found' || route.status === 'ready')?.source || '';
  const stage = ['source', 'media', 'decode', 'first-frame'].includes(value.stage) ? value.stage : 'source';
  return {
    stage,
    source,
    mediaRead: MEDIA_READ.has(value.mediaRead) ? value.mediaRead : 'not-requested',
    mediaDecoded: CHECK_STATUS.has(value.mediaDecoded) ? value.mediaDecoded : 'not-tested',
    firstFrame: CHECK_STATUS.has(value.firstFrame) ? value.firstFrame : 'not-tested',
    ...(safeCode(value.code) ? { code: safeCode(value.code) } : {}),
    routes,
  };
}

function updatePlaybackRoute(value, source, updates = {}, fields = {}) {
  const current = sanitizePlaybackDiagnostics(value);
  const routes = current.routes.slice();
  let index = -1;
  for (let i = routes.length - 1; i >= 0; i--) {
    if (routes[i].source === source && routes[i].attempted && routes[i].status !== 'skipped') {
      index = i;
      break;
    }
  }
  if (index >= 0) routes[index] = routeDiagnostic(source, { ...routes[index], ...updates });
  else routes.push(routeDiagnostic(source, { attempted: true, status: 'address-found', mediaAddress: true, ...updates }));
  return sanitizePlaybackDiagnostics({ ...current, ...fields, source, routes });
}

function playbackFailureMessage(error = {}) {
  const code = safeCode(error.code);
  const sourceCodes = (Array.isArray(error.sources) ? error.sources : [])
    .map(source => safeCode(source?.code)).filter(Boolean);
  const codes = new Set([code, ...sourceCodes]);

  if (error.requiresAccount === true || code === 'ACCOUNT_REQUIRED') {
    return '当前内容需要红果官方账号授权。';
  }
  if (code === 'SOURCE_REMOVED') return '该来源已移除，无法继续播放。';
  if (code === 'PREVIEW_ONLY' || sourceCodes.length === 1 && sourceCodes[0] === 'PREVIEW_ONLY') {
    return '官网目前只提供预览，无法作为完整一集播放。';
  }
  if (codes.has('NO_COMPATIBLE_SOURCE') || codes.has('QUALITY_UNAVAILABLE')) {
    return codes.has('QUALITY_UNAVAILABLE')
      ? '当前所选清晰度暂不可用。'
      : '当前内容暂不支持此设备可用的视频格式。';
  }
  if (['NETWORK_ERROR', 'TIMEOUT', 'ETIMEDOUT', 'ECONNABORTED', 'ERR_NETWORK'].some(value => codes.has(value))) {
    return '网络连接失败，请检查网络后重试。';
  }
  if (codes.has('MEDIA_DECODE_ERROR')) return '本机暂时无法解码该视频，可尝试兼容模式。';
  if (code === 'TRANSCODE_FAILED') return '本机未能生成兼容视频，请重新连接片源或稍后重试。';
  if (code === 'MEDIA_TOO_LARGE') return '当前视频超出在线播放限制，请改用下载后播放。';
  if (code === 'LOCAL_MEDIA_TOOL_ERROR') return '本机媒体组件不可用，请修复安装后重试。';
  return '当前内容暂时无法播放，请稍后重试。';
}

module.exports = { routeDiagnostic, safeCode, sanitizePlaybackDiagnostics, updatePlaybackRoute, playbackFailureMessage };

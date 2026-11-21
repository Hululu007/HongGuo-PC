/**
 * store.js - 红果短剧 3.2 持久化模块（沿用原资料格式）
 * 用单个 JSON 文件保存「设置」与「下载任务」，替代原项目里的 sql.js 数据库 + electron-store，
 * 减少依赖，方便独立打包。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let dataFile = null;
let cache = null; // { settings, tasks }
let durable = '{}';
let errorHandler = null;
let readError = null;
let writeError = false;
let safeStorage = null;
let runtimeProxyPassword = '';
let proxyPasswordWarning = '';
const PROXY_PASSWORD_CIPHER = 'proxy_password_ciphertext';
const SECURE_STORAGE_UNAVAILABLE = '系统安全存储不可用；代理密码仅在本次运行期间保留，重启后需要重新输入。';
const PROXY_PASSWORD_DECRYPT_FAILED = '已保存的代理密码无法解密；原密文已保留，可重新输入密码或清除。';
const READ_ERROR_MESSAGE = '读取本地数据失败，已保留原文件并暂停保存；如检测到可恢复备份，请在设置中确认恢复后重启应用。';
const BACKUP_SUFFIX = '.bak';
const BACKUP_TEMP_SUFFIX = '.bak.tmp';
let recoveryInfo = { available: false };
let backupFingerprint = null; // 最近一次成功备份的源文件 SHA-256；内容未变时跳过重复轮换

function reportReadError() {
  try { errorHandler?.({ error: READ_ERROR_MESSAGE, recovery: { ...recoveryInfo } }); } catch {}
}

function backupFilePath() {
  return dataFile ? dataFile + BACKUP_SUFFIX : null;
}

function backupTempFilePath() {
  return dataFile ? dataFile + BACKUP_TEMP_SUFFIX : null;
}

function isValidDocument(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return false;
  for (const key of ['tasks', 'series', 'mergeTasks']) {
    if (key in document && !Array.isArray(document[key])) return false;
  }
  for (const key of ['settings', 'playback']) {
    if (key in document && (!document[key] || typeof document[key] !== 'object' || Array.isArray(document[key]))) return false;
  }
  return true;
}

function readValidBackup() {
  const file = backupFilePath();
  if (!file) return null;
  try {
    const document = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isValidDocument(document) ? document : null;
  } catch (_) {
    return null;
  }
}

function refreshRecoveryInfo() {
  recoveryInfo = { available: false };
  if (!readError) return;
  const file = backupFilePath();
  if (!file) return;
  try {
    const stat = fs.statSync(file);
    if (stat.isFile() && readValidBackup()) {
      recoveryInfo = { available: true, size: stat.size, modifiedAt: stat.mtimeMs };
    }
  } catch (_) {}
}

function backupCurrentData() {
  const source = dataFile;
  const backup = backupFilePath();
  const temporary = backupTempFilePath();
  const previous = backup + '.previous';
  if (!source || !backup || !temporary) return;
  let sourceBytes;
  try {
    sourceBytes = fs.readFileSync(source);
    if (!isValidDocument(JSON.parse(sourceBytes.toString('utf8')))) throw new TypeError('Invalid current store document');
  } catch (_) { return; }
  // 内容未变时不重复轮换；内容变化但解析失败时绝不动已有的有效备份。
  const fingerprint = crypto.createHash('sha256').update(sourceBytes).digest('hex');
  if (fingerprint === backupFingerprint) return;
  let fd;
  try {
    fd = fs.openSync(temporary, 'w', 0o600);
    fs.writeFileSync(fd, sourceBytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    try { fs.chmodSync(temporary, 0o600); } catch (_) {}
    try { fs.unlinkSync(previous); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { fs.renameSync(backup, previous); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try {
      fs.renameSync(temporary, backup);
      try { fs.unlinkSync(previous); } catch (_) {}
      backupFingerprint = fingerprint;
    } catch (error) {
      try { fs.renameSync(previous, backup); } catch (_) {}
      throw error;
    }
  } catch (error) {
    if (fd !== undefined && fd !== null) { try { fs.closeSync(fd); } catch (_) {} }
    try { fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
}

function writeSyncedFile(file, contents, flags = 'w') {
  const fd = fs.openSync(file, flags, 0o600);
  try {
    fs.writeFileSync(fd, contents);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try { fs.chmodSync(file, 0o600); } catch (_) {}
}

function encryptionAvailable() {
  try {
    return safeStorage?.isEncryptionAvailable?.() === true
      && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  } catch { return false; }
}

function encryptProxyPassword(password) {
  if (!encryptionAvailable()) return null;
  try {
    const encrypted = safeStorage.encryptString(password);
    if (!encrypted?.length) return null;
    return Buffer.from(encrypted).toString('base64');
  } catch {
    return null;
  }
}

function decodeUrlPart(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function extractEmbeddedProxyPassword(settings) {
  const original = String(settings.proxy_host || '').trim();
  if (!original.includes('@')) return '';
  let username = '';
  let password = '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(original) ? original : `http://${original}`);
    username = decodeUrlPart(url.username);
    password = decodeUrlPart(url.password);
  } catch {
    const at = original.lastIndexOf('@');
    const userInfo = original.slice(0, at).split('://').pop();
    const separator = userInfo.indexOf(':');
    username = decodeUrlPart(separator < 0 ? userInfo : userInfo.slice(0, separator));
    password = separator < 0 ? '' : decodeUrlPart(userInfo.slice(separator + 1));
  }
  settings.proxy_host = original.replace(/^((?:[a-z][a-z0-9+.-]*:\/\/)?)[^/]*@/i, '$1');
  if (username) settings.proxy_username = username;
  return password;
}

function stripPublicSecretFields(settings) {
  delete settings.proxy_password;
  delete settings.proxy_password_set;
  delete settings.proxy_password_warning;
  delete settings.clear_proxy_password;
}

function hydrateProxyPassword(settings) {
  let changed = false;
  const embeddedPassword = extractEmbeddedProxyPassword(settings);
  if (Object.prototype.hasOwnProperty.call(settings, 'proxy_password')) changed = true;
  const plaintext = typeof settings.proxy_password === 'string' ? settings.proxy_password : '';
  const storedCipher = typeof settings[PROXY_PASSWORD_CIPHER] === 'string'
    ? settings[PROXY_PASSWORD_CIPHER] : '';
  stripPublicSecretFields(settings);
  delete settings[PROXY_PASSWORD_CIPHER];
  runtimeProxyPassword = '';
  proxyPasswordWarning = '';

  const password = plaintext || embeddedPassword;
  if (password) {
    runtimeProxyPassword = password;
    const encrypted = encryptProxyPassword(password);
    if (encrypted) settings[PROXY_PASSWORD_CIPHER] = encrypted;
    else proxyPasswordWarning = SECURE_STORAGE_UNAVAILABLE;
    return true;
  }
  if (!storedCipher) return changed;
  settings[PROXY_PASSWORD_CIPHER] = storedCipher;
  if (!encryptionAvailable()) {
    proxyPasswordWarning = SECURE_STORAGE_UNAVAILABLE;
    return changed;
  }
  try {
    const decrypted = safeStorage.decryptString(Buffer.from(storedCipher, 'base64'));
    if (typeof decrypted !== 'string') throw new TypeError('Invalid decrypted proxy password');
    runtimeProxyPassword = decrypted;
  } catch {
    proxyPasswordWarning = PROXY_PASSWORD_DECRYPT_FAILED;
  }
  return changed;
}

function serializableCache() {
  const copy = structuredClone(cache || {});
  if (copy.settings) {
    stripPublicSecretFields(copy.settings);
    if (!copy.settings[PROXY_PASSWORD_CIPHER]) delete copy.settings[PROXY_PASSWORD_CIPHER];
  }
  return copy;
}

function loadCache() {
  if (!dataFile) throw new Error('store 未初始化');
  if (cache) return cache;
  let secretsChanged = false;
  let sourceText = null;
  try {
    sourceText = fs.readFileSync(dataFile, 'utf8');
    cache = JSON.parse(sourceText);
    if (!isValidDocument(cache)) throw new TypeError('Invalid store document');
  } catch (e) {
    // 数据不可读时保持只读、绝不覆盖：原文件可能是用户唯一的记录来源。
    cache = {};
    if (e.code !== 'ENOENT') {
      readError = new Error(READ_ERROR_MESSAGE, { cause: e });
      readError.code = 'STORE_READ_FAILED';
      readError.recoverable = (e instanceof SyntaxError || e instanceof TypeError) && typeof sourceText === 'string';
      readError.originalText = readError.recoverable ? sourceText : null;
      refreshRecoveryInfo();
      reportReadError();
    }
  }
  if (!Array.isArray(cache.tasks)) cache.tasks = [];
  if (!cache.settings || typeof cache.settings !== 'object') cache.settings = {};
  if (!readError && !['auto', 'zh-CN', 'en-US'].includes(cache.settings.locale)) cache.settings.locale = 'auto';
  secretsChanged = hydrateProxyPassword(cache.settings);
  durable = JSON.stringify(serializableCache());
  if (secretsChanged && !readError) flush();
  return cache;
}

function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* 无定时能力时直接重试 */ }
}

/** 落盘失败时把内存恢复到最后一次成功写入的内容；就地替换各键，保持 cache 对象标识稳定。 */
function rollbackToDurable() {
  let snapshot;
  try { snapshot = JSON.parse(durable); } catch { return; }
  for (const key of Object.keys(cache)) delete cache[key];
  Object.assign(cache, snapshot);
  // getTasks() 不自愈，必须保证数组形态，否则调用方会读到 undefined。
  if (!Array.isArray(cache.tasks)) cache.tasks = [];
}

function flush() {
  if (!dataFile) return;
  if (readError) {
    // 只读期间的内存改动同样不能留下：它们永远无法落盘，会让界面显示不存在的状态。
    rollbackToDurable();
    reportReadError();
    throw readError;
  }
  const serialized = JSON.stringify(serializableCache(), null, 2);
  const directory = path.dirname(dataFile);
  let lastError = null;
  let pendingTemp = null; // 本轮已完整写好（含 fsync）的独占暂存文件；改名重试时直接复用，不重写内容。
  let pendingTempCreated = false;
  // Windows 上 rename 常因杀毒/索引器瞬时占用返回 EPERM/EBUSY，短暂退避重试即可自愈。
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      if (!pendingTemp) {
        // 每次写入独占创建新暂存文件；历史遗留的固定 data.json.tmp 留作人工恢复，绝不被覆盖。
        pendingTemp = `${dataFile}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const fd = fs.openSync(pendingTemp, 'wx', 0o600);
        pendingTempCreated = true;
        try {
          fs.writeFileSync(fd, serialized, 'utf8');
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      }
      // 改名成功后把「刚验证过可解析」的新文档镜像进 .bak；损坏时恢复点就是最后一次成功保存。
      // 备份失败不阻塞保存本身；内容未变时指纹会跳过重复轮换。
      fs.renameSync(pendingTemp, dataFile);
      pendingTemp = null;
      try { backupCurrentData(); } catch (_) {}
      durable = serialized;
      if (writeError) {
        writeError = false;
        try { errorHandler?.(null); } catch {}
      }
      return;
    } catch (e) {
      lastError = e;
      if (pendingTemp && ['EPERM', 'EBUSY', 'EACCES'].includes(e.code) && attempt < 2) {
        sleepSync(40 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  if (pendingTemp && pendingTempCreated) { try { fs.unlinkSync(pendingTemp); } catch {} }
  // 恢复到上次成功写入的内容：内存与磁盘保持一致，调用方不会看到「显示已保存、重启却丢失」。
  // 就地替换键值而不是替换 cache 对象，避免其他模块持有的引用变成孤儿。
  rollbackToDurable();
  writeError = true;
  try { errorHandler?.({ error: '保存失败，请检查磁盘空间或目录权限；本次变更未能保存。' }); } catch {}
  throw lastError;
}

function init(filePath, { safeStorage: injectedSafeStorage } = {}) {
  dataFile = filePath;
  safeStorage = injectedSafeStorage || null;
  cache = null;
  readError = null;
  recoveryInfo = { available: false };
  backupFingerprint = null;
  writeError = false;
  runtimeProxyPassword = '';
  proxyPasswordWarning = '';
  loadCache();
}

function getRecoveryInfo() {
  return { ...recoveryInfo };
}

function restoreFromBackup(confirmed) {
  if (confirmed !== true) return { success: false, error: '必须明确确认后才能恢复备份。' };
  if (!readError?.recoverable || typeof readError.originalText !== 'string') {
    return { success: false, error: '当前数据无法通过备份恢复；原文件未更改。' };
  }
  const backup = backupFilePath();
  const temporary = dataFile + '.restore.tmp';
  let backupBytes;
  let damagedBytes;
  try {
    backupBytes = fs.readFileSync(backup);
    const backupDocument = JSON.parse(backupBytes.toString('utf8'));
    if (!isValidDocument(backupDocument)) throw new TypeError('Invalid backup document');
    damagedBytes = fs.readFileSync(dataFile);
    if (damagedBytes.toString('utf8') !== readError.originalText) {
      return { success: false, error: '数据文件已发生变化；为避免覆盖新内容，已取消恢复。' };
    }
  } catch (_) {
    return { success: false, error: '备份不可读取或结构无效；原文件未更改。' };
  }

  let preservedPath = '';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (let index = 0; index < 100; index++) {
    const candidate = `${dataFile}.corrupt-${stamp}${index ? `-${index}` : ''}`;
    try {
      writeSyncedFile(candidate, damagedBytes, 'wx');
      preservedPath = candidate;
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') return { success: false, error: '无法安全保留损坏文件；原文件未更改。' };
    }
  }
  if (!preservedPath) return { success: false, error: '无法为原文件分配安全保留名称；原文件未更改。' };

  try {
    writeSyncedFile(temporary, backupBytes);
    fs.renameSync(temporary, dataFile);
    recoveryInfo = { available: false };
    backupFingerprint = null;
    return { success: true, preservedFile: path.basename(preservedPath), restartRequired: true };
  } catch (_) {
    try { fs.unlinkSync(temporary); } catch (_) {}
    return { success: false, error: '恢复备份失败；原文件仍保留，请勿退出前重复保存。' };
  }
}

function getSettings() {
  const settings = { ...loadCache().settings };
  const hasStoredPassword = Object.prototype.hasOwnProperty.call(settings, PROXY_PASSWORD_CIPHER);
  delete settings[PROXY_PASSWORD_CIPHER];
  if (runtimeProxyPassword || hasStoredPassword || proxyPasswordWarning) {
    settings.proxy_password = runtimeProxyPassword;
    settings.proxy_password_set = !!runtimeProxyPassword || hasStoredPassword;
    settings.proxy_password_warning = proxyPasswordWarning;
  }
  return settings;
}

function saveSettings(settings, { clearProxyPassword = false } = {}) {
  const current = loadCache();
  const previousCache = structuredClone(current);
  const previousPassword = runtimeProxyPassword;
  const previousWarning = proxyPasswordWarning;
  const incoming = settings && typeof settings === 'object' ? structuredClone(settings) : {};
  const shouldClear = clearProxyPassword === true || incoming.clear_proxy_password === true;
  const embeddedPassword = extractEmbeddedProxyPassword(incoming);
  const requestedPassword = typeof incoming.proxy_password === 'string' ? incoming.proxy_password : '';
  const currentCipher = typeof current.settings[PROXY_PASSWORD_CIPHER] === 'string'
    ? current.settings[PROXY_PASSWORD_CIPHER] : '';
  stripPublicSecretFields(incoming);
  delete incoming[PROXY_PASSWORD_CIPHER];

  let nextPassword = runtimeProxyPassword;
  let nextCipher = currentCipher;
  let nextWarning = proxyPasswordWarning;
  if (shouldClear) {
    nextPassword = '';
    nextCipher = '';
    nextWarning = '';
  } else if (requestedPassword || embeddedPassword) {
    const password = requestedPassword || embeddedPassword;
    if (password === nextPassword && nextCipher) {
      nextWarning = proxyPasswordWarning;
    } else {
      nextPassword = password;
      nextCipher = encryptProxyPassword(password) || '';
      nextWarning = nextCipher ? '' : SECURE_STORAGE_UNAVAILABLE;
    }
  } else if (nextPassword && !nextCipher) {
    nextCipher = encryptProxyPassword(nextPassword) || '';
    if (nextCipher) nextWarning = '';
  }

  if (nextCipher) incoming[PROXY_PASSWORD_CIPHER] = nextCipher;
  current.settings = incoming;
  runtimeProxyPassword = nextPassword;
  proxyPasswordWarning = nextWarning;
  try {
    flush();
  } catch (error) {
    // 只回滚设置本体，保留 cache 对象与其他键（任务/进度）的引用稳定。
    current.settings = previousCache.settings;
    runtimeProxyPassword = previousPassword;
    proxyPasswordWarning = previousWarning;
    throw error;
  }
}


function getTasks() {
  return loadCache().tasks;
}

function saveTasks(tasks) {
  loadCache().tasks = tasks || [];
  flush();
}

// ===== 短剧档案（让播放页在没有下载任务时也能列出完整分集）=====
function getSeries() {
  const c = loadCache();
  if (!Array.isArray(c.series)) c.series = [];
  return c.series;
}

function saveSeries(list) {
  loadCache().series = list || [];
  flush();
}

// ===== 播放进度（断点续播）=====
function getPlayback() {
  const c = loadCache();
  if (!c.playback || typeof c.playback !== 'object') c.playback = {};
  return c.playback;
}

function savePlayback(map) {
  loadCache().playback = map || {};
  flush();
}

// ===== 合并任务记录 =====
function getMergeTasks() {
  const c = loadCache();
  if (!Array.isArray(c.mergeTasks)) c.mergeTasks = [];
  return c.mergeTasks;
}

function saveMergeTasks(list) {
  loadCache().mergeTasks = list || [];
  flush();
}

module.exports = {
  setErrorHandler: (handler) => { errorHandler = handler; },
  init,
  getSettings,
  saveSettings,
  getTasks,
  saveTasks,
  getSeries,
  saveSeries,
  getPlayback,
  savePlayback,
  getMergeTasks,
  saveMergeTasks,
  getRecoveryInfo,
  restoreFromBackup,
};

const { availableRelease } = require('./app-update');
const { createUpdateDownloadRouter } = require('./app-update-download');
const path = require('node:path');

function isValidSha512(value) {
  const digest = String(value || '').trim();
  if (/^[a-f0-9]{128}$/i.test(digest)) return true;
  if (!/^[A-Za-z0-9+/]{86}==$/.test(digest)) return false;
  try { return Buffer.from(digest, 'base64').length === 64 && Buffer.from(digest, 'base64').toString('base64') === digest; }
  catch { return false; }
}

function createUpdateInstaller({ updater, currentVersion, isEnabled, installBlocker, emit, allowProxy = () => true }) {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.disableWebInstaller = true;
  // Release ZIPs are rebuilt after notarization; their old blockmaps are invalid.
  updater.disableDifferentialDownload = true;
  updater.logger = null;
  updater.setFeedURL({ provider: 'github', owner: 'yuchen0x1', repo: 'HongGuo-PC' });
  let state = { supported: true, reason: '', status: 'idle', version: null, percent: 0, error: '', downloaded: false, route: '' };
  let operation = null, cancellationToken = null, generation = 0, operationGeneration = 0;
  let nativeInstallListener = null, nativeReadyVersion = null;
  const getState = () => ({ ...state });
  const update = patch => { state = { ...state, ...patch }; emit(getState()); };
  const fail = error => ({ success: false, error, state: getState() });
  const downloadRouter = updater.httpExecutor ? createUpdateDownloadRouter({
    executor: updater.httpExecutor,
    allowProxy,
    onRoute: route => {
      if (state.status === 'downloading') update({ route });
    },
  }) : null;
  updater.on('download-progress', progress => {
    if (state.status !== 'downloading' || !isEnabled()) return;
    const percent = Math.max(0, Math.min(100, Math.floor(Number(progress.percent) || 0)));
    const speed = Number(progress.bytesPerSecond);
    const bytesPerSecond = Number.isFinite(speed) && speed > 0 ? Math.round(speed) : 0;
    if (percent !== state.percent || bytesPerSecond !== state.bytesPerSecond) update({ percent, bytesPerSecond });
  });
  updater.on('error', () => {
    if (!['checking', 'downloading', 'installing'].includes(state.status) || !isEnabled()) return;
    clearNativeInstall();
    nativeReadyVersion = null;
    update({ status: 'error', error: state.status === 'installing'
      ? '安装更新失败，当前版本仍可使用。请重试或前往发布页下载安装。'
      : '更新下载或校验失败，请检查网络后重试。' });
  });
  function cancel() {
    generation++;
    clearNativeInstall();
    nativeReadyVersion = null;
    update({ status: 'idle', version: null, percent: 0, bytesPerSecond: 0, error: '', downloaded: false, route: '' });
    cancellationToken?.cancel();
    return { success: true, state: getState() };
  }
  function verifiedReleaseAsset(release, expectedVersion, updateInfo) {
    if (!release || release.version !== expectedVersion || !/^v?\d+\.\d+(?:\.\d+)?$/.test(String(release.tagName || ''))) {
      throw new Error('更新版本信息与 Release 不一致。');
    }
    const files = Array.isArray(updateInfo?.files) ? updateInfo.files : [];
    const installerFiles = files.filter(file => {
      return /^[a-z0-9][a-z0-9._-]*-win-x64-setup\.exe$/i.test(String(file?.url || '').replace(/ /g, '-'));
    });
    if (installerFiles.length !== 1) throw new Error('更新清单没有唯一的 Windows x64 安装包。');
    const manifestFile = installerFiles[0];
    const asset = release.installer || null;
    const name = String(manifestFile.url || '').replace(/ /g, '-');
    if (name !== String(manifestFile.url || '').trim()) throw new Error('更新清单安装包地址必须是资产文件名。');
    if (asset && asset.name !== name) throw new Error('更新清单与 Release 安装包名称不一致。');
    if (updateInfo.tag !== release.tagName) throw new Error('更新清单与 Release 版本标签不一致。');
    if (!isValidSha512(manifestFile.sha512)) throw new Error('更新清单缺少有效的 SHA-512。');
    const manifestSize = Number.isSafeInteger(manifestFile.size) && manifestFile.size > 0 ? manifestFile.size : null;
    const releaseSize = asset?.size ?? null;
    if (releaseSize != null && (!Number.isSafeInteger(releaseSize) || releaseSize <= 0)) {
      throw new Error('Release 安装包大小无效。');
    }
    if (releaseSize != null && manifestSize != null && releaseSize !== manifestSize) {
      throw new Error('更新清单与 Release 安装包大小不一致。');
    }
    const rawManifestSha256 = String(manifestFile.sha2 || manifestFile.sha256 || '').trim();
    const rawReleaseSha256 = String(asset?.sha256 || '').trim();
    const manifestSha256 = rawManifestSha256.toLowerCase();
    const releaseSha256 = rawReleaseSha256.toLowerCase();
    if ((rawManifestSha256 && !/^[a-f0-9]{64}$/i.test(rawManifestSha256))
      || (rawReleaseSha256 && !/^[a-f0-9]{64}$/i.test(rawReleaseSha256))) {
      throw new Error('更新 SHA-256 元数据无效。');
    }
    if (manifestSha256 && releaseSha256 && manifestSha256 !== releaseSha256) {
      throw new Error('更新清单与 Release SHA-256 不一致。');
    }
    const sha256 = manifestSha256 || releaseSha256;
    const size = manifestSize ?? releaseSize;
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error('更新清单缺少有效的安装包大小。');
    if (sha256) manifestFile.sha2 = sha256;
    // A tag-only API fallback may use the trusted official manifest; old manifests stay direct-only.
    if (!sha256) return null;
    return { tag: release.tagName, name, size, sha256 };
  }
  function download(releaseOrVersion) {
    const releaseMetadata = typeof releaseOrVersion === 'object' && releaseOrVersion ? releaseOrVersion : null;
    const expectedVersion = releaseMetadata?.version || releaseOrVersion;
    if (!isEnabled()) return Promise.resolve(fail('自动检测更新已关闭，请先在设置中开启。'));
    if (state.status === 'installing') return Promise.resolve(fail('正在安装更新。'));
    // The updater shares request state; finish cancelled work before starting a retry.
    if (operation) {
      if (operationGeneration === generation) return operation;
      const queuedGeneration = generation;
      return operation.then(() => queuedGeneration === generation ? download(releaseOrVersion) : fail('更新已取消。'));
    }
    if (state.downloaded && state.version === expectedVersion) return Promise.resolve({ success: true, state: getState() });
    const request = ++generation;
    operationGeneration = request;
    update({ status: 'checking', version: expectedVersion, percent: 0, bytesPerSecond: 0, error: '', downloaded: false, route: '' });
    operation = (async () => {
      try {
        const result = await updater.checkForUpdates();
        if (request !== generation || !isEnabled()) { result?.cancellationToken?.cancel(); return fail('更新已取消。'); }
        const release = availableRelease({ tag_name: result?.updateInfo?.version }, currentVersion);
        if (!release || release.version !== expectedVersion) {
          update({ status: 'error', error: '新版信息已变化，请重新检查更新。' });
          return fail(state.error);
        }
        cancellationToken = result.cancellationToken;
        const asset = releaseMetadata ? verifiedReleaseAsset(releaseMetadata, expectedVersion, result.updateInfo) : null;
        if (asset && !downloadRouter) throw new Error('更新下载校验器不可用。');
        downloadRouter?.setAsset(asset);
        update({ status: 'downloading' });
        const downloadedFiles = await updater.downloadUpdate(cancellationToken);
        if (asset) {
          const installer = Array.isArray(downloadedFiles) && downloadedFiles.find(file =>
            typeof file === 'string' && path.isAbsolute(file) && path.basename(file) === asset.name);
          if (!installer) throw new Error('更新器没有返回匹配的安装包。');
          // Cached updater files bypass executor.download, so validate them before enabling installation too.
          const manifestFile = result.updateInfo.files.find(file => file.url === asset.name);
          await downloadRouter.verifyDownloadedFile(installer, manifestFile.sha512);
        }
        if (request !== generation || !isEnabled()) return fail('更新已取消。');
        // Only this operation's verified completion can make the update installable.
        update({ status: 'downloaded', percent: 100, error: '', downloaded: true });
        return { success: true, state: getState() };
      } catch (error) {
        if (request !== generation || !isEnabled()) return fail('更新已取消。');
        const message = error?.code === 'ERR_UPDATE_ROUTES_FAILED'
          ? '所有更新下载线路均失败，当前版本仍可使用。请稍后重试或前往发布页下载。'
          : /^ERR_UPDATE_(?:SHA256|SHA512|SIZE|MANIFEST)$/.test(error?.code || '')
            ? '更新安装包校验失败，已禁止安装。请重试或前往发布页下载。'
            : '更新下载或校验失败，请检查网络后重试。';
        update({ status: 'error', error: message });
        return fail(state.error);
      } finally { downloadRouter?.setAsset(null); }
    })().finally(() => { operation = null; cancellationToken = null; });
    return operation;
  }
  function clearNativeInstall() {
    if (nativeInstallListener) updater.nativeUpdater.removeListener('update-downloaded', nativeInstallListener);
    nativeInstallListener = null;
  }
  function finishInstall() {
    clearNativeInstall();
    if (!isEnabled() || state.status !== 'installing') return;
    const blocked = installBlocker();
    if (blocked) { update({ status: 'downloaded', error: blocked }); return; }
    try {
      if (updater.nativeUpdater && nativeReadyVersion !== state.version) {
        const version = state.version;
        // MacUpdater's implicit deferred quit listener survives errors; own its lifetime instead.
        nativeInstallListener = () => { nativeReadyVersion = version; finishInstall(); };
        updater.nativeUpdater.once('update-downloaded', nativeInstallListener);
        updater.nativeUpdater.checkForUpdates();
      } else updater.quitAndInstall(false, true);
    } catch (_) {
      clearNativeInstall();
      update({ status: 'error', error: '无法启动更新安装，请重试或前往发布页下载安装。' });
    }
  }
  function install() {
    if (!isEnabled() || !state.downloaded || !['downloaded', 'error'].includes(state.status)) return fail('请先完成更新下载。');
    const blocked = installBlocker();
    if (blocked) return fail(blocked);
    update({ status: 'installing', error: '' });
    // Finish the IPC response before starting native preparation or quitting.
    setImmediate(finishInstall);
    return { success: true, state: getState() };
  }
  return { getState, download, install, cancel, dispose: () => downloadRouter?.dispose() };
}

module.exports = { createUpdateInstaller };

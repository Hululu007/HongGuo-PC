'use strict';
// Adapted from jayeeliu's PR #61, with path, partial-result and concurrent-write fixes (GPL-3.0).
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { fetchDanmaku } = require('./danmaku');
const { fetchEpisodeComments } = require('./episode-comments');
const { fetchPublicDetails } = require('./public-details');

const HONGGUO_ID = /^\d{6,30}$/;
const pending = new Map();

const sameIdentity = (a, b) => Boolean(a && b && a.dev === b.dev && a.ino === b.ino);
const sameState = (a, b) => a === b || (sameIdentity(a, b) && a.size === b.size &&
  a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs);

function fileState(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false }) || null;
  if (stat && (stat.isSymbolicLink() || !stat.isFile())) throw new Error('文字导出目标不是普通文件');
  return stat;
}

function exportLocation(target) {
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.realpathSync(parent), stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('文字导出目录不可用');
  return { parent, directory, stat, file: path.join(directory, path.basename(target)) };
}

function checkDirectory(location) {
  const stat = fs.lstatSync(location.directory);
  if (stat.isSymbolicLink() || !stat.isDirectory() || !sameIdentity(stat, location.stat) ||
      fs.realpathSync(location.parent) !== location.directory || fs.realpathSync(location.directory) !== location.directory)
    throw new Error('文字导出目录已变化，请检查后重试');
}

function readPrevious(file) {
  const stat = fileState(file);
  if (!stat) return { stat, data: null };
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    if (!sameState(stat, fs.fstatSync(fd))) throw new Error('文字导出目标已变化');
    const data = JSON.parse(fs.readFileSync(fd, 'utf8'));
    if (!sameState(stat, fs.fstatSync(fd))) throw new Error('文字导出目标已变化');
    return { stat, data };
  } finally { fs.closeSync(fd); }
}

function writeJsonAtomic(location, obj, previous) {
  const tmp = path.join(location.directory, `.hongguo-text-${randomUUID()}.tmp`);
  let fd, owned;
  try {
    checkDirectory(location);
    fd = fs.openSync(tmp, 'wx', 0o600);
    owned = fs.fstatSync(fd);
    fs.writeFileSync(fd, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    fs.fsyncSync(fd);
    const written = fs.fstatSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    checkDirectory(location);
    if (!sameState(written, fileState(tmp)) || !sameState(previous, fileState(location.file)))
      throw new Error('文字导出目标已变化，保留原文件');
    fs.renameSync(tmp, location.file);
    owned = undefined;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
    // Exclusive creation must succeed before cleanup; never remove a foreign collision.
    if (owned) {
      try { if (sameIdentity(owned, fs.lstatSync(tmp))) fs.unlinkSync(tmp); } catch (_) {}
    }
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runner = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try { results[index] = { ok: true, value: await worker(items[index], index) }; }
      catch (error) { results[index] = { ok: false, error }; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, runner));
  return results;
}

const isPartial = data => data.partial === true || data.truncated === true || data.source_limited === true ||
  (Number.isFinite(data.total) && Array.isArray(data.items) && data.total > data.items.length);

function danmakuDoc({ seriesId, seriesTitle, ep }, data, fetchedAt) {
  return { kind: 'danmaku', series_id: String(seriesId), episode_id: String(data.episode_id ?? ep.vid),
    episode_index: Number(ep.vid_index), series_title: seriesTitle, source: data.source || 'official',
    fetched_at: fetchedAt, truncated: data.truncated === true, partial: isPartial(data), notice: data.notice || '',
    items: (Array.isArray(data.items) ? data.items : []).map(it => ({ time: it.time, text: it.text, color: it.color || '', mode: it.mode || '' })) };
}

function commentsDoc({ seriesId, seriesTitle, ep }, data, fetchedAt) {
  return { kind: 'comments', series_id: String(seriesId), episode_id: String(data.episode_id ?? ep.vid),
    episode_index: Number(ep.vid_index), series_title: seriesTitle, fetched_at: fetchedAt,
    total: data.total ?? null, source_limited: data.source_limited === true, partial: isPartial(data), notice: data.notice || '',
    items: (Array.isArray(data.items) ? data.items : []).map(it => ({ id: it.id, content: it.content })) };
}

function reviewsDoc({ seriesId, seriesTitle }, reviews, fetchedAt) {
  return { kind: 'reviews', series_id: String(seriesId), series_title: seriesTitle, fetched_at: fetchedAt,
    total: reviews.total ?? null, partial: isPartial(reviews),
    items: (Array.isArray(reviews.items) ? reviews.items : []).map(it => ({ author: it.author, avatar: it.avatar || '',
      content: it.content, created_at: it.created_at ?? null, likes: it.likes ?? null, rating: it.rating ?? null })) };
}

async function writeOne(target, build, fetch) {
  if (typeof target !== 'string' || !path.isAbsolute(target)) return { status: 'fail' };
  target = path.resolve(target);
  let location;
  try { location = exportLocation(target); }
  catch (_) { return { status: 'fail' }; }
  const key = process.platform === 'win32' ? location.file.toLowerCase() : location.file;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    try {
      checkDirectory(location);
      const previous = readPrevious(location.file);
      const retry = previous.stat !== null;
      if (retry && previous.data?.partial !== true)
        return { status: 'skipped', itemCount: Array.isArray(previous.data?.items) ? previous.data.items.length : undefined };
      const data = await fetch(retry);
      if (data?.success === false && data.source_limited === true && data.code === 'EPISODE_COMMENTS_UNAVAILABLE')
        return { status: 'unavailable' };
      // Failed retries preserve the original partial file, even when the retry returns some items.
      if (!data || (data.success !== true && (retry || data.partial !== true))) return { status: 'fail' };
      const doc = build(data);
      writeJsonAtomic(location, doc, previous.stat);
      return { status: 'ok', partial: doc.partial === true, itemCount: doc.items.length, target };
    } catch (_) { return { status: 'fail' }; }
  })();
  pending.set(key, task);
  try { return await task; }
  finally { pending.delete(key); }
}

async function exportSeriesText(options = {}) {
  const {
    seriesId, seriesTitle, episodes = [], kinds = {}, reviewsPath,
    reviewsLimit = 1000, concurrency = 4,
    fetchers = { fetchDanmaku, fetchEpisodeComments, fetchPublicDetails }, now = () => Date.now(),
  } = options;
  const tally = () => ({ ok: 0, fail: 0, skipped: 0, partial: 0, items: 0, empty: 0, unavailable: 0 });
  const out = { danmaku: tally(), comments: tally(), reviews: tally(), files: [] };
  const wantDanmaku = kinds.danmaku === true, wantComments = kinds.comments === true, wantReviews = kinds.reviews === true;
  if (!wantDanmaku && !wantComments && !wantReviews) return out;
  if (!HONGGUO_ID.test(String(seriesId))) {
    if (wantDanmaku) out.danmaku.skipped = episodes.length;
    if (wantComments) out.comments.skipped = episodes.length;
    if (wantReviews) out.reviews.skipped = 1;
    return out;
  }

  const record = (kind, result) => {
    out[kind][result.status]++;
    if (Number.isInteger(result.itemCount)) {
      out[kind].items += result.itemCount;
      if (result.itemCount === 0) out[kind].empty++;
    }
    if (result.status === 'ok') {
      if (result.partial) out[kind].partial++;
      if (!out.files.includes(result.target)) out.files.push(result.target);
    }
  };
  if (wantReviews) record('reviews', await writeOne(reviewsPath,
    d => reviewsDoc({ seriesId, seriesTitle }, d.reviews, now()),
    () => fetchers.fetchPublicDetails(String(seriesId), '', { reviewsLimit })));

  if (wantDanmaku || wantComments) {
    const results = await mapLimit(episodes, concurrency, async ep => {
      const stem = typeof ep?.savePath === 'string' && path.isAbsolute(ep.savePath) && /\.mp4$/i.test(ep.savePath)
        ? ep.savePath.slice(0, -4) : null;
      const cell = {};
      if (wantDanmaku) cell.danmaku = await writeOne(stem ? `${stem}.danmaku.json` : null,
        d => danmakuDoc({ seriesId, seriesTitle, ep }, d, now()),
        fresh => fetchers.fetchDanmaku({ seriesId: String(seriesId), vid: ep.vid, fresh }));
      if (wantComments) cell.comments = await writeOne(stem ? `${stem}.comments.json` : null,
        d => commentsDoc({ seriesId, seriesTitle, ep }, d, now()),
        () => fetchers.fetchEpisodeComments({ seriesId: String(seriesId), episodeId: ep.vid, cursor: null, limit: 30 }));
      return cell;
    });
    for (const r of results) {
      if (!r.ok) { if (wantDanmaku) out.danmaku.fail++; if (wantComments) out.comments.fail++; continue; }
      if (wantDanmaku) record('danmaku', r.value.danmaku);
      if (wantComments) record('comments', r.value.comments);
    }
  }
  return out;
}

module.exports = { exportSeriesText };

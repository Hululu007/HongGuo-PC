'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { exportSeriesText } = require('./text-export');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hongguo-text-safety-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'downloads');
  fs.mkdirSync(directory);
  const target = path.join(directory, 'episode.danmaku.json');
  const fetchers = { fetchDanmaku: async () => ({ success: true, items: [{ time: 1, text: 'test' }] }) };
  const options = { seriesId: '7240000000000000001', seriesTitle: 'test', kinds: { danmaku: true },
    episodes: [{ vid: '7240000000000000002', vid_index: 1, savePath: path.join(directory, 'episode.mp4') }], fetchers };
  return { root, directory, target, fetchers, options };
}

test('export never truncates a pre-existing predictable temporary hard link', async t => {
  const { root, target, options } = fixture(t);
  const outside = path.join(root, 'unrelated.json');
  const original = 'unrelated user data\n';
  fs.writeFileSync(outside, original);
  fs.linkSync(outside, `${target}.tmp`);
  const result = await exportSeriesText(options);
  assert.equal(fs.readFileSync(outside, 'utf8'), original);
  assert.equal(fs.readFileSync(`${target}.tmp`, 'utf8'), original);
  assert.equal(result.danmaku.ok, 1);
  assert.equal(JSON.parse(fs.readFileSync(target, 'utf8')).kind, 'danmaku');
});

test('a foreign predictable temporary directory does not block export or get removed', async t => {
  const { target, options } = fixture(t);
  const foreign = `${target}.tmp`;
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, 'keep.txt'), 'keep');
  const result = await exportSeriesText(options);
  assert.equal(result.danmaku.ok, 1);
  assert.equal(fs.readFileSync(path.join(foreign, 'keep.txt'), 'utf8'), 'keep');
});

test('a destination created while fetching is preserved, not overwritten', async t => {
  const { target, options, fetchers } = fixture(t);
  const original = JSON.stringify({ partial: false, items: [{ text: 'another export' }] });
  fetchers.fetchDanmaku = async () => {
    fs.writeFileSync(target, original);
    return { success: true, items: [] };
  };
  const result = await exportSeriesText(options);
  assert.equal(result.danmaku.fail, 1);
  assert.equal(fs.readFileSync(target, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(path.dirname(target)), [path.basename(target)]);
});

test('a partial destination edited while fetching is preserved byte for byte', async t => {
  const { target, options, fetchers } = fixture(t);
  fs.writeFileSync(target, JSON.stringify({ partial: true, items: [] }));
  const newer = JSON.stringify({ partial: true, items: [{ text: 'newer local content' }] });
  fetchers.fetchDanmaku = async () => {
    fs.writeFileSync(target, newer);
    return { success: true, items: [] };
  };
  const result = await exportSeriesText(options);
  assert.equal(result.danmaku.fail, 1);
  assert.equal(fs.readFileSync(target, 'utf8'), newer);
});

test('a linked destination is rejected before reading or fetching', async t => {
  const { target, options, fetchers } = fixture(t);
  const original = JSON.stringify({ partial: true, items: [{ text: 'keep' }] });
  fs.writeFileSync(target, original);
  const lstat = fs.lstatSync;
  let requests = 0;
  fetchers.fetchDanmaku = async () => { requests++; return { success: true, items: [] }; };
  const mock = t.mock.method(fs, 'lstatSync', (file, ...args) => {
    const stat = lstat(file, ...args);
    if (path.resolve(String(file)) === path.resolve(target) && stat) stat.isSymbolicLink = () => true;
    return stat;
  });
  const result = await exportSeriesText(options);
  mock.mock.restore();
  assert.equal(result.danmaku.fail, 1);
  assert.equal(requests, 0);
  assert.equal(fs.readFileSync(target, 'utf8'), original);
});

test('a directory replaced by a junction during fetching cannot redirect an export', async t => {
  const { root, directory, target, options, fetchers } = fixture(t);
  const outside = path.join(root, 'unrelated');
  fs.mkdirSync(outside);
  fetchers.fetchDanmaku = async () => {
    fs.renameSync(directory, `${directory}-original`);
    fs.symlinkSync(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
    return { success: true, items: [] };
  };
  const result = await exportSeriesText(options);
  assert.equal(result.danmaku.fail, 1);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.existsSync(target), false);
  assert.deepEqual(fs.readdirSync(`${directory}-original`), []);
});

test('exclusive temporary creation never removes another writer\'s colliding file', async t => {
  const { directory, target, options } = fixture(t);
  const open = fs.openSync;
  let collision;
  const mock = t.mock.method(fs, 'openSync', (file, flags, ...args) => {
    if (typeof file === 'string' && path.basename(file).startsWith('.hongguo-text-')) {
      collision = file;
      const fd = open(file, 'wx', 0o600);
      fs.writeFileSync(fd, 'foreign temporary file');
      fs.closeSync(fd);
    }
    return open(file, flags, ...args);
  });
  const result = await exportSeriesText(options);
  mock.mock.restore();
  assert.ok(collision, 'export uses an unpredictable temporary name');
  assert.equal(result.danmaku.fail, 1);
  assert.equal(fs.readFileSync(collision, 'utf8'), 'foreign temporary file');
  assert.equal(fs.existsSync(target), false);
  assert.deepEqual(fs.readdirSync(directory), [path.basename(collision)]);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const store = require('../src/store');

function withStore(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hongguo-store-'));
  const file = path.join(dir, 'data.json');
  const errors = [];
  store.setErrorHandler(payload => errors.push(payload));
  try { run({ dir, file, errors }); }
  finally {
    store.setErrorHandler(null);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const writes = [
  () => store.saveSettings({ theme: 'dark' }),
  () => store.saveTasks([{ id: 'pending' }]),
  () => store.saveSeries([{ series_id: 'new' }]),
  () => store.savePlayback({ new: { position: 10 } }),
  () => store.saveMergeTasks([{ id: 'new' }]),
];

function assertReadOnly(file, original, errors) {
  assert.ok(errors.length, 'read failure must notify the existing error handler');
  let firstError;
  for (const write of writes) {
    assert.throws(write, error => {
      assert.equal(error.code, 'STORE_READ_FAILED');
      assert.ok(error.cause, 'retain the original read/parse error');
      if (firstError) assert.equal(error, firstError, 'retain read failure until reinitialization');
      firstError = error;
      return true;
    });
    assert.equal(fs.readFileSync(file, 'utf8'), original, 'every write must preserve unreadable data');
  }
  assert.deepEqual(store.getSettings(), {});
  assert.deepEqual(store.getTasks(), []);
  assert.deepEqual(store.getSeries(), []);
  assert.deepEqual(store.getPlayback(), {});
  assert.deepEqual(store.getMergeTasks(), []);
}

test('broken JSON stays intact, startup survives, all writes stay blocked until explicit reload', () => withStore(({ file, errors }) => {
  const original = '{"settings":{"theme":"light"},"tasks":[';
  fs.writeFileSync(file, original);
  assert.doesNotThrow(() => store.init(file));
  assertReadOnly(file, original, errors);
  fs.writeFileSync(file, JSON.stringify({ settings: { theme: 'light' }, tasks: [{ id: 'recovered' }] }));
  assert.throws(() => store.saveTasks([]), { code: 'STORE_READ_FAILED' });
  store.init(file);
  store.savePlayback({ recovered: { position: 10 } });
  assert.equal(JSON.parse(fs.readFileSync(file)).tasks[0].id, 'recovered');
}));

test('read permission failure preserves valid data and reports the original cause', () => withStore(({ file, errors }) => {
  const original = JSON.stringify({ settings: { theme: 'light' }, tasks: [{ id: 'saved' }] });
  fs.writeFileSync(file, original);
  const read = fs.readFileSync;
  const denied = Object.assign(new Error('simulated permission denied'), { code: 'EACCES' });
  fs.readFileSync = (target, ...args) => {
    if (target === file) throw denied;
    return read(target, ...args);
  };
  try { assert.doesNotThrow(() => store.init(file)); }
  finally { fs.readFileSync = read; }
  assertReadOnly(file, original, errors);
  assert.throws(() => store.saveSettings({}), error => error.cause === denied);
}));

test('invalid JSON document shapes are protected instead of silently discarded', () => withStore(({ file, errors }) => {
  for (const invalid of [null, [], 42, { tasks: {} }, { settings: [] }, { series: {} }, { playback: [] }, { mergeTasks: {} }]) {
    const original = JSON.stringify(invalid);
    fs.writeFileSync(file, original);
    errors.length = 0;
    assert.doesNotThrow(() => store.init(file));
    assertReadOnly(file, original, errors);
  }
}));

test('missing file initializes normally; successful saves retain unrelated and future fields', () => withStore(({ dir, file, errors }) => {
  store.init(file);
  store.saveSettings({ theme: 'light' });
  store.saveTasks([{ id: 'complete' }]);
  assert.equal(errors.length, 0);
  const document = JSON.parse(fs.readFileSync(file));
  document.futureField = { preserve: true };
  fs.writeFileSync(file, JSON.stringify(document));
  store.init(file);
  store.savePlayback({ complete: { position: 10 } });
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).futureField, { preserve: true });
  assert.deepEqual(fs.readdirSync(dir).sort(), ['data.json', 'data.json.bak']);
}));

test('interrupted write, fsync or rename keeps disk and memory at their last durable state without leaking handles', () => withStore(({ dir, file, errors }) => {
  store.init(file);
  store.saveSettings({ theme: 'light' });
  store.saveTasks([{ id: 'saved' }]);
  const before = fs.readFileSync(file, 'utf8');
  for (const operation of ['writeFileSync', 'fsyncSync', 'renameSync']) {
    const open = fs.openSync;
    const handles = [];
    fs.openSync = (target, ...args) => {
      const fd = open(target, ...args);
      if (String(target).startsWith(file + '.tmp-')) handles.push(fd);
      return fd;
    };
    const original = fs[operation];
    fs[operation] = (target, ...args) => {
      if (operation === 'writeFileSync') original(target, '{');
      throw new Error('simulated disk full');
    };
    try {
      store.getTasks()[0].id = 'unsaved';
      assert.throws(() => store.saveTasks(store.getTasks()), /simulated disk full/);
    } finally { fs[operation] = original; fs.openSync = open; }
    for (const fd of handles) assert.throws(() => fs.fstatSync(fd), { code: 'EBADF' });
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.equal(store.getTasks()[0].id, 'saved');
    assert.deepEqual(fs.readdirSync(dir).sort(), ['data.json', 'data.json.bak']);
  }
  assert.equal(errors.length, 3);
  store.saveTasks([{ id: 'complete' }]);
  assert.equal(JSON.parse(fs.readFileSync(file)).tasks[0].id, 'complete');
}));

test('temporary contents are synced and the handle is closed before replacing saved data', () => withStore(({ file }) => {
  store.init(file);
  store.saveTasks([{ id: 'saved' }]);
  const before = fs.readFileSync(file, 'utf8');
  const sync = fs.fsyncSync;
  const rename = fs.renameSync;
  const open = fs.openSync;
  let tempName = null;
  let dataFd = null;
  let syncedFd = null;
  fs.openSync = (target, ...args) => {
    const fd = open(target, ...args);
    if (String(target).startsWith(file + '.tmp-')) {
      tempName = target;
      dataFd = fd;
    }
    return fd;
  };
  fs.fsyncSync = fd => {
    if (fd === dataFd) {
      assert.equal(fs.readFileSync(file, 'utf8'), before);
      assert.equal(JSON.parse(fs.readFileSync(tempName)).tasks[0].id, 'complete');
      syncedFd = fd;
    }
    sync(fd);
  };
  fs.renameSync = (source, destination) => {
    assert.notEqual(syncedFd, undefined, 'sync completed contents before replacing the saved file');
    assert.throws(() => fs.fstatSync(syncedFd), { code: 'EBADF' });
    return rename(source, destination);
  };
  try { store.saveTasks([{ id: 'complete' }]); }
  finally { fs.fsyncSync = sync; fs.renameSync = rename; fs.openSync = open; }
  assert.equal(JSON.parse(fs.readFileSync(file)).tasks[0].id, 'complete');
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.bak')).tasks[0].id, 'complete');
}));

test('successful saves keep a verified backup mirror; unchanged saves leave it untouched', () => withStore(({ file }) => {
  store.init(file);
  store.saveSettings({ theme: 'light' });
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.bak')), { tasks: [], settings: { theme: 'light' } });
  store.saveTasks([{ id: 'second' }]);
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.bak')).tasks[0]?.id, 'second');
  const mtime = fs.statSync(file + '.bak').mtimeMs;
  store.saveTasks(store.getTasks()); // 内容与磁盘一致：指纹跳过，不再重复轮换
  assert.equal(fs.statSync(file + '.bak').mtimeMs, mtime);
}));

test('a damaged current document is never copied over a valid backup', () => withStore(({ file }) => {
  store.init(file);
  store.saveSettings({ theme: 'light' });
  store.saveTasks([{ id: 'good' }]);
  fs.writeFileSync(file, '{"tasks":'); // 运行期间外部损坏（未重启，尚无只读保护）
  store.savePlayback({ recovered: { position: 3 } }); // 覆盖保存后备份新文档，损坏字节绝不进入备份
  assert.equal(JSON.parse(fs.readFileSync(file + '.bak')).playback.recovered.position, 3);
  assert.equal(JSON.parse(fs.readFileSync(file)).playback.recovered.position, 3);
}));

test('restore recovers a valid backup only after explicit confirmation and preserves the damaged file', () => withStore(({ dir, file, errors }) => {
  store.init(file);
  store.saveSettings({ theme: 'light' });
  store.saveTasks([{ id: 'good' }]);
  const backupDocument = JSON.parse(fs.readFileSync(file + '.bak'));
  fs.writeFileSync(file, '{"tasks":');
  store.init(file);
  assert.ok(errors.length, 'read failure must notify the error handler');
  assert.equal(errors[0].recovery?.available, true, 'a valid backup is offered for recovery');
  assert.deepEqual(store.getRecoveryInfo(), errors[0].recovery);
  assert.equal(store.restoreFromBackup(false).success, false, 'restore requires explicit confirmation');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"tasks":', 'an unconfirmed restore leaves the original file');
  const result = store.restoreFromBackup(true);
  assert.equal(result.success, true);
  assert.equal(result.restartRequired, true);
  assert.match(result.preservedFile, /^data\.json\.corrupt-/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), backupDocument);
  assert.equal(fs.readFileSync(path.join(dir, result.preservedFile), 'utf8'), '{"tasks":');
  store.init(file);
  store.savePlayback({ good: { position: 5 } });
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).settings.theme, 'light');
}));

test('restore is cancelled when the backup is unusable or the damaged file changed since startup', () => withStore(({ file }) => {
  fs.writeFileSync(file + '.bak', 'not json');
  fs.writeFileSync(file, '{"tasks":');
  store.init(file);
  assert.equal(store.getRecoveryInfo().available, false);
  assert.equal(store.restoreFromBackup(true).success, false);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"tasks":');
  fs.writeFileSync(file + '.bak', JSON.stringify({ settings: { theme: 'dark' } }));
  store.init(file);
  assert.equal(store.getRecoveryInfo().available, true);
  fs.appendFileSync(file, 'x'); // 启动后原文件又变化：拒绝覆盖新内容
  const result = store.restoreFromBackup(true);
  assert.equal(result.success, false);
  assert.match(result.error, /发生变化/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"tasks":x');
}));

test('saves keep legacy temp residues intact and reuse the exclusive temp during rename retries', () => withStore(({ dir, file, errors }) => {
  fs.writeFileSync(file + '.tmp', '{"legacy":true}');
  store.init(file);
  store.saveSettings({ theme: 'light' });
  assert.equal(fs.readFileSync(file + '.tmp', 'utf8'), '{"legacy":true}', 'the legacy residue is never overwritten');
  assert.deepEqual(fs.readdirSync(dir).filter(name => name.startsWith('data.json.tmp')), ['data.json.tmp']);
  const rename = fs.renameSync;
  const open = fs.openSync;
  let renameCalls = 0;
  let openCalls = 0;
  fs.openSync = (target, ...args) => {
    if (String(target).startsWith(file + '.tmp-')) openCalls++;
    return open(target, ...args);
  };
  fs.renameSync = (source, destination) => {
    renameCalls++;
    if (renameCalls === 1) throw Object.assign(new Error('busy'), { code: 'EPERM' });
    return rename(source, destination);
  };
  try { store.saveTasks([{ id: 'retry' }]); }
  finally { fs.renameSync = rename; fs.openSync = open; }
  assert.equal(errors.length, 0, 'a transient rename failure must self-heal without surfacing an error');
  assert.equal(JSON.parse(fs.readFileSync(file)).tasks[0].id, 'retry');
  assert.equal(openCalls, 1, 'the retry reuses the already-synced exclusive temp instead of rewriting it');
}));

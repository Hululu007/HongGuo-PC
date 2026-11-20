// Offline file-boundary checks: disposable marker files only, never user media or app data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const source = path.resolve(__dirname, '../main.js'), req = createRequire(source);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hongguo-delete-boundary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const downloads = path.join(root, 'downloads'), unrelated = path.join(root, 'unrelated');
  fs.mkdirSync(downloads); fs.mkdirSync(unrelated);
  const handlers = {}, app = new EventEmitter();
  Object.assign(app, { getVersion: () => 'test', getPath: () => downloads,
    commandLine: { appendSwitch() {} }, requestSingleInstanceLock: () => true, whenReady: () => ({ then() {} }) });
  const store = { getSettings: () => ({ root: downloads }), saveTasks() {}, saveSeries() {}, saveMergeTasks() {} };
  const context = vm.createContext({ require: name => name === 'electron'
    ? { app, ipcMain: { handle: (key, fn) => { handlers[key] = fn; } }, protocol: { registerSchemesAsPrivileged() {} } }
    : name === './src/store' ? store : req(name), __dirname: path.dirname(source), process, Buffer, URL,
    Response, Request, Headers, AbortController, setTimeout, clearTimeout, console: { log() {}, warn() {}, error() {} } });
  vm.runInContext(fs.readFileSync(source, 'utf8'), context, { filename: source });
  req('./scripts/fixtures/trusted-ipc.cjs')(context, handlers);
  const run = code => vm.runInContext(code, context);
  run("seriesRegistry = [{ series_id: 'S', series_title: 'Short', episodes: [{ vid: 'one', vid_index: 1 }] }]");
  const directory = context.seriesDownloadDir(downloads, 'S', 'Short');
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  const filename = 'Short 001.mp4', original = Buffer.alloc(120000, 7);
  const foreign = path.join(unrelated, filename);
  fs.writeFileSync(foreign, original);
  const link = () => fs.symlinkSync(unrelated, directory, process.platform === 'win32' ? 'junction' : 'dir');
  const record = () => {
    context.taskFixture = { id: 'one', status: 'completed', type: 'hongguo', savePath: path.join(directory, filename),
      customDir: directory, filename, hongguoInfo: { series_id: 'S', series_title: 'Short', vid: 'one', vid_index: 1 } };
    run('downloadTasks = [taskFixture]');
  };
  const invoke = channel => channel === 'delete-task' ? handlers[channel]({}, 'one', { deleteFiles: true })
    : channel === 'delete-tasks' ? handlers[channel]({}, ['one'], { deleteFiles: true })
    : handlers[channel]({}, 'S', 1);
  return { context, run, directory, unrelated, foreign, original, filename, link, record, invoke };
}

for (const channel of ['delete-series-files', 'delete-all-downloaded', 'delete-episode-file', 'cleanup-watched-episode']) {
  test(`${channel} refuses an unrecorded series directory junction`, async t => {
    const h = fixture(t);
    h.link();
    const result = await h.invoke(channel);
    assert.deepEqual(fs.readFileSync(h.foreign), h.original);
    assert.equal(result.success, false, result.error);
    assert.equal(result.count || 0, 0);
    assert.equal(result.freed || 0, 0);
    assert.equal(h.context.collectSeriesEpisodeFiles('S', 'Short').ordered.length, 0);
  });
}

for (const channel of ['delete-task', 'delete-tasks', 'delete-series-files', 'delete-all-downloaded', 'delete-episode-file', 'cleanup-watched-episode']) {
  test(`${channel} retains a legacy task whose directory became a junction`, async t => {
    const h = fixture(t);
    h.record(); h.link();
    const result = await h.invoke(channel);
    assert.deepEqual(fs.readFileSync(h.foreign), h.original);
    assert.equal(result.success, false, result.error);
    assert.equal(result.freed || 0, 0);
    assert.equal(h.run('downloadTasks.length'), 1);
  });
}

for (const channel of ['delete-task', 'delete-series-files', 'delete-episode-file']) {
  test(`${channel} rechecks directory identity after asynchronous validation`, async t => {
    const h = fixture(t);
    fs.mkdirSync(h.directory);
    fs.writeFileSync(path.join(h.directory, h.filename), h.original);
    h.record();
    const validate = h.context.validateNasDeletion;
    h.context.validateNasDeletion = async tasks => {
      const check = await validate(tasks);
      fs.renameSync(h.directory, `${h.directory}-original`);
      h.link();
      return check;
    };
    const result = await h.invoke(channel);
    assert.deepEqual(fs.readFileSync(h.foreign), h.original);
    assert.deepEqual(fs.readFileSync(path.join(`${h.directory}-original`, h.filename)), h.original);
    assert.equal(result.success, false, result.error);
    assert.equal(result.freed || 0, 0);
    assert.equal(h.run('downloadTasks.length'), 1);
  });
}

test('episode filenames reject malformed indexes before constructing a path', t => {
  const h = fixture(t);
  for (const index of ['../../unrelated/marker', '..\\\\..\\\\unrelated\\\\marker', 0, -1, 1.5, Infinity, true, {}]) {
    assert.throws(() => h.context.uniqueEpisodeFilename({ name_format: '剧名' }, 'Short', { vid_index: index }), /分集|编号/);
  }
  const name = h.context.uniqueEpisodeFilename({ name_format: '' }, '../Outside/Title', { vid_index: 1 });
  assert.equal(path.basename(name), name);
  assert.equal(path.isAbsolute(name), false);
});

test('ordinary directory identity detects same-device directory replacement', async t => {
  const h = fixture(t);
  fs.mkdirSync(h.directory);
  const identity = h.context.readDirectoryIdentity(h.directory);
  fs.renameSync(h.directory, `${h.directory}-original`);
  fs.mkdirSync(h.directory);
  assert.throws(() => h.context.validateDirectoryIdentity(identity, path.join(h.directory, h.filename)), /目录|保留/);
});

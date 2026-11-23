const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.resolve(__dirname, '../main.js'), 'utf8');
const mediaSources = fs.readFileSync(path.resolve(__dirname, '../src/native/media-sources.js'), 'utf8');
const router = fs.readFileSync(path.resolve(__dirname, '../src/native/hongguo.js'), 'utf8');
const sourceRegistry = mediaSources.match(/const BUILTIN_SOURCES = \[[\s\S]*?\];/)?.[0] || '';
assert.doesNotMatch(sourceRegistry, /id:\s*'hema'/);
assert.match(main, /sourceId === 'hema'.*河马来源已移除/s);
assert.match(main, /options\?\.source === 'hema'.*河马来源已移除/);
assert.match(router, /河马来源已移除/);
console.log('PASS source integration: Hema is unregistered; browse, search, detail and playback reject legacy IDs');

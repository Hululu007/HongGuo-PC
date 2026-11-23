const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const router = fs.readFileSync(path.join(__dirname, '../src/native/hongguo.js'), 'utf8');
const mediaSources = fs.readFileSync(path.join(__dirname, '../src/native/media-sources.js'), 'utf8');
const rendererSources = fs.readFileSync(path.join(__dirname, '../src/components/mediaSourcesModel.mjs'), 'utf8');

assert.doesNotMatch(mediaSources, /id:\s*'hema'/, 'Hema is not registered as a built-in source');
assert.doesNotMatch(rendererSources, /id:\s*'hema'/, 'Hema is not exposed by the renderer source model');
assert.match(main, /河马来源已移除/);
assert.match(router, /河马来源已移除/);
console.log('PASS removed Hema source: no source registration; legacy IDs fail closed');

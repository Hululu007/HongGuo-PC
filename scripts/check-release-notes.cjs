const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getReleaseNotes } = require('./release-notes.cjs');

const section = (version, body) => `## ${version} · 2026-11-25\n\n${body}\n`;
const legacy = '- Preserve existing preferences.\n- Keep installed-user updates available.';
const template = [
  '## 📢 版本概述',
  '',
  '本次更新整理了依赖维护和发布说明。',
  '',
  '## 🔧 改进与优化',
  '',
  '- **依赖维护**：配套依赖一起提交检查。',
  '',
  '## 📦 下载与安装',
  '',
  '| 文件名 | 平台 / 架构 | 说明 |',
  '|---|---|---|',
  '| [installer.exe](https://example.com/installer.exe) | Windows x64 | 安装版 |',
  '| latest.yml | Windows x64 | 更新清单 |',
  '',
  '- 已安装用户：保留应用内更新。',
  '',
  '## 🧪 验证结果',
  '',
  '- 自动检查：通过测试样例。',
  '- Windows 桌面：本样例不作实机验收结论。',
  '',
  '---',
  '',
  '**项目地址：** [项目][repository]  ',
  '**问题反馈：** [Issues](https://example.com/issues)',
  '',
  '[repository]: https://example.com/project',
].join('\n');
const history = `# 更新记录\n${section('9.2', '- A newer release.')}${section('9.1', template)}${section('9.0', legacy)}`;

assert.equal(getReleaseNotes('v9.1', history), `${template}\n`,
  'Template headings, blank lines, tables, links and Markdown hard breaks must survive extraction');
assert.equal(getReleaseNotes('v9.1', history.replace(/\n/g, '\r\n')), `${template}\n`,
  'Windows line endings must not affect template extraction');
assert.equal(getReleaseNotes('v9.0', history), `${legacy}\n`, 'Adjacent releases must not leak into historical lists');
assert.equal(getReleaseNotes('v9.1', section('9.1', '- One change.\n\n- Another change.')), '- One change.\n- Another change.\n',
  'Historical list normalization must remain compatible');

for (const invalid of ['9.1', 'v9.1.0', 'v9.1-beta.1', undefined]) {
  assert.throws(() => getReleaseNotes(invalid, history), /Expected a release tag/);
}
assert.throws(() => getReleaseNotes('v8.9', history), /exactly one release notes section/);
assert.throws(() => getReleaseNotes('v9.1', history + section('9.1', legacy)), /exactly one release notes section/);
assert.throws(() => getReleaseNotes('v9.1', section('9.1', ' \n\t')), /must not be empty/);
assert.throws(() => getReleaseNotes('v9.1', section('9.1', 'Internal release audit.')), /version overview template/);
assert.throws(() => getReleaseNotes('v9.1', section('9.1', '## 📢 版本概述')), /version overview template|empty template sections/);
assert.throws(() => getReleaseNotes('v9.1', section('9.1', '## 📢 版本概述\n\n## 🧪 验证结果\n\n- Passed.')), /empty template sections/);
assert.throws(() => getReleaseNotes('v9.1', section('9.1', '## 📢 版本概述\n\nA summary.\n\n## 🧪 验证结果')), /empty template sections/);
assert.throws(() => getReleaseNotes('v9.1', section('9.1', '## 📢 版本概述\n\n# Duplicate release title\n\nA summary.')), /must not repeat the release title/);

const recorded = fs.readFileSync(path.join(__dirname, '../docs/releases/release-notes.md'), 'utf8');
const recordedVersions = [...recorded.matchAll(/^## (\d+\.\d+) · /gm)].map(match => match[1]);
assert.ok(recordedVersions.length, 'The source history must contain release notes');
for (const version of recordedVersions) assert.ok(getReleaseNotes(`v${version}`, recorded).trim());
console.log(`PASS release template extraction, rejection cases and ${recordedVersions.length} historical releases`);

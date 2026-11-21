// 关闭按钮收进系统托盘：决策分支、main.js 托盘装配与设置页开关的静态核验。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveCloseAction } = require('../src/native/close-to-tray');

// 决策分支：默认托盘、退出流程放行、托盘退出放行、设置关闭退回直接退出、macOS 维持关闭窗口。
assert.equal(resolveCloseAction(), 'hide', 'close defaults to hiding into the tray');
assert.equal(resolveCloseAction({ closeToTray: true, quitReady: false }), 'hide');
assert.equal(resolveCloseAction({ closeToTray: true, quitReady: true }), 'destroy', 'before-quit readiness lets the window close');
assert.equal(resolveCloseAction({ closeToTray: true, isQuitting: true }), 'destroy', 'tray quit lets the window close');
assert.equal(resolveCloseAction({ closeToTray: false }), 'quit', 'disabling the preference restores direct quit');
assert.equal(resolveCloseAction({ closeToTray: false, quitReady: true }), 'destroy');
assert.equal(resolveCloseAction({ platform: 'darwin', closeToTray: true }), 'destroy', 'macOS keeps close-window-without-quit');
assert.equal(resolveCloseAction({ platform: 'linux', closeToTray: false }), 'quit');
console.log('PASS close-to-tray decision: default hide, quit readiness, tray quit, disabled preference, macOS');

const root = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
// main.js 装配：托盘创建/销毁、关闭分支、气泡提示、设置读取。
assert.ok(/require\('\.\/src\/native\/close-to-tray'\)/.test(mainSource), 'main.js imports the close decision helper');
assert.ok(/function createTray\(\)/.test(mainSource), 'main.js creates the tray');
assert.ok(/createTray\(\);/.test(mainSource), 'tray is created during startup');
assert.ok(/destroyTray\(\); bossKey\.dispose\(\)/.test(mainSource), 'tray is destroyed on will-quit');
assert.ok(/displayBalloon\(/.test(mainSource), 'first hide shows a one-time tray balloon');
assert.ok(/label: '退出应用', click: \(\) => \{ isQuitting = true; app\.quit\(\); \}/.test(mainSource), 'tray menu exposes real quit');
assert.ok(/label: '显示主窗口'/.test(mainSource), 'tray menu exposes window restore');
assert.ok(/closeToTrayEnabled\(\)/.test(mainSource), 'close handler reads the saved preference');
assert.ok(/close_to_tray: true,/.test(mainSource), 'close_to_tray defaults to enabled');
assert.ok(/'close_to_tray'/.test(mainSource), 'close_to_tray is an editable settings key');
assert.ok(/merged\.close_to_tray = source\.close_to_tray === true/.test(mainSource), 'saved preference is normalized to boolean');
assert.ok(/function revealMainWindow\(\)/.test(mainSource), 'tray click restores the main window');
console.log('PASS main.js tray wiring: create, menu, balloon, decision helper, settings key');

// 设置页：锚点与开关存在，且默认值展示为开启。
const settingsSource = fs.readFileSync(path.join(root, 'src/components/Settings.jsx'), 'utf8');
assert.ok(/\{ id: 'window', label: '窗口'/.test(settingsSource), 'settings search exposes the window card');
assert.ok(/aria-label="关闭时最小化到系统托盘"/.test(settingsSource), 'toggle is labelled for accessibility');
assert.ok(/checked=\{settings\.close_to_tray !== false\}/.test(settingsSource), 'toggle renders enabled by default');
assert.ok(/update\('close_to_tray', event\.target\.checked\)/.test(settingsSource), 'toggle persists through the settings draft');
assert.ok(/close_to_tray: true, \.\.\.await window\.electronAPI\.getSettings\(\)/.test(settingsSource), 'renderer readback defaults the preference on');
console.log('PASS settings page window card: anchor, toggle label, default state, persistence');

// 关闭按钮仍走 windowClose IPC（标题栏行为不变，由主进程改为托盘收起）。
const titlebarSource = fs.readFileSync(path.join(root, 'src/components/TitleBar.jsx'), 'utf8');
assert.ok(/windowClose\?/.test(titlebarSource), 'title bar close keeps calling windowClose');
console.log('PASS title bar close button keeps its IPC contract');

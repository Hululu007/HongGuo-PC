const assert = require('node:assert/strict');
const { getTrustedDevServerUrl } = require('./dev-server-url');

for (const value of ['http://localhost:5173', 'http://127.0.0.1:5173/', 'http://[::1]:5173']) {
  assert.equal(getTrustedDevServerUrl(value), new URL(value).origin, `${value} is a local development origin`);
}

for (const value of [
  'https://evil.invalid',
  'http://192.168.1.5:5173',
  'http://localhost.evil.invalid:5173',
  'http://user:pass@localhost:5173',
  'http://localhost:5173/remote',
  'http://localhost:5173/?token=x',
  'http://localhost:5173/#route',
  'not a URL',
]) {
  assert.equal(getTrustedDevServerUrl(value), '', `${value} must not be trusted as a development origin`);
}

assert.equal(getTrustedDevServerUrl('http://localhost:5173', true), '', 'packaged builds ignore the development URL');
assert.equal(getTrustedDevServerUrl(`http://localhost:5173/${'a'.repeat(2048)}`), '', 'oversized input is rejected');
console.log('dev server URL: packaged builds ignore environment overrides; development origins are loopback-only');

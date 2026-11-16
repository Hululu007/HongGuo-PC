const assert = require('node:assert/strict');
const test = require('node:test');
const { parseExternalUrl } = require('./external-links');

test('external links allow only the product web hosts and reject credentials or custom schemes', () => {
  assert.equal(parseExternalUrl('https://github.com/yuchen0x1/HongGuo-PC/releases').hostname, 'github.com');
  assert.equal(parseExternalUrl('https://qm.qq.com/q/tGVzo8p2Ba').hostname, 'qm.qq.com');
  for (const value of ['https://example.com/', 'https://user:secret@github.com/x', 'file:///tmp/a', 'javascript:alert(1)', 'custom-app:run']) {
    assert.equal(parseExternalUrl(value), null, value);
  }
});

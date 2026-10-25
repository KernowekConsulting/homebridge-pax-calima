'use strict';
// Install-time smoke check only. Never construct a driver, read noble.state,
// register stateChange listeners or scan: those operations initialise radio.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.dirname(require.resolve('@stoprocent/noble/package.json'));
const fromNoble = createRequire(path.join(root, 'package.json'));
const result = { platform: process.platform, arch: process.arch, node: process.version,
  noble: fromNoble('./package.json').version, adapterInitialized: false };
if (['linux', 'freebsd', 'android'].includes(process.platform)) {
  const noble = require('@stoprocent/noble');
  // Optional dependencies may be nested rather than hoisted by npm.
  const socket = fromNoble('@stoprocent/bluetooth-hci-socket');
  assert.equal(typeof socket, 'function');
  assert.equal(noble._initialized, false);
  result.hci = fromNoble('@stoprocent/bluetooth-hci-socket/package.json').version;
  result.nativeHciLoaded = true;
} else {
  const addon = fromNoble('node-gyp-build')(root);
  assert.ok(Object.keys(addon).length > 0);
  if (process.platform === 'darwin') assert.equal(typeof addon.NobleMac, 'function');
  result.nativeAddonLoaded = true;
}
console.log(JSON.stringify(result));

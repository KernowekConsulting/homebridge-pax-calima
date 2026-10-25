'use strict';
const { createRequire } = require('node:module');
const moduleName = process.env.HOMEBRIDGE_TEST_MODULE || 'homebridge';
const entry = require.resolve(moduleName);
const fromHomebridge = createRequire(entry);
const hap = fromHomebridge(moduleName === 'homebridge1' ? 'hap-nodejs' : '@homebridge/hap-nodejs');
module.exports = { hap, entry };

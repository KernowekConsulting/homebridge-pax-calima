'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const p = require('../lib/protocol');
const { validateConfig } = require('../lib/platform');
const Ajv = require('ajv');

test('six and eight digit PINs use UInt32LE, preserving leading zero strings', () => {
  assert.equal(p.encodePin('012345').readUInt32LE(), 12345);
  assert.equal(p.encodePin('00123456').readUInt32LE(), 123456);
  for (const v of [123456, '12345', '1234567', '123456789', '12345x', null]) assert.throws(() => p.encodePin(v));
});
test('only explicit success authenticates; false, unknown and malformed replies fail closed', () => {
  for (const v of ['01', '01000000']) p.confirmAuth(Buffer.from(v, 'hex'));
  for (const v of ['', '00', '02', 'ff', '00000000', '00010000', '0100']) assert.throws(() => p.confirmAuth(Buffer.from(v, 'hex')));
});
test('manual expiry, remembered target and cancellation are distinct from active boost/pause', () => {
  assert.equal(p.decodeManual(Buffer.from('00dc050000', 'hex')).state, 'automatic');
  assert.equal(p.decodeManual(Buffer.alloc(5)).state, 'automatic');
  assert.equal(p.decodeManual(p.encodeManual(0, 10)).state, 'pause');
  assert.equal(p.decodeManual(p.encodeManual(1500, 10)).state, 'boost');
  assert.equal(p.decodeManual(Buffer.from('01dc050000', 'hex')).state, 'automatic');
  assert.throws(() => p.decodeManual(Buffer.alloc(4)));
  assert.throws(() => p.decodeManual(Buffer.from('0200000100', 'hex')));
});
test('command confirmation permits native countdown but rejects changed target and failed cancellation', () => {
  p.verifyManual(p.encodeManual(1500, 9), p.encodeManual(1500, 10));
  p.verifyManual(Buffer.from('00dc050000', 'hex'), Buffer.alloc(5));
  assert.throws(() => p.verifyManual(p.encodeManual(2000, 10), p.encodeManual(1500, 10)));
  assert.throws(() => p.verifyManual(p.encodeManual(1500, 11), p.encodeManual(1500, 10)));
  assert.throws(() => p.verifyManual(p.encodeManual(0, 10), Buffer.alloc(5)));
  for (const [rpm, seconds] of [[500,10],[2510,10],[1501,10],[1500,0],[1500,65536],[NaN,10]]) assert.throws(() => p.encodeManual(rpm,seconds));
});
test('captured telemetry replays: valid RPM retained, all three implausible samples rejected', () => {
  const fixture = require('./telemetry-fixture.json'); let rejected = 0;
  for (const sample of fixture) {
    const status = Buffer.from(sample.status, 'hex');
    if (sample.rpm > 2500) { assert.throws(() => p.decodeStatus(status), /RPM_OUT_OF_RANGE/); rejected++; }
    else assert.equal(p.decodeStatus(status).rpm, sample.rpm);
    p.decodeManual(Buffer.from(sample.boost, 'hex'));
  }
  assert.equal(rejected, 3);
  for (const size of [0, 7, 11, 13]) assert.throws(() => p.decodeStatus(Buffer.alloc(size)));
});
test('schedule validation rejects malformed and ambiguous windows', () => {
  assert.equal(p.configuredSchedule('22:00', '06:00').toString('hex'), '0116000600');
  assert.equal(p.configuredSchedule('', ''), null);
  for (const [a,b] of [['22:00',''],['22:00','22:00'],['2x:00','06:00'],['24:00','06:00'],['22:00','06:99']]) assert.throws(() => p.configuredSchedule(a,b));
});
test('invalid old fan entry is isolated; no name-only PIN inference or default PIN', () => {
  const fans = validateConfig({fans:[{name:'Older',pin:'123456'},{mac:'58:2B:DB:11:22:33',pin:'00123456'}]});
  assert.equal(fans.size, 1); assert.equal(fans.issues[0], 'FAN_ADDRESS_REQUIRED');
  assert.equal(fans.get('58:2b:db:11:22:33').pin, '00123456');
  assert.equal(validateConfig({fans:[{mac:'58:2b:db:11:22:33'}]}).size, 0);
  assert.equal(validateConfig({fans:[{mac:'58:2b:db:11:22:33',pin:'123456'},{mac:'58:2b:db:11:22:33',pin:'654321'}]}).size, 0);
});
test('GUI accepts both PIN lengths and enforces address/duration/rpm constraints', () => {
  const schema = require('../config.schema.json').schema;
  const valid = new Ajv({strict:false}).compile(schema);
  for (const pin of ['012345', '00123456']) assert.equal(valid({fans:[{mac:'58:2b:db:11:22:33',pin}]}), true);
  for (const config of [{fans:[{pin:'123456'}]},{fans:[{mac:'bad',pin:'123456'}]},{fans:[],boostMinutes:0},{fans:[],boostRpm:1501}]) assert.equal(valid(config),false);
});

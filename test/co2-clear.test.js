'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { hap, entry } = require('./homebridge');
const { FanAccessory } = require('../lib/accessory');
const { Transport } = require('../lib/transport');
const { FanError, UUID, decodeManual } = require('../lib/protocol');
const { validateConfig, runtimeIdentity } = require('../lib/platform');
const { fakeRadio } = require('./helpers');
const Ajv = require('ajv');
const C = hap.Characteristic, S = hap.Service;
const fan = { name: 'Kitchen Fan', mac: '58:2b:db:11:22:33', pin: '00123456' };
let homebridge;
test.before(async () => {
  const { PlatformAccessory } = await import(pathToFileURL(path.join(path.dirname(entry), 'platformAccessory.js')));
  homebridge = { hap, platformAccessory: PlatformAccessory };
});
async function drain() { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); }
function fixture(t, config = {}, device = fan) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let clock = 0;
  const r = fakeRadio(), logs = [];
  const platform = { config: { showPauseSwitch: true, ...config }, co2ClearNow: () => clock,
    log: { info: s => logs.push(s), warn: s => logs.push(s) }, save: () => {}, transport: new Transport(r.noble, 50, 0) };
  const a = new homebridge.platformAccessory('Kitchen Fan', hap.uuid.generate('co2-clear-' + fan.mac), hap.Categories.FAN);
  a.context.mac = fan.mac;
  const h = new FanAccessory(platform, homebridge, a, device);
  t.after(() => { h.close(); platform.transport.close(); });
  const tick = async ms => {
    if (r.values.manual[0]) r.values.manual.writeUInt16LE(Math.max(0, r.values.manual.readUInt16LE(3) - Math.floor(ms / 1000)), 3);
    clock += ms; t.mock.timers.tick(ms); await drain();
  };
  return { h, r, a, platform, logs, tick, now: () => clock };
}
const set = (h, on) => h.co2ClearService.getCharacteristic(C.On).handleSetRequest(on, {});
const manualWrites = r => r.writes.filter(w => w.name === 'manual');

test('third control defaults Off, retains existing service identities, and can be hidden', async t => {
  const { h, a, platform, r } = fixture(t);
  const uuid = a.UUID, boost = h.boostService, pause = h.pauseService, primary = h.fanService;
  assert.ok(h.co2ClearService); assert.equal(h.co2ClearService.subtype, 'co2-clear'); assert.equal(h.co2ClearService.getCharacteristic(C.ConfiguredName).value, 'CO₂ Clear');
  await h.poll(); assert.equal(await h.co2ClearService.getCharacteristic(C.On).handleGetRequest(), false);
  assert.equal(manualWrites(r).length, 0); h.close(); platform.config.co2ClearEnabled = false;
  const restored = new FanAccessory(platform, homebridge, a, fan); t.after(() => restored.close());
  assert.equal(restored.co2ClearService, null); assert.equal(a.UUID, uuid);
  assert.equal(restored.boostService, boost); assert.equal(restored.pauseService, pause); assert.equal(restored.fanService, primary);
  assert.equal(require('../config.schema.json').schema.properties.co2ClearEnabled.default, true);
});
test('High demand delivers capped 96% for a finite lease, independently of ordinary Boost settings', async t => {
  const { h, r, a, logs } = fixture(t, { boostMinutes: 3, boostRpm: 1000 });
  await set(h, 1);
  assert.equal(h.co2Clear.active, true); assert.equal(r.values.manual.readUInt16LE(1), 2400);
  assert.equal(r.values.manual.readUInt16LE(3), 900); assert.equal(h.intent, null);
  assert.equal(a.context.pendingManual, undefined); assert.equal(a.context.co2ClearLease, true);
  assert.equal(await h.co2ClearService.getCharacteristic(C.On).handleGetRequest(), true);
  assert.ok(logs.some(s => s.includes('CO2 Clear session 1 confirmed at 2400 RPM/900s')));
  assert.ok(logs.every(s => !s.includes(fan.pin) && !s.includes(fan.mac)));
});
test('sustained High renews past the first native timer; clear then returns to automatic', async t => {
  const { h, r, tick } = fixture(t, { co2ClearLeaseMinutes: 1, co2ClearMaxMinutes: 4 });
  await set(h, true);
  for (let i = 0; i < 4; i++) await tick(30000);
  assert.equal(h.co2Clear.active, true); assert.ok(manualWrites(r).length >= 5);
  assert.equal(r.values.manual.readUInt16LE(3), 60);
  await set(h, 0); assert.equal(h.co2Clear.active, false); assert.equal(r.values.manual.toString('hex'), '0000000000');
  const count = manualWrites(r).length; await tick(120000); assert.equal(manualWrites(r).length, count);
});
test('repeated On cannot extend the maximum session; final leases are shortened to the remaining budget', async t => {
  const { h, r, tick } = fixture(t, { co2ClearLeaseMinutes: 1, co2ClearMaxMinutes: 2 });
  await set(h, true); const end = h.co2Clear.current.end;
  await tick(30000); await set(h, true); assert.equal(h.co2Clear.current.end, end);
  await tick(30000); await set(h, true); await tick(30000);
  assert.equal(r.values.manual.readUInt16LE(3), 30);
  await tick(30000); assert.equal(h.co2Clear.active, false);
  assert.equal(decodeManual(r.values.manual).state, 'automatic');
  assert.ok(manualWrites(r).every(w => w.value.readUInt16LE(3) <= 60));
});
test('no clear event ends at the default session cap and never rearms itself', async t => {
  const { h, r, tick, logs } = fixture(t);
  await set(h, true); await tick(3600000);
  assert.equal(h.co2Clear.active, false); assert.equal(decodeManual(r.values.manual).state, 'automatic');
  assert.ok(logs.some(s => s.includes('maximum session reached')));
  const count = manualWrites(r).length; await tick(3600000); assert.equal(manualWrites(r).length, count);
});
test('the session cap also clears an owned timer whose countdown lags slightly behind the controller', async t => {
  const { h, r, tick } = fixture(t, { co2ClearLeaseMinutes: 1, co2ClearMaxMinutes: 2 });
  await set(h, true); await tick(30000); await tick(30000); await tick(30000);
  r.values.manual.writeUInt16LE(59, 3);
  await tick(30000); assert.equal(h.co2Clear.active, false);
  assert.equal(r.values.manual.toString('hex'), '0000000000');
});
test('per-fan lower limits apply to CO2 Clear', async t => {
  const { h, r } = fixture(t, {}, { ...fan, maxManualRpm: 1500 });
  await set(h, true); assert.equal(r.values.manual.readUInt16LE(1), 1500);
});
test('manual Pause supersedes CO2 Clear; a later CO2 Clear Off cannot cancel it', async t => {
  const { h, r, tick } = fixture(t, { co2ClearLeaseMinutes: 1 });
  await set(h, true); await h.manual('pause', true); assert.equal(h.co2Clear.active, false);
  const count = manualWrites(r).length; await set(h, false);
  assert.equal(manualWrites(r).length, count); assert.equal(r.values.manual.readUInt16LE(1), 0);
  await tick(30000); assert.equal(manualWrites(r).length, count);
});
for (const kind of ['boost', 'automatic']) test('manual ' + kind + ' stops renewal and protects the replacement from a delayed clear', async t => {
  const { h, r, tick } = fixture(t, { co2ClearLeaseMinutes: 1, boostRpm: 1500 });
  await set(h, true); await h.manual(kind, kind === 'boost');
  assert.equal(h.co2Clear.active, false); const value = r.values.manual.toString('hex'), count = manualWrites(r).length;
  await set(h, false); assert.equal(r.values.manual.toString('hex'), value);
  await tick(30000); assert.equal(manualWrites(r).length, count);
});
test('Off before a queued High write prevents any obsolete fan instruction', async t => {
  const { h, r } = fixture(t);
  let release; const gate = new Promise(resolve => { release = resolve; });
  const blocked = h.session(() => gate); await drain();
  const start = set(h, true).catch(() => {}); await drain(); const old = h.intent;
  await set(h, false); release(); await blocked; await start; await h.attemptIntent(old);
  assert.equal(h.co2Clear.active, false); assert.equal(manualWrites(r).length, 0); assert.equal(h.intent, null);
});
test('unreachable High retries patiently; Clear before delivery cancels all retries', async t => {
  const { h, platform, r, tick } = fixture(t);
  const run = platform.transport.run.bind(platform.transport);
  platform.transport.run = () => Promise.reject(new FanError('FAN_NOT_FOUND'));
  await assert.rejects(set(h, true)); const old = h.intent;
  assert.equal(h.co2Clear.active, true); await tick(10000); assert.equal(h.intent, old);
  await set(h, false); platform.transport.run = run; await tick(10000); await h.attemptIntent(old);
  assert.equal(manualWrites(r).length, 0); assert.equal(h.intent, null);
});
test('lost write confirmation is adopted without extending the timer, then renews after recovery', async t => {
  const { h, r, tick } = fixture(t, { co2ClearLeaseMinutes: 1 });
  const manual = r.chars.find(c => c.uuid === UUID.manual), read = manual.readAsync; let n = 0;
  manual.readAsync = async () => { if (++n === 2) throw Error('lost response'); return read(); };
  await assert.rejects(set(h, true)); assert.equal(manualWrites(r).length, 1);
  r.values.manual.writeUInt16LE(55, 3); manual.readAsync = read;
  await h.attemptIntent(h.intent); assert.equal(manualWrites(r).length, 1);
  await tick(28000); assert.equal(manualWrites(r).length, 2);
});
test('an Off received during a pending renewal survives a radio failure and clears the owned timer after recovery', async t => {
  const { h, r, platform, tick } = fixture(t, { co2ClearLeaseMinutes: 1 });
  await set(h, true); const run = platform.transport.run.bind(platform.transport);
  platform.transport.run = () => Promise.reject(new FanError('BLE_UNAVAILABLE'));
  await tick(30000); const old = h.intent; assert.equal(old.on, true);
  await assert.rejects(set(h, false)); assert.equal(h.intent.on, false);
  assert.equal(h.co2Clear.active, false); platform.transport.run = run;
  await tick(10000); await h.attemptIntent(old);
  assert.equal(r.values.manual.toString('hex'), '0000000000');
  assert.equal(manualWrites(r).length, 2);
});
test('release retries expire so a much later unrelated Boost is never cancelled', async t => {
  const { h, r, platform, tick } = fixture(t, { co2ClearLeaseMinutes: 1 });
  await set(h, true); const run = platform.transport.run.bind(platform.transport);
  platform.transport.run = () => Promise.reject(new FanError('BLE_UNAVAILABLE'));
  await assert.rejects(set(h, false)); const old = h.intent;
  await tick(61000); assert.equal(h.intent, null); platform.transport.run = run;
  r.values.manual = Buffer.from('0160093c00', 'hex');
  const count = manualWrites(r).length; await h.attemptIntent(old); await tick(10000);
  assert.equal(manualWrites(r).length, count);
});
test('a restart never restores High or pending renewal, even with the prior native timer still running', async t => {
  const { h, r, a, platform, tick, logs } = fixture(t, { co2ClearLeaseMinutes: 1 });
  await set(h, true); assert.equal(a.context.pendingManual, undefined); h.close();
  const restored = new FanAccessory(platform, homebridge, a, fan); t.after(() => restored.close());
  assert.equal(restored.co2Clear.active, false); assert.equal(restored.intent, null);
  const count = manualWrites(r).length; await tick(31000); await restored.poll();
  assert.equal(manualWrites(r).length, count); assert.equal(a.context.co2ClearLease, undefined);
  assert.ok(logs.some(s => s.includes('restart detected; renewal remains Off')));
});
test('authentication rejection stops demand and unattended renewal', async t => {
  const { h, r, tick } = fixture(t); r.values.confirmation = Buffer.from([0]);
  await assert.rejects(set(h, true)); assert.equal(h.co2Clear.active, false); assert.equal(h.intent, null);
  const count = r.writes.length; await tick(3600000); assert.equal(r.writes.length, count);
});
test('a rejected target readback stops CO2 Clear without endlessly resending a bad command', async t => {
  const { h, r, tick } = fixture(t);
  r.chars.find(c => c.uuid === UUID.manual).writeAsync = async () => {};
  await assert.rejects(set(h, true)); assert.equal(h.co2Clear.active, false);
  const count = r.writes.length; await tick(3600000); assert.equal(r.writes.length, count);
});
test('recognisable native app Pause ends demand; a later clear does not overwrite it', async t => {
  const { h, r, tick } = fixture(t); await set(h, true);
  r.values.manual = Buffer.from('0100005802', 'hex'); await h.poll();
  assert.equal(h.co2Clear.active, false); const count = manualWrites(r).length;
  await set(h, false); await tick(30000); assert.equal(manualWrites(r).length, count);
});
test('queued work past the maximum deadline cannot deliver a new High instruction', async t => {
  const { h, r, tick } = fixture(t, { co2ClearMaxMinutes: 1 });
  let release; const gate = new Promise(resolve => { release = resolve; });
  const blocked = h.session(() => gate); await drain();
  const start = set(h, true).catch(() => {}); await drain();
  await tick(61000); release(); await blocked; await start;
  assert.equal(h.co2Clear.active, false); assert.equal(manualWrites(r).length, 0);
});
test('the shutdown boundary leaves a finite native lease and never issues another renewal', async t => {
  const { h, r, tick } = fixture(t, { co2ClearLeaseMinutes: 1 }); await set(h, true);
  h.close(); const count = manualWrites(r).length; await tick(61000);
  assert.equal(manualWrites(r).length, count); assert.equal(r.values.manual.readUInt16LE(3), 0);
});
test('Clear while a High write is already dispatched is reconciled before the queue settles', async t => {
  const { h, r, tick } = fixture(t, { co2ClearLeaseMinutes: 1 });
  const manual = r.chars.find(c => c.uuid === UUID.manual), write = manual.writeAsync;
  let release; const gate = new Promise(resolve => { release = resolve; });
  manual.writeAsync = async (value, ...args) => { if (value[0]) await gate; return write(value, ...args); };
  const start = set(h, true).catch(() => {}); await drain();
  assert.equal(h.co2Clear.current.mayOwn, true);
  const stop = set(h, false); release(); await start; await stop;
  assert.equal(h.co2Clear.active, false); assert.equal(r.values.manual.toString('hex'), '0000000000');
  const count = manualWrites(r).length; await tick(30000); assert.equal(manualWrites(r).length, count);
  assert.equal(h.co2ClearService.getCharacteristic(C.On).value, false);
});
test('a fresh High replaces an unreachable old Clear; the obsolete Clear cannot cancel the new session', async t => {
  const { h, r, platform, tick } = fixture(t, { co2ClearLeaseMinutes: 1 });
  await set(h, true); const run = platform.transport.run.bind(platform.transport);
  platform.transport.run = () => Promise.reject(new FanError('BLE_UNAVAILABLE'));
  await assert.rejects(set(h, false)); const old = h.intent;
  platform.transport.run = run; await set(h, true); await h.attemptIntent(old);
  assert.equal(h.co2Clear.active, true); assert.equal(decodeManual(r.values.manual).state, 'boost');
  await tick(30000); assert.equal(h.co2Clear.active, true);
});
test('Clear does not cancel a recognisably different out-of-band Boost, even before the next poll', async t => {
  const { h, r } = fixture(t); await set(h, true);
  r.values.manual = Buffer.from('01dc055802', 'hex'); // Different 1500 RPM native override.
  const count = manualWrites(r).length; await set(h, false);
  assert.equal(manualWrites(r).length, count); assert.equal(r.values.manual.readUInt16LE(1), 1500);
});
test('CO2 Clear configuration validates consistently in GUI and runtime', () => {
  const valid = new Ajv({ strict: false }).compile(require('../config.schema.json').schema);
  for (const config of [{ co2ClearEnabled: false }, { co2ClearLeaseMinutes: 1, co2ClearMaxMinutes: 1 },
    { co2ClearLeaseMinutes: 15, co2ClearMaxMinutes: 240, co2ClearRpm: 2400 }]) {
    assert.equal(valid({ fans: [fan], ...config }), true); assert.equal(validateConfig({ fans: [fan], ...config }).size, 1);
  }
  for (const config of [{ co2ClearEnabled: 'true' }, { co2ClearLeaseMinutes: 0 }, { co2ClearLeaseMinutes: 16 },
    { co2ClearMaxMinutes: 0 }, { co2ClearMaxMinutes: 241 }, { co2ClearMaxMinutes: 1.5 }, { co2ClearRpm: 2450 },
    { co2ClearRpm: 975 }, { co2ClearRpm: 1501 }]) {
    assert.equal(valid({ fans: [fan], ...config }), false); assert.throws(() => validateConfig({ fans: [fan], ...config }));
  }
});
test('startup evidence identifies the exact runtime without user configuration or credentials', () => {
  const identity = runtimeIdentity(); assert.match(identity, /version=2\.6\.0-beta\.1/);
  for (const file of ['accessory.js', 'transport.js', 'co2-clear.js']) assert.ok(identity.includes(file + '='));
  assert.ok(!identity.includes(fan.mac) && !identity.includes(fan.pin));
});

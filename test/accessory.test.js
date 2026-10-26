'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const {hap,entry} = require('./homebridge');
const { FanAccessory } = require('../lib/accessory');
const { createPlatform } = require('../lib/platform');
const { Transport } = require('../lib/transport');
const { fakeRadio } = require('./helpers');
let homebridge;
const mac='58:2b:db:11:22:33';
const fan={name:'Kitchen Fan',mac,pin:'00123456'};
test.before(async()=>{
  const {PlatformAccessory}=await import(pathToFileURL(path.join(path.dirname(entry),'platformAccessory.js')));
  homebridge={hap,platformAccessory:PlatformAccessory};
});
function fixture(t,config={}) {
  const r=fakeRadio(),logs=[],platform={config:{showPauseSwitch:true,...config},log:{info:v=>logs.push(v),warn:v=>logs.push(v)},transport:new Transport(r.noble,50,0),save:()=>{}};
  const a=new homebridge.platformAccessory('Kitchen Fan',hap.uuid.generate('pax-calima-'+mac),hap.Categories.FAN);a.context.mac=mac;
  const h=new FanAccessory(platform,homebridge,a,fan);
  t.after(()=>{h.close();platform.transport.close();});
  return {r,platform,a,h,logs};
}
async function get(service,type) { return service.getCharacteristic(type).handleGetRequest(); }
async function set(service,type,value) { return service.getCharacteristic(type).handleSetRequest(value); }
const C=hap.Characteristic,S=hap.Service;

test('default controls are Fan and Boost Fan; an explicitly enabled Pause Fan retains its service identity',async t=>{
  const {h,a,platform}=fixture(t,{showPauseSwitch:undefined});
  assert.equal(h.pauseService,null);assert.ok(h.fanService);assert.ok(h.boostService);
  assert.equal(require('../config.schema.json').schema.properties.showPauseSwitch.default,false);
  const uuid=a.UUID,primary=h.fanService,boost=h.boostService;h.close();
  platform.config.showPauseSwitch=true;
  const shown=new FanAccessory(platform,homebridge,a,fan);t.after(()=>shown.close());
  const pause=shown.pauseService;assert.ok(pause);shown.close();
  boost.setCharacteristic(C.ConfiguredName,'Boost');pause.setCharacteristic(C.ConfiguredName,'Pause');
  const restored=new FanAccessory(platform,homebridge,a,fan);t.after(()=>restored.close());
  assert.equal(a.UUID,uuid);assert.equal(restored.fanService,primary);
  assert.equal(restored.boostService,boost);assert.equal(restored.pauseService,pause);
  assert.equal(boost.getCharacteristic(C.ConfiguredName).value,'Boost Fan');
  assert.equal(pause.getCharacteristic(C.ConfiguredName).value,'Pause Fan');
  assert.equal(a.services.filter(s=>s.UUID===S.Switch.UUID).length,2);
});
test('main Fan off starts a timed Pause without a Pause tile; Fan on clears either override without changing presets',async t=>{
  const {r,h}=fixture(t,{showPauseSwitch:undefined,pauseMinutes:3});await h.poll();
  await set(h.fanService,C.Active,0);
  assert.equal(r.values.manual.toString('hex'),'010000b400');
  assert.equal(await get(h.fanService,C.Active),0);assert.equal(h.pauseService,null);
  await set(h.fanService,C.Active,1);assert.equal(r.values.manual.toString('hex'),'0000000000');
  await set(h.boostService,C.On,true);assert.equal(await get(h.boostService,C.On),true);
  await set(h.fanService,C.Active,1);assert.equal(r.values.manual.toString('hex'),'0000000000');
  assert.equal(await get(h.boostService,C.On),false);
  const writes=r.writes.filter(w=>w.name==='manual').length;
  await set(h.fanService,C.Active,1);assert.equal(r.writes.filter(w=>w.name==='manual').length,writes);
  assert.ok(r.writes.every(w=>['auth','manual'].includes(w.name)));
});
test('Fan on replaces an unreachable Boost request and survives restart until automatic readback is confirmed',async t=>{
  const {r,h,a,platform}=fixture(t);await h.poll();
  const run=platform.transport.run.bind(platform.transport);
  platform.transport.run=async()=>{throw Error('temporarily unreachable');};
  await assert.rejects(set(h.boostService,C.On,true));const old=h.intent;
  await assert.rejects(set(h.fanService,C.Active,1));
  assert.equal(a.context.pendingManual.kind,'automatic');assert.equal(a.context.pendingManual.on,false);
  h.close();r.values.manual=Buffer.from('01d0075802','hex');platform.transport.run=run;
  const restored=new FanAccessory(platform,homebridge,a,fan);t.after(()=>restored.close());
  assert.equal(restored.intent.kind,'automatic');await restored.attemptIntent(restored.intent);
  await restored.attemptIntent(old);
  assert.equal(r.values.manual.toString('hex'),'0000000000');assert.equal(a.context.pendingManual,undefined);
  assert.equal(await get(restored.boostService,C.On),false);
  assert.deepEqual(r.writes.filter(w=>w.name==='manual').map(w=>w.value.toString('hex')),['0000000000']);
});
test('failed Fan on cannot report automatic success after an ignored cancellation write',async t=>{
  const {r,h}=fixture(t);await h.poll();await set(h.boostService,C.On,true);
  r.chars.find(c=>c.uuid===require('../lib/protocol').UUID.manual).writeAsync=async()=>{};
  await assert.rejects(set(h.fanService,C.Active,1));
  assert.equal(h.intent,null);assert.equal(h.fault,true);assert.equal(r.values.manual[0],1);
  await assert.rejects(get(h.fanService,C.Active));
});
test('native Home services expose working boost/pause with mutually exclusive readback',async t=>{
  const {r,h}=fixture(t);await h.poll();
  assert.equal(h.boostService.getCharacteristic(C.ConfiguredName).value,'Boost Fan');
  assert.equal(h.pauseService.getCharacteristic(C.ConfiguredName).value,'Pause Fan');
  assert.equal(await get(h.boostService,C.On),false);assert.equal(await get(h.pauseService,C.On),false);
  await set(h.boostService,C.On,true);
  assert.equal(await get(h.boostService,C.On),true);assert.equal(await get(h.pauseService,C.On),false);
  assert.equal(r.values.manual.readUInt16LE(1),2000);assert.equal(r.values.manual.readUInt16LE(3),600);
  await set(h.pauseService,C.On,true);
  assert.equal(r.values.manual.toString('hex'),'0100005802');assert.equal(await get(h.boostService,C.On),false);
  assert.equal(await get(h.pauseService,C.On),true);assert.equal(await get(h.fanService,C.Active),0);
  // A delayed Boost-off after Pause-on must not cancel Pause.
  const count=r.writes.length;await set(h.boostService,C.On,false);
  assert.equal(r.writes.length,count+1); // authentication only
  assert.equal(await get(h.pauseService,C.On),true);
  await set(h.pauseService,C.On,false);assert.equal(r.values.manual.toString('hex'),'0000000000');
  assert.equal(await get(h.pauseService,C.On),false);
  assert.ok(r.writes.every(w=>['auth','manual'].includes(w.name)));
});
test('restart reads a live manual pause; native expiry clears switches without writes',async t=>{
  const {r,h}=fixture(t);r.values.manual=Buffer.from('0100000d00','hex');r.values.status.writeUInt16LE(0,6);
  await h.poll();assert.equal(await get(h.pauseService,C.On),true);
  r.values.manual=Buffer.from('00dc050000','hex');r.values.status.writeUInt16LE(1000,6);
  const count=r.writes.length;await h.poll();
  assert.equal(await get(h.pauseService,C.On),false);assert.equal(await get(h.boostService,C.On),false);
  assert.equal(await get(h.fanService,C.Active),1);assert.equal(r.writes.length,count+1);
});
test('speed slider writes temporary manual control and reports measured speed',async t=>{
  const {r,h}=fixture(t,{boostMinutes:5});await h.poll();
  await set(h.fanService,C.RotationSpeed,60);assert.equal(r.values.manual.readUInt16LE(1),1500);
  assert.equal(r.values.manual.readUInt16LE(3),300);
  await h.poll();assert.equal(await get(h.fanService,C.RotationSpeed),41);
  await h.speed(1);assert.equal(r.values.manual.readUInt16LE(1),1000);
  await h.speed(0);assert.equal(await get(h.pauseService,C.On),true);
  await set(h.fanService,C.Active,1);assert.equal(await get(h.pauseService,C.On),false);
  assert.ok(r.writes.every(w=>['auth','manual'].includes(w.name)));
  for(const v of [-1,101,NaN,Infinity,'60']) assert.throws(()=>h.speed(v));
});
test('auth rejection and rejected readback return HomeKit failures; no fake successful command',async t=>{
  const {r,h,logs}=fixture(t);r.values.confirmation=Buffer.from([0]);
  await assert.rejects(set(h.boostService,C.On,true));
  assert.equal(r.writes.filter(w=>w.name==='manual').length,0);await assert.rejects(get(h.boostService,C.On));
  r.values.confirmation=Buffer.from([1]);
  r.chars.find(c=>c.uuid===require('../lib/protocol').UUID.manual).writeAsync=async()=>{};
  await assert.rejects(set(h.boostService,C.On,true));await assert.rejects(get(h.boostService,C.On));
  assert.ok(logs.some(v=>v.includes('COMMAND_NOT_CONFIRMED')));
  assert.equal(h.intent,null);assert.equal(h.intentTimer,null);
  assert.ok(logs.every(v=>!v.includes(fan.pin)));
});
test('invalid RPM and stale telemetry are communication faults, not plausible speed percentages',async t=>{
  const {r,h}=fixture(t);await h.poll();
  r.values.status.writeUInt16LE(50237,6);await h.poll();await assert.rejects(get(h.fanService,C.RotationSpeed));
  r.values.status.writeUInt16LE(1000,6);await h.poll();assert.equal(await get(h.fanService,C.RotationSpeed),40);
  h.last.at-=45001;await assert.rejects(get(h.fanService,C.Active));
});
test('a transient background failure retains only fresh verified state; commands and stale state fault',async t=>{
  const {h,platform}=fixture(t);await h.poll();const run=platform.transport.run.bind(platform.transport);
  platform.transport.run=async()=>{throw Error('radio dropped');};
  await h.poll();assert.equal(await get(h.fanService,C.RotationSpeed),41);
  await assert.rejects(set(h.boostService,C.On,true));await assert.rejects(get(h.fanService,C.RotationSpeed));
  platform.transport.run=run;await h.poll();h.last.at-=45001;
  platform.transport.run=async()=>{throw Error('radio dropped');};
  await h.poll();await assert.rejects(get(h.fanService,C.RotationSpeed));
});
test('fresh mode gate refuses commands without writing mode or manual state',async t=>{
  const {r,h}=fixture(t);r.values.mode=Buffer.from([4]);
  await assert.rejects(set(h.pauseService,C.On,true));
  assert.equal(r.writes.filter(w=>w.name!=='auth').length,0);
});
test('changed native schedule is applied once; app edits survive polling and restart',async t=>{
  const config={silentHoursStart:'23:00',silentHoursEnd:'07:00',showSilentSwitch:true};
  const {r,h,a,platform}=fixture(t,config);let saves=0;platform.save=()=>{saves++;};
  await h.poll();assert.equal(r.values.silent.toString('hex'),'0117000700');assert.equal(saves,1);
  r.values.silent=Buffer.from('0016000600','hex');await h.poll();assert.equal(r.values.silent.toString('hex'),'0016000600');
  assert.equal(await get(h.silentService,C.On),false);
  await set(h.silentService,C.On,true);assert.equal(r.values.silent.toString('hex'),'0116000600');
  h.close();const restarted=new FanAccessory(platform,homebridge,a,fan);t.after(()=>restarted.close());
  await restarted.poll();assert.equal(r.values.silent.toString('hex'),'0116000600');
  assert.equal(r.writes.filter(w=>w.name==='silent').length,2);
});
test('legacy services migrate with stable fan UUID/subtype and no duplicates',async t=>{
  const {h,a,platform}=fixture(t);h.close();
  const uuid=a.UUID, original=a.getService(S.Fanv2);
  a.addService(new S.StatelessProgrammableSwitch('Kitchen Boost','boost'));
  a.addService(new S.TemperatureSensor('Kitchen Temperature','temperature'));
  a.addService(new S.HumiditySensor('Kitchen Humidity','humidity'));
  a.addService(new S.LightSensor('Kitchen Light','light'));
  const next=new FanAccessory(platform,homebridge,a,fan);t.after(()=>next.close());
  assert.equal(a.UUID,uuid);assert.equal(next.fanService,original);
  for(const type of [S.StatelessProgrammableSwitch,S.TemperatureSensor,S.HumiditySensor,S.LightSensor])assert.equal(a.getService(type),undefined);
  assert.equal(a.services.filter(s=>s.UUID===S.Switch.UUID).length,2);
  assert.equal(a.getServiceById(S.Switch,'boost'),next.boostService);
});
test('unconfigured platform has no Bluetooth work; cached fan remains faulted',async t=>{
  let radioUsed=false;const r=fakeRadio();r.noble.startScanning=()=>{radioUsed=true;};
  const api=new EventEmitter();api.registerPlatformAccessories=()=>{throw Error('unexpected registration');};
  const P=createPlatform(homebridge,{noble:r.noble});const p=new P({warn:()=>{}},{},api);t.after(()=>p.shutdown());
  const a=new homebridge.platformAccessory('Existing Fan',hap.uuid.generate('cached'),hap.Categories.FAN);a.context.mac=mac;
  p.configureAccessory(a);api.emit('didFinishLaunching');assert.equal(radioUsed,false);assert.equal(p.transport,null);
  assert.equal(p.handlers.length,1);await assert.rejects(get(p.handlers[0].fanService,C.Active));
});
test('launch handles only configured addresses and keeps cached identities',async t=>{
  const r=fakeRadio(),api=new EventEmitter(),registered=[],logs=[];
  api.registerPlatformAccessories=(plugin,alias,list)=>registered.push(...list);api.updatePlatformAccessories=()=>{};
  const P=createPlatform(homebridge,{noble:r.noble});const p=new P({warn:v=>logs.push(v),info:()=>{},error:()=>{}},{fans:[{name:'Old',pin:'123456'},fan]},api);t.after(()=>p.shutdown());
  const a=new homebridge.platformAccessory('Kitchen Fan',hap.uuid.generate('pax-calima-'+mac),hap.Categories.FAN);a.context.mac=mac;
  p.configureAccessory(a);api.emit('didFinishLaunching');api.emit('didFinishLaunching');
  assert.equal(p.handlers.length,1);assert.equal(registered.length,0);assert.equal(p.handlers[0].accessory,a);
  assert.ok(logs.some(v=>v.includes('FAN_ADDRESS_REQUIRED')));
  r.noble.emit('error',Error('secret backend info'));assert.equal(p.handlers[0].fault,true);
  api.emit('shutdown');assert.equal(r.noble.listenerCount('stateChange'),0);assert.equal(r.noble.listenerCount('error'),0);
});
test('a newer pause supersedes a queued boost before its write',async t=>{
  const {r,h}=fixture(t);const results=await Promise.allSettled([h.poll(),h.manual('boost',true),h.manual('pause',true)]);
  assert.equal(results[1].reason.code,'COMMAND_SUPERSEDED');assert.equal(results[2].status,'fulfilled');
  assert.deepEqual(r.writes.filter(w=>w.name==='manual').map(w=>w.value.readUInt16LE(1)),[0]);
  assert.equal(await get(h.pauseService,C.On),true);assert.equal(await get(h.boostService,C.On),false);
});
test('failed boost stays pending until verified retry; Home never reports optimistic success',async t=>{
  const {r,h,platform,a}=fixture(t);await h.poll();const run=platform.transport.run.bind(platform.transport);
  platform.transport.run=async()=>{throw Error('temporarily unreachable');};
  await assert.rejects(set(h.boostService,C.On,true));
  assert.equal(h.intent.kind,'boost');assert.equal(a.context.pendingManual.kind,'boost');assert.ok(h.intentTimer);
  assert.equal(r.writes.filter(w=>w.name==='manual').length,0);await assert.rejects(get(h.boostService,C.On));
  platform.transport.run=run;await h.attemptIntent(h.intent);
  assert.equal(await get(h.boostService,C.On),true);assert.equal(h.intent,null);assert.equal(a.context.pendingManual,undefined);
});
test('cancel replaces an unreachable pending boost; the older retry cannot turn it on later',async t=>{
  const {r,h,platform}=fixture(t);const run=platform.transport.run.bind(platform.transport);
  platform.transport.run=async()=>{throw Error('temporarily unreachable');};
  await assert.rejects(h.manual('boost',true));const old=h.intent;
  platform.transport.run=run;await h.manual('boost',false);await h.attemptIntent(old);
  assert.equal(h.intent,null);assert.equal(await get(h.boostService,C.On),false);
  assert.equal(r.writes.filter(w=>w.name==='manual').length,0);
});
test('lost write confirmation is recovered by readback without extending the native timer',async t=>{
  const {r,h}=fixture(t);const char=r.chars.find(c=>c.uuid===require('../lib/protocol').UUID.manual);
  const read=char.readAsync;let n=0;char.readAsync=async()=>{if(++n===2)throw Error('reply lost');return read();};
  await assert.rejects(h.manual('boost',true));assert.equal(h.intent.attempted,true);
  r.values.manual.writeUInt16LE(581,3);char.readAsync=read;
  await h.attemptIntent(h.intent);assert.equal(await get(h.boostService,C.On),true);
  assert.equal(r.writes.filter(w=>w.name==='manual').length,1);assert.equal(r.values.manual.readUInt16LE(3),581);
});
test('a pending request survives child restart; rejected authentication stops it',async t=>{
  const {r,h,a,platform}=fixture(t);const run=platform.transport.run.bind(platform.transport);
  platform.transport.run=async()=>{throw Error('temporarily unreachable');};
  await assert.rejects(h.manual('pause',true));h.close();platform.transport.run=run;
  const restored=new FanAccessory(platform,homebridge,a,fan);t.after(()=>restored.close());
  assert.equal(restored.intent.kind,'pause');await restored.attemptIntent(restored.intent);
  assert.equal(await get(restored.pauseService,C.On),true);assert.equal(a.context.pendingManual,undefined);
  r.values.confirmation=Buffer.from([0]);await assert.rejects(restored.manual('boost',true));
  assert.equal(restored.intent,null);assert.equal(restored.intentTimer,null);assert.equal(restored.authRejected,true);
});
test('HAP requested speed cache is replaced with measured speed after a successful set',async t=>{
  const {h}=fixture(t);await h.poll();await set(h.fanService,C.RotationSpeed,60);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.fanService.getCharacteristic(C.RotationSpeed).value,41);
});
test('a per-fan validated ceiling caps Boost and slider targets without capping measured telemetry or other fans',async t=>{
  const limited=fixture(t,{boostRpm:2450});limited.h.fan={...fan,maxManualRpm:2400};
  await limited.h.manual('boost',true);assert.equal(limited.r.values.manual.readUInt16LE(1),2400);
  await limited.h.speed(100);assert.equal(limited.r.values.manual.readUInt16LE(1),2400);
  limited.r.values.status.writeUInt16LE(2475,6);await limited.h.poll();
  assert.equal(await get(limited.h.fanService,C.RotationSpeed),99);
  const unrestricted=fixture(t,{boostRpm:2450});unrestricted.h.fan={...fan,maxManualRpm:2500};await unrestricted.h.manual('boost',true);
  assert.equal(unrestricted.r.values.manual.readUInt16LE(1),2450);
});
test('default ceiling fixes the same CO2 automation HAP action that fails with an explicitly unsafe higher limit',async t=>{
  const {r,h,a,platform,logs}=fixture(t,{boostRpm:2450});
  h.fan={...fan,maxManualRpm:2500}; // reproduce the previous unrestricted target
  const manual=r.chars.find(c=>c.uuid===require('../lib/protocol').UUID.manual);
  const write=manual.writeAsync;
  manual.writeAsync=async(value,...args)=>{
    await write(value,...args);
    // Exact valid-but-different readback observed on Kitchen, 26 October.
    if(value[0]===1 && value.readUInt16LE(1)>2400) r.values.manual.writeUInt16LE(0,1);
  };
  const connection={}; // Exercise HAP client validation, including numeric bool.
  await assert.rejects(h.boostService.getCharacteristic(C.On).handleSetRequest(1,connection));
  assert.equal(r.values.manual.toString('hex'),'0100005802');
  assert.equal(h.intent,null);assert.equal(a.context.pendingManual,undefined);
  assert.ok(logs.some(line=>line.includes('requested boost 2450 RPM/600s, received pause 0 RPM/600s')));
  await h.poll();assert.equal(await get(h.pauseService,C.On),true);
  // Same accessory/service and automation action; no per-fan limit required.
  h.close();const service=h.boostService,uuid=a.UUID;
  const limited=new FanAccessory(platform,homebridge,a,fan);
  t.after(()=>limited.close());
  await limited.boostService.getCharacteristic(C.On).handleSetRequest(1,connection);
  assert.equal(a.UUID,uuid);assert.equal(limited.boostService,service);
  assert.equal(r.values.manual.toString('hex'),'0160095802');
  assert.equal(await get(limited.boostService,C.On),true);
  assert.equal(await get(limited.pauseService,C.On),false);
  await limited.boostService.getCharacteristic(C.On).handleSetRequest(0,connection);
  assert.equal(r.values.manual.toString('hex'),'0000000000');
  assert.ok(r.writes.every(w=>['auth','manual'].includes(w.name)));
});
test('default temporary target ceiling protects Boost and slider, preserves measured RPM and explicit per-fan overrides',async t=>{
  const {r,h}=fixture(t,{boostRpm:2500});
  await set(h.boostService,C.On,true);assert.equal(r.values.manual.readUInt16LE(1),2400);
  await set(h.fanService,C.RotationSpeed,100);assert.equal(r.values.manual.readUInt16LE(1),2400);
  r.values.status.writeUInt16LE(2475,6);await h.poll();
  assert.equal(await get(h.fanService,C.RotationSpeed),99);
  h.fan={...fan,maxManualRpm:1500};await set(h.boostService,C.On,true);
  assert.equal(r.values.manual.readUInt16LE(1),1500);
  h.fan={...fan,maxManualRpm:2500};await set(h.fanService,C.RotationSpeed,100);
  assert.equal(r.values.manual.readUInt16LE(1),2500);
  assert.equal(require('../config.schema.json').schema.properties.fans.items.properties.maxManualRpm.placeholder,'2400');
});
test('background retry timer fulfils a pending request without another Home command',async t=>{
  const {h,platform}=fixture(t);t.mock.timers.enable({apis:['setTimeout']});
  const run=platform.transport.run.bind(platform.transport);let calls=0;
  platform.transport.run=(...args)=>++calls===1?Promise.reject(new (require('../lib/protocol').FanError)('BLE_UNAVAILABLE')):run(...args);
  await assert.rejects(set(h.boostService,C.On,true));
  t.mock.timers.tick(10000);
  for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await get(h.boostService,C.On),true);assert.equal(h.intent,null);assert.equal(calls,2);
});
test('failed schedule verification does not persist an applied marker',async t=>{
  const {r,h,a}=fixture(t,{silentHoursStart:'23:00',silentHoursEnd:'07:00'});
  r.chars.find(c=>c.uuid===require('../lib/protocol').UUID.silent).writeAsync=async()=>{};
  await h.poll();assert.equal(a.context.appliedSchedule,undefined);await assert.rejects(get(h.fanService,C.Active));
});
test('hiding optional controls preserves the active device action',async t=>{
  const {r,h,a,platform}=fixture(t);r.values.manual=Buffer.from('0100000d00','hex');await h.poll();h.close();
  const count=r.writes.length;platform.config={showBoostSwitch:false,showPauseSwitch:false};
  const hidden=new FanAccessory(platform,homebridge,a,fan);t.after(()=>hidden.close());await hidden.poll();
  assert.equal(a.getServiceById(S.Switch,'boost'),undefined);assert.equal(a.getServiceById(S.Switch,'pause'),undefined);
  assert.equal(hidden.last.manual.state,'pause');assert.equal(r.writes.length,count+1);
});
test('a rejected PIN stops unattended retries; an explicit successful command restores polling',async t=>{
  const {r,h}=fixture(t);r.values.confirmation=Buffer.from([0]);await h.poll();
  const count=r.writes.length;await h.poll();assert.equal(r.writes.length,count);assert.equal(h.authRejected,true);
  r.values.confirmation=Buffer.from([1]);await set(h.boostService,C.On,true);
  assert.equal(h.authRejected,false);assert.ok(h.pollTimer);assert.equal(await get(h.boostService,C.On),true);
});

test('Pause automation accepts numeric HAP On; reports motor coast-down and native expiry without inventing speed',async t=>{
  const {r,h}=fixture(t,{pauseMinutes:2});const connection={};
  await h.pauseService.getCharacteristic(C.On).handleSetRequest(1,connection);
  assert.equal(r.values.manual.toString('hex'),'0100007800');
  assert.equal(await get(h.pauseService,C.On),true);
  assert.equal(await get(h.boostService,C.On),false);
  assert.equal(await get(h.fanService,C.Active),0);
  assert.equal(await get(h.fanService,C.RotationSpeed),41); // still coasting
  r.values.status.writeUInt16LE(0,6);await h.poll();
  assert.equal(await get(h.fanService,C.RotationSpeed),0);
  assert.equal(await get(h.fanService,C.CurrentFanState),1);
  r.values.manual=Buffer.alloc(5);r.values.status.writeUInt16LE(1000,6);
  const writes=r.writes.filter(w=>w.name==='manual').length;await h.poll();
  assert.equal(await get(h.pauseService,C.On),false);
  assert.equal(await get(h.fanService,C.Active),1);
  assert.equal(r.writes.filter(w=>w.name==='manual').length,writes);
});
for(const on of [true,false]) test('Pause '+(on?'On':'Off')+' patiently retries repeated radio failures without more Home commands',async t=>{
  const {r,h,platform,a,logs}=fixture(t);if(!on)r.values.manual=Buffer.from('0100005802','hex');
  t.mock.timers.enable({apis:['setTimeout']});
  const run=platform.transport.run.bind(platform.transport);let attempts=0,offline=true;
  platform.transport.run=(...args)=>{
    attempts++;
    return offline?Promise.reject(new (require('../lib/protocol').FanError)('BLE_UNAVAILABLE')):run(...args);
  };
  await assert.rejects(set(h.pauseService,C.On,on));
  for(let i=0;i<4;i++){
    const before=attempts;t.mock.timers.tick(9999);assert.equal(attempts,before);
    t.mock.timers.tick(1);for(let n=0;n<3;n++)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(attempts,before+1);assert.equal(h.intent.kind,'pause');
    assert.equal(a.context.pendingManual.on,on);assert.equal(h.fault,true);
    assert.equal(r.writes.filter(w=>w.name==='manual').length,0);
  }
  assert.equal(logs.filter(s=>s.includes('request pending')).length,1);
  assert.equal(logs.filter(s=>s.includes('unavailable:')).length,1);
  offline=false;t.mock.timers.tick(10000);
  for(let n=0;n<3;n++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await get(h.pauseService,C.On),on);
  assert.equal(h.intent,null);assert.equal(a.context.pendingManual,undefined);
  assert.equal(r.writes.filter(w=>w.name==='manual').length,1);
  assert.equal(r.values.manual.toString('hex'),on?'0100005802':'0000000000');
});
test('lost Pause write confirmation adopts remaining timer; lost cancellation confirmation cannot restart Pause',async t=>{
  const {r,h}=fixture(t);const manual=r.chars.find(c=>c.uuid===require('../lib/protocol').UUID.manual);
  const read=manual.readAsync;let n=0;
  manual.readAsync=async()=>{if(++n===2)throw Error('response lost');return read();};
  await assert.rejects(set(h.pauseService,C.On,true));assert.equal(h.intent.attempted,true);
  r.values.manual.writeUInt16LE(579,3);manual.readAsync=read;
  await h.attemptIntent(h.intent);
  assert.equal(r.values.manual.readUInt16LE(3),579);
  assert.equal(r.writes.filter(w=>w.name==='manual').length,1);
  n=0;manual.readAsync=async()=>{if(++n===2)throw Error('cancel response lost');return read();};
  await assert.rejects(set(h.pauseService,C.On,false));manual.readAsync=read;
  await h.attemptIntent(h.intent);
  assert.equal(r.values.manual.toString('hex'),'0000000000');
  assert.equal(r.writes.filter(w=>w.name==='manual').length,2);
  assert.equal(h.intent,null);
});
test('Fan On cancels an unreachable Pause request; no stale retry can stop ventilation later',async t=>{
  const {r,h,platform,a}=fixture(t);const run=platform.transport.run.bind(platform.transport);
  platform.transport.run=async()=>{throw new (require('../lib/protocol').FanError)('FAN_NOT_FOUND');};
  await assert.rejects(set(h.pauseService,C.On,true));const old=h.intent;
  await assert.rejects(set(h.fanService,C.Active,1));assert.equal(a.context.pendingManual.kind,'automatic');
  platform.transport.run=run;await h.attemptIntent(h.intent);await h.attemptIntent(old);
  assert.equal(h.intent,null);assert.equal(await get(h.pauseService,C.On),false);
  assert.equal(r.writes.filter(w=>w.name==='manual').length,0);
});
test('pending Pause cancellation survives restart and releases native Pause after reconnection',async t=>{
  const {r,h,platform,a}=fixture(t);r.values.manual=Buffer.from('0100005802','hex');
  const run=platform.transport.run.bind(platform.transport);
  platform.transport.run=async()=>{throw new (require('../lib/protocol').FanError)('BLE_TIMEOUT');};
  await assert.rejects(set(h.pauseService,C.On,false));assert.equal(a.context.pendingManual.on,false);h.close();
  platform.transport.run=run;const restored=new FanAccessory(platform,homebridge,a,fan);t.after(()=>restored.close());
  assert.equal(restored.intent.kind,'pause');assert.equal(restored.intent.on,false);
  await restored.attemptIntent(restored.intent);
  assert.equal(r.values.manual.toString('hex'),'0000000000');assert.equal(a.context.pendingManual,undefined);
});

'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { Transport } = require('../lib/transport');
const { fakeRadio } = require('./helpers');
const mac='58:2b:db:11:22:33', pin='00123456';
test('queue serialises sessions, acknowledges auth writes and disconnects every time', async () => {
  const radio=fakeRadio(), t=new Transport(radio.noble,50), order=[];
  await Promise.all([t.run(mac,pin,async()=>{order.push('a');await new Promise(r=>setTimeout(r,5));order.push('b');}),
    t.run(mac,pin,async()=>{order.push('c');})]);
  assert.deepEqual(order,['a','b','c']);
  assert.deepEqual(radio.events.filter(e=>['connect','disconnect'].includes(e)),['connect','disconnect','connect','disconnect']);
  assert.ok(radio.writes.every(w=>w.name==='auth'&&w.withoutResponse===false));
  assert.equal(radio.writes[0].value.readUInt32LE(),123456);
  assert.equal(radio.noble.listenerCount('discover'),0);assert.equal(radio.noble.listenerCount('stateChange'),0);
  t.close();
});
test('failed authentication prevents actions, disconnects, and does not poison the queue', async () => {
  const r=fakeRadio({auth:0}), t=new Transport(r.noble,50);let called=false;
  await assert.rejects(t.run(mac,pin,async()=>{called=true;}),/AUTH_REJECTED/);
  assert.equal(called,false);assert.equal(r.peripheral.state,'disconnected');
  r.values.confirmation=Buffer.from([1]);await t.run(mac,pin,async()=>{called=true;});assert.equal(called,true);t.close();
});
test('read and scan timeouts clean listeners; backend errors cannot become late writes', async () => {
  const r=fakeRadio({noDiscovery:true}),t=new Transport(r.noble,5);
  await assert.rejects(t.run(mac,pin,async()=>{}),/FAN_NOT_FOUND/);
  assert.equal(r.noble.listenerCount('discover'),0);assert.equal(r.noble.listenerCount('stateChange'),0);
  assert.equal(r.writes.length,0);t.close();
  const s=fakeRadio(),u=new Transport(s.noble,5);
  s.chars.find(c=>c.uuid===require('../lib/protocol').UUID.confirmation).readAsync=()=>new Promise(()=>{});
  await assert.rejects(u.run(mac,pin,async()=>{throw Error('must not run');}),/BLE_TIMEOUT/);
  assert.equal(s.peripheral.state,'disconnected');u.close();
});
test('closed transport rejects queued/new actions and blocks disallowed writes', async () => {
  const r=fakeRadio(),t=new Transport(r.noble,50);
  await assert.rejects(t.run(mac,pin,io=>io.write('mode',Buffer.from([4]))),/WRITE_NOT_ALLOWED/);
  assert.equal(r.writes.filter(w=>w.name!=='auth').length,0);
  t.close();await assert.rejects(t.run(mac,pin,async()=>{}),/BLE_UNAVAILABLE/);
});
test('late connection after timeout is disconnected and never runs an action', async () => {
  const r=fakeRadio(),t=new Transport(r.noble,5);let resolve,called=false;
  r.peripheral.connectAsync=()=>{r.peripheral.state='connecting';return new Promise(r=>{resolve=r;});};
  await assert.rejects(t.run(mac,pin,async()=>{called=true;}),/BLE_TIMEOUT/);
  await assert.rejects(t.run(mac,pin,async()=>{called=true;}),/BLE_RECOVERY_REQUIRED/);
  r.peripheral.state='connected';resolve();await new Promise(r=>setImmediate(r));
  assert.equal(r.peripheral.state,'disconnected');assert.equal(called,false);t.close();
});
test('late scan callback cannot stop a later session scan',async()=>{
  const r=fakeRadio({noDiscovery:true}),t=new Transport(r.noble,5);let oldCallback;
  r.noble.startScanning=(services,duplicates,cb)=>{oldCallback=cb;};
  await assert.rejects(t.run(mac,pin,async()=>{}),/FAN_NOT_FOUND/);
  const count=r.events.filter(e=>e==='stop').length;oldCallback(Error('late'));assert.equal(r.events.filter(e=>e==='stop').length,count);t.close();
});
test('shutdown while scanning cleans up and prevents authentication',async()=>{
  const r=fakeRadio({noDiscovery:true}),t=new Transport(r.noble,5);
  const job=t.run(mac,pin,async()=>{throw Error('must not run');});await new Promise(r=>setImmediate(r));t.close();
  await assert.rejects(job);assert.equal(r.writes.length,0);assert.equal(r.noble.listenerCount('discover'),0);
});
test('a timed-out disconnect is retried before another session can use the radio',async()=>{
  const r=fakeRadio(),t=new Transport(r.noble,5);let attempts=0;
  r.peripheral.disconnectAsync=async()=>{
    attempts++;
    if(attempts===1){r.peripheral.state='disconnecting';return new Promise(()=>{});}
    r.peripheral.state='disconnected';
  };
  await t.run(mac,pin,async()=>{});
  assert.equal(r.peripheral.state,'disconnecting');
  await t.run(mac,pin,async()=>{});
  assert.equal(attempts,3);assert.equal(r.peripheral.state,'disconnected');t.close();
});
test('an already disconnected peripheral is not disconnected again after a dropped session',async()=>{
  const r=fakeRadio(),t=new Transport(r.noble,5);let disconnects=0;
  r.peripheral.disconnectAsync=async()=>{disconnects++;r.peripheral.state='disconnecting';};
  await assert.rejects(t.run(mac,pin,async()=>{
    r.peripheral.state='disconnected';throw Error('link dropped');
  }),/link dropped/);
  assert.equal(disconnects,0);assert.equal(r.peripheral.state,'disconnected');t.close();
});
test('unsuccessful recovery never starts another connection or authenticates',async()=>{
  const r=fakeRadio(),t=new Transport(r.noble,5);
  t.peripheral=r.peripheral;r.peripheral.state='disconnecting';
  r.peripheral.disconnectAsync=()=>new Promise(()=>{});
  await assert.rejects(t.run(mac,pin,async()=>{}),/BLE_RECOVERY_REQUIRED/);
  assert.equal(r.writes.length,0);assert.equal(r.events.includes('connect'),false);t.close();
});
test('connection waits for acknowledged scan stop',async()=>{
  const r=fakeRadio(),t=new Transport(r.noble,50);let stopped=false;
  r.noble.stopScanningAsync=async()=>{await new Promise(r=>setTimeout(r,5));stopped=true;};
  const connect=r.peripheral.connectAsync.bind(r.peripheral);
  r.peripheral.connectAsync=async()=>{assert.equal(stopped,true);await connect();};
  await t.run(mac,pin,async()=>{});t.close();
});
test('unacknowledged scan stop cannot start a connection',async()=>{
  const r=fakeRadio(),t=new Transport(r.noble,5);
  r.noble.stopScanningAsync=()=>new Promise(()=>{});
  await assert.rejects(t.run(mac,pin,async()=>{}),/SCAN_STOP_FAILED/);
  assert.equal(r.events.includes('connect'),false);assert.equal(r.writes.length,0);t.close();
});
test('protected writes wait for the fan to process acknowledged authentication',async()=>{
  const r=fakeRadio(),t=new Transport(r.noble,50,15);let ready=false;
  const auth=r.chars.find(c=>c.uuid===require('../lib/protocol').UUID.auth),write=auth.writeAsync;
  auth.writeAsync=async(...args)=>{await write(...args);setTimeout(()=>{ready=true;},5);};
  await t.run(mac,pin,async io=>{assert.equal(ready,true);await io.write('manual',Buffer.alloc(5));});
  assert.equal(r.writes.filter(w=>w.name==='manual').length,1);t.close();
});
test('shutdown during authentication processing does not execute the action',async()=>{
  const r=fakeRadio(),t=new Transport(r.noble,50,15);let called=false;
  const auth=r.chars.find(c=>c.uuid===require('../lib/protocol').UUID.auth),write=auth.writeAsync;
  auth.writeAsync=async(...args)=>{await write(...args);setTimeout(()=>t.close(),5);};
  await assert.rejects(t.run(mac,pin,async()=>{called=true;}),/BLE_UNAVAILABLE/);
  assert.equal(called,false);assert.equal(r.writes.filter(w=>w.name!=='auth').length,0);
});

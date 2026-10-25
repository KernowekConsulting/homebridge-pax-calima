'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {EventEmitter, once} = require('node:events');
// Real published Noble classes, with only the physical HCI driver simulated.
const Noble = require('@stoprocent/noble/lib/noble');
const {Transport} = require('../lib/transport');
const {UUID, encodeManual, decodeManual, verifyManual} = require('../lib/protocol');
class Binding extends EventEmitter {
  constructor() { super();this.writes=[];this.auth=1;this.values={manual:Buffer.alloc(5)}; }
  start() { queueMicrotask(()=>this.emit('stateChange','poweredOn')); }
  startScanning() { queueMicrotask(()=>{this.emit('scanStart',false);this.emit('discover','aabbccddeeff','58:2b:db:11:22:33','public',true,{},-40,true);}); }
  stopScanning() { queueMicrotask(()=>this.emit('scanStop')); }
  connect(id) { queueMicrotask(()=>this.emit('connect',id)); }
  disconnect(id) { queueMicrotask(()=>this.emit('disconnect',id)); }
  discoverServices(id) { queueMicrotask(()=>this.emit('servicesDiscover',id,['abcd'])); }
  discoverCharacteristics(id,svc) { queueMicrotask(()=>this.emit('characteristicsDiscover',id,svc,Object.values(UUID).map(uuid=>({uuid,properties:['read','write']})))); }
  write(id,svc,uuid,value,withoutResponse) {
    this.writes.push({uuid,value:Buffer.from(value),withoutResponse});
    if(uuid===UUID.manual)this.values.manual=Buffer.from(value);
    queueMicrotask(()=>this.emit('write',id,svc,uuid));
  }
  read(id,svc,uuid) {
    const value=uuid===UUID.confirmation?Buffer.from([this.auth]):this.values.manual;
    queueMicrotask(()=>this.emit('read',id,svc,uuid,Buffer.from(value),false));
  }
}
async function setup(t) {
  const binding=new Binding(),noble=new Noble(binding),transport=new Transport(noble,100);
  const powered=once(noble,'stateChange');await powered;
  t.after(()=>transport.close());return {binding,noble,transport};
}
test('maintained Noble real API completes authenticated GATT write/read/disconnect and rescans',async t=>{
  const {binding,noble,transport}=await setup(t);
  for(const rpm of [2000,0]) {
    const expected=encodeManual(rpm,600);
    const result=await transport.run('58:2b:db:11:22:33','00123456',async io=>{
      await io.write('manual',expected);return verifyManual(await io.read('manual'),expected);
    });
    assert.equal(result.state,rpm?'boost':'pause');
  }
  assert.equal(binding.writes.filter(x=>x.uuid===UUID.auth).length,2);
  assert.ok(binding.writes.every(x=>x.withoutResponse===false));
  assert.equal(noble._peripherals.get('aabbccddeeff').state,'disconnected');
});
test('maintained Noble real API refuses false auth before action writes',async t=>{
  const {binding,transport}=await setup(t);binding.auth=0;
  await assert.rejects(transport.run('58:2b:db:11:22:33','012345',io=>io.write('manual',encodeManual(0,600))),/AUTH_REJECTED/);
  assert.equal(binding.writes.length,1);assert.equal(binding.writes[0].uuid,UUID.auth);
});
test('maintained Noble real API restores disabled remembered-target state as automatic',async t=>{
  const {binding,transport}=await setup(t);binding.values.manual=Buffer.from('00dc050000','hex');
  const manual=await transport.run('58:2b:db:11:22:33','00123456',async io=>decodeManual(await io.read('manual')));
  assert.equal(manual.state,'automatic');
});

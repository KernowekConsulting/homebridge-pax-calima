'use strict';
const { EventEmitter } = require('node:events');
const { UUID } = require('../lib/protocol');
function fakeRadio(options = {}) {
  const noble = new EventEmitter(); noble.state = 'poweredOn';
  const writes = [], events = [];
  const values = { confirmation: Buffer.from([options.auth === undefined ? 1 : options.auth]),
    mode:Buffer.from([0]), manual:Buffer.alloc(5), silent:Buffer.from('0116000600','hex'), status:Buffer.from('4d0074002603fa0301000000','hex') };
  const chars = Object.entries(UUID).map(([name, uuid]) => ({ uuid, properties:name==='auth'?['write']:['read','write'],
    readAsync:async () => Buffer.from(values[name]),
    writeAsync:async (value, withoutResponse) => {
      writes.push({name,value:Buffer.from(value),withoutResponse});
      if (name !== 'auth') values[name] = Buffer.from(value);
    }
  }));
  const peripheral = { address:'58:2b:db:11:22:33',state:'disconnected',
    async connectAsync() { this.state='connected';events.push('connect'); },
    async discoverServicesAsync() { return [{discoverCharacteristicsAsync:async()=>chars}]; },
    async disconnectAsync() { this.state='disconnected';events.push('disconnect'); },
    disconnect(cb) { this.state='disconnected';events.push('disconnect');if(cb)cb(); }
  };
  noble.startScanning = (services, duplicates, cb) => { events.push('scan');if(cb)cb();if(!options.noDiscovery)queueMicrotask(()=>noble.emit('discover',peripheral)); };
  noble.stopScanning = () => events.push('stop');
  return { noble, peripheral, values, writes, events, chars };
}
module.exports = { fakeRadio };

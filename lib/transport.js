'use strict';

const { UUID, normalise, FanError, check, encodePin, confirmAuth } = require('./protocol');

async function bounded(promise, ms, code = 'BLE_TIMEOUT') {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new FanError(code)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

// One queue owns scanning, connecting and GATT across every configured fan.
class Transport {
  constructor(noble, timeout = 7000) {
    this.noble = noble; this.timeout = timeout; this.tail = Promise.resolve();
    this.pending = 0; this.closed = false; this.peripheral = null;
  }
  run(mac, pin, action) {
    if (this.closed || this.pending >= 32) return Promise.reject(new FanError('BLE_UNAVAILABLE'));
    this.pending++;
    const job = this.tail.then(() => this.session(mac, pin, action));
    this.tail = job.catch(() => {}).finally(() => { this.pending--; });
    return job;
  }
  async find(mac) {
    check(this.noble.state === 'poweredOn', 'BLUETOOTH_NOT_READY');
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = async () => {
        clearTimeout(timer); this.noble.removeListener('discover', found);
        this.noble.removeListener('stateChange', changed);
        if (this.noble.stopScanningAsync) {
          await bounded(this.noble.stopScanningAsync(), this.timeout, 'SCAN_STOP_FAILED');
        } else { this.noble.stopScanning(); }
      };
      const fail = code => {
        if (settled) return; settled = true;
        cleanup().then(() => reject(new FanError(code)), reject);
      };
      const changed = state => { if (state !== 'poweredOn') fail('BLUETOOTH_NOT_READY'); };
      const found = peripheral => {
        if (!settled && String(peripheral.address).toLowerCase() === mac) {
          settled = true; cleanup().then(() => resolve(peripheral), reject);
        }
      };
      const timer = setTimeout(() => fail('FAN_NOT_FOUND'), this.timeout);
      this.noble.on('discover', found); this.noble.on('stateChange', changed);
      try { this.noble.startScanning([], true, error => { if (error) fail('SCAN_FAILED'); }); }
      catch (_) { fail('SCAN_FAILED'); }
    });
  }
  async session(mac, pin, action) {
    check(!this.closed, 'BLE_UNAVAILABLE');
    // Retry a stalled disconnect before reusing the radio. Never overlap an
    // unresolved connection or pretend the backend has disconnected.
    check(!this.connecting, 'BLE_RECOVERY_REQUIRED');
    if (this.peripheral && this.peripheral.state !== 'disconnected') {
      try { await bounded(this.peripheral.disconnectAsync(), this.timeout, 'BLE_RECOVERY_REQUIRED'); }
      catch (_) { throw new FanError('BLE_RECOVERY_REQUIRED'); }
      check(this.peripheral.state === 'disconnected', 'BLE_RECOVERY_REQUIRED');
    }
    const peripheral = await this.find(mac);
    this.peripheral = peripheral;
    let expired = false;
    try {
      this.connecting = true;
      const connection = peripheral.connectAsync();
      // Noble may complete a connection after its timeout. Disconnect it then.
      connection.then(() => {
        this.connecting = false;
        if (expired || this.closed) { try { peripheral.disconnect(() => {}); } catch (_) { /* recovery gate remains */ } }
      }, () => { this.connecting = false; });
      await bounded(connection, this.timeout);
      check(!this.closed, 'BLE_UNAVAILABLE');
      const chars = new Map();
      for (const service of await bounded(peripheral.discoverServicesAsync(), this.timeout)) {
        for (const char of await bounded(service.discoverCharacteristicsAsync(), this.timeout)) chars.set(normalise(char.uuid), char);
      }
      const get = (name, property) => {
        check(!this.closed, 'BLE_UNAVAILABLE');
        const char = chars.get(UUID[name]);
        check(char && char.properties.includes(property), 'CHARACTERISTIC_UNAVAILABLE');
        return char;
      };
      const read = name => bounded(get(name, 'read').readAsync(), this.timeout);
      const write = (name, value) => {
        check(['auth', 'manual', 'silent'].includes(name), 'WRITE_NOT_ALLOWED');
        return bounded(get(name, 'write').writeAsync(value, false), this.timeout);
      };
      const secret = encodePin(pin);
      try { await write('auth', secret); } finally { secret.fill(0); }
      confirmAuth(await read('confirmation'));
      return await action({ read, write });
    } finally {
      expired = true;
      // Noble sets state to disconnecting even when already disconnected;
      // a second disconnect may never receive another disconnect event.
      if (peripheral.state !== 'disconnected') {
        try { await bounded(peripheral.disconnectAsync(), this.timeout); } catch (_) { /* next session retries recovery */ }
      }
      // Do not clear the peripheral: its state gates the next connection.
    }
  }
  close() {
    this.closed = true;
    try { this.noble.stopScanning(); } catch (_) { /* shutdown */ }
    if (this.peripheral) {
      try { this.peripheral.disconnect(() => {}); } catch (_) { /* shutdown */ }
    }
  }
}
module.exports = { Transport, bounded };

'use strict';
const { performance } = require('node:perf_hooks');
const { check } = require('./protocol');

// Home supplies demand transitions; this controller has no sensor credentials,
// sensor polling or knowledge of whether a latched High signal is still fresh.
class CO2Clear {
  constructor(host) {
    this.host = host;
    this.enabled = host.config.co2ClearEnabled !== false;
    this.now = host.platform.co2ClearNow || (() => performance.now());
    this.current = null;
    this.sequence = 0;
    if (host.accessory.context.co2ClearLease) {
      delete host.accessory.context.co2ClearLease;
      host.platform.save(host.accessory);
      this.log('restart detected; renewal remains Off; any previous fan timer will expire naturally');
    }
  }
  get active() { return Boolean(this.current && this.current.active); }
  log(message) { this.host.platform.log.info('SvaraHome ' + this.host.accessory.displayName + ': CO2 Clear ' + message + '.'); }
  update() {
    if (this.host.co2ClearService) this.host.co2ClearService.getCharacteristic(this.host.hap.Characteristic.On)
      .updateValue(this.host.fault ? this.host.hapError() : this.active);
  }
  async set(on) {
    check(typeof on === 'boolean', 'INVALID_COMMAND');
    check(this.enabled && !this.host.closed, 'CO2_CLEAR_DISABLED');
    if (!on) return this.stop('acceptable/Off signal');
    check(this.host.fan && this.host.platform.transport, 'FAN_NOT_CONFIGURED');
    if (this.active) {
      // Repeated On must never refresh the maximum session deadline.
      if (this.host.intent && this.host.intent.owner === this.current) {
        check(!this.host.intent.running, 'BLE_UNAVAILABLE');
        return this.host.attemptIntent(this.host.intent);
      }
      check(!this.host.fault, 'BLE_UNAVAILABLE');
      return;
    }
    this.abandon('replaced by a new air demand');
    const token = {
      active: true, sequence: ++this.sequence, mayOwn: false,
      rpm: Math.min(this.host.fan.maxManualRpm || 2400, this.host.config.co2ClearRpm || 2400),
      leaseSeconds: (this.host.config.co2ClearLeaseMinutes || 15) * 60,
      end: this.now() + (this.host.config.co2ClearMaxMinutes || 60) * 60000,
    };
    this.current = token;
    token.capTimer = setTimeout(() => {
      if (this.current === token) this.stop('maximum session reached').catch(() => {});
    },
      Math.max(0, token.end - this.now()));
    this.log('High/On signal received; session ' + token.sequence + ' armed with a finite limit');
    this.update();
    return this.host.manual('boost', true, token.rpm, token);
  }
  valid(intent) {
    const token = intent.owner;
    return this.current === token && (intent.on ? token.active && this.now() < token.end :
      !token.active && token.releasing && this.now() < token.releaseEnd);
  }
  seconds(intent) {
    check(this.valid(intent), 'COMMAND_SUPERSEDED');
    const seconds = Math.min(intent.owner.leaseSeconds, Math.floor((intent.owner.end - this.now()) / 1000));
    check(seconds >= 1, 'COMMAND_SUPERSEDED');
    return seconds;
  }
  willWrite(intent, seconds) {
    if (!intent.on) return;
    intent.owner.mayOwn = true; // An acknowledged write can still lose its readback.
    intent.owner.lastLeaseSeconds = seconds;
    this.host.accessory.context.co2ClearLease = true;
    this.host.platform.save(this.host.accessory);
  }
  canRelease(intent, current) {
    // Do not clear a Pause or a recognisably different native/app override.
    // The fan protocol cannot distinguish identical out-of-band Boost writes.
    return intent.owner.mayOwn && current.state === 'boost' && current.rpm === intent.owner.rpm &&
      current.seconds <= intent.owner.lastLeaseSeconds;
  }
  confirmed(intent) {
    if (!this.valid(intent)) return;
    const token = intent.owner, state = this.host.last.manual;
    if (!intent.on) {
      this.log('release confirmed; fan reports ' + state.state);
      this.abandon();
      return;
    }
    token.expectedEnd = this.now() + state.seconds * 1000;
    this.log('session ' + token.sequence + ' confirmed at ' + state.rpm + ' RPM/' + state.seconds + 's');
    clearTimeout(token.renewTimer);
    token.renewTimer = setTimeout(() => {
      if (this.current !== token || !token.active) return;
      if (this.now() >= token.end) { this.stop('maximum session reached').catch(() => {}); return; }
      this.log('session ' + token.sequence + ' renewing timed ventilation');
      this.host.manual('boost', true, token.rpm, token).catch(() => {});
    }, Math.max(1000, state.seconds * 500));
  }
  failed(intent, code) {
    if (this.current !== intent.owner) return;
    this.log('stopped after ' + code + '; no further renewal');
    this.abandon();
  }
  observe(state) {
    const token = this.current;
    if (!token || !token.active || !token.mayOwn) return;
    const manual = state.manual;
    if (manual.state === 'pause' || (manual.state === 'boost' && manual.rpm !== token.rpm) ||
      (manual.state === 'automatic' && token.expectedEnd && this.now() < token.expectedEnd - 3000)) {
      this.abandon('native/manual control changed');
    }
  }
  async stop(reason) {
    const token = this.current;
    if (!token) return; // An unrelated timed Boost or Pause must be left alone.
    if (!token.active && token.releasing) {
      if (this.host.intent && this.host.intent.owner === token && !this.host.intent.running)
        return this.host.attemptIntent(this.host.intent);
      return;
    }
    token.active = false;
    clearTimeout(token.capTimer); clearTimeout(token.renewTimer);
    this.log(reason + '; renewal Off');
    this.update();
    if (!token.mayOwn) { this.abandon(); return; }
    token.releasing = true;
    token.releaseEnd = this.now() + token.leaseSeconds * 1000;
    token.cleanupTimer = setTimeout(() => {
      if (this.current === token) this.abandon('release window ended; relying on the finite native timer');
    }, token.leaseSeconds * 1000);
    return this.host.manual('boost', false, undefined, token);
  }
  abandon(reason) {
    const token = this.current;
    if (!token) return;
    token.active = false;
    for (const key of ['capTimer', 'renewTimer', 'cleanupTimer']) clearTimeout(token[key]);
    this.current = null;
    if (this.host.intent && this.host.intent.owner === token) {
      this.host.logIntent(this.host.intent, 'replaced by CO2 Clear cancellation');
      clearTimeout(this.host.intentTimer); this.host.intentTimer = null;
      this.host.intent = null; this.host.saveIntent();
    }
    delete this.host.accessory.context.co2ClearLease;
    this.host.platform.save(this.host.accessory);
    if (reason) this.log(reason + '; renewal Off');
    this.update();
  }
  close() {
    const token = this.current;
    if (!token) return;
    for (const key of ['capTimer', 'renewTimer', 'cleanupTimer']) clearTimeout(token[key]);
    token.active = false; this.current = null;
    // Preserve only a marker, never a resumable High or pending renewal.
    this.log('bridge stopping; no further renewal; native timer remains bounded');
  }
}
module.exports = { CO2Clear };

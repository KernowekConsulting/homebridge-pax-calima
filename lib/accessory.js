'use strict';
const { check, bytes, FanError, publicError, decodeStatus, decodeManual, encodeManual,
  verifyManual, decodeSilent, configuredSchedule, MAX_RPM } = require('./protocol');
const POLL_MS = 10000, STALE_MS = 45000;
// Both tested fans turn a rejected 2450 RPM request into Pause. Use the
// verified 2400 target by default; explicit per-fan limits remain available.
const DEFAULT_MANUAL_MAX_RPM = 2400;
const RETRYABLE = new Set(['BLE_OPERATION_FAILED', 'BLE_TIMEOUT', 'BLE_RECOVERY_REQUIRED', 'BLE_UNAVAILABLE',
  'FAN_NOT_FOUND', 'SCAN_FAILED', 'SCAN_STOP_FAILED', 'BLUETOOTH_NOT_READY', 'BLUETOOTH_ERROR']);

class FanAccessory {
  constructor(platform, homebridge, accessory, fan) {
    this.platform = platform; this.hap = homebridge.hap; this.accessory = accessory; this.fan = fan;
    this.config = platform.config; this.last = null; this.fault = true; this.closed = false;
    this.pollPending = false; this.errorCode = null; this.controls = [];
    this.intent = null;
    const saved = accessory.context.pendingManual;
    if (saved && ['boost', 'pause', 'automatic'].includes(saved.kind) && typeof saved.on === 'boolean' &&
        (saved.kind !== 'automatic' || (saved.on === false && saved.rpm === undefined)) &&
        (saved.rpm === undefined || (Number.isInteger(saved.rpm) && saved.rpm >= 1000 && saved.rpm <= MAX_RPM && saved.rpm % 25 === 0))) {
      this.intent = { kind: saved.kind, on: saved.on, rpm: saved.rpm, attempted: saved.attempted === true };
    }
    this.setup();
  }
  hapError() { return new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE); }
  ready() {
    if (this.fault || !this.last || Date.now() - this.last.at > STALE_MS) throw this.hapError();
    return this.last;
  }
  characteristic(service, type, get, set) {
    const c = service.getCharacteristic(type).onGet(() => { const state = this.ready(); return get(state); });
    if (set) c.onSet(async value => {
      await this.handle(() => set(value));
      // HAP caches the requested value after onSet completes. Re-publish
      // readback afterwards, especially for the measured speed slider.
      setImmediate(() => {
        if (!this.closed && !this.fault && this.last) {
          for (const control of this.controls) control.characteristic.updateValue(control.get(this.last));
        }
      });
    });
    this.controls.push({ characteristic: c, get });
    c.updateValue(this.hapError());
    return c;
  }
  setup() {
    const { Service: S, Characteristic: C } = this.hap, a = this.accessory, name = a.displayName;
    this.fanService = a.getService(S.Fanv2) || a.addService(new S.Fanv2(name, 'fan'));
    this.fanService.setPrimaryService(true);
    this.characteristic(this.fanService, C.Active, s => s.manual.state === 'pause' ? 0 : Number(s.status.rpm > 0),
      value => { check(value === 0 || value === 1, 'INVALID_COMMAND'); return value === 0 ? this.manual('pause', true) : this.manual('automatic', false); });
    this.characteristic(this.fanService, C.RotationSpeed, s => Math.round(s.status.rpm / 25),
      percent => this.speed(percent)).setProps({ minValue: 0, maxValue: 100, minStep: 1 });
    this.characteristic(this.fanService, C.CurrentFanState, s => s.status.rpm > 0 ? 2 : 1);
    // Preserve fan accessory identity; retire unsupported readings/event button.
    for (const type of [S.StatelessProgrammableSwitch, S.TemperatureSensor, S.HumiditySensor, S.LightSensor]) {
      for (const service of [...a.services]) if (service.UUID === type.UUID) a.removeService(service);
    }
    this.boostService = this.switchService('boost', 'Boost Fan', this.config.showBoostSwitch !== false,
      s => s.manual.state === 'boost', value => this.manual('boost', value));
    this.pauseService = this.switchService('pause', 'Pause Fan', this.config.showPauseSwitch === true,
      s => s.manual.state === 'pause', value => this.manual('pause', value));
    this.silentService = this.switchService('silent-hours', 'Silent Hours', this.config.showSilentSwitch === true,
      s => s.silent.enabled, value => this.silent(value));
    const info = a.getService(S.AccessoryInformation);
    if (info) info.setCharacteristic(C.Manufacturer, 'Pax / Vent-Axia').setCharacteristic(C.Model, 'Calima / Svara');
  }
  switchService(id, label, show, get, set) {
    const { Service: S, Characteristic: C } = this.hap;
    const existing = this.accessory.getServiceById(S.Switch, id);
    if (!show) { if (existing) this.accessory.removeService(existing); return null; }
    const service = existing || this.accessory.addService(new S.Switch(this.accessory.displayName + ' ' + label, id));
    service.displayName = this.accessory.displayName + ' ' + label;
    service.setCharacteristic(C.Name, service.displayName);
    if (!service.testCharacteristic(C.ConfiguredName)) service.addCharacteristic(C.ConfiguredName);
    service.setCharacteristic(C.ConfiguredName, label);
    this.characteristic(service, C.On, get, value => { check(typeof value === 'boolean', 'INVALID_COMMAND'); return set(value); });
    return service;
  }
  schedule(delay = POLL_MS) {
    if (this.closed || !this.fan || this.authRejected) return;
    if (this.intent && !this.intent.running && !this.intentTimer) this.scheduleIntent(this.intent, delay);
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.poll(), delay);
  }
  async snapshot(io) {
    const mode = bytes(await io.read('mode'), 1)[0];
    const manual = decodeManual(await io.read('manual'));
    const silent = decodeSilent(await io.read('silent'));
    const status = decodeStatus(await io.read('status'));
    return { mode, manual, silent, status, at: Date.now() };
  }
  async session(action) {
    check(!this.closed && this.fan && this.platform.transport, 'FAN_NOT_CONFIGURED');
    return this.platform.transport.run(this.fan.mac, this.fan.pin, action);
  }
  async poll() {
    if (this.closed || this.pollPending || this.authRejected) return;
    this.pollPending = true;
    try {
      const state = await this.session(async io => {
        const schedule = configuredSchedule(this.config.silentHoursStart, this.config.silentHoursEnd);
        const signature = schedule && schedule.toString('hex');
        const state = await this.snapshot(io);
        // An explicitly changed plugin schedule is applied once, after readback.
        // Subsequent app edits remain untouched, including after restart.
        if (signature && this.accessory.context.appliedSchedule !== signature) {
          if (!state.silent.value.equals(schedule)) {
            await io.write('silent', schedule);
            const rb = await io.read('silent');
            check(rb.equals(schedule), 'SCHEDULE_NOT_CONFIRMED');
            state.silent = decodeSilent(rb);
          }
          this.accessory.context.appliedSchedule = signature;
          this.platform.save(this.accessory);
        } else if (!signature && this.accessory.context.appliedSchedule) {
          delete this.accessory.context.appliedSchedule; this.platform.save(this.accessory);
        }
        return state;
      });
      this.publish(state);
    } catch (error) { this.fail(error, true); }
    finally { this.pollPending = false; this.schedule(); }
  }
  async handle(action) {
    try { await action(); }
    catch (error) { if (publicError(error) !== 'COMMAND_SUPERSEDED') this.fail(error); throw this.hapError(); }
  }
  async manual(kind, on, rpm) {
    check(['boost', 'pause', 'automatic'].includes(kind) && typeof on === 'boolean' &&
      (kind !== 'automatic' || (on === false && rpm === undefined)), 'INVALID_COMMAND');
    // Replacing the object invalidates any older queued attempt before its write.
    clearTimeout(this.intentTimer); this.intentTimer = null;
    const intent = { kind, on, rpm, attempted: false };
    this.intent = intent; this.saveIntent();
    return this.attemptIntent(intent);
  }
  saveIntent() {
    if (this.intent) {
      const { kind, on, rpm, attempted } = this.intent;
      this.accessory.context.pendingManual = { kind, on, rpm, attempted };
    } else delete this.accessory.context.pendingManual;
    this.platform.save(this.accessory);
  }
  scheduleIntent(intent, delay = POLL_MS) {
    clearTimeout(this.intentTimer);
    this.intentTimer = setTimeout(() => {
      this.intentTimer = null;
      this.attemptIntent(intent).catch(() => {});
    }, delay);
  }
  async attemptIntent(intent) {
    if (this.closed || this.intent !== intent || intent.running) return;
    clearTimeout(this.intentTimer); this.intentTimer = null;
    intent.running = true;
    try {
      await this.applyManual(intent);
      if (this.intent === intent) { this.intent = null; this.saveIntent(); }
    } catch (error) {
      if (!this.closed && this.intent === intent) {
        this.fail(error);
        if (RETRYABLE.has(publicError(error))) {
          this.scheduleIntent(intent);
          if (!intent.announced) {
            this.platform.log.info('SvaraHome ' + this.accessory.displayName + ': ' + intent.kind +
              ' request pending; retrying until confirmed or replaced by a newer command.');
            intent.announced = true;
          }
        } else { this.intent = null; this.saveIntent(); }
      }
      throw error;
    } finally { intent.running = false; }
  }
  async applyManual(intent) {
    const { kind, on, rpm } = intent;
    const result = await this.session(async io => {
      check(this.intent === intent, 'COMMAND_SUPERSEDED');
      const mode = bytes(await io.read('mode'), 1)[0];
      check(mode === 0, 'CONTROL_REQUIRES_MULTIMODE');
      const current = decodeManual(await io.read('manual'));
      // Fan On clears either override. Individual switch-off still affects
      // only its own kind, so a delayed Boost-off cannot cancel Pause.
      if (!on && (kind === 'automatic' ? current.state === 'automatic' : current.state !== kind)) return this.snapshot(io);
      const seconds = (kind === 'pause' ? this.config.pauseMinutes || 10 : this.config.boostMinutes || 10) * 60;
      const target = kind === 'pause' ? 0 : Math.min(this.fan.maxManualRpm || DEFAULT_MANUAL_MAX_RPM, rpm || this.config.boostRpm || 2000);
      const value = on ? encodeManual(target, seconds) : Buffer.alloc(5);
      // A write may have reached the fan even if the response was lost. Adopt
      // its verified active timer rather than restarting it on every retry.
      if (intent.attempted && on && current.state === kind && current.rpm === value.readUInt16LE(1) && current.seconds <= seconds) {
        return this.snapshot(io);
      }
      check(this.intent === intent, 'COMMAND_SUPERSEDED');
      intent.attempted = true; this.saveIntent();
      await io.write('manual', value);
      const actual = await io.read('manual');
      try { verifyManual(actual, value); }
      catch (error) {
        if (publicError(error) === 'COMMAND_NOT_CONFIRMED') {
          const got = decodeManual(actual), want = decodeManual(value);
          this.platform.log.warn('SvaraHome ' + this.accessory.displayName + ': manual readback differs; requested ' +
            want.state + ' ' + want.rpm + ' RPM/' + want.seconds + 's, received ' + got.state + ' ' + got.rpm + ' RPM/' + got.seconds + 's.');
        }
        throw error;
      }
      return this.snapshot(io);
    });
    this.publish(result); this.schedule(2000);
  }
  speed(percent) {
    check(typeof percent === 'number' && Number.isFinite(percent) && percent >= 0 && percent <= 100, 'INVALID_SPEED');
    if (percent === 0) return this.manual('pause', true);
    // Never change persistent presets to satisfy a Home slider.
    const rpm = Math.max(1000, Math.min(MAX_RPM, Math.round(percent) * 25));
    return this.manual('boost', true, rpm);
  }
  async silent(on) {
    const state = await this.session(async io => {
      const current = decodeSilent(await io.read('silent'));
      const value = Buffer.from(current.value); value[0] = Number(on);
      if (!current.value.equals(value)) {
        await io.write('silent', value);
        check((await io.read('silent')).equals(value), 'SCHEDULE_NOT_CONFIRMED');
      }
      return this.snapshot(io);
    });
    this.publish(state);
  }
  publish(state) {
    if (this.closed) return;
    this.last = state; this.fault = false; this.authRejected = false;
    if (this.errorCode) this.platform.log.info('SvaraHome ' + this.accessory.displayName + ': communication restored.');
    this.errorCode = null;
    for (const { characteristic, get } of this.controls) characteristic.updateValue(get(state));
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.fail(new FanError('TELEMETRY_STALE')), STALE_MS);
  }
  fail(error, polling = false) {
    if (this.closed) return;
    const code = publicError(error);
    // A missed background poll need not flicker Home to No Response. Keep
    // the last verified snapshot only within the existing freshness limit.
    // Authentication, malformed telemetry and failed commands still fault.
    const fresh = polling && RETRYABLE.has(code) && !this.fault && this.last && Date.now() - this.last.at < STALE_MS;
    if (!fresh) this.fault = true;
    // Do not repeatedly submit a known-rejected PIN during unattended polling.
    // A user command can explicitly retry, or a config restart can replace it.
    if (code === 'AUTH_REJECTED') {
      this.authRejected = true; clearTimeout(this.pollTimer); clearTimeout(this.intentTimer); this.intentTimer = null;
      if (this.intent) { this.intent = null; this.saveIntent(); }
    }
    if (this.errorCode !== code) this.platform.log.warn('SvaraHome ' + this.accessory.displayName +
      (fresh ? ' retrying communication: ' : ' unavailable: ') + code + '. Check Bluetooth access, fan address and PIN in Plugin Config.');
    this.errorCode = code;
    if (!fresh) for (const { characteristic } of this.controls) characteristic.updateValue(this.hapError());
  }
  close() { this.closed = true; clearTimeout(this.pollTimer); clearTimeout(this.staleTimer); clearTimeout(this.intentTimer); }
}
module.exports = { FanAccessory, POLL_MS, STALE_MS };

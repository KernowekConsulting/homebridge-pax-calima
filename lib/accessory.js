'use strict';
const { check, bytes, FanError, publicError, decodeStatus, decodeManual, encodeManual,
  verifyManual, decodeSilent, configuredSchedule, MAX_RPM } = require('./protocol');
const POLL_MS = 10000, STALE_MS = 45000;

class FanAccessory {
  constructor(platform, homebridge, accessory, fan) {
    this.platform = platform; this.hap = homebridge.hap; this.accessory = accessory; this.fan = fan;
    this.config = platform.config; this.last = null; this.fault = true; this.closed = false;
    this.pollPending = false; this.errorCode = null; this.controls = [];
    this.setup();
  }
  hapError() { return new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE); }
  ready() {
    if (this.fault || !this.last || Date.now() - this.last.at > STALE_MS) throw this.hapError();
    return this.last;
  }
  characteristic(service, type, get, set) {
    const c = service.getCharacteristic(type).onGet(() => { const state = this.ready(); return get(state); });
    if (set) c.onSet(value => this.handle(() => set(value)));
    this.controls.push({ characteristic: c, get });
    c.updateValue(this.hapError());
    return c;
  }
  setup() {
    const { Service: S, Characteristic: C } = this.hap, a = this.accessory, name = a.displayName;
    this.fanService = a.getService(S.Fanv2) || a.addService(new S.Fanv2(name, 'fan'));
    this.fanService.setPrimaryService(true);
    this.characteristic(this.fanService, C.Active, s => s.manual.state === 'pause' ? 0 : Number(s.status.rpm > 0),
      value => { check(value === 0 || value === 1, 'INVALID_COMMAND'); return value === 0 ? this.manual('pause', true) : this.manual('pause', false); });
    this.characteristic(this.fanService, C.RotationSpeed, s => Math.round(s.status.rpm / 25),
      percent => this.speed(percent)).setProps({ minValue: 0, maxValue: 100, minStep: 1 });
    this.characteristic(this.fanService, C.CurrentFanState, s => s.status.rpm > 0 ? 2 : 1);
    // Preserve fan accessory identity; retire unsupported readings/event button.
    for (const type of [S.StatelessProgrammableSwitch, S.TemperatureSensor, S.HumiditySensor, S.LightSensor]) {
      for (const service of [...a.services]) if (service.UUID === type.UUID) a.removeService(service);
    }
    this.boostService = this.switchService('boost', 'Boost', this.config.showBoostSwitch !== false,
      s => s.manual.state === 'boost', value => this.manual('boost', value));
    this.pauseService = this.switchService('pause', 'Pause', this.config.showPauseSwitch !== false,
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
    this.characteristic(service, C.On, get, value => { check(typeof value === 'boolean', 'INVALID_COMMAND'); return set(value); });
    return service;
  }
  schedule(delay = POLL_MS) {
    if (this.closed || !this.fan || this.authRejected) return;
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
    } catch (error) { this.fail(error); }
    finally { this.pollPending = false; this.schedule(); }
  }
  async handle(action) {
    try { await action(); }
    catch (error) { this.fail(error); throw this.hapError(); }
  }
  async manual(kind, on, rpm) {
    const result = await this.session(async io => {
      const mode = bytes(await io.read('mode'), 1)[0];
      check(mode === 0, 'CONTROL_REQUIRES_MULTIMODE');
      const current = decodeManual(await io.read('manual'));
      // Stale switch-off must not cancel a newer override of another kind.
      if (!on && current.state !== kind) return this.snapshot(io);
      const seconds = (kind === 'pause' ? this.config.pauseMinutes || 10 : this.config.boostMinutes || 10) * 60;
      const value = on ? encodeManual(kind === 'pause' ? 0 : rpm || this.config.boostRpm || 2000, seconds) : Buffer.alloc(5);
      await io.write('manual', value);
      verifyManual(await io.read('manual'), value);
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
    if (this.errorCode) this.platform.log.info('Fan communication restored.');
    this.errorCode = null;
    for (const { characteristic, get } of this.controls) characteristic.updateValue(get(state));
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.fail(new FanError('TELEMETRY_STALE')), STALE_MS);
  }
  fail(error) {
    if (this.closed) return;
    this.fault = true;
    const code = publicError(error);
    // Do not repeatedly submit a known-rejected PIN during unattended polling.
    // A user command can explicitly retry, or a config restart can replace it.
    if (code === 'AUTH_REJECTED') { this.authRejected = true; clearTimeout(this.pollTimer); }
    if (this.errorCode !== code) this.platform.log.warn('Fan unavailable: ' + code + '. Check Bluetooth access, fan address and PIN in Plugin Config.');
    this.errorCode = code;
    for (const { characteristic } of this.controls) characteristic.updateValue(this.hapError());
  }
  close() { this.closed = true; clearTimeout(this.pollTimer); clearTimeout(this.staleTimer); }
}
module.exports = { FanAccessory, POLL_MS, STALE_MS };

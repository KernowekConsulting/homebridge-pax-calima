'use strict';
const { Transport } = require('./transport');
const { FanError, check, publicError, configuredSchedule, encodePin } = require('./protocol');
const { FanAccessory } = require('./accessory');
const PLUGIN = 'homebridge-pax-calima';
const MAC = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/;

function validateConfig(config) {
  const fans = new Map();
  fans.issues = [];
  const duplicates = new Set();
  check(Array.isArray(config.fans), 'CONFIGURE_FANS');
  for (const fan of config.fans) {
    try {
      check(fan && typeof fan.mac === 'string', 'FAN_ADDRESS_REQUIRED');
      const mac = fan.mac.toLowerCase();
      check(MAC.test(mac), 'INVALID_ADDRESS');
      if (fans.has(mac) || duplicates.has(mac)) {
        fans.delete(mac); duplicates.add(mac); throw new FanError('DUPLICATE_ADDRESS');
      }
      const secret = encodePin(fan.pin); secret.fill(0);
      fans.set(mac, { ...fan, mac });
    } catch (error) { fans.issues.push(publicError(error)); }
  }
  for (const key of ['boostMinutes', 'pauseMinutes']) {
    if (config[key] !== undefined) check(Number.isInteger(config[key]) && config[key] >= 1 && config[key] <= 60, 'INVALID_DURATION');
  }
  if (config.boostRpm !== undefined) check(Number.isInteger(config.boostRpm) && config.boostRpm >= 1000 && config.boostRpm <= 2500 && config.boostRpm % 25 === 0, 'INVALID_SPEED');
  configuredSchedule(config.silentHoursStart, config.silentHoursEnd);
  return fans;
}
function createPlatform(homebridge, dependencies = {}) {
  return class PaxCalimaPlatform {
    constructor(log, config, api) {
      this.log = log; this.config = config || {}; this.api = api;
      this.cached = new Map(); this.handlers = []; this.transport = null; this.stopped = false;
      this.valid = false;
      try {
        this.fans = validateConfig(this.config); this.valid = this.fans.size > 0;
        for (const code of this.fans.issues) this.log.warn('SvaraHome skipped fan setup: ' + code + '. Check its address and PIN in Plugin Config.');
      }
      catch (error) {
        this.log.warn('SvaraHome setup needs attention: ' + publicError(error) + '. Check each fan address and its six- or eight-digit PIN in Plugin Config.');
      }
      api.on('didFinishLaunching', () => this.launch());
      api.on('shutdown', () => this.shutdown());
    }
    configureAccessory(accessory) {
      const mac = String(accessory.context.mac || '').toLowerCase();
      if (MAC.test(mac)) this.cached.set(mac, accessory);
    }
    launch() {
      if (this.launched || this.stopped) return;
      this.launched = true;
      // Retain cached identities but fault them when config cannot be routed.
      for (const [mac, accessory] of this.cached) {
        const fan = this.valid && this.fans.get(mac);
        this.handlers.push(new FanAccessory(this, homebridge, accessory, fan || null));
      }
      if (!this.valid) return;
      try {
        // Unconfigured platforms never load Noble or initialise the adapter.
        const noble = dependencies.noble || require('@abandonware/noble');
        this.transport = dependencies.transport || new Transport(noble);
        this.onState = state => {
          if (state === 'poweredOn') for (const handler of this.handlers) handler.schedule(0);
          else for (const handler of this.handlers) handler.fail(new FanError('BLUETOOTH_NOT_READY'));
        };
        this.onError = () => { for (const handler of this.handlers) handler.fail(new FanError('BLUETOOTH_ERROR')); };
        this.noble = noble; noble.on('stateChange', this.onState); noble.on('error', this.onError);
        for (const [mac, fan] of this.fans) {
          if (this.cached.has(mac)) continue;
          const uuid = homebridge.hap.uuid.generate('pax-calima-' + mac);
          const accessory = new homebridge.platformAccessory(fan.name || 'SvaraHome Fan', uuid, homebridge.hap.Categories.FAN);
          accessory.context.mac = mac;
          this.handlers.push(new FanAccessory(this, homebridge, accessory, fan));
          this.api.registerPlatformAccessories(PLUGIN, 'PaxCalima', [accessory]);
        }
        for (const handler of this.handlers) handler.schedule(0);
      } catch (_) {
        this.log.error('SvaraHome Bluetooth could not start. Check adapter access and plugin dependencies.');
        this.shutdown();
      }
    }
    save(accessory) { this.api.updatePlatformAccessories([accessory]); }
    shutdown() {
      this.stopped = true;
      for (const handler of this.handlers) handler.close();
      if (this.noble) {
        this.noble.removeListener('stateChange', this.onState); this.noble.removeListener('error', this.onError);
      }
      if (this.transport) this.transport.close();
    }
  };
}
module.exports = { createPlatform, validateConfig };

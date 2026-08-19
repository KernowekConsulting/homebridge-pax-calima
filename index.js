'use strict';

const noble = require('@abandonware/noble');

let Service, Characteristic, Categories, API, PlatformAccessory;

// ── Verified BLE UUIDs (confirmed via live device dump April 2026) ────────────
const UUID_AUTH    = '4cad343a-209a-40b7-b911-4d9b3df569b2'; // PIN auth
const UUID_STATUS  = '528b80e8-c47a-4c0a-bdf1-916a7748f412'; // RPM (offset 6) + temp (offset 2)
const UUID_SENSOR  = 'a22eae12-dba8-49f3-9c69-1721dcff1d96'; // humidity (offset 0) + lux (offset 2 BE)
const UUID_CONTROL = '1488a757-35bc-4ec8-9a6b-9ecf1502778e'; // speed config [trickle|normal|boost] UInt16LE
const UUID_SILENT  = 'b5836b55-57bd-433e-8480-46e4993c5ac0'; // silent hours [enabled, startH, startM, endH, endM]

const MAC_PREFIX   = '58:2b:db';
const POLL_MS      = 10000;
const RECONNECT_MS = 15000;

function parseTime(str, label) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split(':');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    console.warn('[PaxCalima] ' + (label || 'Silent Hours') + ' time "' + str + '" is not valid — use 24-hour format e.g. 23:00. Silent Hours schedule disabled.');
    return null;
  }
  const hour   = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    console.warn('[PaxCalima] ' + (label || 'Silent Hours') + ' time "' + str + '" is out of range — use 24-hour format e.g. 23:00. Silent Hours schedule disabled.');
    return null;
  }
  return { hour, minute };
}

function timeStr(t) {
  return String(t.hour).padStart(2, '0') + ':' + String(t.minute).padStart(2, '0');
}

module.exports = (homebridge) => {
  Service           = homebridge.hap.Service;
  Characteristic    = homebridge.hap.Characteristic;
  Categories        = homebridge.hap.Categories;
  API               = homebridge;
  PlatformAccessory = homebridge.platformAccessory;
  homebridge.registerPlatform('homebridge-pax-calima', 'PaxCalima', PaxCalimaPlatform, true);
};

// ─── Platform ─────────────────────────────────────────────────────────────────
class PaxCalimaPlatform {
  constructor(log, config, api) {
    this.log               = log;
    this.config            = config || {};
    this.api               = api;
    this.registeredMACs    = new Set();
    this.discoveryStarted  = false;
    this.cachedAccessories = [];

    this.log.info('PaxCalima platform initialised');

    this.api.on('didFinishLaunching', () => {
      this.log.info('Homebridge finished launching — starting BLE');
      noble.on('stateChange', (state) => {
        this.log.info('BLE state: ' + state);
        if (state === 'poweredOn') this.startDiscovery();
      });
      setTimeout(() => {
        if (noble.state === 'poweredOn') this.startDiscovery();
      }, 3000);
    });
  }

  configureAccessory(accessory) {
    const mac = accessory.context && accessory.context.mac;
    this.log.info('Restoring cached accessory: ' + accessory.displayName);
    if (mac) {
      this.registeredMACs.add(mac);
      this.cachedAccessories.push({ accessory, mac });
    }
  }

  startDiscovery() {
    if (this.discoveryStarted) return;
    this.discoveryStarted = true;

    for (const { accessory, mac } of this.cachedAccessories) {
      this.log.info('Starting handler for cached fan: ' + mac);
      new PaxCalimaAccessory(this.log, accessory, mac, this.fanOptions(mac));
    }
    this.cachedAccessories = [];

    this.log.info('Starting BLE discovery scan...');
    noble.startScanning([], false);

    noble.on('discover', (peripheral) => {
      const mac = peripheral.address.toLowerCase();
      if (!mac.startsWith(MAC_PREFIX)) return;
      if (this.registeredMACs.has(mac)) return;
      this.registeredMACs.add(mac);
      this.log.info('Discovered new fan: ' + mac);
      const uuid  = API.hap.uuid.generate('pax-calima-' + mac);
      const hbAcc = new PlatformAccessory(this.nameForMac(mac), uuid, Categories.FAN);
      hbAcc.context.mac = mac;
      new PaxCalimaAccessory(this.log, hbAcc, mac, this.fanOptions(mac));
      this.api.registerPlatformAccessories('homebridge-pax-calima', 'PaxCalima', [hbAcc]);
    });
  }

  fanConfig(mac)  { return (this.config.fans || []).find(f => f.mac && f.mac.toLowerCase() === mac) || {}; }
  pinForMac(mac)  { return this.fanConfig(mac).pin || '012345'; }
  nameForMac(mac) { return this.fanConfig(mac).name || ('Pax Calima ' + mac.slice(-5).toUpperCase()); }

  fanOptions(mac) {
    return {
      pin:               this.pinForMac(mac),
      showHumidity:      this.config.showHumidity    === true,
      showLight:         this.config.showLight        === true,
      showSilentSwitch:  this.config.showSilentSwitch === true,
      silentHoursStart:  this.config.silentHoursStart || null,
      silentHoursEnd:    this.config.silentHoursEnd   || null,
    };
  }
}

// ─── Accessory ────────────────────────────────────────────────────────────────
class PaxCalimaAccessory {
  constructor(log, accessory, mac, options) {
    this.log              = log;
    this.accessory        = accessory;
    this.mac              = mac.toLowerCase();
    this.pin              = options.pin              || '012345';
    this.showHumidity     = options.showHumidity     || false;
    this.showLight        = options.showLight        || false;
    this.showSilentSwitch = options.showSilentSwitch || false;
    this.silentStart      = parseTime(options.silentHoursStart, 'silentHoursStart');
    this.silentEnd        = parseTime(options.silentHoursEnd, 'silentHoursEnd');

    this.currentRPM  = 0;
    this.humidity    = 0;
    this.temperature = 20;
    this.lightLevel  = 0.0001;
    this.silentHours = false; // runtime state of the silent hours switch

    this.pollTimer = null;
    this.polling   = false;

    this.setupServices();
    this.schedulePoll(0);
  }

  // ── Services ────────────────────────────────────────────────────────────────
  setupServices() {
    const n = this.accessory.displayName;

    // Fan speed — always present
    this.fanService = this.accessory.getService(Service.Fanv2)
      || this.accessory.addService(new Service.Fanv2(n, 'fan'));
    this.fanService.getCharacteristic(Characteristic.Active)
      .onGet(() => 1);
    this.fanService.getCharacteristic(Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 100, minStep: 1 })
      .onGet(() => this.rpmToPercent(this.currentRPM))
      .onSet((v) => this.writeSpeed(v));

    // Boost button — always present
    this.boostButton = this.accessory.getService(Service.StatelessProgrammableSwitch)
      || this.accessory.addService(new Service.StatelessProgrammableSwitch(n + ' Boost', 'boost'));
    this.boostButton.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .setProps({ validValues: [0] });

    // Temperature — always present
    this.tempService = this.accessory.getService(Service.TemperatureSensor)
      || this.accessory.addService(new Service.TemperatureSensor(n + ' Temperature', 'temperature'));
    this.tempService.getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(() => this.temperature);

    // Silent Hours switch — opt-in via showSilentSwitch: true
    // Coexists with config schedule — switch state takes priority on next poll
    if (this.showSilentSwitch) {
      this.silentService = this.accessory.getServiceById(Service.Switch, 'silent-hours')
        || this.accessory.addService(new Service.Switch(n + ' Silent Hours', 'silent-hours'));
      this.silentService.getCharacteristic(Characteristic.On)
        .onGet(() => this.silentHours)
        .onSet((on) => {
          this.silentHours = on;
          this.log.info('Silent Hours manually ' + (on ? 'enabled' : 'disabled'));
        });
      this.log.info('Silent Hours switch enabled');
    } else {
      // Remove switch if it was registered in a previous version
      const existing = this.accessory.getServiceById(Service.Switch, 'silent-hours');
      if (existing) {
        this.accessory.removeService(existing);
        this.log.info('Silent Hours switch removed — use config schedule or enable showSilentSwitch');
      }
    }

    // Humidity — opt-in only
    if (this.showHumidity) {
      this.humidityService = this.accessory.getService(Service.HumiditySensor)
        || this.accessory.addService(new Service.HumiditySensor(n + ' Humidity', 'humidity'));
      this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .onGet(() => this.humidity);
      this.log.info('Humidity sensor enabled — reflects fan internal state, not real-time');
    } else {
      const existing = this.accessory.getService(Service.HumiditySensor);
      if (existing) this.accessory.removeService(existing);
    }

    // Light — opt-in only
    if (this.showLight) {
      this.lightService = this.accessory.getService(Service.LightSensor)
        || this.accessory.addService(new Service.LightSensor(n + ' Light', 'light'));
      this.lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .onGet(() => Math.max(0.0001, this.lightLevel));
      this.log.info('Light sensor enabled — reflects fan internal state, not real-time');
    } else {
      const existing = this.accessory.getService(Service.LightSensor);
      if (existing) this.accessory.removeService(existing);
    }

    this.log.info('Services ready: ' + n);
  }

  // ── Poll cycle ──────────────────────────────────────────────────────────────
  schedulePoll(delayMs) {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.poll(), delayMs);
  }

  async poll() {
    if (this.polling) { this.schedulePoll(POLL_MS); return; }
    this.polling = true;
    let peripheral = null;

    try {
      peripheral = await this.findPeripheral();
      await peripheral.connectAsync();

      const charCache = {};
      const services  = await peripheral.discoverServicesAsync();
      for (const svc of services) {
        const chars = await svc.discoverCharacteristicsAsync();
        for (const c of chars) charCache[c.uuid.replace(/-/g, '')] = c;
      }

      // Authenticate
      const authChar = charCache[UUID_AUTH.replace(/-/g, '')];
      if (!authChar) throw new Error('Auth characteristic not found');
      const pinBuf = Buffer.alloc(4);
      pinBuf.writeUInt32LE(parseInt(this.pin, 10), 0);
      await authChar.writeAsync(pinBuf, true);

      // Read RPM + temperature
      const statusChar = charCache[UUID_STATUS.replace(/-/g, '')];
      if (!statusChar) throw new Error('Status characteristic not found');
      const statusData = await statusChar.readAsync();
      this.currentRPM  = Math.max(0, statusData.readUInt16LE(6));
      this.temperature = Math.round((statusData.readUInt16LE(2) / 6) * 10) / 10;

      // Read sensor characteristic only if humidity or light is enabled
      if (this.showHumidity || this.showLight) {
        const sensorChar = charCache[UUID_SENSOR.replace(/-/g, '')];
        if (sensorChar) {
          const sensorData = await sensorChar.readAsync();
          if (this.showHumidity) this.humidity   = Math.max(0, Math.min(100, sensorData.readUInt8(0) * 2));
          if (this.showLight)    this.lightLevel = Math.max(0.0001, sensorData.readUInt16BE(2));
        }
      }

      // Determine silent hours state:
      // If switch is shown, the user's manual toggle takes priority.
      // If no switch, derive from config schedule based on current time.
      let silentActive = this.silentHours; // default: use switch state
      if (!this.showSilentSwitch && this.silentStart && this.silentEnd) {
        silentActive = this.isWithinSilentHours();
      }

      // Write silent hours to fan on every poll
      const silentChar = charCache[UUID_SILENT.replace(/-/g, '')];
      if (silentChar && (this.showSilentSwitch || (this.silentStart && this.silentEnd))) {
        const buf = Buffer.alloc(5);
        if (this.showSilentSwitch) {
          // Switch mode: enabled flag driven by switch; use config times if set, else 00:00–00:00
          buf.writeUInt8(this.silentHours ? 1 : 0, 0);
          buf.writeUInt8(this.silentStart ? this.silentStart.hour   : 0, 1);
          buf.writeUInt8(this.silentStart ? this.silentStart.minute : 0, 2);
          buf.writeUInt8(this.silentEnd   ? this.silentEnd.hour     : 0, 3);
          buf.writeUInt8(this.silentEnd   ? this.silentEnd.minute   : 0, 4);
        } else {
          // Schedule mode: always enabled, times from config
          buf.writeUInt8(1, 0);
          buf.writeUInt8(this.silentStart.hour,   1);
          buf.writeUInt8(this.silentStart.minute, 2);
          buf.writeUInt8(this.silentEnd.hour,     3);
          buf.writeUInt8(this.silentEnd.minute,   4);
        }
        await silentChar.writeAsync(buf, true);
      }

      // Push to HomeKit
      const speed = this.rpmToPercent(this.currentRPM);
      this.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(speed);
      this.tempService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.temperature);
      if (this.showSilentSwitch && this.silentService)
        this.silentService.getCharacteristic(Characteristic.On).updateValue(this.silentHours);
      if (this.showHumidity && this.humidityService)
        this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.humidity);
      if (this.showLight && this.lightService)
        this.lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(this.lightLevel);

      this.log.info('Poll: RPM=' + this.currentRPM + ' Speed=' + speed +
        '% Temp=' + this.temperature + 'C' +
        (this.showSilentSwitch || (this.silentStart && this.silentEnd) ? ' Silent=' + (silentActive ? 'on' : 'off') : '') +
        (this.showHumidity ? ' Hum=' + this.humidity + '%' : '') +
        (this.showLight    ? ' Light=' + this.lightLevel + 'lx' : ''));

    } catch (err) {
      this.log.warn('Poll error: ' + err.message);
    } finally {
      if (peripheral) { try { await peripheral.disconnectAsync(); } catch (_) {} }
      this.polling = false;
      this.schedulePoll(POLL_MS);
    }
  }

  // Returns true if current time falls within the silent hours window
  isWithinSilentHours() {
    if (!this.silentStart || !this.silentEnd) return false;
    const now     = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const start   = this.silentStart.hour * 60 + this.silentStart.minute;
    const end     = this.silentEnd.hour   * 60 + this.silentEnd.minute;
    // Handle overnight spans e.g. 23:00 → 07:00
    if (start > end) return current >= start || current < end;
    return current >= start && current < end;
  }

  findPeripheral() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        noble.removeListener('discover', onDiscover);
        reject(new Error('Scan timeout for ' + this.mac));
      }, 20000);
      const onDiscover = (periph) => {
        if (periph.address.toLowerCase() === this.mac) {
          clearTimeout(timeout);
          noble.removeListener('discover', onDiscover);
          resolve(periph);
        }
      };
      noble.on('discover', onDiscover);
      noble.startScanning([], false);
    });
  }

  // ── Fan speed write ─────────────────────────────────────────────────────────
  async writeSpeed(percent) {
    if (this.polling) { this.log.warn('Speed write skipped — poll in progress'); return; }
    let peripheral = null;
    try {
      peripheral = await this.findPeripheral();
      await peripheral.connectAsync();
      const charCache = {};
      const services  = await peripheral.discoverServicesAsync();
      for (const svc of services) {
        const chars = await svc.discoverCharacteristicsAsync();
        for (const c of chars) charCache[c.uuid.replace(/-/g, '')] = c;
      }
      const authChar = charCache[UUID_AUTH.replace(/-/g, '')];
      if (!authChar) throw new Error('Auth characteristic not found');
      const pinBuf = Buffer.alloc(4);
      pinBuf.writeUInt32LE(parseInt(this.pin, 10), 0);
      await authChar.writeAsync(pinBuf, true);
      const ctrlChar = charCache[UUID_CONTROL.replace(/-/g, '')];
      if (!ctrlChar) throw new Error('Control characteristic not found');
      const current   = await ctrlChar.readAsync();
      const targetRPM = Math.round((percent / 100) * 2400);
      const buf       = Buffer.from(current);
      buf.writeUInt16LE(targetRPM, 2);
      await ctrlChar.writeAsync(buf, true);
      this.log.info('Speed set to ' + percent + '% (' + targetRPM + ' RPM)');
    } catch (err) {
      this.log.error('writeSpeed failed: ' + err.message);
    } finally {
      if (peripheral) { try { await peripheral.disconnectAsync(); } catch (_) {} }
    }
  }

  rpmToPercent(rpm) {
    return Math.min(100, Math.max(0, Math.round(rpm / 25)));
  }
}

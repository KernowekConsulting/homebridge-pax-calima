# homebridge-pax-calima

**Bring your bathroom fan into Apple Home — no hub, no cloud, just Bluetooth.**

If you have a **Pax Calima** or **Vent-Axia Lo-Carbon Svara** extractor fan, this plugin connects it directly to HomeKit via Bluetooth. Once set up, your fan appears in the Home app with live temperature and fan speed — and you can build automations around all of them.

[![Homebridge 2 Ready](https://img.shields.io/badge/Homebridge-2%20Ready-brightgreen)](https://github.com/homebridge/homebridge/wiki/Updating-To-Homebridge-v2.0)
[![npm](https://img.shields.io/npm/v/homebridge-pax-calima)](https://www.npmjs.com/package/homebridge-pax-calima)

---

## Is this the right plugin for your fan?

This plugin works with fans that connect via the official **Pax** or **Vent-Axia** Bluetooth app. If your fan has a MAC address starting with `58:2b:db`, you're in the right place.

**Confirmed compatible:**
- Pax Calima — Sweden, Norway, Denmark, Finland, Spain, Portugal
- Vent-Axia Lo-Carbon Svara White — UK
- Vent-Axia Lo-Carbon Svara Black — UK

These fans are hardware-identical. The same plugin works for all of them.

---

## What you get in the Home app

Each fan appears as a single accessory with:

- 💨 **Fan speed** — shows current RPM as a percentage, live and accurate
- 🌡️ **Temperature** — live reading, updates every ~20 seconds
- ⚡ **Boost** — a button that triggers the fan's high-speed boost mode
- 🌙 **Silent Hours** — keeps the fan quiet at night; set a schedule, a switch, or both (see below)
- 💧 **Humidity** — available but off by default (read below before enabling)
- 💡 **Light level** — available but off by default (read below before enabling)

> Accessories appear in the **Home app on your iPhone**, not the Homebridge UI accessories tab — that's normal for child bridge plugins.

---

## Before you start

You'll need:
- Homebridge `^1.6.0` or `^2.0.0`
- Node.js `18.20.4` or later
- A Bluetooth adapter on your Homebridge host (the Pi 4's built-in adapter works well)

**Running Homebridge OS on a Raspberry Pi?** There's one extra step after installation. Run this once in the **Homebridge terminal**:

```bash
sudo setcap cap_net_raw+eip /opt/homebridge/bin/node
```

If Bluetooth shows as off after that:

```bash
sudo rfkill unblock bluetooth
```

If things still aren't working after both of those — unplug the Pi, wait 10 seconds, plug it back in. A full power cycle rather than a software restart is sometimes needed to reinitialise the Bluetooth stack cleanly.

---

## Installation

Search for **Pax Calima** or **Svara** in the Homebridge UI and click Install.

Or via terminal:
```bash
npm install -g homebridge-pax-calima
```

---

## Configuration

**You don't need to configure anything to get started.** The plugin finds your fan automatically and registers it in HomeKit.

A full config example with all options:

```json
{
  "platform": "PaxCalima",
  "name": "Pax Calima / Vent-Axia Svara",
  "silentHoursStart": "23:00",
  "silentHoursEnd": "07:00",
  "showSilentSwitch": false,
  "showHumidity": false,
  "showLight": false,
  "fans": [
    {
      "name": "Wetroom Fan",
      "mac": "58:2b:db:xx:xx:xx",
      "pin": "012345"
    }
  ]
}
```

| Setting | Default | What it does |
|---|---|---|
| `silentHoursStart` | — | Time the fan stops boosting at night, e.g. `"23:00"` |
| `silentHoursEnd` | — | Time the fan resumes boosting, e.g. `"07:00"` |
| `showSilentSwitch` | `false` | Adds a Silent Hours switch to the Home app — great for Goodnight scenes |
| `showHumidity` | `false` | Shows humidity tile — read the note below first |
| `showLight` | `false` | Shows light tile — read the note below first |
| `fans[].name` | Auto | Friendly name for a specific fan |
| `fans[].mac` | — | Only needed to assign a custom name or PIN |
| `fans[].pin` | `012345` | 6-digit PIN — only change if set via the official app |

---

## Silent Hours

Silent Hours tells the fan not to boost during a set period — useful for not being woken by a noisy fan at 3am.

**Two ways to use it — pick one or combine both:**

**Schedule (set and forget):** Set `silentHoursStart` and `silentHoursEnd` in your config using 24-hour format. The plugin calculates whether you're in the quiet window on every poll and writes the schedule to the fan automatically. Overnight spans work correctly — `23:00` to `07:00` does what you'd expect.

**Switch (for scenes and shift workers):** Set `showSilentSwitch: true` to add a Silent Hours on/off switch to your accessory. This is ideal for including in a **Goodnight scene** alongside lights and heating — one tap and the fan goes quiet with everything else. It's also the right choice if your sleep schedule changes regularly, like shift work, where a fixed time window doesn't suit.

**Using both together:** If you set a schedule AND enable the switch, the switch takes priority when you toggle it manually. The schedule still runs in the background — useful as a safety net if you forget to turn the switch back on.

---

## A note on humidity and light

Both tiles are **off by default**, and for good reason.

During testing we confirmed that both sensors — while active on the device — don't expose live readings via Bluetooth. The fan uses them internally to decide when to boost, but the BLE characteristic returns the fan's last internal threshold state rather than a continuous measurement. In practical terms:

- With all lights off at 21:20, the fan's Bluetooth still reported **52 lux**
- After a shower that raised the room to **89% humidity**, the Bluetooth still reported **50%**

This isn't a bug in the plugin — it's how the fan's firmware works (confirmed on firmware 02.08, and consistent with observations from the Home Assistant community).

**If you turn them on**, be aware that:
- Asking Siri "what's the humidity in the bathroom?" will likely return a stale number
- Automations based on these values won't fire reliably

**What does work well for shower detection:** when the fan's internal humidity sensor detects a sharp rise, it boosts to near full speed automatically. A `Fan Speed > 75%` automation in Apple Home is a reliable, practical trigger for "shower in use."

If you want to enable humidity or light anyway — perhaps for settled ambient readings — set `showHumidity: true` or `showLight: true` in your config.

---

## Fan speed control — it depends on how your fan is wired

The fan can be installed in two wiring modes:

**Intermittent mode** — the fan is off by default and spins up when triggered. In this mode the speed slider in Apple Home works as expected.

**Always-on (trickle) mode** — the fan runs continuously at a speed managed by its own controller. Speed commands are accepted via Bluetooth but the fan resets to its own setpoint within seconds. The slider shows the current speed accurately but can't override it.

Not sure which mode you have? If your fan is always running — even quietly — you're in always-on mode. In either mode, temperature, fan speed and automations work perfectly.

---

## Something not working?

**Fan not showing up in Home**
Run `hciconfig` in the Homebridge terminal — you should see `UP RUNNING`. If it shows `RF-KILL`, run `sudo rfkill unblock bluetooth`. If still nothing, unplug the Pi and power cycle it.

**setcap not taking effect**
Make sure you're targeting the right binary — on Homebridge OS it's `/opt/homebridge/bin/node`, not the system Node.

**Wrong PIN**
Default is `012345`. If you changed it in the official app, add the fan to the `fans` config array with the correct PIN.

**Speed slider does nothing**
Your fan is in always-on mode — see above. Everything else works normally.

**Humidity or light reading seems stuck**
This is expected firmware behaviour — see the sensor note above.

**Accessories not appearing in Home**
Go to Homebridge UI → plugin settings → Remove Accessory Cache, then restart. They'll reappear within a few seconds.

---

## Homebridge 2 compatibility

This plugin is compatible with Homebridge 2:
- Registered as a dynamic platform
- Waits for `didFinishLaunching` before starting BLE or accessory work
- Uses the Homebridge 2-compatible `Accessory.getServiceById()` API for the optional Silent Hours service
- No analytics, tracking or post-install scripts
- Accessories restore cleanly from cache without re-registration
- Requires Node.js 18.20.4 or later
- Live-tested on Homebridge 2.4.0 (HAP 2.2.2) with Node.js 24.19.0

---

## Release notes

### 2.4.5
- **Fixed:** Homebridge 2 compatibility for the optional Silent Hours switch. Homebridge 2 removed `Accessory.getServiceByUUIDAndSubType()`; both lookups now use the supported `Accessory.getServiceById()` API.
- **Verified:** Live-tested successfully on Homebridge 2.4.0 (HAP 2.2.2) with Node.js 24.19.0 on Homebridge OS.
- No BLE protocol, fan control, sensor mapping, configuration, or accessory behaviour changes.

### 2.4.4
- **Fixed:** Silent Hours time fields no longer show a raw regex pattern as validation hint in the Homebridge UI — replaced with plain human-readable placeholder text (e.g. `23:00`) and a description
- **Improved:** Invalid time format now logs a clear warning message rather than silently disabling the schedule

### 2.4.3
- **Silent Hours** reworked — now supports a config schedule (`silentHoursStart` / `silentHoursEnd`) that runs automatically, an optional HomeKit switch (`showSilentSwitch: true`) for Goodnight scenes and irregular schedules, or both together. The switch takes priority when toggled manually; the schedule runs as a background default. Any existing Silent Hours switch from earlier versions is automatically removed unless `showSilentSwitch` is enabled.
- **Light sensor** (`showLight`) added as opt-in — confirmed via live testing that the characteristic returns a static value regardless of lighting conditions.
- **`showSilentSwitch`**, **`showHumidity`** and **`showLight`** grouped under "Optional Sensors" in the Homebridge UI config for a cleaner settings experience.
- **`displayName`** added to `package.json` — shows correctly as "Vent-Axia Svara / Pax Calima" in the Homebridge UI.
- Sensor characteristic only read when at least one optional sensor is enabled — slightly leaner poll cycle for most users.
- Silent Hours written to fan on every poll — stays in sync after power cuts.

### 2.4.2
- Humidity sensor disabled by default — opt-in via `showHumidity: true`
- README rewritten with a more human tone

### 2.4.1
- Fixed sensors returning stale values — reverted to connect→read→disconnect per poll

### 2.4.0
- Rebuilt with persistent connection architecture

### 2.3.x / 2.2.1 / 2.1.0
- Correct sensor UUIDs and byte mappings confirmed via live device testing
- Homebridge 2.0 initialisation fixes; duplicate accessory registration resolved

### 1.0.x
- Initial releases

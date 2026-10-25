# SvaraHome for Homebridge

Give the fan a boost. Pause it for a quiet moment. Let it return to normal when the time is up.

SvaraHome brings local Bluetooth control for Pax Calima and Vent-Axia Svara fans in Apple Home. No cloud account is needed.

## Set up your fan

Install `homebridge-pax-calima` through Homebridge UI, then open Plugin Config. Add each fan's Bluetooth address and its own six- or eight-digit PIN from the official app. Keep leading zeroes. Close the official app while Homebridge connects.

Use Node 22.12 or later within Node 22, or Node 24, with Homebridge 1.8+ or 2. A working Bluetooth adapter and the normal Bluetooth access for your Homebridge installation are required. A dedicated child bridge is recommended. This plugin does not alter system permissions or install system tools.

```json
{
  "platform": "PaxCalima",
  "name": "SvaraHome",
  "fans": [
    { "name": "Kitchen Fan", "mac": "58:2b:db:12:34:56", "pin": "00123456" }
  ],
  "boostMinutes": 10,
  "boostRpm": 2000,
  "pauseMinutes": 10
}
```

The address and PIN above are examples. Each fan needs its own entry. An empty or invalid configuration does not start Bluetooth discovery. Incorrect fan entries are skipped, with a short explanation in the Homebridge log. There is no fallback PIN or automatic pairing with nearby fans.

## In Apple Home

**Boost** runs the fan at your chosen speed for the configured time. Turn it off to return to automatic ventilation. Turn it on again to start a fresh full duration.

**Pause** stops the fan temporarily. The fan's own timer returns it to automatic ventilation, even if Homebridge disconnects. Turn Pause off to resume sooner. The motor can take several seconds to respond.

Boost and Pause share one manual override: starting one replaces the other. Switching off an already inactive control leaves the other action alone. The switches follow the fan's readback, including actions started in the official app; updates arrive after a successful poll, normally around every ten seconds plus Bluetooth connection time. Home does not show a remaining-time countdown.

Name the switches clearly in Home, such as Kitchen Boost and Kitchen Pause. You can then use scenes or Siri phrases such as “Turn on Kitchen Boost” and “Turn on Kitchen Pause”. Siri wording and tile grouping depend on your Home setup; a custom scene can provide your preferred phrase.

The fan's speed slider starts a temporary manual session using the Boost duration. Nonzero targets range from 1000 to 2500 RPM in steps of 25; percentages below 40% request the minimum 1000 RPM. Zero starts Pause. The displayed percentage follows measured RPM, so it can differ while the motor settles. Turning the fan off starts a timed Pause; turning it on clears an active Pause and returns to automatic ventilation. Automatic mode may still leave the motor idle under its native rules.

Hide either switch in Plugin Config if you prefer fewer tiles. Hiding a switch does not cancel a running action. Temporary controls currently require operating mode 00, the mode tested on the newer Kitchen fan. The plugin refuses controls in other modes and does not change installation modes.

## Quiet hours

Leave both time fields blank to retain the fan's own schedule. To save a new schedule, enter different start and end times in 24-hour format. A changed plugin schedule is applied and checked once. Later changes in the official app are retained across polls and Homebridge restarts.

The optional Silent Hours switch enables or disables that saved schedule while preserving its times. It does not start an immediate quiet period; use Pause for that. Native quiet-hours suppression of automatic boosts has not yet been behaviorally verified by this project.

## Upgrading from 2.4.x

- Retain the existing fan accessory and its Home assignment. Correct each fan's address/PIN in Plugin Config; name-only entries cannot be routed safely.
- The old event-only Boost button is replaced by an actionable switch. Check scenes that referred to the old service. Pause is added by default.
- Temperature, humidity and light tiles are removed. The previous humidity/light values came from a heat-setting characteristic; the previous temperature conversion remains unverified. These values should not drive automations. Old `showHumidity` and `showLight` settings are ignored.
- Speed control now uses temporary manual override, leaving humidity, light and trickle speed presets alone.
- Quiet hours are no longer rewritten on every poll. The switch represents the native schedule's enabled flag.
- No factory reset or accessory-cache reset is required.

## When a fan is unavailable

Home reports a communication failure when authentication fails, readback cannot be confirmed, telemetry is stale or RPM is outside the accepted range. A failed command can still have reached the fan if its reply was lost; the next successful poll reconciles state. The plugin does not retry an uncertain control write automatically. A rejected PIN stops unattended authentication retries; correct the configuration and restart the child bridge, or use an explicit Home command to retry.

Check the fan's address and PIN securely in Plugin Config, Bluetooth range and adapter access, and whether another app is connected. The plugin never prints PINs or raw backend errors. After a timed-out connection, it blocks further sessions until disconnection is known; `BLE_RECOVERY_REQUIRED` may require restarting only the fan child bridge after checking the adapter.

## What has been checked

Device-level trials on the owner's newer eight-digit-PIN Kitchen fan established timed Boost, timed zero-RPM Pause, expiry, early resume and speed changes. All tested settings were restored. The older fan did not confirm authentication, so its controls remain unverified.

The 2.5.0 implementation has automated protocol, queue and native Homebridge-service tests, including replay of recorded telemetry. It has not yet been deployed or tested end to end in Apple Home. See [validation](docs/VALIDATION.md), [release notes](RELEASE_NOTES.md) and [changelog](CHANGELOG.md).

Homebridge verification remains an aim. The SvaraHome logo is bundled for the icon request; Homebridge controls verified status and icon display. See [verification preparation](docs/VERIFICATION.md).

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

Boost, Pause and speed requests remain pending through temporary Bluetooth failures. SvaraHome retries every ten seconds after a failed attempt until readback confirms the request or a newer manual command replaces it. Pending requests survive child-bridge restarts. To cancel a pending Boost, turn Boost off; to cancel a pending Pause, turn Pause off. A request may therefore run when the fan becomes reachable later.

The tiles follow verified fan state, never the pending request. If a reply is lost after a write, a retry first checks whether the requested override is already running, avoiding repeated timer extensions. Siri or HomeKit can time out before recovery; an error from Siri does not cancel the pending request or prove the fan did not receive it. Homebridge logs identify pending requests.

A missed background poll retains the last verified reading only within the existing 45-second freshness limit. Home reports a communication failure when authentication fails, a command fails, telemetry is stale or RPM is outside the accepted range. Rejected authentication, invalid data, an explicitly different control readback and unsupported operating modes stop command retries and need attention. A rejected PIN also stops unattended authentication retries; correct the configuration and restart the child bridge, then issue the request again.

Check the fan's address and PIN securely in Plugin Config, Bluetooth range and adapter access, and whether another app is connected. The plugin never prints PINs or raw backend errors. After a timed-out disconnect, it retries disconnection before allowing another session to use the radio. It waits for scanning to stop before connecting. Persistent adapter failures may still require attention.

## What has been checked

Device-level trials on the owner's newer eight-digit-PIN Kitchen fan established timed Boost, timed zero-RPM Pause, expiry, early resume and speed changes. All tested settings were restored. Both Kitchen and the older Wetroom fan subsequently authenticated and provided telemetry after Wetroom's address and PIN were corrected. Kitchen's pending-command retries were also exercised through HomeKit switches. Wetroom's firmware 02.08 did not confirm the initial 2450 RPM Boost test; compatibility investigation remains in progress.

Version 2.5.0-beta.1 has been published and installed on the owner's Pi. This working branch adds recovery and pending-command fixes beyond that published package, with automated protocol, queue and native Homebridge-service tests. See [live diagnostic evidence](docs/BETA1-LIVE-DIAGNOSTIC.md), [validation](docs/VALIDATION.md), [release notes](RELEASE_NOTES.md) and [changelog](CHANGELOG.md). Brief successful sessions do not establish sustained Bluetooth reliability.

Homebridge verification remains an aim. The SvaraHome logo is bundled for the icon request; Homebridge controls verified status and icon display. See [verification preparation](docs/VERIFICATION.md).

Dependency security: this candidate uses the maintained Noble library. The recorded six high and one critical dependency findings have been removed; fresh audits report zero vulnerabilities. See [security evidence](docs/DEPENDENCY-SECURITY.md).

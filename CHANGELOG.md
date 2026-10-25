# Changelog

[Release notes](RELEASE_NOTES.md) describe the proposed update. Earlier entries record the behaviour reported at the time and are superseded where 2.5.0 corrects it.

## 2.5.0 — Boost and Pause (unreleased)

### Everyday controls

- Added actionable timed Boost and Pause switches, shown by default with individual visibility settings.
- Added early return to automatic ventilation and native timer expiry, with readback after commands.
- Used temporary manual override for the fan speed slider instead of changing a persistent light-trigger preset.
- Made Boost and Pause mutually exclusive, and prevented an inactive switch-off from cancelling the other action.
- Restricted manual controls to the tested operating mode without changing installation settings.

### Reliable communication

- Validated six- and eight-digit PIN strings and confirmed authentication before operating reads or writes.
- Required an explicit fan address/PIN binding; isolated invalid entries and removed default-PIN guessing.
- Queued Bluetooth sessions across all fans, bounded operations, cleaned up scans/connections and retained a recovery gate for late connections.
- Returned HomeKit communication failures for rejected or unconfirmed commands; reconciled current state through subsequent polls and after restart.
- Validated payload lengths and RPM, and stopped presenting stale or implausible telemetry as healthy readings.

### Clearer setup and upgrades

- Preserved fan accessory identities while replacing the non-actionable Boost event service.
- Removed unsupported temperature, humidity and light services, correcting the earlier sensor claims.
- Applied changed native quiet-hours schedules once and preserved later app edits; read back the schedule switch and retained its times when toggled.
- Updated Plugin Config guidance, repository links and Node support; introduced the SvaraHome name, layered house-and-fan artwork and a 100-pixel icon for the verification process.
- Added automated native Homebridge 1/2, protocol, configuration and queue tests, plus replay of recorded device telemetry. Live deployment and Homebridge verification remain pending.

## 2.4.5

- Replaced the removed Silent Hours service lookup with `getServiceById` for Homebridge 2 compatibility.
- Reported live validation on Homebridge 2.4.0 and Node 24.19.0.

## 2.4.4

- Improved Silent Hours time-field hints and invalid-time warnings.

## 2.4.3

- Added schedule configuration, an optional Silent Hours switch and optional light sensor exposure.
- Added plugin display metadata and reorganised settings.
- Wrote Silent Hours during every poll. This behaviour is replaced in 2.5.0.

## 2.4.2

- Disabled the optional humidity tile by default and rewrote setup guidance.

## 2.4.1 / 2.4.0

- Revised Bluetooth connection handling and polling.

## Earlier releases

- Added initial Bluetooth integration, Homebridge lifecycle changes and fan services. Earlier sensor interpretations are corrected in 2.5.0.

# Changelog

[Release notes](RELEASE_NOTES.md) describe the proposed update. Beta entries are consolidated into the stable release when it is promoted; beta history remains in GitHub prereleases and tags.

## 2.5.0-beta.1 — Boost and Pause

### SvaraHome

- Introduced the SvaraHome name across the plugin listing, setup guidance and release copy.
- Added the approved layered house-and-fan logo and prepared a Homebridge icon.
- Retained the existing package identifier and fan accessory identities for upgrade continuity.

### Everyday controls

- Added timed Boost and Pause switches, shown by default with individual visibility settings.
- Added early return to automatic ventilation and readback after control commands.
- Used the fan’s native timer so temporary actions can finish while Homebridge is disconnected.
- Changed the speed slider to temporary manual control, preserving persistent speed presets.
- Made Boost and Pause mutually exclusive and prevented an inactive switch-off from cancelling the other action.
- Restricted manual controls to operating mode 00 without changing installation settings.

### Bluetooth and telemetry

- Added explicit address/PIN routing and validation for six- and eight-digit PINs.
- Required confirmed authentication and stopped unattended retries after a rejected PIN.
- Queued Bluetooth sessions across fans and added bounded operations, connection cleanup and late-connection recovery handling.
- Reported communication failures for unconfirmed commands, stale telemetry and invalid readings.
- Reconciled the fan’s current override through polling and after restart.

### Setup and upgrades

- Replaced the non-actionable Boost event service.
- Removed unsupported temperature, humidity and light services.
- Applied changed quiet-hours schedules once, preserving later official-app edits.
- Updated configuration guidance and supported Node versions.
- Added 32 automated tests covering protocol handling, native Homebridge services, configuration, queues, recorded telemetry and the maintained Bluetooth library’s real classes.

### Dependency security

- Replaced the old Bluetooth dependency with the maintained Noble fork, removing the vulnerable archive and native-build dependency chain.
- Confirmed zero reported vulnerabilities in fresh full and production audits, including a separately resolved Linux ARM64 production tree.
- Added high/critical audit gates and a native-module load check to CI.

### Beta validation

- Automated tests passed across Node 22/24 and Homebridge 1/2.
- Verified isolated native Linux ARM64 installation/loading on the Pi under Node 22/24, without initialising Bluetooth or changing the running bridge.
- Live plugin deployment and older-fan authentication remain outstanding.
- Homebridge verification remains pending.

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

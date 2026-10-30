# Changelog

## 2.6.0-beta.2

- Made CO₂ Clear setup easier to follow, with a checklist for the two automations and help replacing an existing CO₂-to-Boost rule.
- Clarified that ending CO₂ Clear hands back to the fan’s own ventilation, including its humidity response.
- Brought speed and maximum running time together in Plugin Config, with the shorter fan timer under advanced settings.
- Updated the included release notes to match SvaraHome’s everyday voice.
- Kept existing controls, settings and beta.1 automations in place.

## 2.6.0-beta.1

- Added **CO₂ Clear**: extra ventilation when your sensor reports high CO₂, with a return to normal when it reports an acceptable level.
- Kept you in control: using Fan, Boost or Pause takes priority over CO₂ Clear.
- Added a choice of speed and maximum running time, with a one-hour default if the sensor's all-clear never arrives.
- Added a setup guide for the two Home automations, recommending Controller for HomeKit for Netatmo's all-clear rule.
- Added more detail to support logs to help investigate interrupted fan communication.

## 2.5.2

- Now verified by Homebridge.

## 2.5.1

- Set a conservative 2400 RPM default limit for temporary Boost and speed-slider requests, avoiding a rejected high-speed command that can put some fans into Pause. Explicit per-fan limits remain available.

## 2.5.0

- Introduced **SvaraHome**, with a new name and house-and-fan identity.
- Added a working **Boost Fan** switch for timed extra ventilation and early cancellation.
- Made **Fan Off** a timed pause and **Fan On** a return to automatic ventilation from either Pause or Boost. Added **Pause Fan** as an optional separate control.
- Added fan-managed timers so temporary actions can end while Homebridge is disconnected.
- Changed the speed slider to control a temporary session, preserving saved ventilation speed presets. Added an optional requested-speed limit for each fan.
- Updated controls to show confirmed state and measured speed, with communication faults for failed commands or stale/invalid readings.
- Added retries for temporary Bluetooth failures and retention of the newest waiting request across child-bridge restarts. A newer command replaces it; rejected authentication and incompatible responses stop retries.
- Required each fan’s address and its own six- or eight-digit PIN, with authentication confirmed before controls.
- Changed quiet-hours handling to save changed schedules once and preserve later edits made in the official app.
- Removed unsupported temperature, humidity and light tiles, and replaced the old event-only Boost service. Preserved fan accessory identities and room assignments.
- Added support for Node 22/24 with Homebridge 1/2.
- Added setup guidance through the [SvaraHome website](https://homebridge.svarahome.kernowekconsulting.co.uk).

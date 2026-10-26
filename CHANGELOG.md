# Changelog

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

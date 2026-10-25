# Changelog

## 2.5.0 — Unreleased

- Introduce **SvaraHome**, with a new name and house-and-fan identity.
- Add a working **Boost Fan** switch for timed extra ventilation and early cancellation.
- Make **Fan Off** a timed pause and **Fan On** a return to automatic ventilation from either Pause or Boost. Offer **Pause Fan** as an optional separate control.
- Use the fan’s own timer so temporary actions can end while Homebridge is disconnected.
- Make the speed slider control a temporary session, preserving saved ventilation speed presets. Add an optional requested-speed limit for each fan.
- Show confirmed control state and measured speed, with communication faults for failed commands or stale/invalid readings.
- Retry temporary Bluetooth failures and retain the newest waiting request across child-bridge restarts. A newer command replaces it; rejected authentication and incompatible responses stop retries.
- Require each fan’s address and its own six- or eight-digit PIN, with authentication confirmed before controls.
- Save changed quiet-hours schedules once and preserve later edits made in the official app.
- Remove unsupported temperature, humidity and light tiles, and replace the old event-only Boost service. Retain fan accessory identities and room assignments.
- Support Node 22/24 with Homebridge 1/2.
- Provide setup guidance through the [SvaraHome website](https://homebridge.svarahome.kernowekconsulting.co.uk).

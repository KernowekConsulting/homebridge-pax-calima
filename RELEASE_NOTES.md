# SvaraHome 2.5.0-beta.3 — Everyday fan controls

A boost when you need it. A pause when you want it. One familiar way back to normal.

## Fan, with an optional extra

The default controls are now **Fan** and **Boost Fan**. **Pause Fan** remains available as an optional switch for status and automation.

In the Kitchen, try:

- “Siri, turn on Boost Fan in the kitchen.”
- “Siri, turn off the kitchen fan.”
- “Siri, turn on the kitchen fan.”

Turning Fan off starts a timed pause. Turning Fan on returns either Pause or Boost to automatic ventilation. Boost Fan off also cancels a boost early. Automatic ventilation follows the fan's own rules, so resuming does not force a motor that would otherwise be idle.

**Fan Off is temporary.** The fan resumes automatically when its own Pause timer ends, even if Homebridge disconnects. The default is 10 minutes; choose your preferred duration in Plugin Config. Apple Home's Off label does not explain that timer.

## Upgrading

Existing fan identities and room assignments are retained. An explicitly enabled Pause switch stays enabled; turn off **Show Pause Fan in Apple Home** if you want the simpler layout. Check scenes before hiding a switch, as hiding removes that service.

The controls now advertise Boost Fan and Pause Fan. Apple Home may retain a customised tile name; rename it there if necessary. No factory reset or re-pairing is required.

Pending requests, readback confirmation and per-fan speed limits continue from beta.2. Fan On can now replace a waiting request with return-to-automatic, including across a child-bridge restart. Failed commands report a communication fault rather than an assumed success; Siri may still time out before Bluetooth recovers.

## Links and validation

The homepage remains the [SvaraHome website](https://homebridge.svarahome.kernowekconsulting.co.uk). The GitHub issue-tracker link is restored so Homebridge can discover release notes. Linked redacted evidence is included in the package.

Homebridge's Plugin Homepage button still reads the stable release's metadata; its correction is held for full 2.5.0 as agreed. This beta does not change the stable channel.

Automated tests cover the new native Homebridge controls, migration, return-to-automatic and recovery. Earlier live fan evidence covers the underlying Boost, Pause and cancellation commands. Exact Siri recognition and the new presentation remain acceptance checks in your Home.

Homebridge verification remains pending.

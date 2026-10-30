# SvaraHome 2.6.0-beta.1

**Trial release — keep stable installations on 2.5.2.**

- **CO₂ Clear** is a third control alongside timed Boost and Pause. A High/On demand renews bounded fan timers; Clear/Off releases its override. Manual control takes priority.
- Default output: 2400 RPM/96%, respecting lower per-fan limits; 15-minute fan timers and a 60-minute maximum session. Restart does not resume old demand.
- Improved command/Bluetooth diagnostics and startup source fingerprints help identify the running code and failed stages.

**Setup dependency:** CO₂-clear rules require a capable HomeKit automation editor. We explicitly recommend Controller for HomeKit; Apple Home's Netatmo CO₂ editor exposes only High. The beta uses the Netatmo's built-in 1600 ppm **Carbon dioxide Detected Yes/No** rules. The plugin does not poll sensors or Apple Home. See [beta setup and rollback](docs/CO2-CLEAR-BETA.md).

Existing Boost/Pause behaviour and accessory identities are preserved. This beta has simulated state-machine and HomeKit tests; real sustained-high, clear, sensor-loss and restart behaviour remains to be validated on the owner's installation. No claim that the intermittent Bluetooth or Netatmo network faults are resolved.

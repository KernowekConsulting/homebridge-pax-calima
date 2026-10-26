# SvaraHome 2.5.1

A small maintenance update to SvaraHome 2.5. Temporary Boost and speed-slider requests now use a conservative **2400 RPM default limit**, avoiding a rejected high-speed command that can put some fans into Pause. Explicit per-fan limits remain available; only raise them to a speed verified to work on your fan.

All the everyday controls introduced in 2.5.0 remain:

## SvaraHome 2.5 — Your fan, at home

A boost when you need it. A quiet moment when you want one. An easy way back to normal.

Meet **SvaraHome**: a new name, a new look and more useful everyday control of your Pax Calima or Vent-Axia Svara fan in Apple Home.

### Familiar controls

**Fan** is your everyday control. Turn it off for a timed pause; turn it on to return to automatic ventilation, whether the fan was paused or boosted.

**Boost Fan** gives ventilation a temporary lift at your chosen speed and duration. The fan’s own timer returns it to automatic operation, even if Homebridge disconnects. Turn Boost Fan off to return sooner.

Try “Siri, turn on Boost Fan in the kitchen”, using the names and rooms in your Home. A separate **Pause Fan** switch is optional for status and automations.

The speed slider now starts a temporary session, leaving your saved ventilation speed presets in place. Each fan can have its own requested-speed limit.

### Clearer feedback, less maintenance

Controls reflect the fan’s confirmed state and measured speed. Failed commands or stale readings show a communication fault, so an unconfirmed request is not presented as success.

Temporary Bluetooth interruptions no longer mean repeating your request: SvaraHome retries and keeps your latest instruction, including across child-bridge restarts. Siri may time out before recovery; a waiting request can still run when the fan reconnects.

Quiet-hours schedules are saved when you change their times. Later schedule changes in the official app are respected.

### Before you upgrade

- Give every fan its own Bluetooth address and correct six- or eight-digit PIN in Plugin Config. Close the official app while Homebridge connects.
- Boost and Pause use the durations in SvaraHome’s Plugin Config, both 10 minutes by default. They do not inherit the countdown selected in the official app. Fan Off is temporary: automatic ventilation resumes when the Pause timer ends.
- Existing fan identities and room assignments are retained. Check scenes that used the old Boost event service, which is replaced by the working Boost Fan switch.
- Temperature, humidity and light tiles are removed because they were not verified ambient measurements.
- Use Node 22.12 or later within Node 22, or Node 24, with Homebridge 1.8+ or 2. After saving configuration, use Restart Child Bridge on SvaraHome’s plugin card.

Setup guidance and support are at the [SvaraHome website](https://homebridge.svarahome.kernowekconsulting.co.uk).

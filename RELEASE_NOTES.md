# SvaraHome 2.5.0 — Your fan, at home

A boost when you need it. A quiet moment when you want one. An easy way back to normal.

SvaraHome brings timed fan controls into Apple Home for Pax Calima and Vent-Axia Svara.

## Familiar controls

**Fan** is your everyday control. Turn it off for a timed pause; turn it on to return to automatic ventilation, whether the fan was paused or boosted.

**Boost Fan** gives ventilation a temporary lift at your chosen speed. Its timer returns the fan to automatic operation, even if Homebridge disconnects. Turn Boost Fan off to return sooner.

Try “Siri, turn on Boost Fan in the kitchen”, using the names and rooms in your Home. A separate **Pause Fan** switch is optional for status and automations.

The speed slider now starts a temporary session, leaving your saved ventilation speed presets in place. Each fan can have its own requested-speed limit.

## Clearer feedback, less maintenance

Controls follow the fan’s confirmed state and measured speed. Temporary Bluetooth interruptions are retried; a newer command replaces a waiting request. Siri may time out before recovery, and a waiting request can run when the fan reconnects.

Quiet-hours schedules are saved when you change their times. Later schedule changes in the official app are respected.

## Before you upgrade

- Give every fan its own Bluetooth address and correct six- or eight-digit PIN in Plugin Config. Close the official app while Homebridge connects.
- Fan Off is temporary: ventilation resumes when the Pause timer ends. The default is 10 minutes; choose your preferred duration in Plugin Config.
- Existing fan identities and room assignments are retained. Check scenes that used the old Boost event service, which is replaced by the working Boost Fan switch.
- Temperature, humidity and light tiles are removed because they were not verified ambient measurements.
- Use Node 22.12 or later within Node 22, or Node 24, with Homebridge 1.8+ or 2. After saving configuration, use Restart Child Bridge on SvaraHome’s plugin card.

Setup guidance and support are at the [SvaraHome website](https://homebridge.svarahome.kernowekconsulting.co.uk).

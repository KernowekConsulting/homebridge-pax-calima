# SvaraHome for Homebridge

[![Verified by Homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=flat)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

<img src="assets/svarahome.png" alt="SvaraHome’s blue house and fan logo" width="160">

Give the fan a boost. Pause it for a quiet moment. Let it return to normal when the time is up.

SvaraHome brings local Bluetooth control for Pax Calima and Vent-Axia Svara fans into Apple Home through your Homebridge host. No SvaraHome cloud account is needed.

[Website and support](https://homebridge.svarahome.kernowekconsulting.co.uk) · [Plugin on npm](https://www.npmjs.com/package/homebridge-pax-calima) · [Release notes](RELEASE_NOTES.md)

**Trial build: SvaraHome 2.6.0-beta.1.** Adds optional **CO₂ Clear**, alongside the existing timed Boost and Pause controls. Stable users should stay on `latest` (2.5.2); this beta is for a supervised trial. See the [CO₂ Clear beta guide](docs/CO2-CLEAR-BETA.md).

## What you get in Apple Home

| Control | What it does |
| --- | --- |
| **Fan** | Shows measured speed as a percentage. Off starts a timed pause; On returns either Pause or Boost to automatic ventilation. |
| **Boost Fan** | Runs the fan at your chosen speed for a limited time. Turn it off to return sooner. Shown by default. |
| **CO₂ Clear** | Separate CO₂ demand switch, shown by default and initially Off. Renews bounded ventilation until cleared or its maximum session ends. Requires both High and Clear automations; see setup below. |
| **Pause Fan** | Optional separate pause switch for status and automations. Hidden by default unless explicitly enabled. |
| **Silent Hours** | Optional switch for the fan’s saved quiet-hours schedule. It does not start an immediate pause. |

**Fan Off is a timed pause, not a permanent shutdown.** The default is 10 minutes; choose the duration in Plugin Config. The fan’s own timer resumes automatic ventilation even if Homebridge disconnects. Apple Home’s Off label does not show that timer.

Boost and Pause share one temporary override. Starting either replaces the other. Turning the main Fan on returns to automatic ventilation; automatic operation can still leave the motor idle under the fan’s own rules.

The displayed speed comes from measured RPM. It can differ from the requested percentage while the motor settles. The speed slider starts a temporary session using the Boost duration; it leaves persistent ventilation speed presets in place. A zero-speed request starts the timed pause. Low nonzero requests use the supported minimum of 1000 RPM.

Temperature, humidity and light are **not exposed as ambient sensors**. SvaraHome does not provide a shower-detection sensor or infer room conditions from fan speed.

## CO₂ Clear: read before enabling an automation

CO₂ Clear is a third control. **It does not read your sensors, poll Apple Home, or infer CO₂ from motor speed.** With no automation sending On, it remains inactive. Ordinary timed Boost and Pause do not require a sensor or an additional app.

For this beta we explicitly recommend **Controller for HomeKit** to configure the CO₂-clear rule. Apple Home's Netatmo CO₂ editor offers only the high warning; it does not offer a CO₂-clear trigger. Controller is an additional app and may require its own licence. Customers should check that dependency before choosing CO₂ Clear. Use regular HomeKit automations in Controller, not its separate Workflows/Controller Hub feature.

The beta uses the Netatmo's existing **Carbon dioxide Detected** flag: **Yes → CO₂ Clear On**, **No → CO₂ Clear Off**. Netatmo documents its built-in high threshold as above **1600 ppm**. No custom numeric threshold is introduced. Use **Carbon dioxide Detected**, not the separate Air Quality measurement (which combines several measurements). A real rising/falling test is still required; selecting a trigger in an editor alone is not end-to-end validation.

Default CO₂ Clear output is 2400 RPM (96% on the 2500 RPM scale), also capped by each fan's configured limit. It renews a 15-minute fan timer halfway through its verified remaining time, with a 60-minute maximum demand session. Repeated On does not extend that session. Clear requests return to automatic ventilation; manual Fan, Boost, Pause or slider actions cancel CO₂ Clear renewal and take priority. Restarting Homebridge does not resume a previous High; any existing finite fan timer can run to expiry.

**A missing Clear is not proof that CO₂ remains high.** The maximum session bounds that uncertainty. At the limit CO₂ Clear turns Off and requests automatic ventilation even if CO₂ is still high; it does not claim the air is acceptable. A new explicit On is needed to start another session. In this MVP link only one CO₂ source to each fan. See the [setup, limitations, trial checks and rollback guide](docs/CO2-CLEAR-BETA.md).

## Use your own words

Assign each fan to its room in Apple Home. In a room named Kitchen, try:

- “Siri, turn on Boost Fan in the kitchen.”
- “Siri, turn off the kitchen fan.”
- “Siri, turn on the kitchen fan.”

Siri recognition depends on your actual accessory names and room assignments. Apple Home may retain a customised tile name; rename an existing control there if needed. You can also include the controls in your own scenes and automations.

Apple Home may show the controls together or as separate tiles, depending on its presentation settings. Homebridge’s Accessories page can also show child-bridge accessories when UI accessory control is available; check its bridge filter.

## Get started

You need Homebridge 1.8 or later within version 1, or Homebridge 2; Node 22.12 or later within Node 22, or Node 24; and a working Bluetooth adapter with the normal Bluetooth access for your Homebridge installation.

1. Install or update `homebridge-pax-calima` through Homebridge UI.
2. Open Plugin Config. Add each fan’s Bluetooth address and its own six- or eight-digit PIN from the official app. Keep leading zeroes. There is no default PIN or automatic pairing with nearby fans.
3. Choose the Boost speed/duration and Pause duration. Close the official app while Homebridge connects.
4. Save and use **Restart Child Bridge** on SvaraHome’s plugin card. A dedicated child bridge is recommended; pair it with Apple Home if it is not already paired.
5. Assign each fan to its room in Apple Home and check its controls.

Temporary controls require a supported fan operating mode. SvaraHome does not change the fan’s installation mode. A factory reset or accessory-cache reset is not part of normal setup or upgrading.

If you manage plugins from a terminal, install `homebridge-pax-calima@latest`. Prefer Homebridge UI when it manages your installation.

## Configuration

```json
{
  "platform": "PaxCalima",
  "name": "SvaraHome",
  "fans": [
    {
      "name": "Kitchen Fan",
      "mac": "58:2b:db:12:34:56",
      "pin": "00123456"
    }
  ],
  "boostMinutes": 10,
  "boostRpm": 2000,
  "pauseMinutes": 10,
  "showBoostSwitch": true,
  "showPauseSwitch": false
}
```

The address and PIN are examples. Use your own fan’s details. A Bluetooth address prefix alone does not establish compatibility. Empty or unusable configuration does not start Bluetooth discovery.

| Setting | Purpose |
| --- | --- |
| `fans[].name` | Name for a newly added fan. Existing accessory identities and Home room assignments are retained. |
| `fans[].mac` / `fans[].pin` | Required address and PIN for that particular fan. |
| `boostMinutes` / `boostRpm` | Temporary Boost duration and requested speed. Defaults: 10 minutes and 2000 RPM. |
| `pauseMinutes` | Timed pause duration, including when the main Fan is turned off. Default: 10 minutes. |
| `showBoostSwitch` | Show Boost Fan. Default: `true`. |
| `co2ClearEnabled` | Show the separate CO₂ Clear demand control. Default: `true`; always initially Off. |
| `co2ClearRpm` | Requested CO₂ Clear speed; default 2400 RPM, range 1000–2400 in 25 RPM steps, also limited by the fan ceiling. |
| `co2ClearLeaseMinutes` | Finite fan timer renewed while demand is active; default 15, range 1–15 minutes. |
| `co2ClearMaxMinutes` | Maximum demand session; default 60, range 1–240 minutes. Repeated On cannot extend it. |
| `showPauseSwitch` | Show the separate Pause Fan switch. Default: `false`; an explicitly enabled setting stays enabled. |
| `fans[].maxManualRpm` | Optional per-fan limit for Boost and slider requests. Leave blank for a conservative 2400 RPM target limit. Only raise it to a speed verified to work on your fan. This does not cap displayed measurement or alter permanent presets. |
| `silentHoursStart` / `silentHoursEnd` | Optional saved quiet-hours schedule, in 24-hour format. Set both times, or leave both blank to retain the fan’s own schedule. |
| `showSilentSwitch` | Show the saved schedule’s enable/disable switch. Default: `false`. |

Boost and Pause durations accept 1–60 minutes. Boost speeds and per-fan target limits accept 1000–2500 RPM in steps of 25. Fans can differ in which targets they accept.

Changing quiet-hours times saves and checks the schedule once. Routine polling respects later schedule changes made in the official app. The Silent Hours switch enables or disables that saved schedule; use Fan Off for an immediate timed pause. Quiet-hours behaviour still depends on the fan’s firmware and settings.

Hiding an optional switch removes its service. Check scenes and automations that use it before changing visibility; hiding it does not cancel a running override.

## If a fan is unavailable

Check its address and PIN privately in Plugin Config, Bluetooth range/adapter access, and whether the official app is still connected. Start with the Homebridge log’s fan-specific message; do not reset the accessory cache or power-cycle the Pi as a routine first step.

Temporary connection failures leave the newest manual request waiting for retry. A waiting request can start later when the fan reconnects. Turn the main Fan on to replace it with return-to-automatic. Siri may time out before recovery; that timeout does not cancel the waiting request.

This also covers Pause On, Pause Off and returning to automatic ventilation. SvaraHome waits ten seconds after a failed attempt before retrying; requests share one Bluetooth queue, so delivery can take longer. Pending requests survive a child-bridge restart, and a newer manual command replaces the older request. A lost reply is checked against the running timer before resending, so recovery does not keep restarting the timer. Rejected credentials, invalid commands and mismatched fan readbacks stop retries and need correction.

Tiles follow confirmed fan state. Background readings are retained only within a 45-second freshness limit; failed commands, stale data and invalid readings report communication faults. A rejected PIN stops unattended authentication retries: correct the saved details, restart the child bridge, then try again.

If Boost fails with `COMMAND_NOT_CONFIRMED`, check the requested and received values in the log. Some fans return a timed Pause when they reject a high RPM target. Set that fan’s **Maximum Manual RPM** to a speed verified to work, then restart its child bridge. Clear any resulting Pause to return to automatic ventilation. A mismatched readback stops the request rather than repeatedly sending the rejected target.

For sensor automations, select **Boost Fan → Turn On**. The main **Fan → On** returns to automatic ventilation. Home’s **Test This Automation** lets you check the saved action separately from a new sensor event.

## Upgrading to 2.5

Keep the existing fan accessory and its room assignment. Check each fan’s address/PIN and any scenes that used the previous Boost event service. Boost is now an actionable **Boost Fan** switch; **Pause Fan** is optional. Unsupported temperature, humidity and light services are removed, and the speed slider now controls a temporary session.

An explicitly enabled Pause switch remains enabled after upgrading. Turn off **Show Pause Fan in Apple Home** if you prefer only Fan and Boost Fan. No re-pairing is normally required.

## About the project

SvaraHome is independent of Apple, Homebridge, Pax and Vent-Axia. **Homebridge verification was granted on 28 October 2026.** Homebridge controls the verification badge and central plugin icon; bundling the SvaraHome artwork does not grant either.

For help, start with the [SvaraHome website](https://homebridge.svarahome.kernowekconsulting.co.uk) or [GitHub issues](https://github.com/KernowekConsulting/homebridge-pax-calima/issues). [Validation evidence](docs/VALIDATION.md) and [verification preparation](docs/VERIFICATION.md) are available separately.

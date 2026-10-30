# CO₂ Clear — 2.6.0-beta.2 trial

CO₂ Clear is a separate third control alongside timed Boost Fan and Pause Fan. It maintains a bounded ventilation request between High and Clear events. The existing fan accessory identities, room assignments and ordinary controls are retained.

## Before you start

CO₂ Clear needs a pair of Home automations: **CO₂ high → CO₂ Clear On**, and **CO₂ acceptable → CO₂ Clear Off**. Check both rules before relying on it.

**CO₂ Clear Off ends extra ventilation, not ventilation needed for humidity.** The fan returns to its own automatic control and may keep running. Never use main Fan Off or Pause as the all-clear action: those request a timed pause. CO₂ Clear has no humidity measurement and does not change the fan’s humidity settings.

If the new control is missing in Controller after an upgrade, close and reopen Controller first. That refreshed the accessory list during this trial without changing the fan, pairing or Homebridge. A stale third-party list is not a reason to reset accessories.

In Plugin Config, the main CO₂ Clear section holds visibility, speed and maximum running time. The shorter disconnect timer is under the collapsed advanced-timer section. Saved settings and existing Home automations are retained when upgrading from beta.1; do not create duplicate rules if the correct pair already exists.

## Required automation editor: decide before using this feature

**Apple Home alone does not expose the Netatmo CO₂-clear automation event. For this beta we explicitly recommend Controller for HomeKit to create that rule.** Controller is an additional app; check its current licensing and Home access requirements. This is an optional feature dependency, not an assumption that customers already have it. Ordinary timed Boost and Pause need neither Controller nor a CO₂ sensor.

Use the regular **HomeKit Automations** editor, not Controller Workflows. These are HomeKit rules for the existing Apple Home hub; this design does not require a separate Controller Hub or SvaraHome cloud account. Other editors are not validated by this beta.

On 30 October, read-only inspection of the owner's Netatmo Kitchen Climate showed:

- Apple Home's CO₂ event editor offers only **Detects High Carbon Dioxide**.
- Controller's editor exposes **Carbon dioxide Detected = No** as a **Value is** start event. At inspection the sensor reported No and 916 ppm.
- Both inspections were cancelled without saving rules or sending fan commands.

This establishes an editable clear rule and a readable normal state, not delivery of a real high-to-normal notification. That transition must be demonstrated during the live trial. Netatmo's [official HomeKit guide](https://helpcenter.netatmo.com/hc/en-us/articles/360010067180-What-can-you-do-with-a-Station-paired-with-Apple-HomeKit) documents detected/high above **1600 ppm**. The owner chose to retain this built-in flag, with no custom 1500 ppm threshold. A warning notification and a characteristic state-change event are different things; no separate normal notification banner is required for an automation.

## Rules to configure for the trial

First install the beta and confirm both ordinary controls remain functional. Check the fan and room, verify the High scene contains only CO₂ Clear On and the Clear scene only CO₂ Clear Off, and confirm both rules are enabled without unintended time or presence restrictions. Do not run an existing CO₂-to-Boost rule alongside the new CO₂ Clear rule: the newer ordinary Boost command would intentionally take priority and cancel CO₂ Clear renewal. Record the old rule so it can be restored for rollback.

For **one CO₂ sensor and one fan**:

1. **High:** Kitchen Carbon Dioxide Sensor detects High → Kitchen CO₂ Clear On. Apple Home's existing High trigger is suitable. Leave Home's delayed **Turn Off** timer disabled for this CO₂ Clear rule; the Clear rule and plugin session limit handle termination.
2. **Clear:** in Controller → Automations → Add Start Event → Accessory → Kitchen Climate → Carbon Dioxide Sensor → **Carbon dioxide Detected** → **Value is No**. Action: Kitchen **CO₂ Clear Off**. Select the CO₂ Clear switch, not Fan Off (which would pause ventilation). Create/save the rule only as part of the agreed trial setup.
3. Review both rules, the selected Home, fan and sensor, and any time/presence restrictions. A sensor that is already High at setup will not necessarily produce a new High transition; a deliberate manual CO₂ Clear trial is separate from a real sensor-trigger test.

Use the Detected flag, not **Air Quality**. Netatmo's Air Quality combines CO₂, temperature and humidity and is not an equivalent CO₂-clear measurement. The MVP does not aggregate multiple sensors: several independent Clear rules could clear another sensor's active demand. Multi-sensor demand arbitration is deferred.

## Settings and behaviour

| Setting | Default | Allowed values |
|---|---:|---|
| co2ClearEnabled | true | true/false; shows the third switch, initially Off |
| co2ClearRpm | 2400 | 1000–2400 RPM, steps of 25; also capped by each fan's maxManualRpm |
| co2ClearLeaseMinutes | 15 | 1–15 minutes |
| co2ClearMaxMinutes | 60 | 1–240 minutes |

2400 RPM is 96% on the plugin's 2500 RPM display scale. Measured motor speed remains a separate reading. CO₂ Clear starts a finite fan timer, confirms its readback, and renews halfway through the reported remaining time. The last timer is shortened to the remaining maximum-session budget. Repeated On does not restart or extend that maximum session. Boost's ordinary duration/speed configuration remains separate.

CO₂ Clear On means the demand session is armed; it is not a CO₂ reading or a claim that every Bluetooth operation succeeded. Failed commands retain existing communication-error/retry behaviour. Receipt, pending/retry, confirmed timer, renewal, cancellation and cap events are logged. A Clear/Off stops renewal immediately and requests release of its owned override. The existing Boost/Pause switches and measured speed show actual verified fan state; demand Off alone is not proof that the release command has reached the fan.

Manual Fan On/Off, Boost, Pause or speed-slider commands cancel CO₂ Clear renewal and take priority. A later CO₂ Clear Off does not cancel those replacement requests. Recognisable native-app changes (Pause, a different boost speed, or early return to automatic) also end demand. The BLE protocol has no ownership tag: an out-of-band app command with the identical speed/timer cannot always be distinguished. Avoid simultaneous control from the native app during the beta test.

## Missing sensor, restart and maximum session

The plugin **does not poll Apple Home or the sensor** and cannot determine freshness from a latched High. If the sensor/network/Home hub fails before Clear, CO₂ Clear keeps renewing only within its configured maximum session. At that limit it turns demand Off and requests automatic ventilation, even if CO₂ has not cleared. It does not report that the air is acceptable. A new explicit On is required to start another session; old High is not replayed automatically.

If Homebridge shuts down, renewals stop; the last finite fan timer expires naturally within the configured lease. Restart never restores a previous High or an air-renewal request. A pending ordinary Boost/Pause request retains its existing restart behaviour. A pending CO₂ Clear release is not retried indefinitely: its cleanup window is bounded by a lease, after which the native timer is the fallback. A command already dispatched over BLE can complete after a newer demand arrives; the queued latest request reconciles that state.

Switching CO₂ Clear off in configuration removes its control and stops future renewals after the child restart. An existing fan timer can run to expiry. Do not hide the control before reviewing the Home rules that reference it.

## Proposed supervised checks

These are trial steps, not claims of tests already performed on live fans:

1. Preserve configuration and exact installed 2.5.2 package/source, record its checksums and confirm a source-only recovery route. Preserve cached accessories and room identities; do not reset pairing.
2. Install the beta only on SvaraHome and restart only its child bridge when authorised. Check startup version/source fingerprints, both connections, unchanged Boost/Pause service identities, CO₂ Clear initially Off and no old demand re-armed.
3. For a shorter observation, set a one-minute lease and three-minute maximum session, retain the verified RPM ceiling, then manually send CO₂ Clear On. Confirm the initial native timer, at least two renewals beyond its first expiry, Off release and return to automatic via readback. Restore the intended 15/60-minute settings afterwards with the agreed child restart.
4. Test manual Pause during demand, then a delayed Clear: Pause must remain in force. Verify ordinary Boost and Fan On still work and that the old air renewal cannot reappear.
5. With a native humidity demand present, verify that CO₂ Clear Off releases only its own extra ventilation and leaves automatic humidity ventilation available. Readback returning to automatic is the check; a stopped motor is not required. If CO₂ Clear has never been On, an Off should not send a fan command.
6. Correlate a natural High transition with receipt and confirmed fan timer. Then correlate the actual Detected Yes→No transition with CO₂ Clear Off receipt and confirmed release. Home's Test Automation action proves only that rule's action path, not the real sensor transition. Do not manufacture CO₂ exposure or falsify readings.
7. Observe source loss/missing Clear and the maximum-session cutoff, plus a bounded restart check. Do not disrupt the live Home hub, Pi radio or other plugins to manufacture a failure without a separate agreed test.

The owner's Netatmo network instability remains an upstream fault. This beta does not repair it or the underlying Bluetooth discovery failures. The existing patient retries remain; no unproven wake delay, adapter reset, new sensor API or changed PIN handling is included.

## Rollback

Stop CO₂ Clear and confirm its native manual override is released, or allow the finite lease to expire if it cannot be reached. Disable only the new High/Clear rules. Restore the exact backed-up stable plugin/configuration, preserving Homebridge accessory cache and fan identities, and restart only the SvaraHome child bridge. Confirm both fans reconnect and no CO₂ Clear renewal survives. Restore the prior CO₂-to-timed-Boost rule only after confirming the beta rules are disabled. Returning to stable removes the new CO₂ Clear service, so its Home rules need to remain disabled or be deleted deliberately.

No beta package installation, fan commands or Home rule changes were performed while preparing this build. The owner is independently updating stable 2.5.2. Beta publication, trial installation and live control checks must be separately recorded; automated tests are not live acceptance.

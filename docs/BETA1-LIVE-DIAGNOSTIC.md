# beta.1 live diagnostic — 25 October 2026

Read-only examination through the existing authenticated Homebridge terminal, approximately 09:29–09:32 local time. No restart, configuration change, extra BLE connection, fan write or deployment performed.

## KEY SUMMARY

- Installed plugin: 2.5.0-beta.1, confirmed by package metadata and Homebridge UI.
- Wetroom Fan configuration contains only `name` and `pin`. PIN is a six-character string; no MAC address is configured. Startup explicitly reports `FAN_ADDRESS_REQUIRED`. Its cached accessory remains present with fan, Boost and Pause services.
- Kitchen Fan configuration contains `name`, `mac` and `pin`. Address format is valid and PIN is an eight-character string. Successful snapshot publication is evidenced by communication-restored messages, followed by transport failures and stale telemetry.
- Latest observed SvaraHome log event was `BLE_RECOVERY_REQUIRED` at 09:25:50. Home screenshots around 09:27 show switch values and fan tiles Updating; those screenshots alone do not demonstrate fresh telemetry or working controls.
- Adapter read returned RX/TX error counters of zero and an existing LE connection. This establishes neither a healthy GATT session nor ownership of that connection.
- No evidence warrants a whole-Pi power cycle as the first remedy. Wetroom's missing binding must be resolved separately. Kitchen requires investigation of disconnect/recovery behaviour.

## Observed fan log sequence

| Local time | Event |
| --- | --- |
| 09:22:19 | FAN_ADDRESS_REQUIRED; initial BLUETOOTH_NOT_READY |
| 09:22:23 | Communication restored |
| 09:23:23 | BLE_OPERATION_FAILED; BLE_RECOVERY_REQUIRED |
| 09:24:00 | TELEMETRY_STALE |
| 09:24:03 | BLE_RECOVERY_REQUIRED |
| 09:24:46 | Communication restored |
| 09:25:10 | BLE_OPERATION_FAILED |
| 09:25:20 | BLE_RECOVERY_REQUIRED |
| 09:25:44 | TELEMETRY_STALE |
| 09:25:50 | BLE_RECOVERY_REQUIRED |

The logs do not identify the fan per event. Attribution of transport activity to Kitchen follows from Wetroom being excluded during configuration validation; it is an inference, rather than an explicit log label.

## Source inspection

Transport serializes sessions and refuses a new one while a prior connection is unresolved or its peripheral is not disconnected. Disconnect is attempted in the session's finally block. If it times out, subsequent attempts only check the recovery gate; they do not actively retry disconnect. This can leave polling blocked indefinitely. The underlying first BLE error is reduced to a generic code, so these observations do not establish its cause.

Fan and switch services are present in the persisted cache. Home's displayed switch names do not distinguish Boost from Pause despite distinct service names in that cache; this is a separate usability issue to investigate.

No PIN values or full Bluetooth addresses are retained here.

## Local hotfix and follow-up

The owner authorised correction. A private backup of the original configuration and changed plugin files was created on the Pi at `svarahome-hotfix-backup-20261025-093309`. Wetroom's missing address was filled from the single unmatched cached accessory after checking that exactly one configured fan lacked an address. Fan identities and PIN values were preserved.

Local hotfix changes (not yet a published npm release):

- Retry a stalled disconnect before the next session, continuing to block new connections if recovery cannot be confirmed.
- Avoid disconnecting a peripheral already reported disconnected; Noble otherwise changes it back to disconnecting and may wait for an event that will never arrive.
- Await acknowledged scan stop before connecting or handing the radio to the next session.
- Supply explicit ConfiguredName values for Boost and Pause and identify each accessory in recovery/error logs.

All 48 tests pass across Node 22/24 and Homebridge 1/2. These include stalled-disconnect recovery, failure to recover, dropped connections, acknowledged scan stop, scan-stop timeout, transient background failures with a strict freshness limit, automatic command retries, supersession, restart persistence, lost-confirmation timer preservation, protected writes after authentication processing and per-fan target limits with uncapped measured telemetry.

Both modified files were hash checked against locally tested source before deployment. SvaraHome's child bridge alone was restarted to activate each hotfix stage. No whole-Pi reboot or fan control/configuration command was issued by the diagnostic workflow. Existing configured quiet-hours behaviour remains part of normal plugin polling.

At 09:35, passive monitoring observed 182 Kitchen address mentions and zero Wetroom address mentions over 16 seconds, plus two scan-enable Command Disallowed responses. Neither configured fan had an existing Pi LE connection at the start of that observation.

The owner then confirmed the official app was open and would close it. Subsequent logs show Wetroom AUTH_REJECTED at 09:36:12 and Kitchen communication restored at 09:36:16. At 09:36:55 no newer Kitchen fault had been logged. This supports renewed Kitchen communication; it is not yet sustained reliability validation.

The owner subsequently confirmed Wetroom's saved PIN was incorrect and was directed to correct it privately in Homebridge Plugin Config. The user was editing that form during follow-up; automation yielded to avoid interfering with credential entry.

Final deployed hotfix source fingerprints:

- `lib/transport.js`: `5c4220af7c69629859427b0250e248ae6359353286eacbe635c710ccbc9ae051`
- `lib/accessory.js`: `a3bfc5ded2fa2fb2a08b1e3eadfb45231924024ec402d86de787ce8f4f6ed2bb`
- `lib/platform.js`: `395db1bafe8f9d2a5fd6618ee62ced7da38afb1da4a49088882bfbb20b31ced4`
- `config.schema.json`: `764cb5a906cfdd0b993a7574e4b42ef1b2cad90c54849c05ec5045334ca80189`

The child bridge restart was requested after the second source update; final live verification remains pending after the owner's configuration edit.

The owner confirmed the correct Wetroom PIN was saved and the bridge restarted. At 09:40:43 both installed source hashes matched the tested final hotfix. The latest logs showed Wetroom communication restored at 09:40:10 and Kitchen restored at 09:40:14. No newer failures were present at that check. Earlier Kitchen errors at 09:38:16 and 09:39:36 recovered automatically at 09:38:30 and 09:39:49 respectively; this validates retry recovery in operation, while intermittent failures still require investigation. No unsupported claim of sustained reliability is made.

A subsequent 45-second passive observation saw successful connections alongside Remote User Terminated Connection and Connection Timeout events, and scan-enable Command Disallowed statuses. Attribute Not Found messages during service discovery are not themselves evidence of a failed user operation. The capture establishes intermittent link/controller events, but not their physical cause.

The final hotfix also retains the last verified snapshot during retryable background-poll failures only while it is under 45 seconds old. Authentication failures, invalid telemetry and failed user commands still fault immediately. No optimistic command success is introduced. Final accessory source was hash checked and activated by terminating only the confirmed SvaraHome child process via a pidfd; Homebridge supervises its restart. This last update supersedes the accessory fingerprint used for the 09:40:43 check above.

The owner then explicitly required pending Boost requests to retry patiently while tiles remain truthful. The working change persists the newest manual request in accessory context and retries transient failures every ten seconds after each failed attempt, across child restarts. A newer manual command supersedes it before any older queued write. Rejected authentication, invalid data and unsupported modes stop retries. Siri's own timeout cannot be extended by the plugin: Siri may report failure while the request remains pending, and a pending request can start when connectivity returns later. Users cancel pending Boost/Pause by switching that control off. Lost write responses are reconciled before resending so an already-running timer is not repeatedly extended. HAP's requested speed cache is replaced with measured readback after the set callback. The accessory fingerprint above now refers to this pending-command revision; live activation and its outcome are recorded below when complete.

## HomeKit switch trials after pending-retry activation

Revision c8142f1 was hash checked and activated at 12:25. Both fans subsequently appeared On with both overrides Off in Homebridge's HAP accessory UI.

- Kitchen Boost: request became pending at 12:28:37, later showed Boost On with measured speed 96%; switching Boost Off returned it to automatic ventilation.
- Kitchen Pause: request became pending at 12:30:00, later showed Pause On, Active 0, measured speed 0%, CurrentFanState Idle. Switching Pause Off returned the fan to On with both switches Off.
- Wetroom Boost at configured 2450 RPM: request became pending at 12:31:49, repeatedly returned COMMAND_NOT_CONFIRMED, and readback showed Pause On rather than Boost. A Pause Off command superseded the pending request; the subsequent cache inspection showed no pending request for either fan. This is a failed compatibility test, not a successful Boost result.

The working revision now stops retries after an explicitly different valid control readback and records requested/received manual state, RPM and seconds for diagnosis. Transport errors and lost responses remain retryable. A 200 ms authentication processing interval is being tested, based on the upstream [WhisperBridge Svara implementation](https://garethcooke.github.io/WhisperBridge/). Its documentation reports silently ignored command writes without this interval; applicability to the owner's older fan remains a hypothesis until live testing.

Revision 4abd47d was activated at 12:45:25. At 12:46:48 Wetroom still returned `requested boost 2450 RPM/600s, received pause 0 RPM/599s`. The authentication processing interval therefore did not resolve this speed-specific failure. The request stopped rather than repeatedly resending the mismatched control state.

The Homebridge UI fan tile toggles Active rather than exposing a speed slider. A temporary Pause from that inspection was cleared through the bridge's existing authenticated HAP interface. The QA-checked `tools/pi-hap-probe.py` verifies accessory ID and exact service name before writing, reads the existing bridge PIN locally without printing it, and connects only to the configured loopback HAP port. It does not change authentication or enable an insecure listener.

Wetroom then accepted a 96% slider request (2400 RPM target) with HTTP 204 and measured readbacks of 84%, 99%, 99%, Boost 1 and Pause 0. Boost-off returned HTTP 204 and measured readbacks of 75%, 40%, 40%, with both overrides Off. This distinguishes the accepted 2400 RPM target from the rejected 2450 RPM target; it does not establish an exact firmware-wide maximum.

The candidate now provides optional per-fan `maxManualRpm` validation and UI input, applying the ceiling to Boost and slider targets while leaving measured RPM unchanged. Wetroom will be assigned the validated 2400 RPM ceiling; Kitchen's common Boost setting remains unchanged. Final live checks follow after deployment.

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

All 44 tests pass across Node 22/24 and Homebridge 1/2. These include stalled-disconnect recovery, failure to recover, dropped connections, acknowledged scan stop, scan-stop timeout, transient background failures with a strict freshness limit, automatic command retries, supersession, restart persistence and lost-confirmation timer preservation.

Both modified files were hash checked against locally tested source before deployment. SvaraHome's child bridge alone was restarted to activate each hotfix stage. No whole-Pi reboot or fan control/configuration command was issued by the diagnostic workflow. Existing configured quiet-hours behaviour remains part of normal plugin polling.

At 09:35, passive monitoring observed 182 Kitchen address mentions and zero Wetroom address mentions over 16 seconds, plus two scan-enable Command Disallowed responses. Neither configured fan had an existing Pi LE connection at the start of that observation.

The owner then confirmed the official app was open and would close it. Subsequent logs show Wetroom AUTH_REJECTED at 09:36:12 and Kitchen communication restored at 09:36:16. At 09:36:55 no newer Kitchen fault had been logged. This supports renewed Kitchen communication; it is not yet sustained reliability validation.

The owner subsequently confirmed Wetroom's saved PIN was incorrect and was directed to correct it privately in Homebridge Plugin Config. The user was editing that form during follow-up; automation yielded to avoid interfering with credential entry.

Final deployed hotfix source fingerprints:

- `lib/transport.js`: `8a5e01032a6ed90845d8496c58c4fd74644e98cafba19a2801ac5fff869846af`
- `lib/accessory.js`: `1319bdbff06c6354ffd1bd40a8299170c3bf6344f4dff8817a83aa7872a4fedb`

The child bridge restart was requested after the second source update; final live verification remains pending after the owner's configuration edit.

The owner confirmed the correct Wetroom PIN was saved and the bridge restarted. At 09:40:43 both installed source hashes matched the tested final hotfix. The latest logs showed Wetroom communication restored at 09:40:10 and Kitchen restored at 09:40:14. No newer failures were present at that check. Earlier Kitchen errors at 09:38:16 and 09:39:36 recovered automatically at 09:38:30 and 09:39:49 respectively; this validates retry recovery in operation, while intermittent failures still require investigation. No unsupported claim of sustained reliability is made.

A subsequent 45-second passive observation saw successful connections alongside Remote User Terminated Connection and Connection Timeout events, and scan-enable Command Disallowed statuses. Attribute Not Found messages during service discovery are not themselves evidence of a failed user operation. The capture establishes intermittent link/controller events, but not their physical cause.

The final hotfix also retains the last verified snapshot during retryable background-poll failures only while it is under 45 seconds old. Authentication failures, invalid telemetry and failed user commands still fault immediately. No optimistic command success is introduced. Final accessory source was hash checked and activated by terminating only the confirmed SvaraHome child process via a pidfd; Homebridge supervises its restart. This last update supersedes the accessory fingerprint used for the 09:40:43 check above.

The owner then explicitly required pending Boost requests to retry patiently while tiles remain truthful. The working change persists the newest manual request in accessory context and retries transient failures every ten seconds after each failed attempt, across child restarts. A newer manual command supersedes it before any older queued write. Rejected authentication, invalid data and unsupported modes stop retries. Siri's own timeout cannot be extended by the plugin: Siri may report failure while the request remains pending, and a pending request can start when connectivity returns later. Users cancel pending Boost/Pause by switching that control off. Lost write responses are reconciled before resending so an already-running timer is not repeatedly extended. HAP's requested speed cache is replaced with measured readback after the set callback. The accessory fingerprint above now refers to this pending-command revision; live activation and its outcome are recorded below when complete.

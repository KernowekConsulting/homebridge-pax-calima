# Kitchen CO2 automation investigation — 26 October 2026

## Evidence

- Inspected repository `KernowekConsulting/homebridge-pax-calima`, local revision `8f64b4b`, initially clean. Connected GitHub metadata confirms this public repository and main branch.
- Live `/var/lib/homebridge/node_modules/homebridge-pax-calima` reports 2.5.0. Its accessory and transport SHA-256 hashes match the checkout: `27c13adf0882b5e33886a384962caae2a4b93a2e52a062ec87d468f6c6fba38a` and `5c4220af7c69629859427b0250e248ae6359353286eacbe635c710ccbc9ae051` respectively. A separate 2.4.0 installation exists under `/opt/homebridge/lib/node_modules`; it was not modified.
- Apple Home's enabled **Kitchen CO2 Cleaner** automation has trigger **High Carbon Dioxide Detected in Kitchen** and exactly one visible action, **Boost Fan, Turn On**. It does not show a main Fan action. Inspected without saving changes.
- Kitchen log at **12:13:22** and **12:38:26 UTC/local (GMT)**: `requested boost 2450 RPM/600s, received pause 0 RPM/600s`, followed by `COMMAND_NOT_CONFIRMED`.
- Retained log spans approximately 11:32–12:48 at inspection. It contains zero `INVALID_COMMAND`, zero `CONTROL_REQUIRES`, and no pending-command announcement before the diagnostic trial. It also contains recurring `BLE_OPERATION_FAILED` background faults and recoveries. The specific radio cause is not established.
- Configured common Boost target is 2450 RPM for 10 minutes. Wetroom has `maxManualRpm: 2400`; Kitchen has no ceiling. Earlier Wetroom evidence in `BETA1-LIVE-DIAGNOSTIC.md` records the same rejection at 2450 and success at 2400. Earlier Kitchen trials verified 1500, not its full speed range.

The two logged requests reached the plugin's command writer. Thus they did not fail solely because of sensor detection, numeric/boolean HAP encoding, or an unavailable automation action. Without controller-side execution logs, the two timestamps cannot independently be assigned to the user's manual test and actual event. Their matching failures establish a concrete action-path defect for both reported symptoms.

## Characteristic and retry semantics

The native `Switch` service, subtype `boost`, uses `Characteristic.On`. Real HAP client validation converts numeric 1/0 to boolean true/false before the plugin handler. Boost On requests a timed manual override, capped by `fan.maxManualRpm` if configured. Readback must match the requested enabled state, target RPM and positive remaining timer. The main `Fanv2.Active=1` clears overrides; that separate action is not present in the inspected automation. `RotationSpeed` reports measured RPM divided by 25; its setter writes a temporary manual override and never changes persistent fan speed presets.

The firmware returns a valid Pause payload for the rejected 2450 target. Strict verification therefore rejects the request. `COMMAND_NOT_CONFIRMED` intentionally does not retry: repeatedly resending a speed that becomes Pause is unsafe. The subsequent poll truthfully publishes Pause. Transient Bluetooth errors take the separate persistent pending-request retry path. No retry or HomeKit identity changes are required to address this speed rejection.

The minimal correction is Kitchen's existing per-fan `maxManualRpm` setting at a hardware-verified speed. A global default change, blind automatic speed fallback, or retrying mismatched readbacks would broaden scope unnecessarily.

## Automated reproduction

`test/accessory.test.js` adds a real HAP handler regression with fake firmware that transforms targets above 2400 into the observed timed Pause payload. The unchanged 2450 configuration rejects `On=1`, leaves no pending retry, and reports Pause on the next poll. Recreating the handler on the same accessory and service with `maxManualRpm:2400` makes the same HAP action succeed; `On=0` returns to automatic. Only authentication/manual BLE writes are permitted by the assertions. The firmware transformation is a simulation based on live logs, not a claim that every fan rejects every speed over 2400.

Node **24.19.0**: **53/53 pass** with Homebridge **2.4.0**, and **53/53 pass** with Homebridge **1.11.4**. Whitespace validation passes. The host's default Node 20 is outside the supported engines: its baseline run had 51/52 pass, failing the existing mocked retry-timer test. This unsupported-runtime result is not treated as plugin acceptance. Node 22 was not rerun in this investigation.

## Backup and recovery

Before any live command or config edit, created private Pi directory `/var/lib/homebridge/svarahome-co2-backup-20261026-125303` (0700). Its `rollback.tar.gz` (0600) includes configuration, installed plugin, accessory cache and persistence. Reopened the archive and compared config and installed accessory/transport bytes against the originals. Archive SHA-256: `27cc0c3b712f46954e7ca34f5a49072179d87f510d0d3685e03d9f96502f75ad`.

`RECOVERY.txt` specifies field-only rollback of Kitchen's ceiling, checking concurrent edits and using Homebridge UI's SvaraHome **Restart Child Bridge** to reload parent configuration. Do not restore whole accessory/persistence caches as routine rollback, re-pair devices, reset Bluetooth, or restart the main bridge. The archive remains private on the Pi; credentials are not copied into this report.

Automatic approval initially blocked the bounded live speed trial over restoration concerns; no command was sent by that rejected call. The owner then explicitly approved the bounded 2400 RPM check, clearing its override, applying the ceiling if successful and restarting only SvaraHome's child bridge.

## Live verification

- 12:54:55 UTC: Kitchen Active 1, measured 41%, Boost 0, Pause 0; exact accessory identity checked before writing.
- 12:54:59: 96% slider request (2400 RPM temporary target) returned HTTP 204.
- 12:55:07: Active 1, measured 92%, Boost 1, Pause 0. This verifies Kitchen accepts the proposed target.
- Initial Boost cancellation at 12:55:09 returned HTTP 207 / HAP -70402 during a Bluetooth failure and became pending. 12:55:14 readback was faulted; 12:55:33 communication recovered. A subsequent read still showed Boost active, so restoration was not assumed and cancellation was explicitly retried.

- Explicit cancellation retry returned HTTP 204; subsequent read returned Active 1, measured 42%, Boost 0, Pause 0. Automatic operation was verified before configuration deployment.

## Deployed correction and saved Home automation

Added only `maxManualRpm: 2400` to the uniquely named Kitchen Fan entry in the Pi config. Checked the original config still matched the backup, validated the proposed full platform through the installed plugin's `validateConfig`, and proved removing this one field made the parsed config equal the original. Used atomic replacement. Common Boost duration/target, Wetroom settings, addresses, PINs, names and accessory identities were preserved. No npm publication or plugin source deployment was needed: the existing 2.5.0 speed-ceiling implementation performs the correction.

Activated using the SvaraHome card's **Restart Child Bridge** in Homebridge UI at approximately 12:59 UTC. Fan child PID changed from 253774 to 269902. Main bridge 51352 and other child processes 51365, 51372, 120208 remained unchanged. Both fans subsequently read Active 1, both overrides Off, measured approximately 40–41%.

Pressed **Test This Automation** on the existing Kitchen CO2 Cleaner automation. At 13:00:04 its Boost request encountered a transient Bluetooth failure and was retained as pending. Initial 13:00:17 readback still showed automatic ventilation. A subsequent read verified Active 1, measured 95%, Boost 1, Pause 0 and no persisted pending manual request. This demonstrates that the saved Home action now achieves Boost, including recovery from an intermittent command failure; it does not demonstrate immediate or reliable radio response on every attempt.

The CO2 sensor was already reporting high when Home was opened. No synthetic sensor value, threshold edit, automation recreation or induced high-CO2 event was used. A new natural normal-to-high transition has not been observed after the fix. Trigger semantics and hub delivery on that future transition remain outside this completed action-path test.

Post-test cancellation initially encountered another transient radio failure, then returned HTTP 204 at **13:01:42 UTC**. At **13:01:50**, verified Active 1, measured 40%, Boost 0, Pause 0. Archive comparisons confirmed installed `index.js`, `lib/accessory.js`, `lib/transport.js`, `lib/platform.js` remained byte-for-byte unchanged and config differed by the Kitchen ceiling alone. Main/other child process IDs remained unchanged.

Final **13:02:50 UTC** check: HTTP 200; Kitchen Active 1, measured 38%, Boost 0, Pause 0; Wetroom Active 1, measured 40%, Boost 0, Pause 0. Kitchen's persisted pending request is absent. Both fans are in automatic ventilation. Redacted trial evidence remains in the private backup directory as `trial.jsonl`, SHA-256 `afd2e471b95f240d3297944fabdfd9cbad03d7e3fd8a49adc67a433d930dc8e0`; `final.json` records the final sample. The report's successful 95% sample was observed in terminal output rather than appended to `trial.jsonl`; the later event named `home-automation-confirmed` in that file actually recorded a faulted sample and must not be treated as proof of success.

README troubleshooting and the regression test are local repository changes. Automated transcripts are saved under `docs/co2-automation-tests-20261026/`. No release was published and no GitHub change was pushed during this task. Intermittent Bluetooth reliability remains unresolved; the ceiling fixes the demonstrated invalid-target failure without claiming to fix the radio.

## Primary references

- [Homebridge characteristic handlers](https://developers.homebridge.io/HAP-NodeJS/classes/Characteristic.html), also checked against installed HAP source for client boolean validation.
- [Apple Home scenes and automations](https://support.apple.com/en-gb/102313): sensor-triggered actions and Test This Automation.

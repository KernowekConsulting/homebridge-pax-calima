# CO₂ automation recurrence — 27 October 2026

## Observation and limits

Owner reports a new high-CO₂ alert on 26 October between 18:20 and 20:00 Europe/London, with no Boost noticed. Manual Boost was not tried at that time. Treat this as an unresolved recurrence, not a successful end-to-end fix in 2.5.1.

Read-only inspection found installed version 2.5.1 and Kitchen/Wetroom explicit 2400 RPM ceilings. Installed `lib/accessory.js` SHA-256 matches released source: `26f3b5bf7a0996073c289c5c45dab1668d2cfde9426c0980fa1a71ef1d3240c0`. Both persisted pending requests were absent at inspection; this does not establish their state yesterday.

The current Home automation is enabled, has Time Any and no presence condition, and targets Kitchen Boost Fan On. Its trigger is Kitchen Carbon Dioxide Sensor detecting high CO₂. The sensor is native Netatmo, not a Pi plugin. Home's summary says turn off after 20 minutes; SvaraHome Boost duration is 10 minutes. This mismatch does not establish why initial activation was not observed. No automation settings were changed.

The approximately 1 MiB Homebridge log covered only 27 October 07:27–09:27. No rotated copy was found. Read-only privileged journal searches for yesterday's window returned service/sudo records but no SvaraHome/fan records. Missing historical logs cannot prove that Home sent no command. Today's retained Kitchen log counted 93 BLE_OPERATION_FAILED, 2 FAN_NOT_FOUND and 5 TELEMETRY_STALE messages, which establishes current radio problems, not yesterday's cause.

## Prepared diagnostics, not a control fix

Local `lib/accessory.js` changes add manual-command receipt, confirmed readback, replacement and terminal-stop messages. Existing pending/retry behavior, timings, HAP responses and fan writes are unchanged. No public version or release copy changed. Receipt records prove arrival at SvaraHome, not whether Home's trigger ran; absent receipts are meaningful only across complete uninterrupted capture.

A real HAP characteristic test submits numeric On while the accessory is faulted, simulates repeated radio failures, and verifies eventual 2400 RPM delivery from the existing retry timer without another Home command. It checks that confirmation is logged only after recovery and that no PIN/address leaks. A second test distinguishes supersession and authentication rejection from success. All 62 tests pass on installed Homebridge 2.4.0 and Homebridge 1.11.4 under Node 24.19.0. Syntax and diff checks pass. These tests do not reproduce yesterday's real Home-hub trigger.

`tools/pi-command-trace.py` is prepared to preserve selected command/communication lines from the existing log, following rotation, for at most 48 hours and 8 MiB. It exclusively creates a 0600 output in a private directory, runs no HAP/Bluetooth/service commands, and stops its tail subprocess on exit. Synthetic filter checks pass. It has not been installed or started on the Pi.

## Backup and proposed activation

Fresh private Pi backup `/var/lib/homebridge/svarahome-diagnostic-backup-20261027-093822/accessory.js` was reread and compared byte-for-byte with the installed source, with the SHA-256 above. `RECOVERY.txt` specifies source-only atomic rollback, checking concurrent changes, then restarting only the SvaraHome child bridge. No configuration/cache restore, re-pairing, Bluetooth reset or main Homebridge restart is involved.

Before activation, recheck installed source, current pending requests and fan state; defer if a control operation is in progress. Install only the diagnostic source with a hash check and preserve mode. Start the bounded private collector, restart only the child bridge, then verify reconnection, configuration/source identity and no introduced pending request. Observe the next natural high alert and correlate its time with receipt, retry and confirmation records. A Test Automation action can separately test delivery but cannot prove a sensor-triggered event. No fan command is required to activate these diagnostics.

At report time only the rollback copy was written on the Pi. No live plugin/config edits, restarts or fan commands were performed during this follow-up. Activation remains subject to the owner's agreement because it briefly interrupts HomeKit access to the two fan accessories, despite leaving their native controls/timers running.

## Authorized activation and first live action test

The owner subsequently authorized live diagnostics across both fans, CO₂ sensors, Apple Home and Pi. Automatic approval review rejected the first child restart because it required explicit restart authorization despite that diagnostic permission. No restart occurred on that attempt. The owner then explicitly approved the SvaraHome-only child restart, which was performed through the Homebridge UI.

Installed diagnostics SHA-256: `741a04df29029f1b3799e518ddda66c12bd11c11e2d3a419a7b0eaed35157175`, exact match to tested local source. The original source remains in the verified backup. Configuration and transport hashes are unchanged. The private bounded collector started as PID 356240 and survived leaving the terminal and the child restart; its stderr was empty. Output is `command-trace.log` in the backup directory. Collector stops after 48 hours or 8 MiB; it is not a permanent service or an automatic notification mechanism.

SvaraHome child stopped 09:45:13 UTC, started 09:45:14 as PID 356379. Kitchen communication restored 09:45:19; Wetroom 09:45:22. HAP GET returned both Active=1, Boost=0, Pause=0. Kitchen measured 40%, Wetroom 94%; those are measurements under native automatic control, not manually requested targets.

Home Test This Automation was invoked once. New retained trace records Kitchen Boost On received **09:46:34**, confirmed **09:46:38**, fan reports **boost 2400 RPM/600s**. Subsequent HAP GET: Active=1, measured94%, Boost=1, Pause=0. This establishes that this test's Home action reached SvaraHome and was delivered in four seconds. It does not reproduce a natural sensor trigger or prove yesterday's failure resolved. Temporary Boost cleanup was then requested separately.

Home sensor inspection showed CO₂ 1365 ppm and Detected No. Netatmo's official [HomeKit documentation](https://helpcenter.netatmo.com/hc/en-us/articles/360010067180-What-can-you-do-with-a-Station-paired-with-Apple-HomeKit) specifies detected/high above 1600 ppm. The owner clarified yesterday's notification was in Apple Home, originating from Netatmo. The alternative hypothesis of merely receiving a Netatmo-app alert at a different threshold therefore does not explain the reported event.

The owner withdrew the suggestion to use 95%; retain verified 2400 RPM (96% of the plugin's 2500 RPM scale). No speed-limit, percentage mapping or release changes were made.

Cleanup: an existing `/tmp` probe differed from the reviewed local hash, so its preflight aborted before any command. Instead, a short loopback HAP request checked the Kitchen Boost service identity and sent Boost Off. Trace shows receipt **09:48:15**, confirmed **09:48:22**, fan reports automatic 0 RPM/0s (the manual-override register, not measured motor RPM). At **09:49:46 UTC**, final HAP 200 shows Kitchen Active=1, measured39%, Boost=0, Pause=0; Wetroom Active=1, measured95%, Boost=0, Pause=0. There are no persisted pending manual requests. Baseline configuration/transport hashes still match; collector is alive with empty stderr. Private `activation-final.json` records this evidence, SHA-256 `ad000afa5c1a2f5ffb914ccd307666547c3e3f37f1026c2afc7d0232376a7ad2`.

Home's current active hub is Snug ATV 4k 2gen, automatic selection enabled. No hub selection/software or Home settings changed. This inspection does not establish which hub executed yesterday's automation. Next diagnostic evidence required: a naturally occurring Apple Home high-CO₂ alert time, correlated with retained receipt/delivery logs. No CO₂ readings or triggers were falsified to manufacture an event.

## Natural alert correlated on 28 October

The owner supplied `IMG_6442.jpg`: Apple Home notification, “Carbon dioxide abnormal in Kitchen”, Tuesday 27 October at 18:03, marked “now”. Owner heard possible fan acceleration but noted a boiling pan at the same time. Sound alone cannot attribute that acceleration to timed Boost rather than native ventilation.

Retained command trace positively establishes delivery at the matching time (Europe/London, GMT):

- **18:02:53** — Kitchen `boost On request received`.
- **18:02:53** — initial attempt `BLE_OPERATION_FAILED`; Boost request retained pending with retries.
- **18:03:09** — `boost On request confirmed; fan reports boost 2400 RPM/599s`.

This is a 16-second receipt-to-confirmation interval. The positive manual-override readback distinguishes the delivered timed Boost from merely observing an automatically elevated motor speed. The screenshot and trace together support a successful natural Home automation action for this event, including recovery from the initial radio failure. They do not prove the earlier 26 October event succeeded or identify its cause, nor prove that every later event will succeed. The diagnostic patch changed logging only; persistent retry behavior was already present in 2.5.1.

At inspection 28 October 06:54–06:57 UTC, the collector was alive with empty stderr, retained roughly 503 kB across the overnight interval, installed source still matched diagnostic SHA-256, and original child PID 356379 remained present. ANSI colour prefixes in retained lines require timestamp parsing rather than an exact line-prefix match; following log truncation can duplicate older lines. Neither affects the positive three-message event above.

Preserved a separate, colour-stripped, 44-line Kitchen extract for 17:58–18:20 at private Pi path `/var/lib/homebridge/svarahome-diagnostic-backup-20261027-093822/kitchen-co2-20261027-1803.log`. Reopened and hashed: SHA-256 `385337cf80afefab7d9fa101a6d39f7931cf6a77f73a531c1e4f0397a8cf1c71`. No fan commands, service restarts, configuration or source changes were performed during this check.

# Bluetooth stage diagnostics — 28 October 2026

Owner authorized improving evidence collection after a natural CO₂ automation succeeded on retry. No new release, speed-limit or retry-policy change is included.

## Recorded evidence

Transport attaches immutable metadata to surfaced errors through a WeakMap, preserving the original error object and existing public error code. Each session has a process-local attempt number. Duration measurements use the monotonic performance clock:

- `stage`: preflight/recovery, scan/scan-stop, connection, service/characteristic discovery, named read/write, authentication validation, or action validation.
- `stageMs`: time spent in the failing operation, including its timeout if applicable.
- `sessionMs`: elapsed connection-session time at failure, excluding queue wait and subsequent cleanup.
- `queueMs`: time waiting behind other shared-radio work.
- `lastCompleted`: last successful stage. A failed `read-manual` after completed `write-manual` identifies failed readback rather than the initial read of the manual state.

The accessory logs public error code, fan display name, operation (`poll` or `command`) and these fields. Every surfaced command-attempt failure is recorded once, even if handled at multiple levels. Repeated background failures with the same code/stage are sampled at most once per minute; a stage change is recorded immediately. Existing availability warnings and command receipt/confirmation logs remain.

No raw backend message, PIN, Bluetooth address, payload or full configuration is logged. Stage labels come from internal constants; unknown characteristic names become `unknown`. No extra wake command or wait interval is introduced. The existing 7-second operation bounds, 200 ms authentication settling, queue, persistent retries and native fan control remain.

Scope limits: queue admission failures have no started session and retain existing generic reporting. Best-effort disconnect failures after an otherwise completed action remain handled by the existing next-session recovery gate; this change does not turn cleanup failures into rejected fan actions. Action validation failures retain the `action` stage plus last completed read. A successful timed Boost is still established by manual readback, not motor sound or a requested value.

## Validation

All **73 tests pass** under bundled Node 24.19.0 with Homebridge 2.4.0 and Homebridge 1.11.4. New tests inject failures at connect, service discovery, characteristic discovery, auth write, auth-confirmation read, mode read, manual write and manual readback. They verify error identity/code preservation, nonnegative stage/session/queue timings, readback context, separate timeout/auth rejection, queued work, reused backend errors, logging deduplication/sampling and no secret leakage. Existing tests cover late connections, recovery, authentication settling, supersession and persistent Boost/Pause retries. Source syntax, Python collector filters and `git diff --check` pass.

Tested hashes:

| File | SHA-256 |
| --- | --- |
| lib/accessory.js | a4bc8884d9bb508e7cac1edab297695224a3c36aa5523f0ac0a8e1ed7c0763d7 |
| lib/transport.js | 551ed594bfd1b49e2b1f3ec784bb72e7c5ce97ecceec5230eb1d8c7b55433e48 |
| tools/pi-command-trace.py | df91782e9d478b963f6b70c2566307f17ebeb81a4b054886dcc1c0efb225fd48 |

## Live preparation

Fresh private rollback directory `/var/lib/homebridge/svarahome-stage-backup-20261028-070643` contains both currently installed source files, reread and compared byte-for-byte. Original accessory SHA-256 `741a04df29029f1b3799e518ddda66c12bd11c11e2d3a419a7b0eaed35157175`; original transport SHA-256 `5c4220af7c69629859427b0250e248ae6359353286eacbe635c710ccbc9ae051`. Baseline configuration/package hashes and a source-only recovery plan are saved privately. Previous retained alert evidence is preserved.

The owner explicitly approved installing this update and restarting only SvaraHome's child bridge once, after disclosure of brief Home accessory unavailability while native ventilation continues. No main Homebridge restart, adapter reset, pairing change, permanent fan setting or public publication is authorized by this diagnostic activation.

## Live activation and evidence

Installed both tested files with exact hash checks and Node syntax validation. Started the updated collector as PID 436793 in the new backup directory, retaining at most 48 hours/8 MiB. The previous bounded collector/evidence is left intact to expire on its original schedule. Neither is a permanent service or notification task.

Pre-restart HAP 200 at 07:10:04 UTC confirmed both fans available, Active=1, Boost=0, Pause=0, measured39–40%, with no persisted pending request. Performed the single approved SvaraHome child restart through the Homebridge UI. Fresh process was polling by 07:10:55; Wetroom communication restored 07:10:58 and Kitchen 07:11:04.

First useful natural background failure, **07:11:15 UTC**:

```text
SvaraHome Kitchen Fan: Bluetooth attempt 6 failed; operation=poll; code=BLE_OPERATION_FAILED; stage=discover-services; stageMs=2; sessionMs=1133; queueMs=0; lastCompleted=connect.
```

This identifies a failure during service discovery after connection completed, before authentication or a manual instruction. It returned in 2 ms rather than reaching the 7-second operation timeout. This is evidence about this poll only; it does not establish the cause of the prior evening's first failed Boost attempt, radio interference, or the underlying backend rejection. No raw backend text is exposed. Kitchen communication restored 07:11:32 on a later poll.

At **07:12:31 UTC**, HAP 200 confirmed both Active=1, Kitchen measured40%, Wetroom39%, both Boost/Pause=0, no pending commands. Installed source hashes match tested files; configuration/package baseline hashes unchanged. Collector remains alive with empty stderr and retained stage lines. No fan commands were sent during this activation. Private `activation-final.json` includes source hashes, HAP state and first stage samples; SHA-256 `7a1f9661746c9b5242f42c7fd302b3f827659d2b429b9bfa6918544aa5eed0e6`.

No version bump, npm publication, GitHub push or public release-copy change was made. These are live diagnostics on installed 2.5.1, with local source changes ready for review.

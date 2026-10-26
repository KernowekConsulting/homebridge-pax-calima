# Pause and persistent retry acceptance — 26 October 2026

Both owner's fans passed Pause On and Pause Off through their existing HomeKit services. Kitchen's first Pause request failed at the Bluetooth layer, then the existing SvaraHome retry delivered it without a second On request. No runtime change was required by these tests; 2.5.1 remains unpublished.

## Live trial

Connected through the already authenticated Pi terminal. Initially checked exact accessory/service identities, both fans' current overrides, and persisted pending requests. Both fans were automatic, approximately 40% measured speed, and had no pending requests. Created a new private backup before writing any command:

- Directory: `/var/lib/homebridge/svarahome-pause-acceptance-20261026-130856` (0700).
- `rollback.tar.gz` (0600) contains config, installed plugin, accessory cache and persistence.
- Reopened archive and compared config and accessory/transport source against originals.
- Archive SHA-256: `d9a40b98a58636246674682f56be4f174522a20b33865d1255f7da23f8fc7afb`.
- Recovery action for this trial: Pause Off cancels an active or pending Pause and returns to automatic; observe confirmed readback before testing the next fan. Stop if restoration cannot be verified. No configuration/source update or cache restoration was needed.

Commands used the plugin's existing authenticated loopback HAP endpoint, with credentials read locally and never printed. Fans were tested sequentially; Pause On was sent exactly once per fan. After a failed request, the probe only observed while SvaraHome's own persistent retry delivered it. No artificial Bluetooth outage, direct BLE diagnostic connection, radio reset, child restart, sensor edit or live configuration change was made.

All times below are UTC / local GMT on 26 October.

| Fan | Pause request | Confirmed Pause and measured zero | Pause Off | Override cleared |
| --- | --- | --- | --- | --- |
| Kitchen | 13:09:05, HTTP 207 / HAP -70402 | 13:09:45, Active 0 / Pause 1 / Boost 0 / speed 0 | 13:09:49, HTTP 204 | 13:09:49, both overrides Off |
| Wetroom | 13:09:55, HTTP 204 | 13:10:05, Active 0 / Pause 1 / Boost 0 / speed 0 | 13:10:09, HTTP 204 | 13:10:09, both overrides Off |

Kitchen's request was confirmed approximately 40 seconds after the initial failed response. The five-second observation cadence and plugin polling mean this is a confirmation latency, not an exact radio-delivery measurement. Wetroom's measured motor stop was confirmed approximately ten seconds after its successful request.

An immediate post-cancellation snapshot still showed zero measured RPM while the motor started. The test did not invent a nonzero speed. A separate settled **13:10:39** check verified:

- Kitchen Active 1, measured 39%, Boost 0, Pause 0; no pending manual request.
- Wetroom Active 1, measured 40%, Boost 0, Pause 0; no pending manual request.
- Pi configuration and installed accessory/transport files match their archived baselines byte-for-byte.
- All observed Homebridge process IDs remained unchanged through the trials.

Exact redacted Pi JSONL is saved at [pause-tests-20261026/pi-trial.jsonl](pause-tests-20261026/pi-trial.jsonl), retrieved through the terminal and verified against Pi SHA-256 `18281b85caa3358caee031f2a2ae5d839279aeb41090ae273dbaf4eabf35e57b`. Private credentials/configuration were not exported.

## Automated tests

Added six tests to `test/accessory.test.js`:

1. Numeric HomeKit Pause On reaches the boolean handler, requests the configured native timer, truthfully reports motor coast-down, and handles native expiry without another control write.
2. Pause On survives four further failed attempts, waits ten seconds between attempts, logs one pending announcement and one repeated-code warning, and completes on recovery without another Home command.
3. The same repeated-failure test for Pause Off proves return-to-automatic retries too.
4. A lost Pause confirmation adopts the remaining timer rather than extending it; a lost cancellation confirmation cannot restart Pause.
5. Fan On supersedes an unreachable Pause, and an old retry cannot stop ventilation later.
6. Pending Pause Off survives handler/child restart and clears the native override after reconnection.

On Node **24.19.0**, the complete suite passes **59/59** with Homebridge **2.4.0** and **59/59** with Homebridge **1.11.4**. Full transcripts are in `pause-tests-20261026/`. Existing tests also cover rejected authentication, mismatched readback, supersession, mode gates, BLE recovery and single-queue transport. Whitespace validation passes. Node 22 was not rerun in this investigation and remains part of release CI acceptance.

## Retry contract for 2.5.1

The existing 2.5.0 runtime already implements the required persistent manual-command retry path:

- Retain the latest manual request in accessory context until verified or replaced.
- Retry transient Bluetooth failures after ten seconds per failed attempt, through one shared serial transport. There is no fixed retry-count cutoff; queue and radio latency can make actual delivery take longer.
- Preserve pending work across child restarts. A newer manual request replaces the old one, including a return-to-automatic request cancelling pending Pause.
- Reconcile fan readback before resending an uncertain write, preserving an already running timer.
- Keep command state truthful; Home/Siri may report an initial communication error even while SvaraHome retains and later delivers the request.
- Stop for rejected authentication, invalid configuration/data, unsupported mode or explicitly mismatched readback. Repeating the earlier rejected 2450 RPM command would repeatedly produce Pause, so that is not a radio-resilience retry.

The deterministic tests establish repeated-failure retry cadence and duplicate-log suppression for the same error code. The live Kitchen result establishes actual delayed delivery after a natural failure. This does not prove long-term radio reliability, total log silence during alternating background faults/recoveries, or Home hub/sensor-trigger delivery. No new Pause automation was created; live tests exercised the same HAP Pause On/Off writes used by automation actions.

README retry guidance was expanded. `tools/pi-pause-acceptance.py` is a reusable version of the bounded procedure, syntax checked locally; the hardware trial used the equivalent inline procedure retained in the Pi terminal and the exported evidence. No plugin source was installed or new release published.

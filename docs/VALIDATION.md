# 2.5.0-beta.1 candidate validation

25 October 2026. Base commit: `1f22f3ab8136cf1ea5f13ea736a6722f4bfdd2b0` (2.4.5). Work is on local branch `feat/2.5.0-boost-pause`. No Pi plugin deployment, service stop, firmware update, reset or new fan-setting write was performed during implementation.

## Automated checks

32 tests pass in each combination:

| Node | Homebridge | Result |
|---|---|---|
| 22.23.4 | 1.11.4 | 32/32 |
| 22.23.4 | 2.4.0 | 32/32 |
| 24.19.0 | 1.11.4 | 32/32 |
| 24.19.0 | 2.4.0 | 32/32 |

Machine-readable results and complete TAP logs are alongside this file in the source checkout; those raw QA files are excluded from the npm package. Tests instantiate the real Homebridge PlatformAccessory and HAP service classes, and the maintained Noble library’s real classes, with simulated physical Bluetooth bindings. They do not start a real Homebridge server, pair an iPhone or connect to a fan.

Coverage includes explicit PIN encoding/confirmation, authentication rejection, queue ordering, failed command readback, scan/ATT timeouts and cleanup, late connection recovery, shutdown, stale and malformed telemetry, native service handlers, restart reconciliation, modes, upgrades, visibility, schedules and config routing. Overlapping poll/Boost/Pause requests all execute serially. Rejected authentication stops unattended retries; an explicit user command or configuration restart can retry.

`test/telemetry-fixture.json` replays 134 redacted status/manual samples from the owner's serial Kitchen tests. Three samples contain two implausible RPM values, 13140 and 50237 (the latter occurs twice). All three are rejected. Disabled manual buffers retaining an old target are treated as automatic, rather than active Boost. Firmware-mode and RPM controls retain the documented conservative gates.

Source syntax, diff whitespace and npm package contents are checked separately. The package includes runtime modules, schema, logo, README, release notes, changelog and licence; test recordings and diagnostic scripts are excluded. The packaged README links the repository documentation for validation details.

## Physical evidence reused

Earlier device trials on 24 October confirmed timed boost start/expiry/cancel/extend/speed adjustment and zero-RPM pause with expiry/early resume on the newer eight-digit-PIN Kitchen fan (software 02.10, mode 00). Those trials used diagnostic scripts, not this plugin implementation. They restored all captured settings exactly.

The older fan (software 02.08) did not confirm authentication using the attempted bindings; no older control tests ran. This build fixes routing and refusal to act without confirmation. It cannot establish that the currently saved older PIN is correct.

## Remaining acceptance gates

1. Complete native Linux installation/execution on supported Node versions. The vulnerable dependency chain has been replaced and full, production and Linux ARM64 resolution audits now report zero vulnerabilities; see DEPENDENCY-SECURITY.md. Linux resolution was checked on macOS without lifecycle scripts, so native Linux compatibility remains to be confirmed.
2. Save/reload Plugin Config on the Pi, securely correct the older fan's address/PIN, and confirm six/eight-digit routing without exposing either PIN in evidence.
3. Deploy the candidate deliberately to the fan child bridge, retaining the existing installed package for rollback. Confirm normal authenticated polling and invalid-PIN fault behavior.
4. In Apple Home, exercise Boost, Pause, early resume, timer expiry and slider control. Check mutual exclusion, command rejection/offline presentation and the expected service migration. Verify Siri using actual Home names/scenes.
5. Restart the fan child bridge during an active timed override, confirm readback restores the switches and let the native timer finish. Give bridge restoration a bounded independent fallback for any diagnostic interruption.
6. Confirm official-app changes are read and routine polls leave presets/schedules alone. Validate environmental/schedule behavior separately before expanding those claims.
7. Finalise the draft release copy, publish the accepted npm package with a matching GitHub release, then request Homebridge verification/icon registration.

## Known limits

No independent airflow measurement, final Apple Home/Siri test or live 2.5.0 deployment has occurred. Durations default to ten minutes and are configurable from one to sixty; native timer serialization is tested, but long-duration physical acceptance still belongs in the final run. Manual controls require mode 00 and never change operating mode. Nonzero targets below 1000 RPM are not offered. Ambient sensors remain omitted until their interpretation is established.

A command acknowledged by the fan can still be reported failed if subsequent telemetry is invalid or communication is lost. This is deliberate uncertainty reporting; the next successful poll reconciles the fan, without automatically resending a control command.

## Owner-supplied Wetroom evidence

The 25 October official-app About screen identifies Wetroom Fan, Bathroom Mode, firmware 02.08, hardware 02.00 and app 7.3.0. See WETROOM-ABOUT.md. This does not establish authentication or control success. Approved beta copy and the stable-promotion rule are recorded in RELEASING.md.

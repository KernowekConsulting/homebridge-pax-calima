# SvaraHome 2.5 validation

## 2.5.1 patch acceptance

The only runtime change from 2.5.0 is a conservative 2400 RPM default ceiling for temporary Boost and slider targets when no explicit per-fan limit is set. Explicit limits and measured RPM remain unchanged. Both tested fans accepted 2400 RPM; Kitchen and Wetroom returned Pause for 2450 RPM. This is a conservative compatibility default, not a universal firmware maximum.

The current suite has 60 tests, including the default ceiling, explicit higher/lower limits, unchanged measured speed, numeric HomeKit writes and persistent Pause On/Off retries. Node 24.19.0 local acceptance passes with Homebridge 1.11.4 and 2.4.0. The publication gate also requires the Node 22/24 × Homebridge 1/2 workflow to pass native load, full/production audits, syntax, tests and package checks on the release commit.

Live Pause/resume trials on 26 October passed on both fans; Kitchen recovered after a failed initial request without a repeated command. Both ended in automatic ventilation with no pending command. The existing Kitchen CO2 automation action achieved Boost after the speed correction. These hardware trials validate the 2400 RPM target and unchanged Pause/retry path; they do not constitute installing 2.5.1 on the Pi or observing a fresh natural CO2 trigger.

## 2.5.0 baseline evidence

The 2.5.0 runtime was the tested beta.3 implementation (release commit 3f4066177868d7a651c8400803c3f490f21d471b). Later repository cleanup changes documentation, not runtime behaviour.

All 52 tests passed in each Node 22/24 × Homebridge 1/2 combination in [release CI run 40220445646](https://github.com/KernowekConsulting/homebridge-pax-calima/actions/runs/40220445646). The jobs also passed native installation/loading, full and production security audit gates, syntax and package checks.

Coverage includes confirmed authentication, malformed telemetry, temporary control readback, timer expiry, queued BLE work, timeouts/disconnect recovery, pending-request retries and supersession, restart persistence, per-fan speed ceilings, preserved accessory/service identities and quiet-hours schedule continuity. Tests use real Homebridge services and maintained Noble classes with simulated physical Bluetooth bindings.

The four beta.3 additions cover default Fan/Boost Fan presentation with optional Pause Fan; main Fan Off starting a timed pause; Fan On clearing either override without changing persistent presets; persisted return-to-automatic after a connection failure/restart; and an ignored cancellation that must remain a communication fault.

The README configuration example was checked against runtime configuration validation. Relative links in packaged documentation and the logo path were checked during repository cleanup. Those checks do not establish Siri recognition or physical fan behaviour.

## Physical evidence

The owner’s newer eight-digit-PIN Kitchen fan and older six-digit-PIN Wetroom fan both authenticated and provided telemetry after configuration was corrected privately. Live HAP trials confirmed timed Boost, Pause and cancellation. Kitchen pending requests recovered without repeating the command. Earlier serial device trials also covered native expiry, early resume and speed changes.

Wetroom accepted a 2400 RPM requested target but returned a zero-RPM override for 2450 RPM. Its per-fan ceiling was set to the accepted target; this is not a universal firmware limit. The final trial set ended with both manual overrides Off and no pending requests. See the [detailed dated report](BETA1-LIVE-DIAGNOSTIC.md) and [42 redacted final-trial records](pi-live-control-evidence-20261025.jsonl).

Beta.3’s new presentation and universal Fan On path have automated service-level coverage. No new physical beta.3 control trial or successful Siri voice acceptance is claimed by that evidence.

## Remaining acceptance and practical limits

- Test the actual Home names/Siri phrases, renamed controls and default visibility in the owner’s Home.
- Exercise Fan On from both Pause and Boost on both physical fans, then observe normal operation/recovery over a longer period before stable promotion.
- Temporary controls require operating mode 00; the plugin does not change installation modes. Nonzero targets below 1000 RPM are not offered.
- Status is measured RPM, not independent airflow. Temperature, humidity and light are not exposed as ambient sensors, and fan speed is not treated as proof of a shower or humidity event.
- A missed background poll may retain its last verified reading only within 45 seconds. Failed commands and invalid/stale telemetry fault. Acknowledged writes may still report failure if subsequent confirmation/telemetry is lost.
- Temporary connection failures retain the newest manual request, which can run later. Siri’s timeout does not cancel it. Authentication rejection, invalid data, incompatible readback and unsupported modes stop retries.
- Native quiet-hours behaviour depends on firmware/settings; its schedule enable/disable control is not an immediate-pause command.

## Historical records

The raw audits, install logs, fixtures and TAP outputs retained in this directory describe the builds named in those files. Older 32-test and 48-test snapshots do not replace the current 52-test release result. Earlier uncompleted checks in dated reports should be read alongside subsequent outcomes, rather than repeated as current blockers.

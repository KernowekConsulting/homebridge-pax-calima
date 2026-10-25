# Homebridge verification readiness

Reviewed 25 October 2026 against the current requirements and request forms. SvaraHome is not verified, and no verification request has been submitted by this work.

## Assessment

**The 2.5 candidate has evidence for the main technical requirements. Finish stable promotion and the remaining user acceptance checks before submitting.** The repository default branch now contains the tested 2.5 implementation and its current public guide. npm latest still points to the older stable release until the owner requests full promotion; that older package is not the remediated candidate.

| Requirement | Evidence and status |
| --- | --- |
| Dynamic platform | Implemented: PaxCalima registers a platform, restores cached fan identities and registers configured fans after launch. |
| Distinct functionality | No Pax, Calima or Svara name was found in the current verified list. This is a preliminary name check, not proof of a complete functionality comparison; explain support for these BLE fans and let reviewers assess overlap. |
| npm and public GitHub source, issues enabled | Confirmed: public KernowekConsulting repository with issues enabled. Beta.3 is published on npm with a matching GitHub prerelease and notes. Default-branch source now matches the 2.5 implementation; align version metadata and final copy at stable promotion. |
| Supported Node LTS versions | Beta.3 release commit 3f40661 passed all four Node 22/24 × Homebridge 1/2 jobs, 52 tests per job, including native installation/loading. |
| Installs and waits for configuration | Candidate has no install/postinstall script. Unconfigured or unusable fan configuration does not load Noble or start discovery. Native Linux ARM64 installation/loading was checked under Node 22/24; normal installed-plugin fan communication subsequently passed live checks. |
| No TTY or unusual Homebridge startup flags | Runtime has no TTY prompt or startup-flag dependency. Normal installed child-bridge operation is evidenced on the Pi. The radio still requires normal Bluetooth access; historical diagnostic scripts are not installation requirements. |
| Settings GUI | Schema provides explicit fan address/PIN, durations, switch visibility, quiet hours and per-fan speed limits. User PIN correction, saved configuration reload and the 2400 RPM setting were exercised in the actual UI/live plugin. |
| No tracking | Runtime source contains no analytics or HTTP/cloud requests. It communicates locally over BLE. |
| Homebridge-local storage | Runtime persists identity, schedule metadata and pending manual intent through Homebridge accessory context. It does not create separate runtime files elsewhere. Diagnostic evidence files are developer tools, not plugin runtime storage. |
| Caught errors | Implemented bounded BLE operations, caught polling/intent failures, redacted fan-specific logs and HomeKit communication errors. Tests cover rejected authentication, bad telemetry, timeouts, shutdown, retries and incompatible readback. This is evidence from inspected paths and tests, not a claim that no unforeseen defect can occur. |

The current [official requirements](https://github.com/homebridge/plugins/wiki/Verified-Plugins) specify Node 22 and 24 and were last revised on 5 May 2026. [The verification process](https://github.com/homebridge/plugins#plugin-verification) requires an issue using [the request form](https://github.com/homebridge/plugins/blob/latest/.github/ISSUE_TEMPLATE/1_verification-request.yml). The source of the orange shield is Homebridge's central verification status; it cannot be changed by adding a logo or a package field.

## Beta.3 update

Beta.3 simplifies the default presentation to Fan and Boost Fan; Pause Fan is optional and explicitly enabled settings are retained. Main Fan On now clears either override through the same verified, persisted request path. All 52 tests passed in each supported Node/Homebridge CI combination in [run 40220445646](https://github.com/KernowekConsulting/homebridge-pax-calima/actions/runs/40220445646). The checked public beta.3 tarball matched its recorded checksum. This extends automated evidence, not the earlier physical/Siri acceptance evidence below.

## Earlier release evidence

- Exact beta.2 release CI: [run 40216171472](https://github.com/KernowekConsulting/homebridge-pax-calima/actions/runs/40216171472), all four jobs successful. Native module loading, full/production high-severity audit gates, syntax, tests and package checks passed.
- Published [npm beta.2](https://www.npmjs.com/package/homebridge-pax-calima/v/2.5.0-beta.2) and [matching GitHub prerelease](https://github.com/KernowekConsulting/homebridge-pax-calima/releases/tag/v2.5.0-beta.2).
- Public beta.2 tarball SHA-256: b1153a3c4a07463c900a5f2407383ecb9583cff983097b8849f062f20a5854fa. Registry download matched the checked artifact and its homepage/issue metadata.
- Both six- and eight-digit-PIN fans authenticated after the owner corrected Wetroom's saved PIN privately. Live HAP controls confirmed Boost, Pause and cancellation on both fans. Wetroom accepted the 2400 RPM ceiling and capped 100% slider request; 2450 RPM was explicitly rejected as a zero-RPM override.
- Kitchen transient failures recovered without repeating the Home command. Final trials ended with both manual overrides Off and no pending requests. See [the detailed live report](BETA1-LIVE-DIAGNOSTIC.md) and [42 redacted trial records](pi-live-control-evidence-20261025.jsonl).
- Dependency remediation and isolated installation details are in [DEPENDENCY-SECURITY.md](DEPENDENCY-SECURITY.md). The beta implementation uses the maintained Noble fork; stable 2.4.5 still has the old dependency.

## Remaining work before requesting review

1. Complete the owner's chosen full 2.5.0 promotion, including final version/source alignment, review of the concise user-facing release copy and removal of the changelog’s Unreleased label. The owner declined a metadata-only 2.4.6 release.
2. Follow [STABLE-PROMOTION.md](STABLE-PROMOTION.md): verify npm latest metadata, the actual Homebridge Plugin Homepage button and release-note view after cache refresh. Beta.2's homepage is correct, but the UI currently uses stable 2.4.5 metadata. Preserve a GitHub issue tracker so release-note discovery still works.
3. Verify that the requested SvaraHome website resolves and loads over HTTPS. It did not resolve during the earlier beta.2 check, but the intended site subsequently loaded over HTTPS in Safari during beta.3 publication. Recheck at stable promotion. This is a website acceptance issue, not a listed Homebridge verification criterion.
4. Record normal-use acceptance on both fans, including the owner's actual Siri names/scenes and a longer period of automatic operation/recovery. HAP tests do not establish Siri recognition or uninterrupted BLE reliability. These are our release acceptance checks, not additional formal Homebridge rules.
5. Prepare the verification form with accurate evidence and the approved icon, then submit only when the owner requests that communication. Review and approval remain with Homebridge.

## Logo

The approved SvaraHome artwork is assets/svarahome-master.png, with a 1024-pixel version in assets/svarahome.png. assets/homebridge-pax-calima.png was checked as a square 100 × 100 PNG.

The verification form accepts an optional icon attachment. The [separate icon request form](https://github.com/homebridge/plugins/blob/latest/.github/ISSUE_TEMPLATE/2_icon-request.yml) requires an already-verified plugin and a request from its developer. Include the approved icon with the verification request; central registration controls its appearance in the Homebridge tile. Do not claim verification, use a verified badge or replace the approved logo with a manufacturer mark.

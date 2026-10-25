# Homebridge verification preparation

Reviewed 25 October 2026. This is preparation for a request, not a claim of approval.

## Current sources

- [Homebridge](https://homebridge.io/)
- [Current requirements](https://github.com/homebridge/plugins/wiki/Verified-Plugins), updated 5 May 2026; the older homebridge/homebridge wiki still quotes obsolete Node versions.
- [Verification process](https://github.com/homebridge/plugins#plugin-verification)
- [Verification form](https://github.com/homebridge/plugins/blob/latest/.github/ISSUE_TEMPLATE/1_verification-request.yml)
- [Icon form](https://github.com/homebridge/plugins/blob/latest/.github/ISSUE_TEMPLATE/2_icon-request.yml)

The current requirements name supported Node LTS 22 and 24, a dynamic platform, settings GUI, graceful errors, explicit configuration before startup, no tracking, and Homebridge-local storage. A published npm package, public GitHub source with issues enabled, and matching GitHub release notes are required. Current UI transport metadata supports `supports-hap`, which this package declares. It does not register Matter accessories itself.

## Assessment

| Area | Candidate evidence / remaining work |
|---|---|
| Dynamic platform | Registers PaxCalima, restores cached identities and creates only explicitly configured fans after launch. |
| Node LTS | 29 tests pass on Node 22.23.4 and 24.19.0 with Homebridge 1.11.4 and 2.4.0. |
| Settings GUI | Schema provides per-fan addresses and secret six/eight-digit PIN fields, Boost/Pause choices and quiet hours. Actual UI save/reload still needs acceptance testing. |
| Configuration gate | No Noble load or radio work for absent/empty/unusable fan config; unroutable cached accessories remain faulted. |
| Errors | Bounded sessions, rejected-PIN polling stop, redacted messages and HomeKit communication errors; no optimistic success after rejected readback. |
| Storage/tracking | No runtime files outside Homebridge. Only schedule-application metadata is saved through accessory context. No analytics or cloud calls. |
| Installation/startup | Plugin has no install/postinstall script or TTY requirement. Noble has native dependencies: clean Linux install and ordinary Homebridge Bluetooth permissions must be validated before claiming compliance. |
| Dependency audit | The source checkout’s saved audit reports six high and one critical finding in the optional Linux Noble/native build chain. Resolve and recheck before publication; no broad version override was applied without native-install evidence. |
| Comparable verified plugin | Current list has no name matching Pax or Calima. A full functionality comparison and final decision remain with Homebridge reviewers. |
| Publication | Local candidate only. npm publication and matching GitHub release remain pending acceptance. |

## Supplied icon

The project owner's original image is retained in `assets/vent-axia.png`. The square 100 × 100 PNG `assets/homebridge-pax-calima.png` matches the form's requested approximate size and format. Its text and blue background were visually checked at that size.

The verification form can include an icon. The separate icon request form requires the plugin to be verified first and the requester to be its developer. Homebridge then registers the icon centrally; adding a logo URL to package metadata alone does not enable the tile. No invented metadata field or verified badge has been added.

Prepared request details:

- npm name: `homebridge-pax-calima`
- repository: `https://github.com/KernowekConsulting/homebridge-pax-calima`
- attachment: `assets/homebridge-pax-calima.png`
- status: do not submit until the open validation and dependency items are resolved; the supplied manufacturer mark is subject to its owner's rights as explained alongside the asset.

## Release writing

Tone references: GivHome [4.1.0](https://github.com/KernowekConsulting/homebridge-giv-iog-local/releases/tag/v4.1.0), [4.1.1 changelog](https://github.com/KernowekConsulting/homebridge-giv-iog-local/blob/v4.1.1/CHANGELOG.md) and recent prereleases. The default-branch changelog currently describes stable v3, so the v4 tag was used for the recent stable style.

Lead with everyday intent and outcomes, explain what a tile does in plain language, state defaults and continuity, then separate tested behavior from future aims. Avoid claims of verification or complete compatibility while the relevant checks remain open. Drafts are in RELEASE_NOTES.md and CHANGELOG.md.

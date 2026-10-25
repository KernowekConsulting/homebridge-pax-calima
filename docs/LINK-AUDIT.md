# Public link audit — 25 October 2026

The owner chose to hold the Homebridge homepage-button correction until full 2.5.0. Stable 2.4.5 and published beta.2 remain unchanged.

| Surface | Observed result | Correction / acceptance |
| --- | --- | --- |
| Installed plugin version in the Pi UI | 2.5.0-beta.2 | Confirmed in Safari. |
| Pi Plugin Information → PLUGIN HOMEPAGE | `https://github.com/JayC68/homebridge-pax-calima` | Confirmed actual link. Homebridge obtains it from npm latest (2.4.5), rather than the installed beta. Verify the new site on this actual button after stable promotion. |
| Public beta.2 homepage | `https://homebridge.svarahome.kernowekconsulting.co.uk` | Already correct; registry metadata and public tarball verified. |
| Public beta.2 issue-tracker URL | Same SvaraHome site | Working source now restores `https://github.com/KernowekConsulting/homebridge-pax-calima/issues`. Homebridge's release-note discovery needs a GitHub homepage or issue tracker. Setup/support links still use the SvaraHome site. |
| Public beta.2 repository URL | Current KernowekConsulting GitHub repository | Correct and retained. Stable 2.4.5 still references the old JayC68 repository address; stable promotion must replace that metadata. |
| GitHub repository About → Website | Previously empty | Set to the requested SvaraHome site and read back successfully. This metadata change does not publish a plugin version. |
| README, changelog and release-note website links | Requested SvaraHome site | Correct. GitHub release/source/issue links and official Homebridge references retain their appropriate destinations. |
| Packaged documentation links | Live report and trial records were referenced but absent from the npm allowlist | Working source now includes both plus the stable-promotion checklist referenced by the revised verification report. All 13 relative Markdown links in the package resolve to source files and are included. Package dry-run lists 22 files. |
| Website response | DNS resolution failed from this Mac on both release and follow-up checks | Remains a site acceptance item. Exact supplied address is retained; no guessed alternate hostname or DNS change was made. |
| Logo / orange verification shield | Default Homebridge icon; unverified | Expected pending Homebridge review/central icon registration, not a missing package homepage field. Approved 100 × 100 PNG is ready. |

The upstream [Homebridge plugins service](https://github.com/homebridge/homebridge-config-ui-x/blob/latest/src/modules/plugins/plugins.service.ts) supplies homepage and issues from npm's latest endpoint. Its GitHub release-note lookup tries the homepage and then the issue tracker, using [RE_GITHUB_REPO](https://github.com/homebridge/homebridge-config-ui-x/blob/latest/src/core/regex.constants.ts). The working metadata was checked against that expression and identifies KernowekConsulting/homebridge-pax-calima correctly.

These source corrections are unreleased promotion preparation. No existing npm version, prerelease tag, fan configuration or runtime behaviour was overwritten. Follow [STABLE-PROMOTION.md](STABLE-PROMOTION.md) before declaring the full release complete.

# Dependency security — 2.5.0-beta.1

25 October 2026. The seven recorded findings have been removed from the candidate dependency tree.

| Check | Before | After |
|---|---:|---:|
| High vulnerabilities | 6 | 0 |
| Critical vulnerabilities | 1 | 0 |
| Total vulnerabilities | 7 | 0 |

## Change

Replaced `@abandonware/noble@1.9.2-26` with the exact published `@stoprocent/noble@2.8.0` and updated the runtime import. The maintained package resolves `@stoprocent/bluetooth-hci-socket@2.3.0` through the lockfile. It retains the callback/Promise GATT API used by this plugin.

The old optional Linux HCI package brought in `@mapbox/node-pre-gyp`, `node-gyp` and vulnerable `tar` versions. Those packages, along with the abandoned Noble/HCI packages, are now absent from this candidate tree. No audit suppression, omitted optional dependencies, npm overrides or force-fix were used to achieve the result.

Source evidence: the installed published package contents and integrity-pinned lockfile, [maintained Noble source](https://github.com/stoprocent/noble) and [Linux HCI source](https://github.com/stoprocent/node-bluetooth-hci-socket). The published tarball version is authoritative for this build; the upstream default-branch package version differs from its published version.

## Evidence

- `dependency-audit-before.json`: preserved seven-finding baseline.
- `dependency-audit.json`: fresh full-tree audit, zero vulnerabilities.
- `dependency-audit-production.json`: fresh production audit, zero vulnerabilities.
- `dependency-audit-consumer.json`: zero vulnerabilities in a fresh consumer installation of the actual beta tarball. Native dependency install scripts were enabled; the packaged entry point loaded with no Bluetooth activity when unconfigured.
- `removed-dependency-check.json`: old Noble/HCI/archive/native-build chain absent.
- `dependency-audit-linux-arm64.json`: clean separately installed production tree resolved for Linux ARM64, zero vulnerabilities. It includes the new native HCI package; it was not silently omitted.
- `linux-arm64-resolution.log`: fresh `npm ci --omit=dev --ignore-scripts --os=linux --cpu=arm64`. Lifecycle scripts were deliberately disabled because the host is macOS. This checks dependency resolution and audit, not Linux binary execution.
- Native dependency install scripts completed locally. The macOS Noble native addon loads on Node 22.23.4 and 24.19.0 without creating or starting an adapter. The Linux-only HCI addon cannot be executed on macOS and is not claimed tested here.
- 32 tests pass with Node 22/24 and real Homebridge 1.11.4/2.4.0 services. Three added tests instantiate the maintained Noble/Peripheral/Service/Characteristic classes with a simulated physical binding, exercising authenticated read/write, rescanning, disconnection, rejected authentication and expired override decoding.
- CI now runs full and production audits with a high-severity failure threshold, native install/load checks and the compatibility test matrix. `scripts/check-native.cjs` resolves optional dependencies from Noble itself, supporting both nested and hoisted layouts. The GitHub Linux workflow passed all four Node 22/24 × Homebridge 1/2 combinations before beta publication: https://github.com/KernowekConsulting/homebridge-pax-calima/actions/runs/40179681093. The workflow result and tested commit are recorded in `github-ci-release.json`.

Audits describe known advisories returned at check time; they are not a guarantee against undiscovered issues. Repeat them before publication.

## Remaining acceptance

After the owner unlocked the Mac, an isolated production dependency installation on the Homebridge Pi completed with native lifecycle scripts enabled. The native HCI dependency loaded successfully on Linux ARM64 under the installed Node 24.22.1 and an isolated Node 22.23.4 runtime. Noble remained uninitialised in both checks: no scan, radio start or fan connection occurred. The Pi audit also returned zero vulnerabilities.

The first checker incorrectly assumed the HCI package would be hoisted to the project root. npm had correctly nested it under Noble. Resolving from Noble’s own package fixed the checker; the module itself required no repair. This initial failed check and its correction are retained in the evidence.

`pi-native-evidence.json` preserves the complete result, Pi audit and install logs; `pi-native-result.json` and `dependency-audit-pi.json` provide separate views. The evidence capsule’s SHA256 is `26407c16508f1fdb5e5c4edf8c09ffdbcede0c9e65c9e659a076387fde9ee8ec`.

Homebridge configuration and installed 2.4.5 plugin source hashes matched before/after. All five observed Homebridge process IDs remained unchanged, including the fan bridge PID 167016. No production plugin deployment, bridge restart, adapter permission change or fan write occurred. Native Linux install/load is now verified; the actual plugin’s Pi/Home acceptance tests remain outstanding.

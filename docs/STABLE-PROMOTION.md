# Stable 2.5.0 promotion checks

The owner has chosen to hold the homepage-button correction for full 2.5.0. There is no authorisation here to publish 2.4.6 or promote a beta to `latest`.

## Why the button differs during beta

Homebridge UI's `getPluginFromNpm` obtains the package at `/homebridge-pax-calima/latest`, then uses that package's `homepage` and `bugs.url` for its links. Choosing a newer beta for update detection does not replace those metadata fields. The installed version can therefore be beta.2 while the homepage button still uses stable 2.4.5's old GitHub address.

Verified on the owner's Pi on 25 October: installed version 2.5.0-beta.2; Plugin Homepage target `https://github.com/JayC68/homebridge-pax-calima`. The public beta.2 package has the intended website URL. Source: [Homebridge UI plugins service](https://github.com/homebridge/homebridge-config-ui-x/blob/latest/src/modules/plugins/plugins.service.ts).

The same service locates GitHub release notes from either the homepage or issue-tracker URL. With a separate website homepage, retain the GitHub issue tracker. Repository metadata must also use the current organisation.

## Prepare the stable build

- Set package and lockfile versions to `2.5.0`.
- Use homepage `https://homebridge.svarahome.kernowekconsulting.co.uk`.
- Use issue tracker `https://github.com/KernowekConsulting/homebridge-pax-calima/issues`.
- Use repository `git+https://github.com/KernowekConsulting/homebridge-pax-calima.git`.
- Keep setup/support website links on the SvaraHome site. GitHub issue, release, source, Homebridge requirement and dependency-reference links have distinct purposes and must retain their appropriate destinations.
- Check all relative Markdown links against the shipped files and repository tree. The linked redacted live report and trial records are now on the package allowlist.
- Rewrite RELEASE_NOTES.md for the final stable behaviour. Consolidate Unreleased and beta changes into a single 2.5.0 entry; remove beta-version entries from the stable CHANGELOG.md. Existing prerelease tags/releases retain beta history.
- Reconcile the latest beta acceptance evidence, including Siri with the owner's actual Home names, reconnection, expiry/cancellation and extended operation. Record limits honestly; automated HAP trials do not establish voice recognition or uninterrupted Bluetooth reliability.
- Run the Node 22/24 × Homebridge 1/2 checks, native install/load check, full/production audits and package checks on the exact release commit. Verify public source, issues and matching release notes.
- Confirm that the new site resolves and responds over HTTPS. It did not resolve from the Mac at the beta.2 release check; do not silently treat that as completed.

## Verify the published result

Only perform the promotion when the owner requests it.

- Publish the tested stable package, matching GitHub release and tag. Ensure the repository's default branch contains the stable source/docs reviewers will inspect.
- Read npm's `latest` endpoint: version must be `2.5.0` and all three URLs above must match. Download the public tarball and compare its checksum and metadata with the checked artifact.
- Allow Homebridge's registry metadata cache to refresh (the upstream service uses a five-minute package cache), then refresh the plugin page. A whole-Pi reboot is unnecessary for this check.
- Open SvaraHome's Plugin Information modal and inspect **PLUGIN HOMEPAGE** itself. It must point to the requested site; following it must load the intended page.
- Verify Homebridge's release-note/changelog view resolves the matching GitHub notes and that the website support link works. Inspect the issue-tracker and repository destinations separately.
- Save actual link targets and results in the release evidence. Registry metadata alone is insufficient acceptance evidence for the UI button.
- Reassess docs/VERIFICATION.md, then prepare a verification request with the approved 100 × 100 icon. Submitting it is a separate external communication requiring the owner's instruction.

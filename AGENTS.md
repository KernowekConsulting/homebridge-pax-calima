# SvaraHome project instructions

The approved public name is SvaraHome. Keep the existing npm identifier, platform alias and accessory identities unless a separate migration is authorised.

## Releases

Use the owner's approved Release Notes and Changelog wording, including their edit to the Siri example. Update factual validation/security details as evidence changes, without treating approval of release copy as approval to publish or deploy.

When promoting beta to a stable release, rewrite RELEASE_NOTES.md around the final stable behaviour and consolidate beta changes under the stable version in CHANGELOG.md. Remove beta-version entries from the stable changelog. Retain beta history in GitHub prereleases and tags; do not leave beta notes in the stable Changelog.

The approved SvaraHome logo is in assets/. Preserve original fan identities and user room names through upgrades.

## Stable promotion links

The owner chose to hold the Homebridge Plugin Homepage button correction for full 2.5.0, rather than publishing a metadata-only 2.4.6. Do not promote a beta to npm latest to change the button.

Before calling the stable promotion complete, follow docs/STABLE-PROMOTION.md. The Homebridge UI reads homepage and issue-tracker metadata from npm latest even when a beta is installed. Verify the actual Plugin Homepage button points to https://homebridge.svarahome.kernowekconsulting.co.uk after stable publication and cache refresh. Keep the GitHub repository and issues URLs on KernowekConsulting/homebridge-pax-calima so Homebridge can find release notes. Check the website response and disclose any unresolved DNS/HTTPS issue.

## Public documentation and final 2.5.0 release copy

The owner treats 2.4.5 as deprecated and wants the public guide to focus on 2.5. Do not restore the legacy feature guide or frame the README as a comparison of supported product lines. Until stable publication, retain a short, accurate installation/channel note so users can obtain the 2.5 build described.

For full 2.5.0, RELEASE_NOTES.md and CHANGELOG.md must communicate only added value, changes since 2.4.5 and essential upgrade information. No beta discussion, internal workings, investigations, test chronology or release-process narrative. Keep development evidence in docs/ and prior prerelease tags/releases. The working release notes are the concise 2.5 copy; the changelog remains explicitly Unreleased until publication.

The owner specifically requires npm's default public README to lose the false legacy feature list at stable 2.5.0 publication. Check the exact tarball's README before publication and the rendered https://www.npmjs.com/package/homebridge-pax-calima page afterwards. A cleaned GitHub README alone is not completion. Follow the explicit obsolete-claims checks in docs/STABLE-PROMOTION.md.

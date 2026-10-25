# Release continuity

The owner approved the SvaraHome logo and the 2.5.0-beta.1 Release Notes/Changelog on 25 October 2026. The approved Release Notes include “Siri, boost the fan.” in the Boost example. Actual Siri acceptance still depends on Home names/scenes and remains a live test.

Security work updates the changelog's dependency and test evidence. Approval of copy does not authorise npm publication, GitHub release publication or a production Pi deployment by itself.

Publish an accepted beta under the npm `beta` tag, leaving `latest` on the stable version. Use a matching GitHub prerelease and package version. Rebuild and record the package hash after approved final wording is saved.

When promoting to stable 2.5.0, replace the beta release notes with the final stable story and consolidate all beta-cycle changes under 2.5.0 in CHANGELOG.md. Remove beta-version sections from that stable changelog. Retain beta history in GitHub prereleases/tags, following the GivHome release-history style. Update validation statements to the evidence actually obtained; do not carry outstanding beta caveats forward as if still current, or erase unresolved limits.

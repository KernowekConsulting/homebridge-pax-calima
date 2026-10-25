# Release writing and continuity

For full 2.5.0, write RELEASE_NOTES.md and CHANGELOG.md around added value and changes since 2.4.5. The owner treats the older release as deprecated; the public guide should focus on 2.5.

- Explain what users gain, how controls behave and essential upgrade steps or limitations.
- Keep beta discussion, internal workings, investigations, test chronology and release-process narrative out of both final documents.
- Keep development evidence in docs/ and prior immutable release tags. Do not turn that evidence into a release diary.
- Review the concise working 2.5 copy against the final behaviour, then remove the changelog’s Unreleased label only at stable publication.

The intended spoken example is “Siri, turn on Boost Fan in the kitchen”, using the actual room/control names. Siri acceptance remains dependent on the owner’s Home setup.

Approval of wording alone does not authorise publication or deployment. Follow [STABLE-PROMOTION.md](STABLE-PROMOTION.md) when the owner requests promotion. A requested prerelease uses npm’s beta channel and a matching GitHub prerelease; it must not move the stable channel merely to change a homepage button.

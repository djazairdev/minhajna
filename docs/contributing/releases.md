# Releases and the changelog

This guide is mostly for maintainers. Contributors need only [adding a release note](#adding-a-release-note).

- [The calendar](#the-calendar)
- [Branches and tags](#branches-and-tags)
- [Who releases](#who-releases)
- [The release checklist](#the-release-checklist)
- [Signing](#signing)
- [Fixes and security releases](#fixes-and-security-releases)
- [The changelog](#the-changelog)
- [Reference-data releases](#reference-data-releases)

## The calendar

Releases follow the school year ([PRD §1.9](../prd/PRD.md#19-official-builds-releases-the-name-and-security)).

- **Freeze windows.** In the two weeks before each term-end export window, only fixes ship. The windows fall around mid-December, March and May. Each year's freeze dates go on the roadmap as soon as the ministry publishes its calendar.
- **During a freeze:**
  - the apps and the server ship patch releases only;
  - the server has no maintenance ([PRD §6.8](../prd/PRD.md#68-non-functional-requirements));
  - calendar fixes still ship within 24 hours, because they are fixes ([PRD §4.4](../prd/PRD.md#44-the-yearly-cycle));
  - security fixes ship as soon as they are ready.
- **Outside the freezes,** minor releases ship when they are ready, each through the public beta group first.
- **The new school year.** The release that teachers set up the year with ships before they return in September, so nobody starts a year on a build that is about to change.

## Branches and tags

- **Release branches.** When a release is prepared, a branch `release/<major>.<minor>` is made from `main`. From then on it receives only fixes:
  1. the fix is merged into `main` first, through a pull request;
  2. a maintainer copies it to the release branch with `git cherry-pick -x`, which records where it came from.
- **Patch releases** come from the release branch.
- **Tags** are annotated and signed by the release manager:
  - `v1.5.0` and `v1.5.0-beta.1` for the apps;
  - `server-v1.2.0` for the server.
- **A pushed tag is never moved or deleted.** A mistake gets a new version. The first two releases were tagged `app-v0.1.0` and `app-v0.2.0`; those tags stay, beside `v0.1.0` and `v0.2.0` on the same commits.

## Who releases

- **Each release has a release manager,** a maintainer named in a public release issue.
- **The release issue holds the checklist below,** ticked as the work is done.

## The release checklist

**Before the first beta**
1. The freeze dates are respected.
2. Each privacy-sensitive change has two maintainers' approval and its plain-Arabic line. While there is only one maintainer, its public notice goes out at least a week before the release ([PRD §1.7](../prd/PRD.md#17-contributions)).
3. The release notes in `CHANGELOG.md` cover every change teachers can see, with both English and Arabic text complete.

**Checks on the release commit** ([PRD §6.9](../prd/PRD.md#69-security-and-privacy-while-building))

4. Dependencies: every licence is compatible with AGPL-3.0, and no known vulnerability is left unexplained.
5. Secret scanning is clean.
6. `NETWORK.md` matches the code: every address the app contacts, what it sends and why.
7. The build is reproducible: two independent builds from the tag give the same result, apart from the signature.
8. The tests pass:
   - the published test cases, in both apps;
   - every export imports back to the same records;
   - the database upgrades from every earlier release, and every older file version opens.
9. Any print layout that changed is printed at 100% on A4, in black and white, and checked against the printed samples ([PRD §6.8](../prd/PRD.md#68-non-functional-requirements)).
10. Changed screens are checked right to left, with text at 200% and with the screen reader. The speed targets hold on a budget phone.

**Beta**

11. The beta goes to the public beta group for at least a week. Anything serious it finds is fixed, and a new beta follows.

**Release**

12. The release manager signs the tag. The release is built from the tag and signed, and the SHA-256 checksum of each file is published with it.
13. The release is published:
    - on GitHub, titled with its tag (`v1.5.0`), with the notes, the files, the checksums and the signatures. A beta is marked as a pre-release; the newest release is marked as Latest;
    - on the project's website, with the signing key's fingerprint and the checksums, which the README repeats ([PRD §1.9](../prd/PRD.md#19-official-builds-releases-the-name-and-security));
    - on Google Play, as a staged rollout;
    - on F-Droid, which builds it from the tag.
14. It is announced in Arabic in the teacher group ([PRD §1.11](../prd/PRD.md#111-community-transparency-and-building-in-public)).

**After the release**

15. For the first week, maintainers watch the problem reports and the store reviews, and halt the rollout if something serious appears.

## Signing

- **Official builds are made only from the public source** ([PRD §1.9](../prd/PRD.md#19-official-builds-releases-the-name-and-security)).
- **Signing keys are held by named maintainers,** with an offline backup. They never enter a repository, and no check that runs on a pull request can reach them ([PRD §1.4](../prd/PRD.md#14-what-is-open-and-what-stays-private)).
- **One signing certificate for every official Android source.** A teacher can then move between Google Play, the website and F-Droid without reinstalling the app and losing its data. Google Play signs with the project's own key, and reproducible builds let F-Droid ship the project's signed build.
- **A lost or exposed key is a security incident** ([SECURITY.md](../../SECURITY.md)).

## Fixes and security releases

- **A fix between releases** takes the same path: a pull request into `main`, a cherry-pick to the release branch, then a patch release. The beta may be shortened, but the checks never are.
- **A security fix** is prepared in private, in a GitHub security advisory. It ships in a release, then the advisory is published, crediting the reporter. Critical flaws are fixed within 7 days ([PRD §6.7](../prd/PRD.md#67-the-server-and-its-operators)).

## The changelog

`CHANGELOG.md` holds the release notes for teachers. New entries are in English and Arabic; earlier releases keep their original wording. The Arabic notes are also used in the app and in the teacher group ([PRD §1.9](../prd/PRD.md#19-official-builds-releases-the-name-and-security)).

- **Written for teachers:** what changes for them, in plain words, without jargon or code names.
- **Newest first.** Pending notes go under `Unreleased` at the top. Each published release has its version and date, then its sections.
- **Credit.** Each release thanks its contributors. Only those who agreed are listed, under the names they chose ([PRD §1.7](../prd/PRD.md#17-contributions)).
- **Changes only developers notice,** such as refactors and new checks, stay out of `CHANGELOG.md`. The GitHub release lists every merged pull request.

Each release has these sections, in this order, each only when it has entries. The Arabic notes in the app use the same sections.

| Section | For |
|---|---|
| New | New features |
| Changed | Changes to existing features |
| Going away | Features to be removed in a later release ([versioning.md](versioning.md#taking-something-away)) |
| Removed | Features removed |
| Fixed | Bug fixes |
| Privacy | Every privacy-sensitive change, in plain words. The app's Arabic notes carry its plain-Arabic line ([PRD §1.7](../prd/PRD.md#17-contributions)) |
| Security | Security fixes |

### Adding a release note

A pull request that changes something teachers can see adds a short note under `Unreleased` in [CHANGELOG.md](../../CHANGELOG.md#unreleased), using the section names above. Put the Arabic translation immediately below the English entry, as a nested bullet:

```markdown
### New

- You can now mark the whole class present in one tap.
  - يمكنك الآن تسجيل حضور القسم كله بضغطة واحدة.
```

- **Write for teachers.** Describe what changes for them, not how the code works.
- **If you can't write the Arabic line,** a maintainer adds it before the release.
- **Credit** is agreed in the pull request. Only contributors who consent are named in the release notes.
- **Keep other pending notes.** If another change edits the same section, keep both entries when resolving the conflict.
- **Before tagging a release,** the release manager changes the `Unreleased` heading to the version and release date, following the existing headings, and starts a fresh `Unreleased` section above it. The Arabic entries are copied into the app's release notes and the teacher announcement. Published notes stay in `CHANGELOG.md`.

## Reference-data releases

Plan packs and calendars have their own pipeline and yearly cycle ([PRD §4.3](../prd/PRD.md#43-the-pack-pipeline), [§4.4](../prd/PRD.md#44-the-yearly-cycle)):
- each release moves from draft to under review to published, and later to superseded or withdrawn;
- two people check each release against its sources;
- every release is signed.

The data repository's guide covers them.

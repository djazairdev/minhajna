# Curator pack list

Verification of [#611](https://github.com/djazairdev/minhajna/issues/611), part of [#531](https://github.com/djazairdev/minhajna/issues/531), on 2026-11-01. All plans, files, worlds and people used here are made up.

## Scope

The curator's Packs page in a national demo world now lists the supplied reference catalogue. Each release shows its grade and subject, recorded source status and meaning, release, provenance and selectable pack ID. A stale release also shows its reason when supplied. All five PRD statuses are supported, and the bundled examples keep their separate Example status. An example's explanation appears once.

Every release stays visible, newest first within its pack ID. An older release is not silently hidden, promoted to Stale or given a lifecycle state. A filter changes only the list; All restores it. An empty catalogue, a filter with no match and unreadable source files have distinct messages. A teacher's own list never enters the catalogue.

This is #611's list, following PRD section 4.2 and R-4.2-23. Draft metadata editing, publication authority and release lifecycle are #612's work; item editing is #613's. This page changes no reference pack, teacher pin, history or record. It accepts reference inputs only and adds no storage, dependency, permission or network call.

The maintainer asked to proceed before #515 has a pack-list board. The page therefore uses the existing workspace, badges and filters, as the demo's other pages do before their design exports. This is an implementation for review, not approval of a new canvas board. The route is limited to the curator's Packs page. The Ministry's calendar route from #763 is preserved.

## Translations and accessibility

New words live in the bundled `editorPacks` namespace, in `apps/android/src/editor/text/ar.json`, `fr.json` and `en.json`. The main language catalogues are unchanged. The namespace is covered by REUSE and registered for the existing Weblate configuration; tests use a fake API, and no translation service was contacted.

The shared chip control now exposes `aria-checked` as well as the native checked state, and aligns its label for the current direction. Browser review caught that the web version previously omitted the selected state. The pack list's Arabic paragraphs explicitly align right. Labels can wrap, with no line clamp or text scaling cap.

## Checks

| Check | Result |
|---|---|
| Root types and tests | Passed: 1,139 core, 24 sync, 17 web-storage and 57 tools tests |
| Full app suite on main `6260d284` | 391 suites and 3,009 tests passed; the four previously reported notices failures did not reproduce |
| After rebase onto main `d43cab0c` | Android types and all 75 tests in eight affected curator, chip, catalogue, workspace and Ministry calendar suites passed |
| PR refresh onto main `387dcdfc` after #764 | Android and PC types, 48 tests in seven affected workspace/calendar suites, changed-router lint and the PC production build passed; the Ministry calendar keeps its new `kit` input |
| PR refresh onto main `8a35f321` after #770 | Android and PC types, 43 tests in eight affected workspace/calendar suites, changed-router lint and the PC production build passed; the curator route sits after the calendar routes to reduce shared-router conflicts |
| PC web app | Type check, 128 tests and production build passed; final build and type check repeated after rebase |
| Repository lint and formatting | Passed; repeated after rebase |
| File licences and patch rules | REUSE 6.2.0 passed with its supported `chardet` detector; whitespace, file length and Arabic-placement checks passed |

Browser review used the real components in a temporary local fixture because the live demo server was unreachable. Arabic, French and English statuses, selected-state accessibility, Enter-key filtering and empty/unreadable-file states were checked. Arabic and English were also checked with long source text and identities at 200% text size, doubled in the fixture; neither list overflowed horizontally. These are component checks, not a successful live-server session or a manual screen-reader listening check.

The full app's made-up-server integration tests open the curator through the real workspace, keep both bundled releases, check that filtering writes nothing and teacher history stays closed, reset the filter on leaving the page, and remove the editor when the role changes.

No Android build or physical-device acceptance is claimed for this PC workspace page. The shared chip change retains the same native checked values, and its existing tests pass. No new teacher workflow or record format is introduced; the curator page is documented here rather than in the teachers' release notes. All changed files stay below 300 lines, new comments are in file headers, and new Arabic text appears only in catalogues and tests.

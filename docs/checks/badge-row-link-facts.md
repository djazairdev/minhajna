# Badge, RowLink and kept Facts (#135)

Local implementation and native checks on 2026-10-17 for [#135](https://github.com/djazairdev/minhajna/issues/135), part of #20, with publication checks on 2026-10-18. Branch `codex/135-badge-row-link-facts` started from main `ae844d5` and was rebased onto `85bfb3a` before publication. Results here are local, not CI results.

The rebase preserves upstream gallery entries and welcome tests alongside this contribution. The new control implementations are unchanged by integration. Automated checks and the native build are repeated after rebasing; the earlier emulator interactions are not repeated on the new baseline.

## Contract and design

- `Badge` follows its [design page](../design/system/components/Badge/README.md): short caller-translated content states, with default (`pill-on`/`ink2`), done (`ok`/`ok-ink`) and warning (`notice-strong`/`notice-ink`) variants. Every state is a word, never a teacher rating. It is static text, not a control or an unsolicited live region. Unlike the canvas's no-wrap badge, it permits wrapping at enlarged text sizes.
- `RowLink` follows its [design page](../design/system/components/RowLink/README.md): one full-width, growing target of at least 56 dp, with a decorative icon, title, optional explanation and direction-aware chevron. It is a button for internal navigation, named by its title; the explanation is a spoken hint unless the caller supplies another. There is no URL-opening behaviour. Disabled rows have no action handler and retain their target and name.
- The row uses the corrected `controlBorder` rather than the decorative canvas line. Its pressed ground is `link-row`, with a dark border; its inset focus ring is separate from pressed feedback. The privacy notice adopts this row without changing the translated title, destination, first-use acceptance, Back handling or external-link confirmation.
- `Facts` preserves the welcome's three-promise API. Its new `kept` API shows every result, not just the first three. Kept results have a tick; exclusions have a cross and strike-through. Each grouped spoken name includes the caller's translated kept/not-kept words, because strike-through alone is not spoken. Icons are decorative. This is a display summary, not storage, deletion, export filtering or a new record layer.
- The cross is bundled vector artwork from the existing CC BY-SA design canvas, with its own SPDX header. `Icon` registers it; the existing `@drawable/icon_*` keep rule covers it. No icon is downloaded.
- Text is uncapped, wrapping and aligned with the local direction, without ellipsis, shrinking or fixed text height. Arabic, French and English previews include all badge variants, a longer two-word badge, title-only and long/disabled rows, and four synthetic kept results including a long line and an exclusion. Row previews change only a local activation counter.

## Automated and build checks

| Check | Local result |
|---|---|
| Locked installs | Root offline install and Android `npm ci --no-audit` pass after rebasing; lockfiles unchanged by this PR |
| Type checks | Root and Android pass |
| Tests | 262 core and 13 sync-check tests pass; 1,062 Android assertions pass, but the full Android command exits 1 on the upstream teardown error below |
| Focused checks | All 147 tests across the six component/gallery/privacy/contrast suites pass with exit 0 |
| Badge and Facts | All three languages, both directions and 100%/200% font environments; named states, palette pairs, uncapped text, spoken exclusions, distinct marks, all kept results and the original promise limit |
| RowLink | The same language/direction/font matrix, whole-row action, title/hint, mirrored chevron, disabled state, optional explanation, pressed feedback, focus/blur and target-size contracts |
| Integration | Gallery state and activation feedback, inactive row unchanged, and privacy-to-connections navigation in every language/direction; `accessibilityProblems` empty |
| Contrast | Text pairs for the three badges and pressed row, plus row focus and chevron, pass; existing checks cover paper/sheet outlines and fact text |
| Native build | ARM64 debug APK builds after rebasing with the cached offline Gradle toolchain |
| Hygiene | Lint/formatting, diff checks and Gitleaks pass; maintained files stay below 300 lines |
| Licences | REUSE 6.2.0 passes with the isolated `chardet` detector |

The full Android command is not green: `joint-class.test.tsx` imports native views after Jest teardown and exits 1 despite its passing assertions. The same isolated test exits 1 on an unmodified archive of main `85bfb3a`, using the same locked dependencies. The second test remounts through `addJoint` without unmounting its first renderer; cleanup reaches only the later tree. This contribution leaves that unrelated test unchanged rather than suppressing the failure. The PR must disclose it for maintainer review. The full suite also emits `act` warnings from unchanged AboutBuild, Entry/LessonSheet and Classes tests.

Mocking font scale checks component contracts, not actual native layout. Native observations are recorded separately below. The existing REUSE detector workaround avoids an unchanged demo-pupils UTF-8 chunk-classification problem; it adds no app dependency and changes no source header or licence annotation.

## Native observations and limits

These observations are from the original `ae844d5` baseline on 2026-10-17, not a new native acceptance pass after rebasing. The isolated AOSP ARM64 Android 8/API 26 and Android 15/API 35 emulators use 360×800 dp displays (720×1600 pixels, density 320). Only synthetic content is used; the third emulator is not touched.

- Arabic RTL at 100% and 200% passes on both versions, with system text scale confirmed as `1.0`/`2.0`. All badge words remain complete. Long row titles/explanations and kept lines wrap without horizontal clipping. Full-row targets are at least 48 dp; the two available rows increment the local counter to 2, and tapping the disabled row leaves it unchanged. Native metadata names each row and explicitly distinguishes kept results from exclusions. Tick/cross artwork and strike-through were visually inspected.
- The actual privacy-to-connections flow passes at 200% on both versions. Keyboard Tab reaches the titled row and its inset focus ring is visible. The row opens the offline Connections page; Android Back returns to the notice with its first-use acceptance still available. No acceptance, external link or record write is triggered by this check. Screenshots were visually inspected.
- Arabic forced LTR at 200% passes on Android 8: the same badge, row, activation/disabled and kept-state checks pass. Screenshots confirm reversed icon/chevron positions, start-aligned words, complete wrapping and distinct tick/cross marks. This checks local layout and interaction, not spoken acceptance.

Both original system text scales are restored to `1.0`; the interface language remains Arabic. Preview apps and the task-only server are stopped, and task-only localhost forwards and temporary UI dumps are removed. Screenshots and logs remain outside the repository. The initial native helper was corrected to handle off-screen content, safe screen bounds and Android's retained clickable flag on disabled controls; the final checks use disabled state and unchanged activation count, without changing app behaviour to satisfy the helper.

Human TalkBack listening remains pending in Arabic, French and English: confirm badge words, one titled row with its explanation, decorative icons skipped, and explicit kept/not-kept announcements in reading order. Native metadata and automated tests are not spoken acceptance. Native French/English visuals, physical/budget-phone acceptance, landscape and complete hardware-keyboard/switch navigation are not certified. No release reproducibility, size comparison or F-Droid scan is repeated for this UI slice.

## Privacy and release notes

No new app dependency, permission, network request, storage, encryption, sync, insights, export, official-file or record-history flow. `NETWORK.md` is unchanged. All preview content is synthetic. The localhost developer server and emulator forwards are test infrastructure, not a release-app flow. Screenshots and logs remain outside the repository.

The privacy link's focus presentation changes in release builds, so `changelog.d/privacy-row-link.md` includes English and Arabic notes. The new badge and kept-summary previews otherwise remain in the debug gallery; no PRD or decision change is needed.

To repeat: run contributor checks and build/install the debug APK. Open developer menu → **Component gallery** → **Badge**, **RowLink** and **Facts**. Try both available rows and the disabled row, verify the local activation count, and inspect all kept results. Repeat at 200% text and with the gallery direction reversed. From the privacy notice, open Connections and return without accepting the notice. Confirm speech separately with TalkBack and restore test settings afterwards.

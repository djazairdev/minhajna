# Android PageHeading and SectionHeader (#115)

Local implementation and checks on 2026-10-17 for [#115](https://github.com/djazairdev/minhajna/issues/115), on `codex/115-page-section-headings`, from main `d7de489`. The branch is independent of the still-open TextField and Notice/Snackbar PRs (#123 and #124). These are local results, not remote CI results.

## Behaviour and integration

- `PageHeading` follows the [PageHeading design](../design/system/components/PageHeading/README.md): a 36 dp, bold, bundled Aref Ruqaa title; a caller-supplied date or scope in `fact`/`ink2`; an optional neutral fact with a decorative 18 dp icon; and a slot for independently labelled actions. Scope-only headings support screens such as Classes. The title is a header, not a group containing its actions.
- Dates/scopes are displayed verbatim. The component does not parse, generate or substitute a date, consult a clock, or format a record. Screens must supply consistently formatted, translated words and Western digits.
- At ordinary text size the title/scope and trailing actions share a wrapping row. At font scale 1.5 or more, the title/scope take the full width and the actions get their own trailing row. The Android 8 check at 200% exposed a day name splitting beside the buttons; stacking prevents this while keeping the date out from under actions. Long titles still wrap and may require vertical scrolling.
- Native checks exposed Ruqaa ink clipping with the canvas's fixed `day` line height. The new title keeps the token's family, size and weight but uses native font line spacing and font-scaled vertical/horizontal ink space. The shared tokens, font assets and existing components are unchanged. The 200% test guards the padding and stacked layout; the contributor accepted the current long-title visual after reviewing the Android 15 screenshots at 200% and then 100%.
- `SectionHeader` follows the [SectionHeader design](../design/system/components/SectionHeader/README.md): `label` in `ink2`, with a translated count phrase or an independent action at the end. Counts include their unit and Western digits; pluralisation belongs to the caller. A zero phrase remains visible. The header's accessible name includes its count; the separately drawn count is hidden from accessibility to avoid a second reading. Actions are not inside that heading.
- Both components use local RTL/LTR context and logical `start` alignment, uncapped font scaling and growing layouts. No ellipsis, font shrinking, fixed text height or fixed line count hides words. Existing labelled buttons supply action targets, focus/pressed feedback and disabled behaviour.
- The debug gallery has Today with settings/add controls, a long title with an action, a scope-only page, and plain/counted/zero/action/long section examples in Arabic, French and English. Gallery callbacks change only local synthetic counters. Screens own real navigation, data, date formatting and action behaviour; the components add no persistence.

## Automated and build checks

| Check | Local result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit --offline` pass; lockfiles unchanged |
| Type checks | Root and Android pass |
| Tests | 170 core tests and 313 Android tests pass |
| Components | Every state in both directions; heading roles, typography, verbatim scope, optional fact/hidden icon, zero count, count in the spoken name, separate working actions and uncapped text |
| Enlarged text | Scaled ink space and stacked full-width page heading at 200%, without a fixed line height or size cap |
| Gallery | All three languages in both directions have no `accessibilityProblems`; title variants, five section states and independent synthetic action counters are checked |
| Contrast | Existing `ink`/`ink2` on paper/sheet and action/focus pairings retain their passing checks; no new colour pairing |
| Hygiene | Lint/formatting, diff checks, REUSE and Gitleaks pass, including new files; each maintained file stays below 300 lines |
| Native build | ARM64 debug APK builds with the cached offline Gradle toolchain |

Toolchain: Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1 and React Native 0.87.1. No dependency, permission, network call, storage, encryption, sync, insights, export, record-history or pupil-data flow changes. `NETWORK.md` is unchanged. No change teachers can see in release builds: only the debug gallery currently uses these components, so no changelog fragment is needed.

## Native observations and limits

Both existing isolated AOSP ARM64 emulators, Android 8/API 26 and Android 15/API 35, install and open the debug APK at 360×800 dp (720×1600 pixels, density 320). The development bundle uses a temporary local forward, not a release-app network flow. Only made-up gallery content is used.

- Ordinary-size Arabic previews showed the display title, separate date/fact, settings/add actions and long heading. These checks prompted the font-spacing changes above. The final enlarged layout was checked after clean app restarts as well as live style updates.
- With system font scale confirmed as 2.0, both native previews show the complete day name and date at full width and a separate trailing action row. On Android 8, the date no longer has to wrap beside the buttons. Long display titles remain scrollable rather than truncated. On 2026-10-17, the contributor reviewed unedited Android 15 long-title screenshots at 200% and then the default 100%, and accepted the visual; this is not native visual acceptance for the other languages or devices.
- At 200%, both versions show plain, counted, zero, actionable and long section labels. Android 15's native heading descriptions include `الفوج الأول. 18 تلميذاً` and `الفوج الأول. 0 تلاميذ`, with a separate `تعديل` button. This is native metadata, not proof of spoken TalkBack output.
- Settings remains a 48×48 dp native button. The add-session target at 200% is about 116.5×63 dp on Android 8 and 108×57 dp on Android 15; the section edit target is about 101.5×63 dp and 95×57 dp respectively. The buttons grow without shrinking their concise labels.

Human TalkBack listening remains pending in Arabic, French and English: confirm heading recognition, reading order, scope/fact speech, the count read once and independently reachable actions. The Arabic long-title visual was accepted as described above. Native French/English and LTR visuals, landscape, keyboard/switch navigation and physical/budget-phone behaviour are not certified. The automated language/direction matrix does not replace those checks.

No release reproducibility, size comparison or F-Droid scan was repeated for this component-only work. Screenshots and logs stay outside the repository. Test text scales are restored to 1.0, languages remain Arabic, temporary emulator snapshots/development forwards are removed and the local server is stopped after checking.

To repeat: run contributor checks, build/install the debug APK and open developer menu → **Component gallery**. Scroll to PageHeading and SectionHeader, try the actions, switch directions, and enlarge text to 200%. Read long titles across the scrollable gallery, check that dates never sit under controls, and confirm counts and action focus with TalkBack in all three languages. Use synthetic content only and restore test settings afterwards.

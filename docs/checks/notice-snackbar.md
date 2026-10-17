# Android Notice and Snackbar (#114)

Local checks on 2026-10-17 for [#114](https://github.com/djazairdev/minhajna/issues/114), on `codex/114-notice-snackbar`, from main `d7de489`. This branch is independent of the TextField PR (#123). These are local results, not CI results.

## Behaviour and integration

- `Notice` follows the [Notice design](../design/system/components/Notice/README.md): a reassurance with a decorative 18 dp icon and `small` text in `ink2`, or a dashed `notice-edge` box on `notice`, with a concise warning badge, an optional heading and an instruction. The caller supplies translated words and the icon. Each notice is one named accessibility item; its icon adds no separate spoken name. Wording explains a next step without scolding.
- Both notice styles grow with their text. Logical `start` alignment follows the local direction. The initial native check exposed Android's left/right text-alignment swap in RTL; logical alignment fixes the new components, with a regression assertion and native screenshots. This does not change existing components.
- `Snackbar` follows the [Snackbar design](../design/system/components/Snackbar/README.md): a past-tense confirmation on `board`, an independent Undo button in `hi`, `shadow-snack`, a minimum 52 dp container and a minimum 48 dp Undo target. It retains a visible boundary on Android 8 without relying on shadow support.
- The message is a `status` with a polite accessibility live region. Undo remains a separate named button, with pressed feedback and an inset `focus-on-board` ring. The component makes no focus-moving call or extra imperative announcement. Human listening is still needed to verify speech.
- Mount the snackbar in a positioned screen container. Supply `bottomOffset` as the actual distance from that container's bottom to the navigation bar's top, including its bottom safe inset; do not assume the bar is 64 dp at enlarged text. The snackbar adds a 12 dp gap and horizontal safe insets. The host must also reserve space in its content so an overlay cannot hide a task or input.
- Text scaling is uncapped, with no ellipsis or font shrinking. At font scale 1.5 or more, the message and Undo stack, leaving the full width for the message. The translated Undo label stays concise and can grow if necessary.
- The screen owns the current message, lifetime, replacement, undo callback, persistence and any reversal in history. The component sets no timer, does not expire Undo or invoke it automatically, and performs no record operation. Future screen integrations must provide real behaviour and avoid sensitive details in feedback.
- The debug gallery includes short/long reassurances, a dashed notice and two repeatable snackbar previews, using made-up words from `samples.ts` in Arabic, French and English. Each snackbar is above a real measured bottom bar. Undo hides only its own synthetic preview; the try action shows it again. The existing tab preview is extracted into a shared gallery helper without changing its behaviour.

## Automated and build checks

| Check | Local result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit --offline` pass; lockfiles unchanged |
| Type checks | Root and Android pass |
| Tests | 170 core tests and 310 Android tests pass |
| Notice | Both styles/directions; name, hidden icon, dashed box and uncapped/wrapping text |
| Snackbar | Short/long messages in both directions; status/live region, distinct Undo target, callback/replacement, navigation offset/safe insets, pressed/focus feedback, 200% stacking and no automatic expiry |
| Gallery | All three languages in both directions, including laid-out snackbar previews, have no `accessibilityProblems`; real Undo/re-show and navigation-height changes are exercised |
| Contrast | New instruction/badge and Undo colour pairings pass 4.5:1; reassurance, confirmation, border and focus pairings retain their passing checks. The dashed notice outline is decorative, backed by words |
| Hygiene | Lint/formatting, diff checks, REUSE and Gitleaks pass, including new files; each maintained file stays below 300 lines |
| Native build | ARM64 debug APK builds with the cached offline Gradle toolchain |

Toolchain: Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1, React Native 0.87.1. No dependency, permission, network call, storage, encryption, sync, insights, export or pupil-data flow changes. `NETWORK.md` is unchanged. No change teachers can see in release builds: only the debug gallery currently uses these components, so no changelog fragment is needed.

## Native observations and limits

Both existing isolated AOSP ARM64 emulators, Android 8/API 26 and Android 15/API 35, install and open the debug APK at 360×800 dp (720×1600 pixels, density 320). The bundle comes from a temporary local development-server forward, not a release-app network flow. Only synthetic gallery content is used.

- Arabic notices and snackbar previews were inspected in native trees at ordinary text size. Android 15 screenshots show the concise and long confirmations above their navigation bars at 100%. Its Undo target is 59×48 dp. Tapping Undo removes the short preview and shows the synthetic reversal message; trying again restores the preview.
- With system font scale confirmed as 2.0, screenshots on both Android versions show complete Arabic reassurances and dashed notice text with correct right alignment. The long snackbar's full message and Undo are visible in a stacked layout above the bottom bar, without horizontal clipping.
- At 200%, native Undo targets are 91×55 dp on Android 8 and 85×49 dp on Android 15. The corresponding bars are 80.5 dp and 76.5 dp tall, rather than the nominal 64 dp; their actual measurements position the snackbar. Android 15 uses non-linear font scaling, so equal system scale settings do not imply equal glyph sizes across Android versions.

Human TalkBack listening remains pending: confirm notice grouping, status announcements on appearance/replacement, the separate Undo action and no focus theft in Arabic, French and English. Native French/English and LTR visual checks, landscape, switch/keyboard navigation and physical/budget-phone behaviour are not certified here. The language/direction matrix is automated coverage, not a substitute for those checks. The gallery's fake confirmation is not proof of a future screen's persistence or undo-history integration.

No release reproducibility, size comparison or F-Droid scan is repeated for this component-only work. Screenshots and logs stay outside the repository. Test text scales are restored to 1.0, languages remain Arabic, temporary emulator snapshots and development forwards are removed, and the local server is stopped after checking.

To repeat: run contributor checks, build/install the debug APK and open developer menu → **Component gallery**. Scroll to Notice and Snackbar, try Undo and re-show, switch directions and enlarge text to 200%. Check the actual navigation height and complete long messages; repeat in all interface languages and with TalkBack. Use made-up content only and restore test settings afterwards.

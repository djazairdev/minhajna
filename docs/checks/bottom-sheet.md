# Android BottomSheet (#20)

Local implementation and checks on 2026-10-17 for the BottomSheet slice of [#20](https://github.com/djazairdev/minhajna/issues/20), on `codex/20-bottom-sheet`. This is not completion of the whole component-library issue. Work began from the reviewed choice-row commit, then moved onto main `6463018` after #127 and the subsequent gallery/setup components merged. Main's component-specific text structure and existing examples are preserved. These are local results, not CI results.

Before publication, the branch was rebased onto main `cc7b2c7` after #147 and #148. The automated and build checks below were repeated on that base. Detailed native observations were made on `6463018`; the BottomSheet, focus bridge and gallery code are unchanged by the rebase.

## Contract and integration

- Follows the [BottomSheet design](../design/system/components/BottomSheet/README.md): a caller-supplied title, context, choices and reassurance on `sheet`, with `radius-chip` top corners, `shadow-sheet` and a scrim. The handle is decorative; dragging, snapping and animation are not implemented or promised.
- Visibility is controlled by the screen. Close, backdrop and Android Back request cancellation only. The sheet never chooses, writes a record or saves an edit itself. Screens own staged edits, cancellation policy and choice callbacks. Hidden content is unmounted; keep the sheet component mounted and change `visible` so focus can return after closing.
- One scrolling body keeps the title, choices and reassurance reachable with large text or the keyboard. A separate, translated 48 dp close action stays outside that scrolling body. Text wraps without ellipsis, shrinking or a scaling cap. Direction follows local RTL/LTR context. Modal-local safe-area insets keep system bars separate from the content.
- React Native's native modal window isolates background interaction. The backdrop is not a screen-reader focus stop; the explicit close action remains available. The heading is an accessible target. Screens supply a stable native `returnFocusRef`, normally pointing to the opener; `Button` now exposes that native ref.
- Native checking caught Android returning to the first gallery button after an edited note closed. React Native 0.87 gates `View.focus()` behind the disabled `enableImperativeFocus` flag. The existing native-interface module now takes an ephemeral numeric view identifier, resolves it on the UI thread, requests Android focus in touch mode and requests accessibility focus. No label, input contents or record crosses that boundary. Invalid, removed, hidden or disabled targets are ignored. No framework flag is changed.
- Closing schedules focus return after the controlled closing commit. The native operation waits for the target window to regain focus and its next frame. Layout-phase cancellation prevents a late React effect cancelling the new heading request. Reopening, unmounting, target detachment or React-instance destruction releases pending listeners and invalidates queued work. Android has no `Modal.onDismiss` callback; animation is disabled. A missing native ref/handle or detached target is ignored safely. Native focus observations and human spoken acceptance are separate checks.
- Keyboard handling measures the modal's moving content frame and reveals only an input focused inside the sheet, rechecking focus before using asynchronous measurements. It does not store keyboard data or assume a keyboard height. Sheet focus/blur events stop at its boundary; the background gallery resizes/reveals only for its own inputs. A failing regression first proved it was reacting to the modal's input. Both scroll areas keep native children attached: clipping an off-screen opener could otherwise prevent Android 15 focus return.
- Debug-only examples cover a short choice, deliberately long content and an optional note. The examples use made-up Arabic, French and English words, transient local state and existing rows/fields. Closing is reported separately from choosing; note text is not copied into live announcements. No lesson or pupil record is created.

## Automated and build checks

| Check | Local result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit` passed before implementation; lockfiles remain unchanged |
| Type checks | Root and Android pass after main integration |
| Tests | 195 core tests and 577 Android tests pass |
| Modal regressions | All three languages in both directions, translated close, minimum targets, isolated dialog contract, growing text, hidden-content removal, cancellation without choice and controlled visibility |
| Focus regressions | Heading request only on native show, deferred return to the supplied opener, cancellation before/after native dispatch, missing/detached targets and native `Button` refs |
| Keyboard regressions | Modal-local insets, measured moving offset, own-input filtering, stale asynchronous measurements, blur/current-focus checks and background-handler isolation |
| Gallery | Short, long and form previews open, cancel without choosing, accept a synthetic note and close on a synthetic choice; the whole gallery remains covered in both directions |
| Native build | ARM64 debug APK builds with the cached offline Gradle toolchain, including the native focus operation |
| Hygiene | Lint/formatting, diff checks and Gitleaks pass; maintained files remain below 300 lines |
| Licences | REUSE 6.2.0 passes with the `chardet` detector; see the tool note below |

Toolchain: Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1 and React Native 0.87.1. No new app dependency, permission, network call, storage, encryption, sync, insights, export, record-history or pupil-data flow. `NETWORK.md` is unchanged. No change teachers can see in release builds: only the debug gallery currently uses the sheet, so no changelog fragment is needed.

The local `charset_normalizer` licence detector could not classify the first 2,048 bytes of main's unchanged `packages/core/src/demo-pupils.ts`: that chunk ends part-way through a UTF-8 Arabic character. Its SPDX headers are present. Repeating the same REUSE version with `REUSE_ENCODING_MODULE=chardet` passes every file. The alternative detector is an isolated checking tool, not a project dependency; no unrelated source or licence annotation was changed.

## Native observations and limits

Both existing isolated AOSP ARM64 emulators, Android 8/API 26 and Android 15/API 35, install and open the debug APK at 360×800 dp (720×1600 pixels, density 320). Only synthetic gallery content is used. Localhost development-server forwards are testing infrastructure, not a release-app data flow.

- At 100%, the short and long Arabic sheets show their complete title, context, options and reassurance. The close target measures 48×48 dp. The native tree while open contains the modal's controls, not the underlying gallery's buttons.
- At 100%, the synthetic note field remains above the on-screen keyboard on both Android versions, with the close action reachable. Typing `demo` works; the first Back dismisses the keyboard and leaves the sheet open with that synthetic text.
- With the focus fix, native metadata on both versions confirms the heading receives input focus, and note/Back, explicit close, backdrop and choice paths return input focus to the actual opener rather than the first gallery button. A choice closes the preview; cancellation never selects one. This is not a spoken TalkBack check.
- With system font scale confirmed as 2.0 on both versions, long Arabic titles and explanations wrap completely. Scrolling reaches the complete last choice and reassurance; the 48 dp close action stays fixed and reachable. Closing returns focus to the long-preview opener. In the 200% form, the focused note ends at pixel 946, above the keyboard starting near pixel 980 on each emulator. Typing a synthetic note and pressing close while the keyboard is open dismisses both and restores the form opener. Choosing in the enlarged short preview also closes it and restores its opener. Full-frame screenshots were visually inspected at both scales.

Human TalkBack listening remains pending in Arabic, French and English: confirm heading entry, meaningful order, background isolation, labels/states, cancellation and return to the actual opener. Native metadata and automated tests do not certify spoken acceptance. Native French/English and LTR visuals, landscape, switch navigation and physical/budget-phone behaviour are not certified. Native input-focus observations do not certify a complete hardware-keyboard navigation pass.

No release reproducibility, size comparison or F-Droid scan was repeated for this slice. Screenshots and logs stay outside the repository. After checking, text scale is restored to 1.0, the test language remains Arabic, the temporary emulator UI dumps/localhost forwards are removed and the development server is stopped.

To repeat: run contributor checks, build/install the debug APK and open developer menu → **Component gallery** → **BottomSheet**. Open all three previews, try close/Back/backdrop and a choice, edit only made-up note text, then repeat with 200% system text. With TalkBack, confirm focus enters the heading and returns to each opener rather than the first screen control. Restore test settings afterwards.

Implementation references: [React Native Modal](https://reactnative.dev/docs/modal), the installed React Native `ReactModalHostView.kt`, `ReactViewManager.kt` and `ReactNativeFeatureFlagsDefaults.kt`. The [WAI modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) informs entry/return focus; this native implementation does not claim web ARIA conformance.

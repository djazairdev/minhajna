# Switch and Stepper (#137)

Local implementation and checks on 2026-10-17 for [#137](https://github.com/djazairdev/minhajna/issues/137), part of #20. Branch `codex/137-switch-stepper` started from main `2c53412` and was rebased onto `ae844d5` before publication. It does not depend on the unmerged selection-controls pull request. Results here are local, not CI results.

## Contract and design

- `Switch` follows its [design page](../design/system/components/Switch/README.md). Its full-width row is one target, at least 56 dp tall, with a title and optional explanation spoken together. Native Android exposes a switch with its checked and disabled state. The track and thumb are decorative, not a second control.
- The track uses `board` when on and `rule` when off. The thumb moves between logical start/end with the local direction, so colour is not the only signal. A corrected `controlBorder` outline and a dark thumb edge preserve contrast on the checked light grounds; no Android-9-only shadow is required. A pressed row uses `sheet` and an ink outline rather than putting the track's border on a lower-contrast ground. Keyboard focus has its own inset ring.
- The caller must supply `value` and `onValueChange`; there is no implicit default or persistence. Anything that shares or sends must start off when a real screen adopts the control. The gallery changes only made-up display preferences, not any real sharing, notification or signature setting.
- `Stepper` follows its [design page](../design/system/components/Stepper/README.md). It takes a caller-owned count, inclusive minimum/maximum, a unit line and translated button names identifying the count. Each 48×48 dp button requests exactly one step. At a limit the relevant button is disabled; equal bounds disable both. A disabled preview changes nothing.
- Counts and bounds must be non-negative safe integers, with the value in range. Invalid programmer-supplied values throw a static `RangeError`, without echoing data, rounding, clamping, requesting a change or silently fixing a record. Zero and the largest safe integer are covered. This is a component contract, not user-input validation for a future screen.
- The count is rendered with `String(value)` in Western digits, in the bundled Latin stepper face and a stable LTR number run. Its labelled text is a polite live region. The unit line is included in that spoken name, so its visible duplicate is hidden from accessibility. Minus/plus marks are decorative, with corrected outline contrast, pressed feedback and individual focus rings on their buttons.
- Text has no line limit, ellipsis, shrinking or font-scaling cap. Switch rows grow; the stepper's unit wraps and its button/value row can wrap within the available width. The local direction controls row order and alignment. Callers should use short unit lines for concise spoken feedback and keep their screen scrollable.
- Synthetic Arabic, French and English gallery examples cover on/off and disabled switches, a long explanation, independent counters, minimum/maximum states, a long unit line and equal bounds. No pupil, session, mark or other record is created.

## Automated and build checks

| Check | Local result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit --offline` pass; lockfiles unchanged |
| Type checks | Root and Android pass, including explicit value/callback and button-name contracts |
| Tests | 236 core and 837 Android tests pass after rebasing |
| Switch | Each on/off/disabled/explanation combination in all three languages and both directions; whole-row name/target, requested opposite value, controlled state and thumb position |
| Stepper | Below/at each limit, individual button names, requested values, no internal mutation, equal bounds, largest safe count, invalid/fractional/non-finite/out-of-range inputs and Western digits |
| Growing text and focus | Uncapped wrapping props in a 200% font environment, pressed/focus styles and disabled focus suppression; actual native layout is checked separately below |
| Gallery | Independent state updates, bounded counts, updated live-region name, inactive previews unchanged and `accessibilityProblems` empty |
| Checker regression | A deliberately unnamed 20 dp disabled switch fails with the old checker; adding disabled switches makes the regression pass |
| Contrast | Existing text/outline/focus pairings plus the switch thumb edge against `rule`/`sheet` and thumb fill against `board` pass |
| Native build | ARM64 debug APK builds with the cached offline Gradle toolchain |
| Hygiene | Lint/formatting, diff checks and Gitleaks pass; maintained files remain below 300 lines |
| Licences | REUSE 6.2.0 passes with the isolated `chardet` detector |

The same local REUSE workaround as the previous UI checks is used: the default detector cannot classify a chunk of main's unchanged demo-pupils file that ends inside a UTF-8 character. No source header, licence annotation or app dependency was changed for this tool issue.

## Native observations and limits

The isolated AOSP ARM64 Android 8/API 26 and Android 15/API 35 emulators use 360×800 dp displays (720×1600 pixels, density 320). Only synthetic gallery values are used. The third emulator is not touched. Native interactions below were checked on the original `2c53412` baseline; after rebasing, the automated checks and native build were repeated, not the emulator interactions. The control implementations are unchanged by the rebase.

- Arabic RTL at 100%: both versions install/open the debug APK and pass switch changes, disabled switch states, count increases/decreases, minimum/maximum blocking and disabled/fixed counter checks. Native metadata exposes `android.widget.Switch`, full translated names and 48 dp or larger targets. Counts change between 0 and 3 in Western digits and update their complete live-region name. Screenshots were visually inspected.
- Arabic RTL at 200%: both versions pass the same interaction and boundary checks with the system text setting confirmed as `2.0`. Long switch explanations and counter unit lines wrap completely; thumb positions stay distinct and count buttons retain their 48 dp targets. Screenshots were visually inspected, including the complete long unit line and disabled/fixed states.
- Arabic forced LTR at 200%: Android 8 visual checks confirm reversed row/button order, text alignment and off/on thumb positions, with Western digits and complete wrapped text. This is a layout check; the full LTR state matrix is automated, not a claim of a new spoken acceptance pass.

Human TalkBack listening remains pending in Arabic, French and English: confirm switch role/state and explanation, contextual minus/plus names, announcement of the changed count, reading order and focus after reaching a limit. Native metadata and automated tests are not spoken acceptance. Native French/English visuals, landscape, complete hardware-keyboard/switch navigation and physical/budget-phone acceptance are not certified. No release reproducibility, size comparison or F-Droid scan was repeated for this UI-only slice.

After checking, both test text scales are restored to their original `1.0`, and the language remains Arabic. The preview apps and task-only server are stopped; task-only localhost forwards and temporary UI dumps are removed. Screenshots and logs stay outside the repository.

No new app dependency, permission, network request, storage, encryption, sync, insights, export, official-file or record-history flow. `NETWORK.md` is unchanged. The developer server and localhost emulator forwards are test infrastructure, not a release-app flow. **No change teachers can see** in release builds: only the debug gallery currently uses these controls, so no changelog fragment is needed.

To repeat: run contributor checks and build/install the debug APK, then open developer menu → **Component gallery** → **Switch** / **Stepper**. Tap the whole switch row, try each counter direction and limit, then repeat at 200% text and with the gallery direction reversed. Scroll to the ends of long explanations and unit lines. Confirm speech separately with TalkBack and restore test settings afterwards.

Native roles, checked states and polite live regions follow [React Native's accessibility API](https://reactnative.dev/docs/accessibility). These properties do not alone certify spoken acceptance.

# Android CheckRow and OptionRow (#116)

Local implementation and checks on 2026-10-17 for [#116](https://github.com/djazairdev/minhajna/issues/116), on `codex/116-choice-rows`. Work began from main `dcd9558`, then integrated main `c26df51` after the TextField, Notice/Snackbar and PageHeading/SectionHeader PRs (#123, #124 and #126) merged. Their existing examples and regressions are preserved. These are local results, not remote CI results.

## Behaviour and integration

- `CheckRow` follows the [CheckRow design](../design/system/components/CheckRow/README.md): one full-width target at least 48 dp high, a 22 dp box, a wrapping label and a visible chalk tick on `board` when checked. The canvas's 44 px target is increased to 48 dp as the accessibility page requires. The screen supplies `checked` and `onCheckedChange`; a tap requests the opposite value without persisting or silently changing it inside the component.
- `OptionRow` follows the [OptionRow design](../design/system/components/OptionRow/README.md): a full-width button at least 52 dp high, a 22 dp decorative icon, a label and optional second line on `sheet`, with a 1.5 dp outline. The outline uses the existing contrast-safe `controlBorder` role rather than the canvas's low-contrast `line`; selected and pressed outlines use `board` and `ink` respectively.
- With `selected` omitted, an option is an ordinary action button. With a boolean, it is a choice button exposing Android's selected state, plus a visible trailing tick when selected. It is not a checkbox or radio. The screen owns the selected value and mutual exclusion; the gallery demonstrates a pair with exactly one selected. Labels and explanations form one accessible name. The example privacy sentence is caller-supplied wording, not a data-handling implementation.
- Both rows use local RTL/LTR context, logical start-aligned text, full-row activation, growing height and uncapped font scaling. Only explicitly directional option icons mirror; checkbox and selection ticks keep their drawing direction. Neither labels nor descriptions use ellipsis, a line cap, font shrinking or fixed text height.
- Disabled rows expose that state and cannot call their callbacks. Pressed backgrounds and inset focus rings give feedback. Decorations are hidden from accessibility. Screens must supply translated words and meaningful icons; there are no built-in state announcements or persistence.
- The debug gallery has checked/unchecked and disabled checkbox states, an independent action, selected/unselected choice buttons, disabled options and long rows, with made-up Arabic, French and English content from `samples.ts`. Only transient preview state changes. No session or pupil record is created.

## Automated and build checks

| Check | Local result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit --offline` pass; lockfiles unchanged |
| Type checks | Root and Android pass |
| Tests | 170 core tests and 415 Android tests pass after main integration |
| Row states | Enabled/disabled, checked/unchecked, action/selected/unselected, optional explanation, callbacks, controlled values, direction, ticks, decorative icons, pressed/focus feedback and growing text |
| Gallery | All three languages in both directions have no `accessibilityProblems`; independent toggles, exclusive choices and the synthetic action counter are checked |
| Checker regression | A failing test first proved disabled checkboxes/radios escaped the existing checker; the checker now covers them even without an `onPress` handler |
| Contrast | Existing passing text/control/focus roles, plus `board` marks/outlines on paper, sheet and pressed soft, and explanation text on pressed soft |
| Hygiene | Lint/formatting, diff checks, REUSE and Gitleaks pass, including new files; each maintained file stays below 300 lines |
| Native build | ARM64 debug APK builds with the cached offline Gradle toolchain |

Toolchain: Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1 and React Native 0.87.1. No new dependency, permission, network call, storage, encryption, sync, insights, export, record-history or pupil-data flow. `NETWORK.md` is unchanged. No change teachers can see in release builds: only the debug gallery currently uses these rows, so no changelog fragment is needed.

## Native observations and limits

Both existing isolated AOSP ARM64 emulators, Android 8/API 26 and Android 15/API 35, install and open the debug APK at 360×800 dp (720×1600 pixels, density 320). Only synthetic gallery content is used. The development server and temporary localhost forwards are testing infrastructure, not a release-app network flow.

The detailed 100%/200% row checks below were made before integrating main's three component PRs. The row components and their sample rendering are unchanged after that integration; the combined tests and debug build pass again. A final Android 15 smoke check of the integrated gallery at 100% repeats long-label checkbox toggling, choice selection, disabled-row safety and the independent action counter, which changes from 0 to 1.

- At 100%, both show complete long Arabic checkbox labels with a 22 dp tick box and no truncation. Checkbox targets measure at least 48 dp high. Tapping the long label away from its box changes only its checked state; tapping the disabled unchecked row leaves it unchecked.
- Android 15 also shows full long option labels and explanations at ordinary size, with the independent action at 52 dp minimum. Tapping the long option's text moves the selected state and trailing tick from its neighbour. Native metadata exposes checkboxes with `checked`/`enabled`, and options as buttons with `selected` and the combined label/explanation.
- With system font scale confirmed as 2.0 on both emulators, long Arabic checkbox labels and option explanations wrap completely without truncation or overlap when scrolled into view. The long checkbox grows to about 156 dp on Android 8 and 120 dp on Android 15; the long option grows to about 288 dp and 228 dp respectively. Icons and ticks stay at their intended size rather than consuming the growing text area.
- At 200%, tapping the long option's text on both emulators clears its neighbour's selected state and shows its own tick. Tapping a disabled option leaves it disabled and unselected. These observations and native checkbox/button metadata are not a spoken TalkBack test.

Human TalkBack listening remains pending in Arabic, French and English: confirm one focus target per row, the checkbox role/state, label and explanation read together, selected/disabled announcements, logical focus order and whole-row activation. Native French/English and LTR visuals, landscape, keyboard/switch navigation and physical/budget-phone behaviour are not certified. Automated checks and native metadata do not replace spoken or human visual acceptance.

No release reproducibility, size comparison or F-Droid scan was repeated for this component-only work. Screenshots and logs stay outside the repository. Test text scales are restored to 1.0, languages remain Arabic, temporary emulator UI dumps/development forwards are removed and the local server is stopped after checking.

To repeat: run contributor checks, build/install the debug APK and open developer menu → **Component gallery**. Scroll to CheckRow and OptionRow, tap labels rather than just icons, try disabled rows and both choices, switch directions, and repeat at 200% text. Confirm names and states with TalkBack in all three languages. Use synthetic content only and restore test settings afterwards.

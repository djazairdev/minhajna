# SegmentedControl and RadioCard (#136)

Local implementation and checks on 2026-10-17 for [#136](https://github.com/djazairdev/minhajna/issues/136), part of #20. Branch `codex/136-selection-controls` starts from main `3d94377`, independently of the BottomSheet pull request. Results here are local, not CI results.

Before publication, the branch was rebased onto main `2c53412` after #151 and #153. Automated checks and the debug build below were repeated on that base. Detailed native observations were made on `3d94377`; the new controls and their gallery code are unchanged by the rebase.

## Contract and design

- `SegmentedControl` follows its [design page](../design/system/components/SegmentedControl/README.md). It takes exactly two or three translated choices, a group name, the current value and `onSelect`. The screen owns the corresponding content. Native tabs expose `selected`; the group is a tab list, not an accessible parent that hides its controls.
- Segments share the available width, with at least 48 dp in each dimension. The selected one uses `board` and `chalk`, plus an underline as a non-colour cue. Outlines and dividers use the corrected `controlBorder`, not the canvas's low-contrast `rule`. Focus uses `focus-on-board` on a selected segment and `focus` elsewhere.
- `RadioCard` follows its [design page](../design/system/components/RadioCard/README.md). One full-width target contains the title, explanation and decorative radio mark. Its native radio role exposes `checked`; title and explanation form one spoken name. A dot and an inset border distinguish selection without colour alone or an Android-9-only shadow.
- `RadioCardGroup` adds a translated group name and mutually exclusive caller-owned values. `selected: null` allows no initial choice. A whole group or individual choice can be disabled. Pressing a chosen item never deselects it or requests a redundant change. These controls choose no default and save nothing.
- Local direction controls reading order, dividers, radio position and text alignment. Text has no line limit, ellipsis, shrinking or font-scaling cap; minimum heights can grow. Callers should supply concise segment labels and let their screen scroll when content grows.
- Synthetic Arabic, French and English gallery examples show two and three segments, short and long radio explanations, and selected/unselected disabled states. Each preview changes only its own temporary selection. No setup screen, plan assignment or record is changed by these examples.

## Automated checks

| Check | Result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit --offline` pass; lockfiles unchanged |
| Type checks | Root and Android pass, including controlled-value and two-or-three-choice type contracts |
| Tests | 209 core and 650 Android tests pass |
| Selection | Every segment position with two/three choices, checked/unchecked radios, no initial radio choice, callback values and no internal or redundant selection |
| Disabled | Selected/unselected controls, group and individual radio disabling, unchanged values and retained names/targets |
| Accessibility | All three languages in both directions; `accessibilityProblems` is empty; decorative marks are hidden, explanations stay with their radio, and focus rings contrast with their ground |
| Growing text | A 200% font environment and uncapped/wrapping props; actual native layout is checked separately below |
| Gallery | Independent preview changes and mutual exclusion; the existing bottom-navigation test now targets its own entry rather than another preview's tabs |
| Checker regression | Disabled tabs now receive the same name/target checks as disabled buttons, checkboxes and radios; a deliberately unnamed 20 dp tab is rejected |
| Build | ARM64 debug APK builds with the cached offline Gradle toolchain |
| Hygiene | Lint/formatting, diff checks and Gitleaks pass; maintained files remain below 300 lines |
| Licences | REUSE 6.2.0 passes using the isolated `chardet` detector |

The REUSE detector workaround is unchanged from the BottomSheet verification: the default local detector cannot classify a partial UTF-8 character in main's unchanged demo-pupils file. No source header or licence annotation was changed to work around it.

## Native checks and acceptance limits

The isolated AOSP ARM64 Android 8/API 26 and Android 15/API 35 emulators use 360×800 dp displays (720×1600 pixels, density 320). Checks use only synthetic gallery content and a task-local development server.

- Arabic RTL at 100%: segment selection changes, radio mutual exclusion and disabled states pass on both versions. Native metadata reports selected tabs and checked/checkable radios, with complete translated names. Unclipped measured controls meet the 48 dp minimum. Screenshots were inspected visually.
- Arabic RTL at 200%: both versions pass selection and disabled checks. The complete long explanation remains readable, both active cards fit after scrolling, and the selected dot/inset ring and segment underline remain visible. The system setting was verified as `2.0` on both devices.
- Arabic with the gallery forced LTR at 200%: Android 8 also passes selection and disabled checks. Segment order, dividers, radio placement and text alignment reverse correctly, while complete words and the long explanation remain readable. All captured layouts were visually inspected.

Human TalkBack listening remains pending in Arabic, French and English: confirm group context, each label/explanation, selected or checked state, disabled state, reading order and focus after changing a choice. Native metadata and automated checks do not certify spoken output. Native French/English visuals, landscape, full hardware-keyboard/switch navigation and a physical budget phone are not certified. No release reproducibility, APK-size or F-Droid scan was repeated for this UI-only slice.

After checking, both text scales are restored to their original `1.0`, the app language remains Arabic, preview apps and the task-only server are stopped, and task-only localhost forwards and UI dumps are removed. Screenshots and logs stay outside the repository.

No new app dependency, permission, network request, storage, encryption, sync, insights, export, official-file or record-history flow. `NETWORK.md` is unchanged. The developer preview's localhost connections are test infrastructure, not a release-app data flow. **No change teachers can see** in release builds: only the debug gallery uses these new controls, so no changelog fragment is needed.

To repeat: run contributor checks, build/install the debug APK, then open developer menu → **Component gallery** → **SegmentedControl** / **RadioCard**. Try each choice and disabled preview. Repeat in both directions and at 200% system text, scroll through the full explanations, then restore test settings. Confirm speech separately with TalkBack.

Accessibility roles and states follow [React Native's accessibility API](https://reactnative.dev/docs/accessibility). Contrast pairings use the existing checked palette roles; no design-export values were altered.

# Android TextField (#113)

Local implementation and checks on 2026-10-17 for [#113](https://github.com/djazairdev/minhajna/issues/113), on `codex/113-text-field`. Native observations used main `62e074a`; the branch was then updated to main `d7de489`, including the merged button PR (#122), with its gallery examples and accessibility checks preserved. Automated checks were repeated after that update. These are local results, not remote CI results.

## Behaviour and scope

- A controlled native input with a concise label above it, an example placeholder, a minimum 48 dp target and the contrast-safe `controlBorder` on `sheet`. Text areas start at 80 dp and grow or shrink with native content measurements, without counting Android's compound padding twice. Enlarged fonts also increase the minimum input height.
- The screen supplies the translated label, placeholder, optional word and error. An optional field appends that word in parentheses to its visible label. The component contains no hard-coded interface wording.
- Each field has a unique native label association. The associated label's accessible name includes the optional marker and any error, even for a filled input. Errors also appear as visible text with a polite live region. This does not rely on optional speech hints or invent a non-native edit-box role. The checker now resolves input label associations and rejects missing/broken labels, including unnamed filled inputs whose values must not substitute for labels.
- Text follows the interface direction. Code and number inputs can explicitly remain LTR inside an Arabic form. Typed text is forwarded unchanged; the component does not rewrite Arabic, mixed scripts, digits, composition or line breaks. Screen callers own validation and saving; the component adds no persistence.
- Focus feedback, a native focus ref, editability, submission and keyboard options are supported. Font scaling is uncapped; labels/errors can wrap. No ellipsis or font shrinking hides text.
- Android autofill is opted out, autocomplete is off, and autocorrect/spellcheck are disabled. These are platform hints, not a guarantee about an independently installed keyboard or accessibility service.
- The debug gallery has editable empty, filled, text-area, optional, error, LTR-code and numeric examples, with synthetic words in Arabic, French and English. Edits stay in transient component state. A keyboard-aware gallery wrapper measures the real header offset, resizes the viewport and reveals the focused input on focus, resize and content growth. It adds no timer, dependency or native change.

The implementation uses React Native's [TextInput API](https://reactnative.dev/docs/textinput), [native label associations and live regions](https://reactnative.dev/docs/accessibility), and the existing design tokens. No dependency, permission, network call, encryption, history or pupil-data flow changes. `NETWORK.md` is unchanged. No change teachers can see in release builds: the new component is currently shown only in the debug gallery, so no changelog fragment is needed.

## Automated and build checks

| Check | Local result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit` pass |
| Type checks | Root and Android pass |
| Tests | 170 core tests and 324 Android tests pass on the updated branch |
| Component | Every state in RTL/LTR; unique labels, optional/error text, unchanged editing, growth/shrinkage, invalid size events, focus/ref/submission and 100%/200% sizing |
| Gallery | All three languages in both directions have no `accessibilityProblems`; seven uniquely labelled fields, live editing and a design-page entry |
| Keyboard regression | Header measurement, revealing on focus/resize/content growth, caller content-size callback and no reveal with the keyboard hidden |
| Contrast | Error text on paper/sheet passes 4.5:1; existing input/placeholder text, control outline and focus colours retain their passing pairings |
| Hygiene | Lint/formatting, diff checks, REUSE and Gitleaks pass, including new files; each maintained file is under 300 lines |
| Native build | ARM64 debug APK builds with the offline Gradle cache |

Toolchain: Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1 and React Native 0.87.1. The app's separate lockfile is unchanged.

## Native observations

Both existing isolated AOSP ARM64 emulators, Android 8/API 26 and Android 15/API 35, install and open the debug APK. They are 360×800 dp (720×1600 pixels, density 320). The development bundle is served over a temporary local port forward; this is not a release-app network flow. Only synthetic preview/gallery content was used.

- Arabic shaping, concise labels, placeholders and filled values were visually inspected. At confirmed system font scale 2.0, Android 8 shows the full three-line area, growing to 167 dp, with the optional label and input visible. Android 15 shows the optional/error states, the visible error line and LTR `CEM-01`/`12` fields at 200%, without horizontal clipping.
- Native trees show real `android.widget.EditText` controls, 48 dp inputs at ordinary text size and 71 dp inputs at 200%. The error label's native accessible name includes its error. Interface XML does not prove what TalkBack actually speaks.
- On Android 15 at 100%, typing synthetic Latin text and new lines into the Arabic area increases its height from 95 dp to 143 dp. Mixed-script text and existing Arabic content remain present. With the keyboard open, the whole growing input stays above it with a 16 dp gap.
- On Android 15 at 200%, editing the explicit LTR code gives `CEM-01X`, with a left-aligned value/caret and the whole input above the keyboard. On Android 8 at 200%, typing `demo` into the optional RTL field keeps its value right-aligned and fully visible above the keyboard.
- The first native editing check exposed keyboard overlap in the existing gallery. The wrapper fixes that, including the custom header's offset in both viewport sizing and focused-input reveal. The observations above use that fix. Synthetic edits are discarded when the gallery reloads; no teacher record is involved.

Screenshots, APKs and test logs stay outside the repository. Both text scales are restored to 1.0; app languages remain Arabic. Temporary development-server forwards are removed after checking.

## Remaining human/device checks

No human TalkBack listening acceptance is claimed. A person still needs to confirm Arabic/French/English label, optional-marker and error announcements, including filled fields and live errors. Full Arabic-keyboard composition, selection, cursor movement, landscape, native French/English entry and physical/budget-phone behaviour are not certified here. Unicode editing and both directions are covered in component tests, not substituted for those device checks.

No release reproducibility, size comparison or F-Droid scan was repeated for this component-only work. The native keyboard fix is for the debug gallery, not a claim that future form screens already handle the IME.

To repeat: run the contributor checks, build/install a debug APK and open developer menu → **Component gallery**. Try each field, change direction, enlarge text to 200%, enter several lines and keep editing with the keyboard open. Check code/numeric inputs inside an Arabic form, then repeat in French/English and with TalkBack. Use synthetic content only and restore test settings afterwards.

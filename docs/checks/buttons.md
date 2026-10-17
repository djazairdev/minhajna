# Android buttons (#112)

Local implementation and checks on 2026-10-17 for [#112](https://github.com/djazairdev/minhajna/issues/112), on `codex/112-buttons`, from main `e79e134`. These are local results before submission, not remote CI results.

## Scope

- `Button` implements primary, line, soft, plain and danger. The primary fills its container and is at least 56 dp high; every other weight is at least 48 dp in both dimensions. Minimum sizes, wrapping and uncapped text scaling allow labels to grow instead of being cut off.
- A primary can take a leading decorative icon. The caller supplies its drawing; the component supplies the 22 dp size and foreground colour. Other weights deliberately reject an icon in their TypeScript props.
- `IconButton` has a round 48 dp target and requires an `accessibilityLabel`. Its icon is decorative, drawn in an LTR space, and mirrors only when `directional` is set and the navigation/gallery direction is RTL. Non-directional icons keep their orientation.
- Both expose the native button role and disabled state, remove the activation handler while disabled, and offer pressed feedback and an inset keyboard-focus ring. Disabled opacity is a visual cue, not the only indication: Android also exposes the inactive state. Inactive controls are exempt from WCAG's contrast minimum; the enabled text, icons and focus colours have contrast tests.
- The line button uses `colorRoles.controlBorder`, not the failing canvas `rule` value. No palette token or design export changes.
- The debug-only gallery shows every weight enabled and disabled, a concise primary action with an icon, and directional/non-directional icon buttons in both states. Visible action labels use short wording such as “Save”, “Edit” and “Add”, not lesson descriptions. Its tap counts are transient component state, not teacher records. All sample words are in `samples.ts`, in Arabic, French and English. Future screen callers must use their catalogue for labels and hints. The component retains uncapped scaling and wrapping as an accessibility fallback; long-label stress cases remain in tests only.

There is no new dependency, permission, network call, storage field, history entry or pupil-data flow. `NETWORK.md` is unchanged. Existing navigation and teacher-facing preview screens are not refactored to use these controls. **No change teachers can see** in release builds; no changelog fragment is needed.

## Automated checks

| Check | Local result |
|---|---|
| Locked installs | Root and Android `npm ci --no-audit` pass |
| Type checks | Root and Android pass, including invalid-prop regression checks |
| Tests | 153 core tests and 244 Android tests pass; 104 of the Android tests cover buttons, the gallery and contrast, including the compact labels in all three languages |
| Button states | Every weight, disabled state and direction; labels, target sizes, fonts, wrapping policy, pressed/focus feedback, decorative icons and blocked activation |
| Gallery | All three languages in both directions have no `accessibilityProblems`; every component has its design-page entry |
| Accessibility helper | Checks the innermost control rather than forwarding wrappers; includes disabled buttons even without an activation handler, with a negative regression test |
| Contrast | Existing paper/sheet pairings plus chalk/danger, ink/soft and dark/light inset focus colours pass |
| Hygiene | Lint, formatting, `git diff --check`, REUSE and Gitleaks pass, including new files; every changed source file is under 300 lines |
| Native build | ARM64 debug APK builds with the installed SDK and offline Gradle cache |

Toolchain: Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1 and React Native 0.87.1. The first build attempt lacked the SDK environment variable; selecting the installed SDK allowed the build to pass. No source workaround or dependency change was needed.

## Initial native visual and interaction checks

The existing isolated AOSP ARM64 Android 8/API 26 and Android 15/API 35 emulators installed and opened the debug APK. Both have 720×1600 pixels at density 320: 360×800 dp. Only synthetic preview/gallery content was used. The debug build loads its JavaScript from a local development server through an emulator-local port forward; this is not a release-app data flow. The checks below preceded the user's request to shorten the labels; the old long descriptions have since been removed from gallery buttons.

- Arabic enabled and disabled buttons were visually inspected on both versions at system font scale 2.0. Text stays inside the growing controls. The long primary label wraps over several lines and retains its leading icon on the right. Android 15 was also inspected at 100% text.
- Native bounds show a 56 dp primary at ordinary text size and 48×48 dp icon buttons. Enlarged labelled buttons grow beyond their minima. Only fully visible bounds are used for target checks: a scroll viewport can clip the reported bounds of an off-screen control.
- Native trees expose the supplied names, button roles and `enabled=false` for inactive controls. On Android 8, an enabled primary tap followed by a disabled primary tap leaves the sample count at one. Android 15 similarly leaves the count unchanged for a disabled primary; one enabled icon tap followed by its disabled counterpart leaves the icon count at one.
- On Android 15, the same Arabic gallery was switched from RTL to LTR. The back drawing points right in RTL and left in LTR; the plus stays unchanged. The icon row moves to the leading edge. This forced-direction check does not require changing the phone's system language.
- On Android 8, French/LTR labels were inspected at confirmed 200% text. The normal primary wraps to two lines, with the other weights remaining inside the screen. The long primary was only partially visible in the scroll viewport; the final capture was interrupted (command exit 137), so complete native visibility of that French example is not claimed. The emulator remained reachable. No cause for that interruption is inferred.

Screenshots and APKs stay outside the repository. Text scale is restored to 1.0 after the checks, and the Android 8 app's language is restored to Arabic.

## Short-label follow-up

Following the user's review, all visible button actions were shortened in Arabic, French and English, including the icon-bearing primary (“إضافة”, “Ajouter”, “Add”). The previous lesson-length descriptions no longer appear as button labels. Three regression tests assert the concise labels in the rendered gallery. Component tests still use synthetic long text to guard the accessibility fallback; no font shrinking, ellipsis or one-line truncation was introduced.

The updated gallery was inspected on the 360 dp-wide Android 8 emulator at system font scale 2.0, in Arabic/RTL and French/English LTR. Every weight's label and the icon-bearing primary fit on one line, with enabled/disabled examples inspected while scrolling. Screenshots and native text bounds were checked. In particular, “Enregistrer” and “Ajouter” now fit on one line; the earlier incomplete French long-description check is no longer an outstanding check for an example that exists in the gallery. These observations cover this width, fonts and scale, not arbitrary future translations or narrower containers. Updated copy was not rechecked natively on Android 15; both directions remain covered by automated tests.

## Boundaries and repeating the check

This does **not** claim human listening acceptance for TalkBack, native keyboard-focus acceptance or a physical/budget-phone result. The old French long-description check was incomplete; that example is now replaced by the short “Ajouter” action, not certified by the earlier check. The focus-ring behaviour is covered in component tests; a native keyboard check did not reach these controls. Spoken Arabic/French/English wording and inactive-state announcements still need a person with the screen reader. Earlier spoken acceptance for navigation does not certify these new controls.

No release reproducibility, APK-size comparison or F-Droid scan was repeated for this component-only change. Those remain covered by the separate build/release checks, not by this debug gallery check.

Run the contributor checks, then build a debug APK as in [the Android build guide](android-build.md) with the debug task. Start the app's local development server, open the developer menu → **Component gallery**, choose each direction and enlarge text in the emulator's settings. Tap enabled and disabled examples and compare the counts. Repeat in each interface language, with TalkBack and a keyboard, using synthetic content only. Restore the test settings afterwards.

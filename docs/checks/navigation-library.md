# Navigation library proposal (#72)

Status: local validation implemented, not merged. Researched on 2026-10-15 for [#72](https://github.com/djazairdev/minhajna/issues/72), initially against main at `12fc84f9a3be382e605be943c3c57736d68c4c55`. After the user's approval in this chat, the validation change started from updated main at `4d8db4c219d7754715b91852f1d43a62e21b4143` on `feat/72-navigation`.

This records the comparison and the subsequently approved, bounded local integration. The maintainer [agreed to the dependencies on #72](https://github.com/djazairdev/minhajna/issues/72#issuecomment-6196252821), conditional on shrinking and per-processor APKs before the pilot (#93). Source provenance and spoken Arabic TalkBack were gates before the PR leaves draft; the local follow-up now records evidence for both. The historical results below are dated 2026-10-15; the [integration follow-up](#integration-follow-up-2026-10-16) records later changes. This is not a claim that every acceptance gate passed or that #72 is complete.

## Recommendation

Use **React Navigation 7, with its native stack and JavaScript bottom tabs**, as agreed on #72, subject to the remaining checks and the #93 size condition. The measured 6.20 MiB increase is accepted only with shrinking and per-processor APKs before the pilot.

The proposed direct additions, pinned to the stable versions inspected, are:

- `@react-navigation/native` 7.5.1;
- `@react-navigation/native-stack` 7.21.0;
- `@react-navigation/bottom-tabs` 7.21.0;
- `react-native-screens` 4.30.0.

Reuse `react-native-safe-area-context` 5.10.1, already installed. Plain native-stack and JavaScript tabs do not require Gesture Handler, Reanimated, Expo, a drawer, analytics or a navigation-state storage package. Do not add these through a starter template. The published packages' peer dependencies support this distinction; see the [versioned package evidence](#published-package-evidence).

This is an engineering judgement: native screen transitions, a custom tab bar and a smaller integration surface fit our needs better than a JavaScript stack's additional gesture dependency or Wix's replacement native bootstrap. Build and binary-scanner evidence is recorded below; full accessibility and F-Droid source-build acceptance remain open.

## Requirements being compared

The app currently uses React Native 0.87.1, React 19.3.0, Fabric and Hermes, without Expo ([package manifest](../../apps/android/package.json)). It must run on Android 8/API 26 and later. The choice must preserve offline operation, a small install, Arabic-first RTL, French and English, TalkBack, 200% text and 48 dp targets ([PRD §5.2](../prd/PRD.md#52-architecture), [§6.8](../prd/PRD.md#68-non-functional-requirements)).

The design requires tabs only on Today, Classes and Documents; an inner screen instead has a back/close control and a two-line TopBar. Its selected tab uses our pill, colours and typography, not an unmodified operating-system tab style ([BottomNav](../design/system/components/BottomNav/README.md), [TopBar](../design/system/components/TopBar/README.md)).

Every new dependency also needs an allowed licence, no proprietary/Google Play code, no autonomous network traffic, reproducible builds and scanner checks ([engineering rules](../contributing/engineering.md#dependencies), [Android build check](android-build.md), [Android CI](../../.github/workflows/android.yml)). Passing one APK scan does not establish that F-Droid can build the full source.

## Side-by-side comparison

The compatibility assessment distinguishes upstream evidence from project tests. A now has the limited local validation recorded below; B and C have not been built in this project.

| Criterion | A — React Navigation native stack + JS tabs | B — React Navigation JS stack + JS tabs | C — Wix React Native Navigation |
|---|---|---|---|
| Packages compared | Native 7.5.1, native-stack 7.21.0, bottom-tabs 7.21.0, Screens 4.30.0; reuse safe-area-context | Replace native-stack with stack 7.12.1; also needs Gesture Handler, inspected at 3.3.0; keep Screens and safe-area-context | react-native-navigation 8.9.0, its JS dependencies and native Android dependencies |
| Top-level licences | MIT for all four additions | MIT for stack and Gesture Handler, and the shared additions | MIT for the npm package; that does not certify every native/transitive dependency |
| RN 0.87 / Android 8 | Best explicit evidence: Screens 4.27 added RN 0.87 support; 4.30's Fabric table covers 0.84+. Its Android minimum is below API 26 | Same Screens evidence; Gesture Handler 3.3 has an API 24 minimum. Broad peer ranges are not proof that this exact combination builds | API 24 minimum fits API 26, but no explicit RN 0.87 compatibility confirmation was found in the inspected documentation; its published matrix is older than its npm package |
| No proprietary / Google Play code | No Play Services dependency declared in Screens' Android build. Uses AndroidX and open-source Material Components. Full resolved dependency audit and scanner run still required | Same checks as A, plus Gesture Handler's native dependency tree | More native artifacts/repositories to review, including several `com.github.*` artifacts. No blanket approval from the top-level MIT licence |
| RTL and back | Container defaults direction from `I18nManager`; RTL header/system Back checked on API 26/35, ordinary edge Back on API 35. LTR checked in JS tests only. Upstream requires predictive preview to be disabled; it is not supported | Same direction and hardware Back base; stack source explicitly reverses its pan interpolation for RTL. App-level pan handling adds another interaction to test against Android system Back; do not assume predictive preview works | Exposes `layout.direction` for RTL/LTR and native navigation. Correct back animation, system gesture and cancellation on RN 0.87 remain unverified |
| TalkBack | Tab source exposes a tab role, label and selected state on Android. Our custom bar/header must preserve semantics, focus and text scaling; device test required | Shares A's tab semantics; custom transitions and hidden screens still need TalkBack checks | Accessibility-label options exist, but labels alone do not prove focus order, selected-state announcements or 200% layout. Device test required |
| Design and integration | Custom JS tabs and custom TopBar, with native screen stack; keep the existing React activity/application | Most control over JS transitions, but that control is not presently a design requirement; extra gesture setup | Native tabs/stacks are available, but matching the bespoke bar must be demonstrated; changes activity/application base classes and root registration |
| Maintenance | React Navigation stable 7; Screens 4.30 released 2026-10-13 and has explicit RN 0.87 work | Same React Navigation family, plus Gesture Handler's release/compatibility cycle | npm publishes 8.9.0, while the latest GitHub release endpoint returned 8.8.11 and the installation docs rendered 8.5.0. Resolve that provenance/documentation mismatch before adoption; it is not proof of abandonment |
| Added APK size | **+6,504,587 bytes / 6.20 MiB / 22.39%**, including the preview and notices, universal unshrunk APK; details below | **Not measured**; an extra native package is not a measured APK delta | **Not measured**; larger source archive is not a measured APK delta |
| Conclusion | Preferred for an approved validation change | Fallback if the native stack cannot meet an evidenced requirement | Do not select now: compatibility/provenance and integration costs need stronger evidence |

Primary evidence for the matrix:

- React Navigation's [native-stack](https://reactnavigation.org/docs/native-stack-navigator/), [JS stack](https://reactnavigation.org/docs/stack-navigator/), [bottom tabs](https://reactnavigation.org/docs/bottom-tab-navigator/) and [container](https://reactnavigation.org/docs/navigation-container/) documentation; version-specific runtime evidence is in the published packages below.
- Screens' [RN 0.87 support release](https://github.com/software-mansion/react-native-screens/releases/tag/4.27.0), [4.30 release](https://github.com/software-mansion/react-native-screens/releases/tag/4.30.0), [compatibility and installation README](https://github.com/software-mansion/react-native-screens/blob/4.30.0/README.md) and [Android dependencies](https://github.com/software-mansion/react-native-screens/blob/4.30.0/android/build.gradle).
- [Material Components' Apache-2.0 licence](https://github.com/material-components/material-components-android/blob/1.13.0/LICENSE). Google's Maven repository or the `com.google.android.material` namespace is not the same thing as proprietary Google Play Services.
- Gesture Handler's [3.3.0 release](https://github.com/software-mansion/react-native-gesture-handler/releases/tag/v3.3.0) and its published source below. The inspected 3.3.0 source still exports `PanGestureHandler`, which React Navigation's JS stack imports; this removes one obvious API concern, not the need to build it.
- Wix's [installation instructions](https://wix.github.io/react-native-navigation/docs/installing/), [direction options](https://wix.github.io/react-native-navigation/api/options-layout/), [8.8.11 release](https://github.com/wix/react-native-navigation/releases/tag/8.8.11), [latest-release endpoint](https://api.github.com/repos/wix/react-native-navigation/releases/latest), and 8.9.0 registry/source links below.

## Published-package evidence

The following are the stable npm versions observed on the research date. Metadata links give licences, peer dependencies and archive integrity; source links identify the exact inspected archives. All seven archives matched their registry SHA-512 integrity. None declared `preinstall`, `install` or `postinstall` scripts, or contained files with `.aar`, `.jar`, `.so`, `.dll`, `.exe` or `.node` extensions. This limited inspection does not clear their transitive dependencies or build-time downloads.

| Package | Version | Declared licence | Unpacked source bytes | Primary evidence |
|---|---|---|---:|---|
| `@react-navigation/native` | 7.5.1 | MIT | 293,040 | [metadata](https://registry.npmjs.org/@react-navigation%2Fnative/7.5.1), [source](https://registry.npmjs.org/@react-navigation/native/-/native-7.5.1.tgz) |
| `@react-navigation/native-stack` | 7.21.0 | MIT | 263,021 | [metadata](https://registry.npmjs.org/@react-navigation%2Fnative-stack/7.21.0), [source](https://registry.npmjs.org/@react-navigation/native-stack/-/native-stack-7.21.0.tgz) |
| `@react-navigation/bottom-tabs` | 7.21.0 | MIT | 416,357 | [metadata](https://registry.npmjs.org/@react-navigation%2Fbottom-tabs/7.21.0), [source](https://registry.npmjs.org/@react-navigation/bottom-tabs/-/bottom-tabs-7.21.0.tgz) |
| `@react-navigation/stack` | 7.12.1 | MIT | 482,723 | [metadata](https://registry.npmjs.org/@react-navigation%2Fstack/7.12.1), [source](https://registry.npmjs.org/@react-navigation/stack/-/stack-7.12.1.tgz) |
| `react-native-screens` | 4.30.0 | MIT | 3,683,431 | [metadata](https://registry.npmjs.org/react-native-screens/4.30.0), [source](https://registry.npmjs.org/react-native-screens/-/react-native-screens-4.30.0.tgz) |
| `react-native-gesture-handler` | 3.3.0 | MIT | 3,209,635 | [metadata](https://registry.npmjs.org/react-native-gesture-handler/3.3.0), [source](https://registry.npmjs.org/react-native-gesture-handler/-/react-native-gesture-handler-3.3.0.tgz) |
| `react-native-navigation` | 8.9.0 | MIT | 6,992,793 | [metadata](https://registry.npmjs.org/react-native-navigation/8.9.0), [source](https://registry.npmjs.org/react-native-navigation/-/react-native-navigation-8.9.0.tgz) |

These are **source distribution sizes, not APK sizes**, and do not include the complete dependency trees. Do not total them and report an APK increase. React Navigation 8 and Screens 5 were prereleases when checked; this proposal does not select them. Recheck stable versions and advisories when implementation is approved rather than blindly using a future `latest` tag.

Useful inspected paths inside the archives:

- Native: `src/NavigationContainer.tsx`, `src/useBackButton.native.tsx`, `src/useLinking.native.tsx`.
- Bottom tabs: `src/views/BottomTabItem.tsx` and `src/views/BottomTabBar.tsx`.
- JS stack: `src/views/GestureHandlerNative.tsx`, `src/views/Stack/Card.tsx`, `src/views/Stack/CardStack.tsx`.
- Screens: `README.md`, `android/build.gradle`, `android/src/main/AndroidManifest.xml` and native screen sources.
- Gesture Handler: `src/index.ts` and `android/build.gradle`.
- Wix: `android/build.gradle` and `src/interfaces/Options.ts`. Its native build includes Material `1.2.0-alpha03`, `ahbottomnavigation`, `BlurView`, `reflow-animator` and `fab`, and declares a Sonatype snapshots repository. These are review items, not evidence that proprietary code ships.

The recommendation's immediate JS dependency tree also includes React Navigation core/elements/routers and small utility packages; Screens declares `react-freeze` and `warn-once`. Inspect the **resolved** npm and Gradle trees, not just these direct packages. Optional peers are not a reason to install masked-view or other unused libraries ([core metadata](https://registry.npmjs.org/@react-navigation%2Fcore/7.24.0), [elements metadata](https://registry.npmjs.org/@react-navigation%2Felements/2.9.45)).

## Proposed screen structure

This arrangement follows the existing design, not a new product flow:

```text
Root native stack
├── HomeTabs — only this root screen displays BottomNav
│   ├── Today
│   ├── Classes
│   └── Documents
└── Inner screens — stacked above HomeTabs, with TopBar instead
```

Putting a separate stack inside each tab would leave the tab bar visible while pushing an inner screen. Nesting the tabs inside the root stack gives the required opposite behaviour ([nesting guidance](https://reactnavigation.org/docs/nesting-navigators/)). Preserve each tab's useful state when returning from an inner screen. Setup or other flows are separate work, not implemented by this proposal.

The validation uses our own BottomNav presentation and TopBar, while retaining navigation events and selected-state semantics. It does not render a second native header. It reuses the tokens and bundled fonts: #70/#71 merged before the implementation started. The tab icons are dependency-free preview marks, not a claim that the full component gallery is finished.

### RTL, Back and accessibility acceptance

- Set navigation direction and native `I18nManager` consistently from the chosen interface language, not from two unrelated settings. The current forced-RTL preview is not the final language-switch implementation. Native direction changes may require an app restart; handle this with #21 ([I18nManager](https://reactnative.dev/docs/i18nmanager)).
- Mirror directional back icons and use logical start/end spacing. Verify Arabic tab order and transitions, not just Arabic text alignment.
- Distinguish Android hardware/three-button Back, the operating system's edge gesture, and an app's own pan-to-pop gesture. Test system Back from **both edges** where available, in RTL and LTR. The `gestureEnabled`/`gestureDirection` options documented for native-stack on iOS do not establish Android behaviour.
- Upstream explicitly requires `android:enableOnBackInvokedCallback="false"`; the validation sets this on `MainActivity`. Predictive preview and its cancellation animation are **unsupported**, not a test that passed. Ordinary edge Back is separate and was checked. Revisit the opt-out when upgrading navigation, including newer Android versions; avoid global handlers that swallow Back or trap the app at its root ([upstream setup](https://reactnavigation.org/docs/getting-started/#opting-out-of-predictive-back-on-android), [Android guidance](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture), [React Navigation Back guidance](https://reactnavigation.org/docs/custom-android-back-button-handling/)).
- Give every custom tab a translated label, tab role and selected state; preserve tab press/long-press events and cancellation. Map the design's web `aria-current` intent to native selected-state semantics rather than relying on colour alone.
- Test TalkBack traversal and focus after push, pop and tab changes. Covered screens must not remain in the accessibility traversal; the back/close control needs a meaningful label and at least a 48 dp target.
- Test Arabic, French and English at 200% text on a 360 dp-wide screen. Do not fix tab/header heights so rigidly that labels or the TopBar's two lines clip. Account for system insets and keyboard display without double padding.

## Privacy and saved work

The recommendation adds no product network flow. Leave external deep linking unconfigured for this change, request no new permission and add no state-persistence or screen-tracking integration. The inspected native container enables linking when configured; persistence and analytics are integrations described by upstream, not requirements to copy ([state persistence](https://reactnavigation.org/docs/state-persistence/), [screen tracking](https://reactnavigation.org/docs/screen-tracking/)).

Route names must be neutral. Pass only the minimum opaque record identifiers needed to retrieve records locally, not pupil names, marks, private notes or whole records in navigation state. Identifiers are still sensitive: do not log, export or send route state, including through devtools. No pupil data belongs in debug labels, error messages or notifications ([engineering privacy rules](../contributing/engineering.md#pupil-data-and-privacy)).

Save each edit through the data layer immediately, not only on blur, Back or unmount. A native-stack pop can unmount a screen without a separate blur event; navigation lifecycle is not the persistence mechanism ([navigation lifecycle](https://reactnavigation.org/docs/navigation-lifecycle/)). Test process recreation and Back during edits with made-up demo data. For Screens 4.30, follow its documented Android fragment-restoration setup before `super.onCreate`; do not apply an older activity workaround without checking the pinned version's instructions.

No autonomous data-sending code was identified in the inspected recommended navigation entry points. This is a source-review finding with limited scope, **not** a complete transitive privacy audit. The resolved dependency audit and release manifest/network checks remain mandatory. If integration proposes a new or wider call, stop for the required review and update `NETWORK.md`; this document authorizes none.

## APK measurement

The approved validation measured A, not B or C. These are unsigned universal release APKs for `armeabi-v7a` and `arm64-v8a`, without shrinking, with the same existing fonts, release settings, Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1 and NDK 27.1.12297006 on macOS arm64. The candidate includes the minimal navigation preview, native integration and licence notices; this is not an isolated library-only size claim.

| Build | APK bytes | SHA-256 |
|---|---:|---|
| Fresh baseline, main `4d8db4c219d7754715b91852f1d43a62e21b4143` | 29,049,974 | `128181ed68e9d17130fff5f4ca977c8991ad4f86fbe101a3dd691f597bedb2b5` |
| Candidate, identical in both independent source copies | 35,554,561 | `3ddeca9d59b11810a8833bac6821a1bea47f9f86f8d2e239cc2710b88cd00ee6` |

Increase: **6,504,587 bytes, 6.20 MiB, 22.39%**. This is material on a budget phone; it must not be described as negligible. B/C remain unmeasured, so no numeric “smallest APK” ranking is established.

Compressed ZIP-entry growth explains most of the increase: native libraries +3,324,264 bytes, DEX +1,697,655, resources +1,009,806, Hermes bundle +357,220, other entries +5,801. The remaining 109,841 bytes are packaging overhead/alignment. These categories are compressed sizes, not installed-memory estimates.

The two copies started with fresh dependencies and no build output in different directories. Both clean builds matched byte-for-byte. After JS-only status-bar and directional-icon corrections and a notice-attribution cleanup, both were rebuilt and again matched, yielding the candidate hash above. Screens has a separate CMake target: its initial library retained compiler strings, so the root build applies the app's existing prefix maps, no-build-ID flag and comment-stripping linker script to that module too. Neither its final native libraries nor its generated native libraries contained the checked checkout prefix or compiler string. Linux/cross-OS verification is still pending CI.

For repeating the measurement or evaluating another candidate:

1. Build a no-navigation baseline and candidate from the same base, with identical fonts, toolchain, release flags, ABIs and signing treatment. Record commits and exact package versions.
2. Compare the unsigned universal release APK, reporting before/after bytes and the delta, not an npm archive size. Inspect DEX, resources, JS/Hermes bytecode and native libraries to explain the increase. Keep any per-ABI comparison separate.
3. Repeat clean builds in different directories and the existing Linux/macOS reproducibility checks. New native C++ output may need the same path/build-ID protections as the existing app; do not assume it inherits them correctly.
4. Report cold-start behaviour on a budget phone against the PRD's under-two-second Today target. The PRD has no numeric added-MB budget: a maintainer must judge the measured increase, not an invented threshold.
5. Measure B or C on the same baseline if the maintainer needs a numeric alternative before final selection. Otherwise mark their deltas unmeasured, not zero or estimated.

## Approval and implementation gates

- [x] Maintainer agreement for the bounded validation scope is recorded on [#72](https://github.com/djazairdev/minhajna/issues/72#issuecomment-6196252821), conditional on #93 before the pilot. This does not approve later changes or authorize automatic public posts.
- [ ] Recheck versions, advisories, full npm/Gradle licences, source provenance, repositories and absence of proprietary or data-sending dependencies. Preserve exact direct versions, the app's independent lockfile and script-free installs. Resolve dynamic native versions to pinned project versions.
- [ ] Demonstrate the root-stack/tab arrangement with the existing design, without changing the product flow or adding unrelated packages. Verify React Native 0.87.1, Fabric, Hermes, API 26 and current Android builds.
- [ ] Run the RTL/Back, TalkBack, 200% text, inset, keyboard, state-return and process-recreation checks above. Record devices, Android versions and results; do not replace manual accessibility evidence with snapshots alone.
- [ ] Run root and Android typechecks/tests, lint and licence checks. The release asks for no permissions and adds no network behaviour.
- [ ] Run the existing proprietary-dependency guards, F-Droid APK scanner and clean-build byte comparisons. Inspect new source-scan findings too. F-Droid's complete source-build recipe and source-built Hermes remain separately open in [the build check](android-build.md#f-droid).
- [ ] Append APK deltas and budget-phone results, obtain maintainer acceptance, then merge the implementation. If A fails an essential requirement, return to the issue with evidence before substituting B or C.

## Initial proposal-only checks

On 2026-10-15, root and Android typechecks passed, as did all 97 core tests and the Android app's one test. REUSE licence validation, ESLint on tracked source files, formatting on non-ignored project files, relative file links and whitespace checks passed. Markdown is intentionally excluded from the repository's formatter.

The full `npm run lint` did not pass in the original working directory: it also traversed an existing nested checkout at `.claude/worktrees/fonts`, reporting 192 type-aware lint errors there. The proposal did not alter that checkout or the lint configuration. At that proposal-only stage, no candidate was built or scanned. The subsequent validation is recorded below.

## Local validation results (2026-10-15)

The preview adds only the three named tabs and one neutral inner test screen. It keeps the selected tab on a pop and uses tab history for root-level Back; after history is exhausted, Android handles Back. It has no record payloads, database, navigation persistence, external linking, analytics or network flow. Android fragment restoration is configured before `super.onCreate`, and status-bar icon contrast changes with the light/dark screen background. A visual check caught Android mirroring a neutral text arrow twice; the final back icon uses a logical-end border shape with explicit direction-dependent rotation, not a glyph.

| Check | Result / limit |
|---|---|
| npm additions | Four exact direct versions; 20 added lockfile packages in total, all declaring MIT; no existing package version changed and no added package declares an install script |
| Advisories | GitHub's public advisory API returned no matches for the 20 exact added package/version pairs on the check date; not a guarantee that no vulnerability exists |
| Native dependencies | Gradle resolved RN to 0.87.1; proprietary-group guard passed. The seven direct Screens Android dependencies' resolved Maven POMs declare Apache-2.0. AndroidX/Material are not Play Services |
| Notices | MIT notices for all 20 additions and the Apache-2.0 text are bundled in `assets/licenses/navigation.txt`. `standard-navigation` omits LICENSE from its npm archive; its upstream MIT text is preserved with its Git blob ID. Its registry `gitHead` did not resolve in the stated repository, so that field is not a verified source-rebuild reference |
| Root checks | Typechecks and all 97 core tests passed |
| Android checks | Typecheck and 21 tests passed, including six navigation cases: real JS navigation state, RTL/LTR icons, tab events, text settings and hardware Back/history/root fallback |
| Lint / licences | Full `npm run lint` passed in the isolated source copy without the unrelated nested checkout; REUSE and whitespace checks passed. Existing nested-checkout lint failures remain untouched |
| Release build | Both phone ABIs build with Fabric/Hermes; the two independent macOS copies produce the candidate hash above |
| Permissions / receiver guard | Final APK requests no permissions. No caller of the removed-permission `ContextCompat.registerReceiver` path was found in the DEX check |
| F-Droid binary scanner | fdroidserver 2.4.5 with refreshed signatures exited successfully on the final unsigned APK, scanning both DEX files and extra signing blocks |
| Android 8/API 26 | Fresh AOSP emulator without Play Services, 360 dp width: launch, RTL tab order, selected state, header Back, hardware Back and hidden tabs on the inner screen checked. Font-scale change to 200% recreated the activity without a crash; navigation labels and controls remained usable |
| Android 15/API 35 | Fresh AOSP emulator without Play Services: launch, RTL navigation, hidden covered tabs and hardware Back checked. Ordinary system Back from both edges checked in gestural mode; this does not enable predictive preview |
| Startup | During validation, the preview's cold activity launch reported 352 ms on API 26 and 428 ms on API 35, on a fast development machine. These are samples, not a budget-phone benchmark or a measurement of a complete Today feature |
| Still open | Spoken TalkBack/focus testing (not installed in these emulators), native LTR/French/English validation with #21, physical budget phone, newer Android versions, Linux/cross-OS CI and F-Droid's full source-built recipe/Hermes checks |

The local approval does not replace the reviewed public issue record. Before merge, review the measured size, the predictive-preview limitation, the package source-reference caveat, and the remaining manual checks. This is a validated development scaffold, not completed teacher screens or full accessibility certification.

## Integration follow-up (2026-10-16)

The local follow-up merges main at `58a75d8`, preserving #89's reviewed history. It retains the bundled-reference reader and encrypted-history verification from #95/#99. Navigation opens only after both checks succeed; failed or pending checks keep the standalone welcome/refusal page. Tests cover pending verification, a changed history, a lost key and invalid reference files without exposing the navigator.

The transitive `standard-navigation` pin is replaced with `0.0.9`, through the app's npm override. Its JavaScript and declarations are byte-identical to the original `0.0.8`, but its published source commit resolves and its archive includes the licence. The [provenance report](navigation-provenance.md) records the immutable source, rebuild and hashes; the original `0.0.8` source reference is not treated as verified.

The notices now occupy `assets/licenses/navigation-frameworks.txt`, `navigation-helpers.txt` and `navigation-android.txt`, each below 300 lines. Complete upstream notices are preserved. A regression test checks the twenty package notices, standard-navigation's emitted-file hashes and licence, and the full native Apache-2.0 text. Comments are relocated to comply with the current contribution rules.

Current local checks pass: core and Android type checks, lint/formatting, 134 core tests and 67 Android tests. Two independent macOS builds produce byte-identical APKs; native checks pass on API 26/35, including Arabic layout at 200% text. The user confirmed spoken Arabic labels, selected-state announcements and Back/focus return after listening on API 35. The [follow-up verification report](navigation-follow-up.md) distinguishes that human confirmation from automated checks and lists the remaining limits.

The original measurements above do not describe the integrated APK. Source provenance and spoken Arabic now have local evidence. The merge was validated locally before publication; the user confirmed review and DCO certification and authorised committing and pushing it on 2026-10-16. Do not change the remote PR's draft status automatically. #93 remains required before the pilot, and the broader language, budget-phone and source-build checks remain separate.

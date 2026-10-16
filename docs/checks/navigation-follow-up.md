# Navigation integration verification

Checked on 2026-10-16 for [#89](https://github.com/djazairdev/minhajna/pull/89). This follows the [original comparison](navigation-library.md) and [helper provenance report](navigation-provenance.md).

## Candidate and scope

Main at `58a75d8` is merged into `feat/72-navigation`, without rebasing or rewriting the reviewed PR history. Verification below was performed on the uncommitted local merge before publication. These results are not remote PR checks or a change to its draft status.

The combined app verifies bundled reference files and encrypted history before showing navigation. Pending or refused verification exposes only the standalone welcome/refusal page. Regression tests exercise the real navigator rather than replacing it with a mock. This remains a navigation preview, not completed teacher screens.

The existing transitive `standard-navigation` dependency is overridden to 0.0.9, whose published source commit resolves and whose archive includes its MIT licence. Its JavaScript and declarations match the original 0.0.8 bytes. No new package or product network flow is introduced. The provenance report records the independent source rebuild.

## Automated and build checks

| Check | Result |
|---|---|
| Root typecheck and tests | Pass; 134 tests across 20 suites |
| Android typecheck and tests | Pass; 67 tests across nine suites |
| Lint and formatting | Pass, including current comment-location rules |
| REUSE | Pass; all candidate files have licence coverage |
| Secret scan | Gitleaks 8.30.1 reports no leaks in the complete candidate diff against main |
| Release build | Pass for `armeabi-v7a` and `arm64-v8a`, Fabric/Hermes and the integrated SQLCipher storage |
| Independent build | Two fresh source paths on macOS arm64 produce byte-identical unsigned APKs |
| APK permissions | None requested |
| Receiver guard | No DEX caller of the removed-permission `ContextCompat.registerReceiver` path found |
| F-Droid binary scanner | fdroidserver 2.4.5, refreshed public signatures, successful exit on the unsigned APK |

Both unsigned APKs are **38,871,986 bytes**, with SHA-256:

```text
61c514e30bcee183aee246f4e2ad0eeee10f94d1ab20d20846678d59ce18183f
```

Toolchain: Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1, NDK 27.1.12297006 and React Native 0.87.1. Dependencies were installed from the lockfile with lifecycle scripts disabled. Both source paths started without native build output. Documentation-only evidence updates followed these builds.

This is an integrated candidate size, not a new isolated navigation delta: main now includes reference data and encrypted storage. Do not compare it with the older baseline and attribute the entire increase to navigation. The original same-base size comparison remains in the dated report.

## Native navigation and enlarged text

Fresh, separate AOSP arm64 emulators were created for Android 8/API 26 and Android 15/API 35. Both use a 720-pixel display at density 320: 360 dp wide. Existing emulator app data was not used. The preview contains no pupil records and neither system image includes Play Services.

- Both install and launch the signed test copy of the candidate, passing startup verification on fresh storage.
- Arabic tab order is Today on the right, Classes in the middle and Documents on the left. The selected state changes with the active tab.
- Opening the inner preview hides the tabs; its labelled Back control and Android Back return to the originating tab. This was checked on API 26 and API 35. API 26 also returns through tab history after switching tabs.
- At system font scale 2.0, both emulators recreate the activity without a crash. Arabic tab labels, the inner title/subtitle and Back target remain visible and usable; screenshots and interface bounds were inspected. The Back target measures 48 dp. On API 35, TalkBack was temporarily paused for the visual-only check, then restored.
- Recreation returns to Today because navigation-state persistence is deliberately absent. No claim about saving teacher edits is made: the preview has no editable record screen.

Font scale was restored to 1.0 after these checks. The prior report's ordinary edge-Back check was not rerun on this integrated candidate; predictive preview remains explicitly unsupported and opted out.

## Spoken Arabic: human verification

The isolated API 35 emulator used [TalkBack from F-Droid](https://f-droid.org/en/packages/com.android.talkback/), version `TfPu_release_15_1-2024_10_17_0000`, with the offline [eSpeak engine](https://f-droid.org/en/packages/com.reecedunn.espeak/), version 1.52.0. Arabic `ar-DZ` was configured. The service and TTS engine were observed bound. These are test-environment applications, not Minhajna dependencies or additions to its APK.

On 2026-10-16, the user confirmed in this chat after listening: **Arabic tab labels (اليوم، الأقسام، الوثائق), selected-state announcements and the رجوع button are correct, including focus return.** This is the human acceptance evidence for the spoken Arabic gate. The coding agent did not independently judge pronunciation; interface trees and screenshots are not substituted for listening.

This confirmation covers this preview and emulator/engine combination. It does not certify every screen, voice, language or Android version. Future teacher screens still need their own accessibility checks.

## Remaining boundaries

Source provenance and the requested spoken Arabic check now have local evidence. On 2026-10-16, the user confirmed review and DCO certification and authorised committing and pushing this follow-up. The PR's draft status remains a separate human decision. These local results do not claim that a later CI run has passed.

Native French/English and LTR checks belong with the interface-language work in #21. Budget-phone performance, newer Android versions, keyboard/editing flows, integrated ordinary edge Back, Linux/cross-OS verification and F-Droid's complete source-build recipe/Hermes checks remain unverified here. The binary scanner is not a source-build acceptance result.

The maintainer's #93 requirement for shrinking and per-processor APKs before the pilot remains in force. This report does not close #72, #93 or any separate release gate.

# Smaller Android APKs (#93)

Local verification on 2026-10-16 for [#93](https://github.com/djazairdev/minhajna/issues/93), following the navigation approval's before-pilot size condition. Branch `codex/93-shrink-apks` is a separate follow-up to [#89](https://github.com/djazairdev/minhajna/pull/89). That PR merged during verification as `9edc26d`, including comment-only update `c3591cd`; this contribution is based directly on that merged main tree.

## What changes

- Release code and resources are shrunk with R8 and Android's optimising default rules. AGP 9.2.1 supplies integrated resource shrinking; no compatibility-mode or broad app-wide keep rule is added ([Android guidance](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)).
- ABI splitting produces one self-contained APK per configured processor type and no universal APK. The existing `reactNativeArchitectures` property controls both compilation and splitting, preserving the developer's emulator override ([Android ABI splitting](https://developer.android.com/build/configure-apk-splits), [React Native guidance](https://reactnative.dev/docs/signed-apk-android#publishing-to-other-stores)).
- React Native, Screens and SQLCipher supply their own consumer rules for native entry points and fragment restoration. The app adds only a narrow receiver-guard rule, described below. Font registration uses explicit `R.font` references; no blanket resource keep file is necessary.
- There is no new dependency, data format, permission, product network call or change to encryption. `NETWORK.md` is unchanged. This does not close the separate F-Droid source-build/Hermes/SQLCipher work.

## Size and reproducibility

Unsigned release APKs, built with Node 22.23.2, JDK 17.0.20.1, Gradle 9.4.1, AGP 9.2.1 and NDK 27.1.12297006 on macOS arm64. Decimal MB means 1,000,000 bytes. The current main baseline was freshly built from an isolated source copy, not taken from the issue's older 29 MB estimate.

| Build | Bytes | MB | Reduction against current main |
|---|---:|---:|---:|
| Pre-navigation main `58a75d8`, universal, unshrunk | 32,366,772 | 32.37 | Historical reference |
| Navigation `5a34a39`, universal, unshrunk | 38,871,986 | 38.87 | Historical comparison control |
| Current main `9edc26d`, universal, unshrunk | 38,871,986 | 38.87 | Baseline |
| Candidate `armeabi-v7a`, shrunk | 16,952,333 | 16.95 | 21,919,653 bytes / 56.39% |
| Candidate `arm64-v8a`, shrunk | 22,511,453 | 22.51 | 16,360,533 bytes / 42.09% |

Against the earlier pre-navigation main, the savings are still 15,414,439 bytes (47.62%) and 9,855,319 bytes (30.45%). These figures combine shrinking and ABI splitting; they are not an isolated measurement of R8 alone. Each phone downloads one APK, not the sum of both. The historical navigation control is the previously byte-verified #89 artifact; current main was built separately from a fresh `9edc26d` source export and its own locked dependency install after #89 merged.

| APK | SHA-256 |
|---|---|
| Pre-navigation main universal | `e2275ed32a4e7a2dcbd4f892e302dcdb90b856e053eed0fde9ea908f402c6d93` |
| Historical navigation universal | `61c514e30bcee183aee246f4e2ad0eeee10f94d1ab20d20846678d59ce18183f` |
| Current main universal | `590a5c8b570b0f8246475c8e68ba7ec4363ca80e4e459cca3ab05ff06ac97ef2` |
| Candidate `armeabi-v7a` | `bd3330d1c78bd0b20938c6adc36ac31477878e4ff6d9ab29b9e402318e8d06e7` |
| Candidate `arm64-v8a` | `949a20718b7152753cf96b78bf662c8c9e0cabd49cbdc55130006627b05f88fd` |

The working checkout's clean build and a fresh source export in another directory, with its own locked dependency install and no native build output, match byte-for-byte for each ABI. APK contents retain all nine font files unchanged, every licence notice unchanged, and the required app/React Native/Hermes/SQLCipher libraries for that ABI only. Documentation and build-checker-only updates do not change these APK bytes.

Before submission, the parent branch gained comment-only update `c3591cd` in two app source files. Rebuilding both source trees preserved the sizes but changed the APK hashes above: only `assets/index.android.bundle` differed from the previous candidate, with 40 changed bytes at its header/footer. Final clean builds in both trees matched these hashes; APK contents, the exact CI permission/receiver guard and refreshed F-Droid scans passed again. The final arm64 APK was installed as an update and opened again on both isolated emulators. The table above identifies the final candidate, not the earlier bytes used for the detailed navigation checks.

CI now requires both expected outputs and their Gradle ABI metadata before checking permissions or uploading artifacts. It compares each ABI independently, scans both with F-Droid, and retains the R8 mapping/configuration. Missing output, wrong ABI metadata, stale universal output and differences in either APK are failures, not partial successes. The checker uses only Node built-ins and the existing `unzip` tool.

## Permission guard under R8

The manifest deliberately removes the permission used by `ContextCompat.registerReceiver`. Its existing DEX guard would become unreliable if R8 renamed or inlined those methods. The app's only extra rule keeps that class/method name and prevents their optimisation, while allowing unused code to be removed. No broad keep of AndroidX or all app classes is added.

The exact updated CI permission/receiver step passes for both candidate APKs. A synthetic call inserted only into the temporary source copy was compiled with R8 and correctly rejected by that step. That probe was never installed or added to the project. After its removal, a further build again matched both candidate APKs byte-for-byte.

## Local checks and device evidence

| Check | Result / boundary |
|---|---|
| Core, app and tooling tests | 134 core, 67 Android and 11 build-tool tests pass; both typechecks and lint/formatting pass |
| Licences / secret scan | REUSE passes for all 835 candidate files; Gitleaks 8.30.1 reports no leak in the complete #93 diff |
| APK scanner | fdroidserver 2.4.5 with refreshed public signatures passes for both unsigned APKs |
| Permissions / native libraries | Neither APK requests a permission; both retain their required native libraries and contain only their declared ABI |
| Android 8/API 26, arm64 | Installed as an update on the isolated AOSP emulator. Existing synthetic encrypted history opens, the navigation preview appears, tabs/inner screen/Back operate, and Arabic layout remains usable at 200% text |
| Android 15/API 35, arm64 | Installed on the isolated AOSP emulator. Offline startup, native inner-screen navigation/Back and selected-tab return checked, including 200% Arabic text |
| `armeabi-v7a` install and open | **Pending a compatible emulator host or Android 8+ device.** The two running emulators support only arm64. A downloaded Android 11 x86_64 image advertises ARMv7 translation, but cannot boot on this Apple-silicon host; see below. Build, archive, scanner and reproducibility checks are not runtime acceptance |

Only synthetic preview content was used; no real pupil data was accessed. API 35 was in airplane mode; API 26 had airplane mode set and Wi-Fi disabled. Both APKs lack network permission independently of emulator settings. During concurrent builds/testing, the first API 35 emulator instance hung in QEMU and disconnected; it was restarted before the successful checks above. This is recorded as a test-environment interruption, not suppressed or attributed to the app without evidence.

This preview has no editable teacher screen. Reopening its existing empty encrypted history checks native startup, not a full records/upgrade/load test. Native smoke tests are not a budget-phone benchmark. Spoken TalkBack confirmation from #89 predates shrinking; no new spoken acceptance is claimed here. Font scale was restored to 1.0 on both emulators and API 35's TalkBack service was restored after the visual checks. Signature-copy verification was not repeated: the standalone checker was unavailable in the offline tool cache; the earlier build report's signature-copy result remains historical, not evidence for these APKs.

## Additional emulator attempt (2026-10-16)

At the user's request, the official SDK manager downloaded `system-images;android-30;google_apis;x86_64`, revision 16: Android 11/API 30. The installed image's `build.prop` lists `x86_64,x86,arm64-v8a,armeabi-v7a,armeabi`, including `armeabi-v7a` in its 32-bit ABI list. This confirms the image declares ARMv7 translation support, not that the app has run successfully. The SDK catalogue had no native ARMv7 Android 8+ image; that does not mean every emulator option lacks ARMv7 support ([official image properties](https://android.googlesource.com/platform/prebuilts/android-emulator-build/system-images/+/refs/heads/main/generic/system-images/android-30/google_apis/x86_64/build.prop)).

A separate AVD, `minhajna-apk93-api30-armv7`, was created without changing existing virtual devices. Emulator 37.2.12 on this `Darwin arm64` host exited before boot, including with `-accel off`:

```text
Avd's CPU Architecture 'x86_64' is not supported by the QEMU2 emulator on aarch64 host. System image must match the host architecture.
```

No 32-bit APK installation or launch was possible in that attempt. Downloading the image does not satisfy runtime acceptance. A compatible Intel/AMD emulator host or a phone supporting ARMv7 remains necessary for this official-image route; a physical phone is not the only option. A different x86 app build would not test the shipped ARMv7 APK.

The approximately 3.2 GiB installed image remains in the local Android SDK for reuse. It is test-environment software, not an app dependency, and no downloaded binary enters the repository or changes `NETWORK.md`. Nothing was provisioned on a paid service or published to CI.

## BrowserStack follow-up (2026-10-16)

The maintainer reports that BrowserStack's open-source programme requires the repository to be at least **three months old**. Keep this as an eligibility constraint when revisiting hosted testing. This is maintainer-provided information: the [public programme page](https://www.browserstack.com/open-source) reviewed during this check did not independently confirm the age criterion. Reaching that age does not by itself establish approval or current access to App Live's native-app testing.

No application, account creation or APK upload was made. Before using the service, confirm eligibility, native-app coverage and an Android 8+ device that supports `armeabi-v7a`. Upload only a disposable test-signed APK with synthetic content, never pupil records or production signing keys. This is an optional test-environment route, not a product dependency or a new app network call; `NETWORK.md` stays unchanged. The 32-bit installation/open check remains pending and can also be completed on a compatible local emulator host or phone.

## Before acceptance or release

- Complete the 32-bit APK install/open check on a compatible emulator or phone. #93 is not fully accepted until both processor-specific APKs run successfully; no physical-phone-only requirement is imposed for this smoke test.
- Run the updated CI on Linux and compare its APK hashes with these macOS results. Local verification is not a claim that later remote CI has passed.
- Both unpublished preview APKs retain the existing version code `1` and app version `0.0.0`. No ABI bits are invented in the handbook's versioning scheme. Store publishing in #48 must follow the [versioning rules](../contributing/versioning.md); these same-code preview APKs are not a Play multi-APK upload configuration.
- Keep the independent budget-phone, accessibility and F-Droid source-build gates in the [Android build report](android-build.md). Do not treat a smaller APK or a binary scan as completion of those gates.

This report records local verification before submission. A draft PR may share the work for review, but does not complete the pending acceptance checks above.

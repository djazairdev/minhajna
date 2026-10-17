# Offline licence notices (#96)

Local implementation and verification on 2026-10-16 for [#96](https://github.com/djazairdev/minhajna/issues/96), on `codex/96-offline-licences`, updated to main `584da74` before submission. This incorporates the merged catalogues, language choice and dependency notices (#106–#108). It is independent of the unmerged shrinking follow-up [#105](https://github.com/djazairdev/minhajna/pull/105); it still builds the main branch's universal APK.

## Scope and behaviour

- The preview's labelled Help button opens the About/licences slice of the [Help design](../design/screens/Help.html). Reports, privacy settings and other unbuilt Help features are not simulated.
- Help's licences entry opens every public file in the APK's flat `assets/licenses/` directory. The native reader enumerates and sorts names, reads UTF-8 on a worker, and offers no arbitrary-path API. No record or database is read by that module.
- All fourteen notices appear: fonts, reference data, SQLCipher, navigation, translation libraries, React/React Native and the app's full AGPL. Known titles follow the selected Arabic, French or English catalogue; a future filename remains visible without a title/code update.
- Android's generated-assets API copies `LICENSES/AGPL-3.0-or-later.txt` unchanged to `licenses/minhajna.txt` for each variant. It is not a second maintained legal document. CI also watches that canonical licence file. New source files remain under 300 lines; the complete legal text is generated build output.
- The installed version comes from Android's `BuildConfig`. Licence contents are re-read by name, never stored in route parameters or the teacher's history. Reading errors show a generic translated message and a retry, with no network fallback. The asset reader joins the existing native-module registry; language selection and encrypted storage are unchanged.
- Screens follow the interface direction. Legal paragraphs retain their source text, with reading direction selected from their first letter: Arabic/Hebrew-range letters use RTL, and Latin paragraphs use LTR. This fixes English text and wrapped URLs inheriting the Arabic screen's direction. Arabic and mixed-script paragraphs have regression tests.

## Privacy and the source link

There is no new dependency, permission, analytics, web view, app fetch, encryption change or pupil-data flow. Reading all notices works locally. The fixed public source link requires a tap **and a separate confirmation in the selected interface language** before Android hands only that URL to the browser; cancelling makes no hand-off. The browser may contact GitHub under its own settings. This external action and its boundary are documented in [NETWORK.md](../../NETWORK.md). Tests mock it: no test contacts that site.

Original copyright notices are preserved. The displayed AGPL text has SHA-256 `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0`, identical to the canonical licence. This work does not relicense fonts, reference data or third-party code.

## Checks

| Check | Result / boundary |
|---|---|
| Core and app | 134 core and 162 app tests pass; both typechecks, lint and formatting pass. Catalogue parity and Help labels, titles, refusal/retry and browser confirmation are checked in all three languages, including a same-direction language change |
| Native asset tests | Four tests pass on each isolated Android 8/API 26 and Android 15/API 35 ARM64 emulator before the main update: every asset, exact AGPL hash, future names/Unicode and explicit read failures. All four were rebuilt and repeated successfully on the integrated APK on Android 8; Android 15 was not repeated after integration |
| Accessibility/layout | Arabic labels, 48 dp controls, unrestricted text scaling, scrollable pages, 200% text, mixed-script paragraphs, Back navigation and source-link cancellation checked; RTL/LTR direction is also covered in Jest |
| Actual notices | Before integration, font/data notices were inspected at 200% on both emulators and the complete AGPL opened. On the integrated Android 8 APK, Arabic/French Help and lists were rechecked, plus English Help, list scrolling and the font notice at 200%. Screenshots were visually inspected; source URLs and legal paragraphs wrap without horizontal clipping |
| Permissions | Final unsigned release APK requests none, including no `INTERNET` permission |
| Reproducibility | The integrated APK matches byte-for-byte from a clean build in the working tree and a fresh independent source tree with its own locked dependency installs. Earlier pre-integration builds also matched |
| F-Droid | fdroidserver 2.4.5 passes the integrated APK with refreshed public signatures, using the configured SDK and a 15-second socket timeout. Before integration, the first refresh timed out and a bounded retry succeeded; a cached-signature scan also passed |
| Licences and secrets | REUSE and Gitleaks pass locally; the secret scan includes the staged new files as well as edits to existing files |

The integrated universal unsigned APK is **39,049,645 bytes** (39.05 decimal MB), SHA-256 `e65283ec0c4477798a0e7728d51abc381a7d09c93f6a6cc66ccdb00a82c78bce`. Both independent builds have that hash. It includes the updated main baseline and does not include #105's shrinking; no processor-specific or 32-bit runtime acceptance is claimed here.

Only synthetic preview content and disposable test signing were used. No pupil data or production signing key was accessed. Screenshots, test APKs, source copies and logs stay outside the repository. Both emulator text scales were restored to 1.0 and Android 15's original TalkBack service was restored. Its tutorial was dismissed, but no human spoken-Arabic acceptance is claimed. A spoken review of the Help/licences labels remains a human review step, as do French/English wording and spoken acceptance. Android 8's Arabic language and 1.0 text size were restored after the integration checks.

Before the main update, after the completed layout checks, both isolated emulator processes exited with code 137. This is recorded as an environment interruption, without attributing it to the app. Only Android 8 was restarted, with 1 GB of RAM, for final package verification, settings cleanup and the later integration checks. The Android 8 Wi-Fi command had also been interrupted; its visible Settings switch successfully disabled Wi-Fi for the offline restart check. Its original Wi-Fi-on setting was restored afterwards. App-level network access is independently forbidden by the absence of the permission. Neither emulator timing nor an emulator restart is a budget-phone performance measurement.

## Repeating the check

Run the contributor checks and `assembleRelease` from [the Android build guide](android-build.md). Install a disposable test-signed build on an isolated emulator; open Help → licences, open each notice, enlarge text and use Back. Try cancelling the source-link confirmation without opening a browser. Never use real pupil records or a production signing key.

For the native tests, build `assembleDebugAndroidTest` and install a test-signed copy with the same disposable certificate as the app. Run `dz.minhajna.preview.licences.LicencesTest` through the AndroidJUnit runner. These tests read public assets only. Rebuild from a fresh source directory with its own locked install and compare the unsigned APKs byte-for-byte.

Implementation uses [Android's AssetManager](https://developer.android.com/reference/android/content/res/AssetManager) and the existing [React Native TurboModule setup](https://reactnative.dev/docs/turbo-native-modules-introduction), without another library. The Help text uses the shared translation hook introduced on main; the Arabic, French and English additions have matching keys and placeholders. Legal notices are not translated or rewritten.

These are local results, recorded before submission. Remote CI, a budget-phone benchmark, spoken acceptance and the independent #93 runtime gate are not claimed by these checks.

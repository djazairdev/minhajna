# Technical check 1: the Android build

This is the first of the checks before the pilot ([PRD §5.13](../prd/PRD.md#513-checks-before-the-pilot)). The question is whether the Android app can be built from its source, reproducibly and with no proprietary library. If it can, F-Droid can build it, and anyone can check an official build against the code ([PRD §1.3](../prd/PRD.md#13-licences), [§1.9](../prd/PRD.md#19-official-builds-releases-the-name-and-security)). It is ticket FC-02 of the field-check plan ([#18](https://github.com/djazairdev/minhajna/issues/18)).

- [The result](#the-result)
- [The app](#the-app)
- [What had to change](#what-had-to-change)
- [Repeating the build](#repeating-the-build)
- [Timing the start](#timing-the-start)
- [F-Droid](#f-droid)
- [Dependencies](#dependencies)
- [Still open](#still-open)

## The result

| Check | Result |
|---|---|
| Two clean builds give the same APK | **Passed.** On macOS, two builds from clean checkouts in different folders gave the same APK byte for byte, and so did a third, in a working copy. CI repeats the check on Linux on every change to the app. Its first run caught the build machine's IP address in the APK, which is now left out ([below](#what-had-to-change)). Since [#93](https://github.com/djazairdev/minhajna/issues/93), release builds are shrunk and split by processor; CI compares each processor's APK separately, and the [#93 report](apk-size.md) records their sizes and hashes |
| The same APK on macOS and on Linux | **Passed.** Two Linux builds in CI and two macOS builds gave the same APK, byte for byte. Checked again once the app had its encrypted history, its three languages, its navigation and its offline licences: a macOS build and both CI builds of the same commit gave the same APK. For the shrunk, per-processor APKs, CI's two Linux builds match; macOS against Linux is not repeated yet |
| A signed APK can be checked against a rebuild | **Passed.** The signature of a signed APK, copied onto a clean rebuild from another folder, verifies ([below](#checking-a-signed-apk)). Not repeated for the shrunk APKs: compare a signed APK with a rebuild for the same processor |
| No proprietary library | **Passed.** The build stops if one appears, directly or through another library. It was tried with Google Play services, and with Google's Maps utilities, which pull them in |
| F-Droid's scanner on the APK | **Passed.** No known non-free code, and no extra signing block |
| F-Droid's scanner on the source | **47 findings, all in installed npm packages.** Each one has a fix, [below](#f-droid) |
| The app built with F-Droid's tools | **Open.** It needs a build recipe, with the Hermes compiler built from source ([below](#f-droid)) |
| No permission | **Passed.** The release APK asks for none, not even the network. CI checks it |
| Installs and opens on Android 8 | **Passed on an emulator** with Android 8.0 and a 360×800 screen, without Google Play services. Its first frame came after about 0.23 seconds, and the whole first screen, text included, within 0.6 seconds, but on a fast computer ([below](#timing-the-start)). **Open on a budget phone**. The shrunk arm64 APK installs and opens on an emulator; a 32-bit device check remains open ([#93 report](apk-size.md)) |
| `NETWORK.md` | **No network call.** Help's source link hands a fixed address to the browser, and only after the teacher confirms |

## The app

- React Native 0.87.1 with React 19.3.0, the new architecture and the Hermes engine 250829098.0.17, without Expo ([PRD §5.2](../prd/PRD.md#52-architecture)).
- Android 8 (API 26) and later. It targets Android 16 (API 36), and compiles against API 37 ([PRD §6.8](../prd/PRD.md#68-non-functional-requirements)).
- The app opens on a first screen with the name and the tagline, a choice of Arabic, French or English, and Help. Three tabs lead to placeholder screens. The history is kept encrypted with SQLCipher ([#19](https://github.com/djazairdev/minhajna/issues/19)), and Help shows every licence notice offline. The screens themselves come with the setup issues.
- The application ID is `dz.minhajna.preview` for now. The final ID follows the project's domain.
- Release builds shrink code and resources with R8 and produce a separate APK for `armeabi-v7a` and `arm64-v8a`, with no universal APK. The [#93 report](apk-size.md) measured 16,952,333 and 22,511,453 bytes respectively on the navigation preview; the app has grown since.

## What had to change

React Native's app template is the starting point. These changes make it follow the [engineering rules](../contributing/engineering.md):

- **No proprietary library.** `android/build.gradle` stops the build when a library from a proprietary group is resolved, anywhere in the build. The groups cover Google Play services, Firebase, Play Core, Google's ads, consent and ML Kit libraries, Play billing and install referrer, Crashlytics, Facebook's SDKs, and Huawei's and Amazon's services.
- **Release builds** come out unsigned, so that two builds can be compared. They carry no version-control information and no dependency block. Google Play asks for that block, encrypted for Google alone, and F-Droid refuses it.
- **No permission.**
  - androidx adds a permission of the app's own, for receivers registered through `ContextCompat.registerReceiver`. Nothing in the app calls it, so the manifest removes the permission.
  - CI fails if a library starts to call it, since the call would then throw on Android 12 and earlier.
- **No request to another app.** At start-up, androidx's emoji support asks the phone's font provider for a newer emoji font, which it may download. On most phones that provider is Google Play services. The manifest turns this off, and emoji use the phone's own font.
- **The same native libraries on any machine.**
  - Two clean builds first differed only in the two native libraries compiled from source. The code kept the paths of the files it was compiled from, including the builder's home folder, and their build IDs hashed those paths. The paths of the checkout, the Gradle cache and the SDK are now mapped to fixed names when compiling.
  - A build on macOS and one on Linux then differed in the same two libraries, and only in their build IDs and in the names of the compilers. The NDK's start-up code carries the name of the compiler that built it, which differs between the NDK for macOS and the NDK for Linux. The libraries now carry no build ID, and `no-comment.ld` drops the names.
- **The builder's address.** React Native's Gradle plugin writes the build machine's IP address into every build, so that a debug build finds Metro over Wi-Fi. Release builds keep React Native's own default, `localhost`. The APK then neither depends on the machine that built it nor gives its address away.
- **Installs run no scripts,** and the app has its own lockfile, outside the root workspaces.
- **Gradle's download is checked** against its published SHA-256, and CI checks the Gradle wrapper.
- **Licences.**
  - Files from the template keep Meta's MIT notice, and the Gradle wrapper keeps its Apache-2.0 notice. The edit-text drawable keeps the Android Open Source Project's notice.
  - The launcher icon is drawn from the logo, under CC-BY-SA-4.0.
- **Removed from the template:** the debug signing key, the iOS project, the Ruby files, the PNG launcher icons and the linter settings. The linter comes with [#17](https://github.com/djazairdev/minhajna/issues/17).

## Repeating the build

You need JDK 17, Node.js 22.18 or later, and the Android SDK with platform 37, build tools 37.0.0, NDK 27.1.12297006 and CMake 3.22.1.

```sh
git clone https://github.com/djazairdev/minhajna.git
cd minhajna/apps/android
npm ci --no-audit
cd android
./gradlew assembleRelease
sha256sum app/build/outputs/apk/release/app-*-release-unsigned.apk
node ../../../tools/android/release-apks.js verify app/build/outputs/apk/release
```

Build again from a second clone in another folder and compare matching processor types with `tools/android/release-apks.js compare <first-output-directory> <second-output-directory>`. The checker requires both APKs and their `output-metadata.json`, and rejects missing outputs or a stale universal APK. Use `./gradlew clean assembleRelease` when changing the output layout. Any folder works, unless its path has a space. Linux/cross-OS confirmation for shrinking awaits CI.

### Checking a signed APK

A signed APK differs from an unsigned build only by its signature. To check one against the source, rebuild it as above. Then F-Droid's [`apksigcopier`](https://github.com/obfusk/apksigcopier) copies the signature onto your build and checks that it verifies:

```sh
apksigcopier compare minhajna-arm64-v8a-signed.apk --unsigned app/build/outputs/apk/release/app-arm64-v8a-release-unsigned.apk
```

This works only if the release was signed without moving the files inside the APK. Sign with `apksigner sign --alignment-preserved --v1-signing-enabled false`. Android 8 doesn't need the old v1 scheme. Without `--alignment-preserved`, `apksigner` realigns the files, and the signature no longer fits any rebuild.

The signed APK and rebuild must target the same processor. CI retains each build's R8 mapping/configuration separately for diagnosis; they are not installed on the phone.

## Timing the start

The target is under 2 seconds on a budget 360×800 phone ([PRD §6.8](../prd/PRD.md#68-non-functional-requirements)). Time a cold start, with the app stopped beforehand, and use a release build: a debug build loads its code from Metro and is much slower.

Build the APK as above. To install it, sign it with a throwaway key that is used only for the test and then deleted:

```sh
keytool -genkeypair -keystore throwaway.jks -alias test -keyalg RSA -keysize 2048 -validity 1 -dname CN=test
apksigner sign --ks throwaway.jks --out minhajna-test.apk app/build/outputs/apk/release/app-release-unsigned.apk
adb install minhajna-test.apk
```

Then, with USB debugging on, start the app ten times from cold:

```sh
for i in 1 2 3 4 5 6 7 8 9 10; do
  adb shell am force-stop dz.minhajna.preview
  sleep 2
  adb logcat -c
  adb shell am start -W -n dz.minhajna.preview/.MainActivity | grep TotalTime
  sleep 5
  adb logcat -d | grep "Fully drawn"
done
```

`TotalTime` is the time to the first frame, in milliseconds. The first screen with content comes later, once the JavaScript has run and the history has opened. At that moment the app tells Android, which logs a "Fully drawn" line with the time since launch. That line is the one the target is about. To see the screen itself, record it during a start with `adb shell screenrecord --bugreport /sdcard/start.mp4`, which stamps the time on every frame.

With a full year of records, the start takes longer: [the encrypted history's check](encrypted-history.md#a-full-year-at-start-up) has the figures on emulators, and how to fill the history with a demo year.

**On an emulator,** with Android 8.0, a 360×800 screen and no Google Play services, on an Apple silicon Mac, ten starts took 213 to 280 ms to the first frame, 230 ms in the middle. In five more, the whole first screen was there within 0.6 seconds. The emulator runs on a fast computer, so these figures say nothing yet about a budget phone.

## F-Droid

**The APK.** F-Droid's scanner, from fdroidserver 2.4.5 with its latest list of non-free libraries, found no non-free code and no extra signing block. CI runs the same scan on every build.

**The source.** F-Droid scans the source after the dependencies are installed and before the build. The scan found 47 problems and 10 warnings, all in npm packages under `apps/android/node_modules`. None is in the project's own files.

To repeat the scan, install the dependencies afresh in a clean checkout. A build writes the compiled native modules into `node_modules`, and the scanner then reports nearly 2,000 more findings, all of them the build's own output.

| Found | How many | What it is | The fix in F-Droid's build recipe |
|---|---|---|---|
| The Hermes compiler, `hermes-compiler/hermesc` | 3 programs, and 9 Windows libraries as warnings | It turns the app's JavaScript into bytecode during the build | Build it from Hermes's source, at tag `hermes-v250829098.0.17`, into `node_modules/react-native/sdks/hermes/build/bin/`, or point `REACT_NATIVE_OVERRIDE_HERMES_DIR` at the Hermes build. React Native's Gradle plugin looks there before it uses the prebuilt compiler. Then delete the prebuilt files |
| `react-native/React/I18n/strings/*/fbt_language_pack.bin` | 36 | Translation packs for iOS | Delete them: Android doesn't use them |
| `fb-dotslash/bin` | 5 | Meta's tool that fetches the debugger's programs | Delete them: the build doesn't use them |
| `fsevents/fsevents.node` | 1 warning | File watching on macOS | Delete it |
| Unknown Maven repositories | 3 | React Native's script for publishing itself, and a local folder that older versions of React Native used, in `react-native-safe-area-context` and `react-native-screens` | Ignore them: the build uses none of them |

The scanner also removes the Gradle wrapper, as it does for every app, and F-Droid builds with its own Gradle 9.4.1.

Gradle downloads the Android libraries, such as React Native's, Hermes's and androidx. They are open source, and come from Maven Central and Google's Maven repository, which the scanner accepts.

**Still to do:**
1. Write the build recipe.
2. Build with `fdroid build` on F-Droid's build server.
3. Check that the Hermes compiler built from source gives the same bytecode as the prebuilt one. Only then can F-Droid's build match the project's signed APK.
4. Build SQLCipher for Android from source, as Tuta's recipe does, rather than taking Zetetic's AAR from Maven Central (#75).

## Dependencies

**npm.** The app installs 688 packages. Nearly all are tools for building and testing. The app itself runs React, React Native, React Navigation with `react-native-screens` and `react-native-safe-area-context`, and i18next with `react-i18next`.

The licences are MIT (597), ISC (44), BSD-3-Clause (25), Apache-2.0 (11), BSD-2-Clause (4), 0BSD (1) and CC-BY-4.0 (1). Three more packages offer MIT among other licences. Two need a look:
- **`argparse` 2.0.1** is under the Python Software Foundation licence (`Python-2.0`), which is not on the allowed list, so a maintainer decides ([engineering rules](../contributing/engineering.md#dependencies)). It reaches React Native's command-line tools through `cosmiconfig` and `js-yaml`.
- **`exit` 0.1.2**, which Jest uses, declares MIT in an old format that the lockfile doesn't record.

**Known vulnerabilities.** Two advisories have no fixed version yet:
- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in `braces` (high): deeply nested patterns can exhaust the stack.
- [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) in `sprintf-js` (moderate): an unbounded precision can tie it up.

Both are in tools that run on the developer's machine, on the project's own files: Metro, React Native's command-line tools and Jest. Neither reaches the APK. The dependency review fails on any known vulnerability, so it will fail on these until a fix ships, or a maintainer allows them.

**Android libraries.** The dependency review reads only npm's lockfile, so the build's own check and F-Droid's scanner watch these. The libraries in the APK are mainly under three licences:
- Apache-2.0: androidx, Kotlin, OkHttp, Okio, SoLoader and fbjni.
- MIT: React Native, Hermes, Fresco and Yoga.
- A BSD licence: Bolts, which Fresco uses. The Bolts project is under MIT now. SQLCipher for Android, which encrypts the history, is under BSD-3-Clause; its crypto provider, LibTomCrypt, is in the public domain. Their notices travel in the APK, in `assets/licenses/sqlcipher.txt`.
- Inside React Native's and Fresco's native libraries: folly (Apache-2.0); glog, double-conversion, fmt and fast_float (BSD-3-Clause and MIT); Boost (BSL-1.0); libjpeg-turbo (IJG, BSD-3-Clause and Zlib); and, in Hermes, LLVM's support code (Apache-2.0 WITH LLVM-exception and NCSA) and dtoa. IJG, NCSA, LLVM-exception and dtoa are allowed for this code by name ([engineering rules](../contributing/engineering.md#dependencies)).

The notices of all of these, and of every JavaScript package in the bundle, travel in the APK in `assets/licenses/`, and a test checks that each runtime dependency has one.

SQLCipher is the one native library the APK takes prebuilt from Maven Central. `gradle/verification-metadata.xml` pins it to the checksums Maven Central publishes, so any other bytes stop the build (#75).

React Native includes OkHttp for its network functions. Without the network permission, they cannot reach the network.

## Still open

- **A budget phone.** Time the app's start on a budget 360×800 phone with Android 8, as [above](#timing-the-start). The target is under 2 seconds ([PRD §6.8](../prd/PRD.md#68-non-functional-requirements)).
- **F-Droid's build:** the recipe and the Hermes compiler, as above.
- **Shrinking follow-up.** Implemented and measured in [#93's report](apk-size.md); 32-bit install/open verification and CI remain open before acceptance.
- **The application ID**, once the project's domain is registered.
- **Maintainer decisions** on the `argparse` licence and the two advisories.

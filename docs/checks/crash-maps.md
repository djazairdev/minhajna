# The maps that read crash reports (#460)

Checks of 26 October 2026 for [#460](https://github.com/djazairdev/minhajna/issues/460), from the pull request that adds this record. Made-up crashes only, on my own emulator. The crash reports themselves are checked in [crash-reports.md](crash-reports.md).

## What changed

- **Two maps per release:** R8's mapping, for Java and Kotlin frames, and the Hermes bundle's source map, for JavaScript frames. A release build already made both. `tools/android/release-maps.js collect` now gathers them as `minhajna-<version>-mapping.txt` and `minhajna-<version>-index.android.bundle.map`.
- **One pair for three APKs:** the tool checks that the universal APK and the one for each of the two processors carry the same code (`classes*.dex`) and the same bundle, so one pair serves them all. The issue asked for maps named by version and processor; the processor is left out of the names, as it changes nothing in them.
- **The same maps on any machine:** the source map named each source by its absolute path on the build machine. The tool names them from the repository's root instead, and refuses a source outside it. R8's mapping holds no path.
- **No map in an APK:** `release-apks.js verify` refuses an APK that holds a `.map` file or a `mapping.txt`.
- **CI:** each of the two build copies collects its maps and keeps them for 90 days, in place of the R8 mapping alone. "Same APK twice" compares them byte for byte, as it does the APKs.
- **Reading a report:** `tools/android/read-crash.js` finds the frames in a report as the teacher sent it, in any of the app's languages, Hermes's unnamed functions such as `?anon_0_` among them. It reads JavaScript frames from the source map, and passes Java and Kotlin frames to the Android SDK's `retrace`. [Reading a crash report](../contributing/crash-reports.md) explains it.
- **Release steps:** the preview's release steps collect the maps and publish them with the APKs and their checksums. The versioning guide and the Android build check say which maps belong to which APK.
- **A kept report before Today:** the crash sheet showed only over Today. A director or an inspector who started in reader mode never saw a kept report, which stayed on the phone, and a teacher who turned crash reports on from Help during setup saw it only once setup was finished. The reader's home and the welcome now offer it as Today does.
- **Hermes's own frames:** a frame in Hermes's own code, such as a promise's job, named a position that no map reads, and would have read back to an unrelated line of the app. The app now keeps such a frame by its name only.

## Checks

| Check | Result |
|---|---|
| Tool tests | 23 pass, 9 of them new. They cover: names by version; sources from the repository's root, and one outside it refused; one version and one code and bundle for the three APKs, and a different bundle refused; the maps of two builds compared byte for byte; a map inside an APK refused; the frames of a report found in order without its bidi marks, an unnamed function's among them; a bundle position read from a source map; native frames passed to `retrace` one by one; retrace's frames and candidates for one frame put on one line |
| Android tests | 2410 pass. New in `crash-report.test.tsx`: a reader's home and the welcome offer a kept report, and «عدم الإرسال» deletes it; a frame in Hermes's own code is kept by its name only. The 4 i18next notice tests fail on this machine only, as on main |
| Two builds | A release build in two copies at different paths on this Mac gave byte-identical maps: mapping SHA-256 `7ceb970f…`, source map `2fb65cdd…`. Every source in the map is named from the repository's root. The three APKs carry the same `classes*.dex` and bundle, and none holds a map |
| A JavaScript crash | In a throwaway copy, never committed, a Help row threw a made-up `TypeError` from a release build on Android 15, with crash reports on. The kept report's first frame, `onPress 1:2132342`, read back to `apps/android/src/help/HelpScreens.tsx:196:22`, the `throw`, and the next ones to React Native's `Pressability.js` |
| A Kotlin crash | The same copy threw a made-up `IllegalStateException` on a thread of its own when Settings opened. The report's `ck.run:23` read back through `retrace` to `CrashKeep.setSteps$lambda$4(CrashKeep.kt:61)`, the line that threw |
| Reader mode | The first JavaScript crash was made from the reader's home, and the next start offered nothing. With the fix, the next start showed the report on the reader's home |
| Type check, ESLint, Prettier | Pass |

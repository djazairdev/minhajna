# Reading a crash report

A teacher who turned crash reports on can send one after the app stops suddenly ([crash-reports.md](../checks/crash-reports.md)). The report names where the crash happened in the code, but a release build's names can't be read as they are:
- **Java and Kotlin frames,** such as `a.b.c:12`, are names that R8 shortened when it shrank the app.
- **JavaScript frames,** such as `render 1:20457`, are a function's name with its line and its offset in the release's Hermes bytecode bundle, not a place in a source file. The tool reads a release build's reports; a debug build's would read one column off.

Each release publishes two maps that turn these back into files and lines, next to its APKs and their checksums:

| File | Reads |
|---|---|
| `minhajna-<version>-mapping.txt` | Java and Kotlin frames: R8's mapping |
| `minhajna-<version>-index.android.bundle.map` | JavaScript frames: the Hermes bundle's source map |

One pair serves all three APKs of a release: the universal APK and the one for each of the two processors carry the same code and the same bundle, and only their native libraries differ. The release build checks this. The maps never go into an APK, and the code is open source, so they hold nothing private.

## What you need

- The report as the teacher sent it, saved as a text file. It may be in Arabic, French or English; the tool finds the frames in any of them.
- The two maps of the report's version. The report gives the version on its «الإصدار» line. A build of your own makes them too, see [Making the maps](#making-the-maps).
- Node.js, and for Java and Kotlin frames the Android SDK's command-line tools, which hold `retrace`. Set `ANDROID_HOME` to the SDK.

## Reading it

From the repository's root:

```sh
node tools/android/read-crash.js report.txt minhajna-<version>-index.android.bundle.map minhajna-<version>-mapping.txt
```

Each frame comes out on a line of its own, innermost first, with where it comes from:

```text
onPress 1:2132342 -> apps/android/src/help/HelpScreens.tsx:196:22
_receiveSignal 1:1809815 -> apps/android/node_modules/react-native/Libraries/Pressability/Pressability.js:696:41
ck.run:23 -> dz.minhajna.preview.crash.CrashKeep.setSteps$lambda$4(CrashKeep.kt:61)
java.lang.Thread.run:1012 -> java.lang.Thread.run(SourceFile:1012)
```

These lines come from the two made-up crash reports of the check of 26 October 2026 ([crash-maps.md](../checks/crash-maps.md)). A JavaScript function may carry another's name when Hermes put the other inside it: here the made-up `throw` sits in a function that `onPress` calls. The source line is still the one that threw.

- **A JavaScript frame** gives the source file, line and column. The file is named from the repository's root.
- **A Java or Kotlin frame** gives the class, method, file and line, as `retrace` reads them. When R8 put one method inside another, `retrace` gives each of them, joined by `<-`. When the mapping can't tell between methods, it gives each candidate, joined the same way.
- **A frame with no position,** such as a native JavaScript function or one in Hermes's own code, which the app keeps by name only, is left out, since there is nothing to read. Android's own frames, such as `java.lang.Thread.run`, are not renamed and stay as they are.

A report holds at most ten frames and never the error's message, so it says where the crash happened but not always why. The screens it names, in the order opened, help to repeat it.

## Making the maps

A release build makes both maps. Collect them under their published names from the repository's root:

```sh
node tools/android/release-maps.js collect apps/android/android/app/build <folder>
```

The tool checks that the three APKs carry the same code and bundle, and names each of the source map's files from the repository's root, so two builds at different paths give the same maps. CI builds the app twice and compares them byte for byte, and keeps each build's maps for 90 days. A release keeps its own copy for good ([the preview's release steps](../field-check/session-guide.md#making-the-preview)).

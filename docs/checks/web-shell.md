# The PC web app's shell (#250, part 1)

Checks of 26 October 2026 for the first part of [#250](https://github.com/djazairdev/minhajna/issues/250), from the pull request that adds this record. Made-up data only; nothing is recorded in this part.

## What changed

- **`apps/web`, a new app with its own lockfile.** It builds the phone app's own code for the browser with esbuild 0.28.2 and React Native Web 0.21.4 (answers 499 and 501). The founder approved downloading React Native Web and React DOM 19.3.1 on 26 October; esbuild was already in the npm cache. `react-dom` is the phone app's exact React version, so one React runs.
- **The bundle** (`scripts/build.ts`):
  - **How the phone app's imports are redirected:** React Native goes to a small module over React Native Web, each native module to a web version, and every package to the web app's own install. The build stops if a native module has no web version.
  - **Fonts:** the phone app's own font files. Naskh has no Latin letters, so each Naskh weight falls back to the Noto Sans file of the same weight, where Android uses its own sans-serif.
  - **Images:** the phone app's 24 vector drawables, written as SVGs of the same names.
  - **Licences:** a notice for each of the 38 packages in the bundle, each read from its own folder, with the data's and the fonts'.
  - **Checksum:** the version is the Android app's, also built into the bundle for crash reports. `build.json` lists each file's SHA-256. The build's checksum is the SHA-256 of those lines as `sha256sum` writes them, sorted by name, so standard tools reproduce it ([README](../../apps/web/README.md)).
- **The page loads nothing from elsewhere:** its security policy allows its own files only, no inline script and no `eval`. The one exception is React Native Web's empty style sheet, allowed by its hash (R-6.6-01).
- **Offline:**
  - **Install:** the worker reads `build.json` once, checks that its checksum is the one its files' hashes give, fetches every file past the HTTP cache, and checks each against its SHA-256. A changed file or a redirected page fails the install, so one cache never mixes two builds. It keeps the files in one cache named after the checksum, `build.json` last, and answers only from it (R-6.6-05).
  - **Updates:** the worker never changes between builds, so the browser never replaces the app on its own. Accepting an update comes in part 4 (R-6.6-06).
  - **Before the install finishes,** requests go to the server as usual.
- **The direction:**
  - right to left unless the kept language is French or English, as the phone starts in Arabic;
  - the page's `lang` and `dir`, and the app's root view, follow the kept language;
  - a change of language reloads the page, as the phone restarts.
- **The native modules:**
  - Interface, Lock and Crash keep their settings in the browser's local storage under `minhajna:`, with the phone's rules; no record goes there. A crash report keeps what the phone keeps: the type, the frames, the last 10 screens and the version, with the browser's name left out. An error nothing caught counts as a crash; a refused promise does not, as on the phone.
  - Build and Licences read `build.json` and `licences.json`.
  - Notify is off, and StorageCheck is absent.
  - Storage gives the browser's SHA-256 and random bytes, and a lock that stands at set-up.
  - Every step of a later part is refused as `E_WEB_NOT_YET`, so nothing is kept unencrypted.
- **CI:** the test workflow installs the web app's locked dependencies, type-checks it and runs its tests.
- **NETWORK.md:** the web app asks only its own origin for its own files.

## Checks

| Check | Result |
|---|---|
| Web tests (`apps/web`, 20) | Pass. They cover:<br>• **the bundle:** built twice to the same checksum, each file's SHA-256 listed, and the checksum reproduced from `sha256sum`'s lines; the Android version, also in the bundle; every file listed for the worker and nothing else; the security policy, with no outside address, `unsafe` value or inline script; every font alias and drawable; a licence notice for every bundled package;<br>• **the drawables:** colours with alpha, strokes, fills and moved groups; a selector left out; any other element or attribute refused;<br>• **every native spec** in the phone app has a web version, and a missing one stops the build;<br>• **the settings:** kept under `minhajna:` and refused as the phone refuses them; the lock's delay and screenshot choice; a crash kept only while reports are on; SHA-256 and random bytes; every later step refused with nothing kept;<br>• **a crash kept on the web** is offered by the phone app's own `crash-report.ts`, bundled as the web build bundles it;<br>• **every package both apps use** has the phone's exact version. |
| Type checks | Pass: the web code, typed against the phone app's types, and its scripts and tests |
| ESLint, Prettier | Pass, 32 files |
| Bundle | `app.js` is 3.1 MB minified (825 KB gzipped). `dist/` is 7.1 MB, 3.9 MB of it fonts, in 50 files |
| Built-in browser of the desktop app, from the local server | Pass:<br>• **Arabic:** the welcome draws in full, right to left, with the chalk mark, the Ruqaa wordmark, the icons and Naskh text.<br>• **English:** left to right, in Noto Sans.<br>• **«لنبدأ»** opens the PIN pad. A PIN entered twice gives the app's own "not saved" message, and nothing is kept.<br>• This browser runs no service worker, so offline was checked in Chrome. |
| Checksum by hand | `find`, `sort` and `shasum -a 256` over `dist/` gave the checksum in `build.json` |
| Chrome (headless, the installed Google Chrome) | Pass:<br>• **Install:** the worker activated with one cache of all 50 files.<br>• **A file changed after the build:** the install failed and kept no cache, and the page still loaded from the server.<br>• **A changed file with its hash changed in `build.json`, the checksum kept:** the install failed the same way.<br>• **A reload during the install** drew the app from the server.<br>• **Offline:** with the local server stopped, a reload drew the welcome in full, all 6 images, in English left to right, with the installed build's version and checksum.<br>• No console error, and no security-policy violation. |

## Found and fixed while checking

By the audit:
- **A crash kept on the web was deleted, not shown:** it lacked the fields the phone's reader needs. It now keeps the phone's shape, and a test reads it back through the phone's own code.
- **A refused promise counted as a crash,** unlike on the phone; it no longer does.
- **One cache could mix two builds** on a host with HTTP caching, or with a new build put up during an install. Each file is now fetched past the cache and checked against its hash.
- **The checksum shown was taken on trust:** the worker now refuses a `build.json` whose checksum is not the one its files' hashes give.
- **The checksum could not be reproduced with standard tools;** it now can.
- **A package's licence was read from the top-level folder,** which a nested package would get wrong; each is now read from its own folder.
- **A vector's unknown attribute,** such as `autoMirrored`, would have been dropped silently; it now stops the build.
- **A guard** now keeps the web's packages at the phone's versions.
- **A focus tag** now holds its element weakly.
- **A screen-wake request** answered after the screen was let sleep is now released.

By hand:

- **The worker's cache counted before it was full.** A reload during the install found the new, empty cache and answered 404, and a failed install would have left it so. A cache now counts only once it holds `build.json`, and leftovers are cleared before an install.
- **English text in a serif.** The app names Naskh for every language, and the browser filled its missing Latin letters with its own serif. Each Naskh weight now falls back to Noto Sans.
- **Rows laid out left to right in Arabic.** React Native Web takes the direction from the nearest view that names one, not from the page. The app's root view now names it.

## Left for the next parts

- **Part 2:** done in [web-lock.md](web-lock.md).
- **Part 3:** files in and out, QR codes and signatures; the keep-storage request and warning (R-6.6-08); the handover rule (answer 503).
- **Part 4:** accepting an update with its checksum, «مسح هذا الحاسوب», and printing through the browser. Help's build facts still say "APK" for the checksum.
- **Crash reports:** the frames are read in Hermes's form, so a browser's stack keeps the type and the screens but may keep no frame. The report's line "Android …" needs web wording.
- **A cleared browser** loses the installed build with its storage, and the next visit installs whatever the server holds, without the teacher accepting it. Part 3's keep-storage request and part 4's updates must say so (R-6.6-06, R-6.6-08).
- **For the host (answer 500):**
  - HTTPS;
  - a `frame-ancestors 'none'` header, which a page's own policy cannot set;
  - `./` served as `index.html` with no redirect, which the worker refuses;
  - no caching that rewrites the files.
- **Still to check by hand:**
  - installing from Edge and Chrome on Windows 10 and 11, and Firefox, which cannot install it;
  - the screen reader and keyboard focus on a PC;
  - text at 200%.

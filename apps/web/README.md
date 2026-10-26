# Minhajna for the web

The PC web app ([#250](https://github.com/djazairdev/minhajna/issues/250)): the phone app's own screens, texts and rules, running in a browser on the teacher's own computer, offline once installed (PRD §6.6, answers 499 and 501).

**Status: the shell only.** This is the first of four parts. The app starts and shows its welcome screen, but it keeps no records yet: setting up, the lock and the history come in part 2, with a passphrase of at least 12 characters (answer 502). Until then every step that would keep a record is refused. Use made-up data only.

## Build and try it

```bash
npm ci
npm run build
npm run serve
```

Then open <http://127.0.0.1:4180/> in Chrome, Edge or Firefox. The server answers on this computer only and serves `dist/` and nothing else.

- `npm test` builds the bundle twice and checks it.
- `npm run typecheck` checks the web code and the scripts.

## How it is built

- **One bundle, made by esbuild** from `src/index.tsx`, which starts the phone app's `App.tsx`. `scripts/resolve.ts` redirects the app's imports:
  - `react-native` goes to `src/react-native.js`, which is React Native Web plus what it leaves out: the layout's direction, view tags for focus, the Android drawables, and inert Android-only pieces.
  - each native module goes to its web version in `src/native/`. The build stops if one is missing.
  - every package comes from this folder's own lockfile, so only one React runs.
- **Fonts and images:** the phone app's fonts, and its vector drawables written as SVGs (`scripts/drawables.ts`).
- **Version and checksum:** the version is the Android app's. `build.json` lists each file's SHA-256, and the build's checksum. The checksum is the SHA-256 of those lines as `sha256sum` writes them, sorted by name, and the same sources always give the same checksum (R-6.6-07). To check a build by hand:

  ```bash
  cd dist
  find . -type f ! -name build.json | sed 's|^\./||' | LC_ALL=C sort | xargs sha256sum | sha256sum
  ```
- **Nothing loaded from elsewhere:** the page's security policy allows only its own files, and no inline script (R-6.6-01).
- **Licences:** `licences.json` holds a notice for every package in the bundle, with the reference data's and the fonts'.

## Offline and updates

`public/sw.js` reads `build.json` once and fetches every file it lists past the browser's HTTP cache. It checks each file against its SHA-256, so a changed file or a redirected page fails the install, and one cache never mixes two builds. It keeps the files in one cache named after the checksum and answers only from it, so the app opens with no network (R-6.6-05). The worker never changes between builds, so the browser never swaps the app on its own. A new build is installed only when the teacher accepts it (R-6.6-06); that step comes in part 4.

## The native modules

| Module | On the web |
|---|---|
| Interface, Lock (settings), Crash | Kept in the browser's local storage under `minhajna:`, never a record. A browser cannot block screenshots. A crash report keeps what the phone keeps, with the browser's name left out. |
| Build, Licences | Read from `build.json` and `licences.json`. |
| Notify | None: the phone carries the reminders. |
| StorageCheck | Absent, as in a release build. |
| Storage | The browser's SHA-256 and random bytes. The history and the lock come in part 2, and erasing the PC in part 4. |
| Files, CalendarInput, Signature | Come in part 3. |
| Pdf | Printing through the browser, in part 4. |

Until its part comes, a module refuses each step with `E_WEB_NOT_YET`.

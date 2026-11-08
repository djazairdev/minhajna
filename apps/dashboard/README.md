# Minhajna's dashboard

The dashboard (answer 855) is where the Ministry keeps its reference list (N-Reference) and a school keeps its classes, pupils, teachers, joining codes and week (D-Classes, D-Issue), in the demo server's directory (answers 805, 807 and 809). It is an app of its own, apart from the teacher's: neither the phone nor the PC web app carries it. It runs in a browser on a PC, and needs the network, as everything it shows comes from the directory.

**Made-up data only.** Every page says so. The server keeps the directory in the clear, and whoever sets a page's edit code first holds that page, until the Ministry runs the national system.

## Build and try it

From the repository's root, install the four lockfiles, as CI does, then build and serve:

```bash
npm ci && (cd apps/android && npm ci) && (cd apps/web && npm ci) && cd apps/dashboard && npm ci
npm run build
npm run serve
```

Then open <http://127.0.0.1:4181/> in Chrome, Edge or Firefox. The server answers on this computer only and serves `dist/` and nothing else, with the host's headers. The pages call the demo server, `https://minhajna-demo.djazair.dev`, whose CORS rules name the dashboard's addresses, this one among them.

- `npm test` builds the bundle twice and checks it, serves it as its host does and runs the host check against it, then runs the screens' tests with the Android app's Jest.
- `npm run typecheck` checks the dashboard's code, its scripts and its tests.
- `npm run zip` packs the build into `release/minhajna-dashboard-<version>.zip`, and `npm run check-host -- <address> <checksum>` checks a deployed build.

## How it is built

The dashboard is built the way the PC web app is, with no other tool (answer 855), and shares its code rather than copying it:

- **The build** is the web app's `scripts/bundle.ts`, run with this folder's own esbuild: one bundle from `src/index.tsx`, every package from this folder's own lockfile, so one React runs, and the phone app's fonts and drawn images. `build.json` lists each file's SHA-256 and the build's checksum, and the same sources always give the same checksum. The version is the Android app's.
- **The phone app's code:** the shared components, the design tokens, the network guard and the directory's client (`apps/android/src/network/directory-network.ts`) come from `apps/android/src`, and React Native is React Native Web, as the web app's `scripts/resolve.ts` redirects them. The web versions of the native modules it needs, the file dialog, printing, the storage and its lock, crash reports and the interface's settings, are the web app's own, in `apps/web/src/native`.
- **Its own code** is in `src/`: the home and its pages, their rules, the directory's calls, reader mode's navigator and settings, and the communes (`data/dz/communes.json`, CC0), which only this app bundles.
- **Its words** are in `src/text/{ar,fr,en}.json`, read under the `dashboard` key beside the teacher app's words, which the shared components use (answer 821). Arabic comes first, and every text is in all three. The teacher app's catalogues come into the bundle with them, about 1.3 MB of its 3.6 MB, as the shared components read their words from them.
- **No offline worker, install or update offer:** the dashboard works with the server alone, so the page has no service worker or manifest, and the build writes no `notes.json` and no PDF engine.
- **Nothing loaded from elsewhere:** the page's security policy allows only its own files and no inline script. It may connect to one other address, the demo server, for the directory only; the host check fails if it names any other.
- **The serve, pack and host-check scripts** are the web app's, given this folder and its address.

## Tests

- `test/` holds the build's tests, which run with Node's test runner, as the web app's do.
- `__tests__/` holds the screens' tests, which run with the Android app's Jest, its settings and its fakes (`jest.config.cjs`), against a made-up directory (`jest/fake-directory.ts`). The packages they use come from the Android app's install, so one React runs.

## Its host

The dashboard is served at <https://minhajna-admin.djazair.dev> by a Cloudflare Worker of its own, the web app's Worker under the settings in `host/wrangler.jsonc`, whose first deploy creates the address. The release workflow deploys each release's `minhajna-dashboard-<version>.zip` there and checks it, and the hosted test deploys a copy at <https://minhajna-admin-test.djazair.dev> ([the host guide](../../docs/contributing/web-host.md#the-dashboards-host)).

## Reader mode

Reading a teacher's statement («قراءة بيان أستاذ», answers 489 to 492, 799 and 856) opens from the dashboard's home. It runs the teacher app's shell (`apps/android/src/shell/`): the lock, the encrypted history in this origin's browser storage under a passphrase of its own, the verified reference data and plan packs the reader's screens read, the automatic lock, the screen guard and the providers, with a navigator built from reader mode's routes alone (`src/ReaderNavigator.tsx`). It never loads the teacher app's navigator, setup or teaching screens.

- **First use on this browser** asks for a passphrase, twice, then shows the privacy notice in reader mode, which leads to the reader's home. The notice shows at each opening until a first statement is kept. It and its page on what the dashboard connects to are in the dashboard's own words (`src/reader-notice.ts`, answer 857), not the PC teacher app's.
- **Later**, the lock asks for the passphrase and opens on the reader's home, or on the screen it was on when it locked by itself.
- **The reader's home** is the school's picture of the statements received, with their list, opening a statement, its spot-check sheet and a grade's merge, and a crash report kept before the last stop when crash reports are on.
- **Settings** holds this PC's lock and its delay, with the passphrase change; the interface's language; erasing this PC, with no export; the crash reports switch; and the privacy notice. There is no Help and no setup.
- **Leaving**, from the passphrase pages, the first notice or the reader's home, locks the history and goes back to the dashboard's home.

The teacher app still carries its reader screens until they leave it in their own change (answer 856). Reader mode adds about 0.6 MB to the dashboard's bundle, for the navigator, the history and the reader's screens.

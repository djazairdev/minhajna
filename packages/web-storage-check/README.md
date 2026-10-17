# Browser-storage diagnostic

A standalone developer tool for [#79](https://github.com/djazairdev/minhajna/issues/79), supporting the browser matrix in [#46](https://github.com/djazairdev/minhajna/issues/46). It is **not the teacher web app** and accepts no real records. It depends on the full-year generator from #77 (PR #118).

From the repository root, with Node.js 22.18 or later:

```sh
npm ci --no-audit
npm run build --workspace @minhajna/web-storage-check
npm run preview --workspace @minhajna/web-storage-check
```

Open `http://127.0.0.1:4179/`. The optional preview serves static files on loopback only; there is no application backend. Alternatively serve the contents of this package's ignored `dist/` directory on a dedicated HTTPS origin, without changing any source path. No CDN or external script is used. `file://` is not an installation/offline test environment.

1. Choose Arabic, French or English, the timetable and the actual operating system. The browser's user agent cannot reliably distinguish Windows 10 from 11, so record the OS manually.
2. Enter a disposable test phrase of at least 12 characters, never a real password. The input is cleared when a test starts, and neither phrase nor key is stored or copied.
3. Run the encrypted write/read check. It replaces only this tool's previous synthetic run, atomically, in `minhajna-synthetic-storage-check-v1`. No teacher database is opened. Existing records survive an aborted replacement.
4. Optionally request persistent storage. A refusal is a result, not a test error. Estimates cover the whole origin and are approximate; the app cache contributes to usage too.
5. After the offline files are ready, reload once. Close/reopen the browser, re-enter the same disposable phrase, then choose Reopen. This reads the saved run without generating a replacement.
6. Use the browser's Install app menu if available, then repeat in its standalone window. The report records actual display mode, not whether an install button was seen. If unavailable, record that fact rather than pretending to test installation.
7. Copy the metrics-only report. If clipboard access fails, select the report text and copy manually. Copying is the only report export; there is no upload.
8. Delete the tool's demo database when finished. This removes only synthetic records; static offline files remain cached. To remove those too, use the browser's site-storage controls **on this dedicated test origin**, not an origin that holds other work.

The built page has a manifest, a local SVG icon and a service worker that caches an explicit static-file list. A new build waits for the old windows to close instead of silently replacing a running check. Close all tool windows between builds, then reopen and compare `buildSha256`. The checksum covers compiled modules and copied public assets; generated `assets.js` and `build.json` are excluded from their own hash. The build test verifies repeatability and that every module import is cached.

The tool derives an in-memory, non-extractable AES-256-GCM test key with Web Crypto PBKDF2/SHA-256 (600,000 iterations, fresh 16-byte salt). Every entry gets a fresh random 12-byte IV and a 128-bit tag; additional authenticated data binds it to the run and sequence. Only salt, test parameters, sequence, IVs and ciphertext persist. This is a **diagnostic envelope**, not an approved archive format or production passphrase policy. It does not test signing, passphrase recovery, secure memory erasure or the teacher app's lock.

No new library is installed: TypeScript already in the repository emits browser modules, and Node's own modules build and optionally serve static files. The root `build`, `typecheck`, `lint` and `test` commands include this workspace. Build output is not committed. The report and remaining checks are in [web-storage.md](../../docs/checks/web-storage.md).

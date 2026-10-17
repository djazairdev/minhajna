# Browser-storage check: tool and remaining matrix

This is the diagnostic page for [#79](https://github.com/djazairdev/minhajna/issues/79), part of [#46](https://github.com/djazairdev/minhajna/issues/46), technical check 4 ([PRD §5.13](../prd/PRD.md#513-checks-before-the-pilot), [§6.6](../prd/PRD.md#66-the-web-app)). It uses the #77 [synthetic full-year workload](demo-year.md). It is not an implementation of the teacher web app or its production key lifecycle.

## What the tool measures

The [standalone page and instructions](../../packages/web-storage-check/README.md) build with the existing TypeScript compiler and run as static files on HTTPS or localhost. There is no application backend, external script, upload, analytics or new dependency. Only the static origin is contacted, as listed in [NETWORK.md](../../NETWORK.md). Do not deploy it into a teacher app's origin or run it with real data.

Arabic is the default, with French/English and both text directions. Every test uses 45 made-up identities, the bundled public calendar and an invented example plan. CEM has 396 history entries / 260,598 compact UTF-8 JSON bytes; primary has 554 / 368,444 bytes. Synthetic records never appear in the report.

| Report field | Meaning |
|---|---|
| `buildSha256` | Hash of compiled modules and copied public assets, excluding the generated hash/list files themselves |
| `browser`, `operatingSystem`, `standalone` | Browser-reported user agent, manually selected OS and actual display mode; not a guessed Windows version |
| `usage`, `quota` | Browser estimates for the entire origin, including caches and database overhead, or null when unavailable |
| `persisted` | Actual browser grant, false when refused, or explicit unsupported/error; never a promise of a backup |
| `plainJsonBytes` | Compact full history JSON including headers; same definition as #77 |
| `ciphertextAndIvBytes` | Sum of per-entry ciphertext (including GCM tags) plus IVs; excludes metadata, indexes and database overhead |
| `keyDerivationMs` | Elapsed PBKDF2 time, separate from all database measurements |
| `encryptMs` | Serialisation and AES-GCM encryption of entries before any write transaction |
| `committedWriteMs` | New connection, atomic replacement and transaction-completion acknowledgement |
| `readMs` | Read through a new connection and one transaction; not the writer's cache |
| `decryptAndVerifyMs` | Authentication, JSON decoding, core history verification and state rebuild |

Generation is outside the encryption/storage timers. These are single-run diagnostic elapsed times, not averages or performance guarantees. There are no clock times in the synthetic records or their history. A later Reopen does not fetch/generate a new workload: it uses only persisted salt, parameters and ciphertext, and a re-entered disposable phrase. The core checks the reopened chain and state before success is reported.

The key is non-extractable and stays in memory; no passphrase/key is stored in IndexedDB, localStorage, Cache Storage or a copied report. UI errors use an allowlisted code, not arbitrary exception text. AES-GCM failure never reports a successful measurement. A replacement is one transaction; quota/abort/queuing failures do not commit a cleared or partial replacement. Deletion targets this tool's named synthetic database only.

## Evidence collected locally

On **17 October 2026**, the Codex in-app Chromium browser on macOS reported Chrome 155 compatibility in its user agent, in a normal browser tab. This is **not a Chrome-branded Windows acceptance run**.

- CEM: encrypted write/read verified all 396 history entries; reload plus re-entered disposable phrase reopened the same saved run successfully.
- Primary: encrypted write/read verified all 554 history entries.
- A wrong disposable phrase failed with `OperationError`, a null measurement and no record/phrase in the report.
- The explicit persistence request returned `false`, recorded without changing browser settings or treating it as success.
- With the optional static host stopped, the cached page reloaded, reopened the saved primary history and generated/encrypted/verified a new CEM workload from cached reference files. This checks loss of access to the host, not every possible OS network condition.
- Arabic RTL, French LTR and English LTR controls were exercised. At a 360 × 800 viewport override, the Arabic page had no horizontal overflow (345-pixel content/client width after the scrollbar); controls measured 48 pixels or more. Native installation, 200% text and screen-reader acceptance remain unverified.

The final locally exercised build hash was `865dc8772bcdca513fd7ca173f1b0de3cfef2f61fdd46942a80e3b552e4773f6`. On that build, one offline CEM run reported 42.8 ms derivation, 2.7 ms encryption, 23.3 ms committed write, 2.3 ms read and 9.4 ms decrypt/verification. The primary reopen reported 554 entries / 368,444 plaintext JSON bytes / 383,401 ciphertext-and-IV bytes. These are observations from one local run, not Windows acceptance figures, averages or the Android Today benchmark. The static preview was stopped after QA; synthetic test records and the offline cache remain local to its dedicated origin.

The automated tests cover full-year authenticated round-trip, a different key, tampered ciphertext/IV/run identity, row order, repeatable derivation, minimum test-phrase length, transaction acknowledgement/abort, synchronous queuing failure, grant/refusal/unsupported/error reporting, catalogue key parity, and reproducible static build/cache coverage. Node tests do not simulate browser durability or installability.

Local verification also passed: clean locked installs, the static build, root and Android type checks, lint/format checks, all 185 core/diagnostic tests (170 + 15), all 182 Android tests, and secret scanning. Source-only REUSE validation passed for all 917 files. Before the new workspace is tracked, REUSE's Git-ignore enumeration scans its ignored `dist/` output; a clean source snapshot avoids that local tooling artefact without changing any source licence or committing generated files. The built static files still carry the code/data licence texts and the source files' SPDX headers.

## Required manual matrix: not yet accepted

Run each row on a dedicated origin/profile, with an ordinary tab and, where supported, an installed standalone window. Save separate copied reports for each scenario and mode. No result below is implied by Chromium/macOS.

| OS | Chrome | Edge | Firefox |
|---|---|---|---|
| Windows 10 | Pending | Pending | Pending |
| Windows 11 | Pending | Pending | Pending |

For each supported mode:

1. Record the exact browser version, actual OS, displayed build hash and whether the profile is private/incognito. Do not infer Windows 11 from the user agent.
2. Run both workloads, request persistence explicitly and record granted/refused/unsupported, without changing browser security settings to force a grant.
3. Close all tool windows and restart the browser/app. Reopen with the disposable phrase and verify the saved run. If it is gone, report that, not a new successful generation.
4. Once offline files are ready, reload without access to the static host, then reopen the saved run and generate a new one. Record offline readiness separately from persistence.
5. Test a wrong phrase, quota/storage refusal in an isolated environment, blocked database operations with another tool tab, and deletion of only the diagnostic database. Do not fill or pressure the user's disk, or clear unrelated browser data.
6. Record native install availability. A missing option is a platform/support limitation, not an encryption failure. Do not use extensions or display-mode emulation as proof of native installation.

## What a successful test cannot prove

A persistence grant reduces automatic eviction risk under the browser's policy; user deletion and profile loss remain possible. A single year fitting does not establish maximum quota, disk-pressure survival, crash/power-loss durability, safe passphrase recovery or production security. No stress test fills the disk here, and the tool never presents estimates as exact free disk space. Those limitations must accompany the results of #46.

## Public API references

- [StorageManager.persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist): request and actual grant.
- [StorageManager.estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate): origin-wide approximate usage/quota.
- [IndexedDB transaction completion](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event): request success is not transaction completion.
- [Web Crypto](https://www.w3.org/TR/webcrypto/): built-in AES-GCM, PBKDF2 and random bytes, not project-written cryptography.
- [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable): secure hosting and browser-dependent native installation.

# Navigation helper provenance

Checked on 2026-10-16 for [#89](https://github.com/djazairdev/minhajna/pull/89), following the maintainer's gate on [#72](https://github.com/djazairdev/minhajna/issues/72#issuecomment-6196252821).

## Replacement

The original `standard-navigation` 0.0.8 archive declares MIT but omits `LICENSE`. Its registry `gitHead`, `4b038b914b71549d54655a81eae9ed502b4780d4`, does not resolve in the named repository; a GitHub commit search also returned no result. This does not establish wrongdoing, but it does not supply a verified source reference either.

The app now overrides that existing transitive dependency to **0.0.9**. No new package is introduced. Both its executable JavaScript and its declaration file are byte-identical to 0.0.8, so this replacement changes provenance, documentation and licence packaging without changing those runtime/type bytes.

- [Published 0.0.9 metadata](https://registry.npmjs.org/standard-navigation/0.0.9).
- [Immutable upstream source](https://github.com/react-navigation/standard-navigation/tree/4ebc8b3229da88cb6ade1ff4484491915bedd7cc), matching the new registry `gitHead`.
- [Licence at that commit](https://github.com/react-navigation/standard-navigation/blob/4ebc8b3229da88cb6ade1ff4484491915bedd7cc/LICENSE), also included in the 0.0.9 npm archive.

The direct React Navigation and Screens versions remain as approved. The override is needed because `@react-navigation/native` 7.5.1 requests `^0.0.8`, which does not include 0.0.9.

## Rebuild evidence

The public repository was checked out at the exact commit above in a temporary source directory. Its own `tsconfig.json` was compiled with TypeScript 6.0.3 and the installed app's React type definitions, without executing a package lifecycle script. The compiler exited successfully. `cmp` then matched the generated JavaScript and declarations against the downloaded 0.0.9 archive. The source licence matched the archive's licence as well.

SHA-256 of the published files, independently matched by that rebuild:

| File | SHA-256 |
|---|---|
| `lib/src/index.js` | `770d8b338177d7f92f484cab466c973455f30a18eb69fe5ce14996996b67cf9e` |
| `lib/src/index.d.ts` | `0c2e0ce5a7faeafb27b23e99eb5408b6a97ba9dfdcc76e7f73b0120a40bcdbba` |
| `LICENSE` | `77aa111867b23a7dd45fd66c958c410a0a4b09f2f49e1ea0c16af01d1582d291` |

The old installed 0.0.8 JavaScript and declarations matched the first two hashes before its replacement. The refreshed lockfile changes only this transitive package's version, archive URL and integrity relative to #89's original lockfile. Normal installs remain script-free.

This is a source-to-published-file check, not npm publisher-identity attestation, a claim about the unresolved old commit, or a complete dependency audit. The lockfile still authenticates the selected archive's bytes through npm integrity checking.

## Notices and regression checks

All twenty navigation-package notices remain in the APK, split by complete notice blocks into three files below 300 lines. The standard-navigation notice is now taken from the licence included in its locked archive. The native dependencies' full Apache-2.0 licence remains separate and unmodified.

`apps/android/__tests__/navigation-notices.test.ts` checks the override, installed version, executable/declaration hashes, licence text, immutable source reference, package coverage, full Apache text and each notice file's line count. It runs offline with the existing Jest suite.

Spoken TalkBack, native accessibility, APK size and reproducibility are separate checks. Resolving provenance does not mark those checks passed or make #89 ready by itself.

# Teacher signing and QR generation

Part 2 of [#245](https://github.com/djazairdev/minhajna/issues/245), scoped by [#437](https://github.com/djazairdev/minhajna/issues/437). Based on main `2ae76b0`, checked on 24 October 2026. All payloads and keys used in tests are invented or generated for that test run.

This adds native primitives, not a Share screen. Nothing is signed at startup or sent anywhere. There is no change teachers can see yet, so CHANGELOG.md is untouched.

## The signing key

`MinhajnaSignature.teacherKey()` returns a base64 DER SubjectPublicKeyInfo public key. First use creates an EC P-256 pair in Android Keystore under `minhajna-teacher-signing-v1`, separate from every database or app-lock key. Concurrent first calls and later module instances use the same pair. An existing alias of the wrong type or curve fails rather than being replaced.

The private key is an opaque Keystore handle. It is never exported, returned to JavaScript, put in the history or written to a backup or transfer file. A new phone has a new signing key. Device erasure in #248 must delete `TeacherSigningKey.ALIAS`; that erasure flow is not implemented here. These properties follow the [Android Keystore model](https://developer.android.com/privacy-and-security/keystore); this change does not claim hardware protection on every phone.

`sign(payload)` signs the exact UTF-8 bytes with the platform's ECDSA P-256/SHA-256 implementation. It returns base64 DER, as the existing `verify` accepts. Empty text, lone surrogates and text over 65,536 UTF-8 bytes fail before a key is created. The native module does not canonicalise a statement: #436 provides the exact payload to sign.

Signing, verification, fingerprints and QR generation run off the UI thread on the module's serial worker. Signing failures expose only a fixed code and message, without the payload, key material or underlying platform exception. Calls after shutdown fail promptly. Existing verification still resolves false on a malformed signature or a stopped worker.

No signature, consent or legal status is inferred from these primitives. #438 must sign only when the teacher chooses an output. Reader mode in #246 must handle identity and known-key continuity; #247 handles recovery and a replacement phone. Weekly authentication and state certification are not implemented here.

## Fingerprints

The native `keyFingerprint(spki)` validates a P-256 public key and returns lowercase SHA-256 over its decoded DER bytes, not the base64 text. This matches reference-data fingerprints. The TypeScript `teacherKeyFingerprint(spki)` returns the first 32 hex characters, a 128-bit display abbreviation. The existing display formatter can group those characters.

This abbreviation is never an identifier for trust decisions. Verification and key continuity must use the complete public key. The helper rejects a malformed hash rather than printing it. No new JavaScript hash implementation or dependency is added.

## QR contract

`qrMatrix(text)` returns `{size, rows}`: a square grid of `0` for white and `1` for black. The rows **include the four-cell white quiet zone**, so a drawing must keep that border, square cells and a white background. No image, bitmap or payload is saved to disk.

Encoding uses the already-bundled ZXing Core 3.5.4 `QRCodeWriter`, with explicit UTF-8 and error correction M, and no compact encoding. The writer chooses the smallest version. The result is no larger than version 25: 117 cells plus the quiet zone gives at most 125 per side. See the [writer](https://github.com/zxing/zxing/blob/zxing-3.5.4/core/src/main/java/com/google/zxing/qrcode/QRCodeWriter.java) and [encoding hints](https://zxing.github.io/zxing/apidocs/com/google/zxing/EncodeHintType.html).

The limit is **996 bytes of the complete signed text**, matching #436's `STATEMENT_QR_LIMIT`. Kotlin keeps the same named constant while the core part awaits submission; the standalone Jest fixture repeats its boundary. UTF-8 byte length, not character count, is checked before encoding. A malformed or oversized text fails without truncation. The future integration must keep the core, native and test boundaries aligned.

The Jest stand-in signs and verifies with Node's crypto using an ephemeral, in-memory pair. Its QR method returns a deliberately blank matrix for bridge and layout tests only. It is not a QR encoder, is not bundled in the app and cannot establish scannability. The instrumented tests decode the real writer's matrix with ZXing's `QRCodeReader`.

## Verification

The regression suite first failed because the native stand-in had no teacher-key, signing, fingerprint or QR methods. Tests use generated aliases under `minhajna-test-teacher-...`, and delete only those aliases afterwards. They never open, replace or delete the production teacher alias.

- Native tests cover persistent and non-exportable keys, concurrent first calls, unchanged and changed payloads, another key, fingerprints, malformed input and refusal to replace an invalid alias.
- QR tests read ASCII, Arabic and emoji images through `QRCodeReader`, check the quiet zone and dimensions, round-trip 996 bytes and reject 997 bytes or malformed Unicode.
- TypeScript tests cover the new bridge contract, exact UTF-8 signing, fingerprints, malformed inputs and byte limits. The existing shared signature-vector test remains in place.

Final results, with Node.js 22.23.2 and Temurin 17:

- Locked root and Android installs, root and Android type checks, ESLint and Prettier pass. All files remain below 300 lines; the whitespace check passes.
- All 732 core, 19 sync, 17 web-storage and 14 APK-tool tests pass. This branch intentionally excludes #436's 22 additional core tests.
- All 257 Android suites and 2,256 tests pass, including the 6 new teacher-signature tests. The focused run with the existing signature-vector suite passes 7 tests.
- **Android 8 / API 26:** all 15 native signature-package tests pass on a dedicated `minhajna-codex-signature-api26` emulator, port 5556.
- **Android 15 / API 35:** the same 15 tests pass on `minhajna-codex-signature-api35`, port 5554. These include the actual module's success values, fixed-error Promise overloads and replies after shutdown, not just helper or Jest tests.
- Debug APKs, generated bridge and instrumented tests compile. The offline release build and verification of all three unsigned APKs pass. The release requests exactly USE_BIOMETRIC, CAMERA, POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED; no network permission.
- REUSE 6.2.0 with chardet passes for 2,106/2,106 files. No new dependency, licence annotation or lockfile change was needed.

The emulators were created from already-installed images, with no Google services or downloads. No shared emulator was wiped, updated or used. This is not a physical-phone, camera-scan or independent reproducibility result. The native package can be repeated after installing the debug app and test APKs with `adb shell am instrument -w -r -e package dz.minhajna.preview.signature dz.minhajna.preview.test/androidx.test.runner.AndroidJUnitRunner`.

## Remaining work

- #436: core figures and signed-file format, prepared separately and not included in this branch.
- #438: Share preview, A4 print/PDF, explicit user choice and output logging.
- #439: the drawn QR screen, signed-file sharing and optional recipient-role history. A recipient's name must not be collected; PRD §3.10 wins over the older issue wording.
- #246 and #247: known-key continuity, reader mode and recovery. #248: deletion of the signing alias on device erasure.
- Native layout, spoken Arabic TalkBack, A4 paper, camera scanning and budget-phone acceptance belong to the connected screens. None is claimed by these primitive tests.

No dependency, app permission, network call, database migration, record layer or existing public file format changes. NETWORK.md, PRIVACY.md and the PRD are untouched. No user-visible translation is needed until the screens are connected.

# Calendar: receiving, stage 5 of #222

This extends the [stages 1–4 check](calendar-viewer.md) on the same branch. It implements the offline receive design and PRD §§4.5 and 5.9, not #223's signed-release importer.

## What changed

From Calendar, choose Receive, then Open file or Scan QR code. Both paths read one [closure notice](calendar-notice-format.md), show its content and claimed sender, and require school review and an impact preview before adding it. Ignore writes nothing. Received entries keep their provenance, remain read-only and can be withdrawn without erasing history.

File input uses Android's local-only document picker with no storage permission, persistent grant or URI retention. Reads have a 16 KiB cap, strict UTF-8, a ten-second deadline and cancellation; raw input is never saved or logged. A provider that ignores cancellation may occupy the reader, but the teacher's wait is bounded. Android controls which providers offer a document; the app does not fetch it over a network.

QR input uses an internal secure Camera2 activity. It requests permission only after Scan is selected, decodes in memory, clears the copied luminance buffer and releases the camera on pause. A refusal or unavailable camera leaves file input available. No frame is written to a file or sent to a tool or service.

The app keeps its no-network behaviour. The release permission check permits only biometrics and the explicitly approved camera; the camera hardware is optional. [NETWORK.md](../../NETWORK.md#offline-calendar-input) and the in-app privacy notice describe this local input.

## Dependency approval

The user approved **ZXing Core 3.5.4**, **Apache-2.0**, its maintenance-mode status and scan-only camera access in the #222 working chat. This is a local record of that approval, not a public issue comment, accepted governance decision or permission to submit a contribution.

Only the pure-Java core is added, not the old Barcode Scanner app, an online decoder, a Google Play service or a camera wrapper. The [3.5.4 module POM](https://github.com/zxing/zxing/blob/zxing-3.5.4/core/pom.xml) lists no runtime dependency; the [upstream README](https://github.com/zxing/zxing/blob/zxing-3.5.4/README.md) explains maintenance mode. Its [licence](https://github.com/zxing/zxing/blob/zxing-3.5.4/LICENSE) travels in Help, with REUSE coverage. Gradle pins the version and checks the JAR and POM SHA-256 values.

The dependency is an implementation of the already specified inbound file/QR flow; it adds no pupil field, outbound data flow or new claim of official status. Any broader flow or changed principle still needs the repository's decision process.

## Compatibility and limits

Database version **5** protects the local received marker and read-only semantics. The migration changes the compatibility marker only, not history rows, hashes or timing rows. Versions 0–4 upgrade through the existing transactional migration; newer versions are refused. Format-1 reference readers refuse local-only `received`, as they already refuse half-days, lunar overlays and rotations.

The bundled calendar is not replaced by a received notice. Stable-ID/scope matching prevents an identical received/reference entry from taking effect twice. Verified releases, reference withdrawal tombstones and update ordering remain #223; a removed reference can otherwise reveal its still-stored received copy.

Neither a QR nor an announced source proves origin. The preview deliberately omits the design's claim that a notice was unchanged since sending: there is no signature verification in this flow. No screen says a notice is an official app update. No generator, URL reader, archive importer or notice-sharing export is added.

## Verification

Initial pre-commit checkpoint, on Node.js 22.23.2 and Temurin 17:

- Repository type checks, lint/format checks and tests: 382 core, 13 sync, 17 web-storage and 14 APK-tool tests.
- Android type check and all 152 suites: **1,519 tests**, including 22 new receiving tests in three suites. These cover all three languages at font scales 1 and 2, explicit acknowledgement, preview without writes, duplicates, conflicting IDs, wrong schools, changing the selected school, cancellation, stale input callbacks, failed saves, queued changes, double taps, leaving and navigation.
- Offline release, debug and native-test builds. Universal, armeabi-v7a and arm64-v8a release APKs pass the package verifier, including their licence assets. The release manifest requests exactly `USE_BIOMETRIC` and `CAMERA`; camera hardware is optional. There is no network or storage permission.
- Android 8/API 26: **23 native tests passed** (13 existing storage, four migration, six calendar-input). Versions 2, 3 and 4 retain their exact opaque history rows on upgrade to 5, version 2 keeps its timings and version 6 is refused. Generated Arabic, inverted and rotated complete-notice QR matrices decode offline. Strict UTF-8 and the byte limit are checked; the scanner is internal and camera hardware optional.
- REUSE: all **1,640 files** covered. All **134 changed/new files** stayed within 300 lines. Nothing had been staged or committed at that checkpoint.

The native tests ran on a separate read-only emulator. All fixtures and decoded matrices are synthetic; no real pupil data or camera image is supplied to tools. Renderer and decoder checks do not establish real-camera, native-layout or spoken TalkBack acceptance. No clean-build reproducibility comparison or new F-Droid scan is claimed.

### Verification for the pull request

The contribution was split into four commits on main `a9919ea`, retaining the merged Settings, exam-duty, privacy and Weblate changes. The final app tree is unchanged by the split; Today compatibility and its catalogue travel with the core commit so the intermediate app can compile.

- Repository and Android type checks, lint and formatting pass. Repository tests pass: **385 core**, 13 sync, 17 web-storage and 14 APK-tool tests.
- Android: **154 suites, 1,559 tests passed**. Release, debug and native-test builds pass; all three release APKs pass package verification. Permissions remain biometrics and camera only.
- Android 8/API 26: **23 native tests passed** again on the rebased build. The separate read-only emulator was stopped after testing.
- REUSE covers all **1,618 files** after main's documentation cleanup. The 134 files changed by this contribution remain within 300 lines.

The first two commits are also checked from independent exported snapshots; the third contains the final tested app, and the fourth changes documents only. Device acceptance below is still pending, so the pull request is a draft and references the issue without completing its acceptance checklist.

## Manual acceptance still required

1. On a phone, open a short synthetic notice from a local file and scan the same JSON from another screen or paper, in airplane mode. A QR must contain the notice, not its URL. Check normal, rotated and poor-light scans.
2. Refuse camera access, cancel, press Back, background the scanner and return. Check permission is never asked on launch, on Calendar or on Open file; the camera indicator must stop on leaving. File input must remain available.
3. Read the unsigned-source warning, school name/code/wilaya, level/grade scope and full date range. A different school, wrong year or conflicting ID must not save. Compare the preview with the made-up timetable.
4. Ignore; import twice; withdraw; try malformed and oversized files; leave during input or saving. Check no raw file/path/image is retained, no false success appears and recorded lessons remain intact.
5. At 200% Arabic text, including landscape, check the native scanner's title, instruction, cancel button and system permission dialog, plus the receive preview. Repeat in French/English; check Arabic TalkBack and Back focus. Renderer tests are not spoken/native acceptance.
6. Check camera availability, cancellation and performance on a budget phone. BrowserStack/device acceptance, native visual/TalkBack checks, reproducibility comparison and a new F-Droid scan are not claimed by this stage.

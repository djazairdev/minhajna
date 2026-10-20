# Network calls

Every network call that Minhajna's code makes is listed here, with the address, what is sent and why ([engineering rules](docs/contributing/engineering.md#pupil-data-and-privacy), [PRD §1.5](docs/prd/PRD.md#15-pupil-data-and-privacy-rules)). Adding or widening a call is a privacy-sensitive change, and this file changes in the same pull request.

| Part | Address | What is sent | Why |
|---|---|---|---|
| The shared core (`packages/core`) | None | Nothing | The core makes no network calls |
| Android app (`apps/android`) | None | Nothing | Help reads licence notices from the installed APK; no network permission is requested |
| Synthetic browser-storage diagnostic (`packages/web-storage-check`, #79) | Its own static origin only (HTTPS or optional `http://127.0.0.1:4179` preview) | GET requests for the page, modules, public profile/calendar, manifest, icon, build checksum and licence files; the offline worker caches these static assets | Load/install the standalone test page. No result, history entry, passphrase, key or other user input is uploaded. There are no external scripts, telemetry or third-party endpoints |

The tests make no network calls either ([engineering rules](docs/contributing/engineering.md#tests)).

## Offline calendar input

Only after the teacher selects Open file does Android's document picker select one local document (`EXTRA_LOCAL_ONLY`). The app reads that content URI with a byte limit and timeout, takes no persistent URI grant, and asks for no storage permission. It does not fetch URLs found in a file or QR code.

Only after the teacher selects Scan QR code does an unexported app screen request camera permission and decode frames locally with ZXing Core 3.5.4. Frames remain in memory, are cleared after decoding and are not saved or sent. Leaving or backgrounding that screen closes the camera. Refusing access leaves file input available. No Google Play service, online decoder, identifier, upload, analytics or new network permission is involved. The user approved this dependency and scan-only camera access in the #222 working chat; no public comment was posted by the agent.

## Optional source link in Help

The source link is the fixed public address [github.com/djazairdev/minhajna](https://github.com/djazairdev/minhajna). Reading Help or a licence makes no request and does not launch another app. Only after the teacher selects the link and confirms a notice in their interface language does Android hand that address to the user's browser. No record, identifier, query parameter or other payload is attached. The browser may then contact GitHub under its own settings, revealing its normal connection/browser information to that site; this is not an in-app fetch or an embedded web view. Cancelling makes no hand-off. An unavailable browser does not prevent offline reading.

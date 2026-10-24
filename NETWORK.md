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

Only after the teacher selects Scan QR code does an unexported app screen request camera permission and decode frames locally with ZXing Core 3.5.4. Frames remain in memory, are cleared after decoding and are not saved or sent. Leaving or backgrounding that screen closes the camera. Refusing access leaves file input available. No Google Play service, online decoder, identifier, upload, analytics or new network permission is involved. The founder approved this dependency and scan-only camera access for #222 (answer 288 in the project's decision record).

Signed calendar updates (#223) come in through the same Open file and Scan QR code steps, and signed plan packs through Open file alone, up to 1 MB. The phone checks the signature itself, with Android's own platform crypto (ECDSA P-256), against the public keys bundled in the app's `data/dz/keys.json`; no key server, certificate list or revocation service is asked, and no new library or permission is involved (answers 303 and 316). Only an update or a pack the teacher applies is kept, in the local history; nothing is sent.

## Notifications

The weekly digest and the daily preview (#234) are notifications Android shows at times the app sets while it is open, with words it sets then. Android 13 and later ask the teacher for the notification permission once. No push service, server, Firebase or Google Play service is involved: nothing arrives from outside the phone and nothing is sent. A notification never shows a pupil's name or a mark, and when the phone hides sensitive content on the lock screen, only its title shows there. After a restart, the app sets the alarms still to come again, which needs Android's boot permission and no network (answer 406 in the project's decision record).

## Optional pack source links

A plan pack may name the address where its source file was found. Pack details show that address as text; reading them makes no request and launches nothing. Only when the teacher selects Open the source on an item, and confirms a notice that names the address's host, does Android hand the address to the user's browser, with the item's source page after `#page=`. The address opens only if it is a plain `https` address on a named host, in printable ASCII, with no user name, password or fragment of its own; any other address is shown and never opened. No record, identifier or query parameter is added. The browser may then contact that host under its own settings; this is not an in-app fetch or an embedded web view. Cancelling makes no hand-off (#225, answer 289).

## Plan-error reports

A teacher may report an error in a plan item. The report screen shows the exact text before it leaves: the pack and item IDs, the release, the kind of error, the teacher's note and, only if the teacher turns on credit and types it, a name. No class, school, pupil, record or device identifier is added, the teacher card's name is never filled in, and the screen asks the teacher not to write pupils' names in the note. Bidi control characters are removed from what the teacher types. Only when the teacher selects Share the report does Android's share sheet open with that text; the teacher picks the app, and the screen suggests `contact@djazair.dev`. The app makes no request and needs no network permission; whatever the chosen app does with the text is under its own settings (#225, answers 287 and 290).

## Problem reports

A teacher may report a problem from Help. The report screen shows the exact text before it leaves: what happened, in the teacher's words, the part of the app they chose, the app's version, Android's version and the route names of the last ten screens opened since the app started, kept in memory only, never their content or parameters. Every pupil's name the app holds, Arabic or Latin, whole or in part, is replaced with «تلميذ 1», «تلميذ 2» in what the teacher types before it is shown, as the class lists write it, with common spelling variants and attached prefixes; a name spelled another way may remain, which is why the teacher reads the whole report before sharing it. Registration numbers are replaced too, and bidi control characters are removed. No class, school, record or device identifier is added. Only when the teacher selects Share the report does Android's share sheet open with that text; the teacher picks the app, and the screen suggests `contact@djazair.dev`. The app keeps no copy, makes no request and needs no network permission (#249, answer 483).

## Optional source link in Help

The source link is the fixed public address [github.com/djazairdev/minhajna](https://github.com/djazairdev/minhajna). Reading Help or a licence makes no request and does not launch another app. Only after the teacher selects the link and confirms a notice in their interface language does Android hand that address to the user's browser. No record, identifier, query parameter or other payload is attached. The browser may then contact GitHub under its own settings, revealing its normal connection/browser information to that site; this is not an in-app fetch or an embedded web view. Cancelling makes no hand-off. An unavailable browser does not prevent offline reading.

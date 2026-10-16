# Network calls

Every network call that Minhajna's code makes is listed here, with the address, what is sent and why ([engineering rules](docs/contributing/engineering.md#pupil-data-and-privacy), [PRD §1.5](docs/prd/PRD.md#15-pupil-data-and-privacy-rules)). Adding or widening a call is a privacy-sensitive change, and this file changes in the same pull request.

| Part | Address | What is sent | Why |
|---|---|---|---|
| The shared core (`packages/core`) | None | Nothing | The core makes no network calls |
| Android app (`apps/android`) | None | Nothing | Help reads licence notices from the installed APK; no network permission is requested |

The tests make no network calls either ([engineering rules](docs/contributing/engineering.md#tests)).

## Optional source link in Help

The source link is the fixed public address [github.com/djazairdev/minhajna](https://github.com/djazairdev/minhajna). Reading Help or a licence makes no request and does not launch another app. Only after the teacher selects the link and confirms a notice in their interface language does Android hand that address to the user's browser. No record, identifier, query parameter or other payload is attached. The browser may then contact GitHub under its own settings, revealing its normal connection/browser information to that site; this is not an in-app fetch or an embedded web view. Cancelling makes no hand-off. An unavailable browser does not prevent offline reading.

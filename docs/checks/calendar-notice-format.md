# Single closure notice: format 1.0

This is the local file/QR input for [#222](https://github.com/djazairdev/minhajna/issues/222), implementing PRD §§4.5 and 5.9. It is not a signed reference release, a record export or an invitation to connect to a server. See the [synthetic example](calendar-notice.example.json) and [receiving checks](calendar-receiving.md).

## Envelope

One UTF-8 JSON object, at most **16,384 bytes**. No ZIP, image-file input, URL, array of notices or streaming feed. A QR contains the complete same JSON text, not a link. Real QR capacity is smaller than the file limit; producers must keep notices short enough for one code. There is no notice-export tool in this stage.

| Field | Requirement |
|---|---|
| `format` | Exactly `minhajna.calendar-entry` |
| `version` | `{"major":1,"minor":0}`; a different major is refused; a newer non-negative integer minor opens with a warning, keeping only supported fields |
| `country` | The loaded country's code, currently `dz` |
| `year` | The loaded school-year ID, such as `2026-2027` |
| `sender` | Non-empty description, at most 160 UTF-16 code units; unverified, not an account or identifier |
| `school` | Required only for a school entry: `name` (160), a known `zone` code and optional `code` matching the core's school-code grammar |
| `entry` | Exactly one closure with the fields below |

Text is trimmed; control characters and malformed UTF-8 are refused. Bounds count the original input, before unknown fields are discarded. Unsupported fields never reach history, navigation or logs. Signatures, signed wrappers and an `entries` array are explicitly refused; an unknown field must not be used to change the meaning of a closure.

## Entry

| Field | Requirement |
|---|---|
| `id` | Stable entry ID, matching `ENTRY_ID` in the core; keep it when resending the same notice |
| `layer` | `school` or `zone` only |
| `effect` | `closure` only |
| `from`, `to` | Inclusive valid Gregorian dates, `YYYY-MM-DD`, inside the loaded year, in order |
| `source` | Non-empty source description, at most 200 code units; never fetched |
| `name` | One to eight language keys matching `LANGUAGE`; each title is non-empty and at most 160 code units |
| `confidence` | `announced` or `expected`; the sender's claim, not verified by the app |
| `zone` | Required for the zone layer, known in the country profile; absent for school entries |
| `half` | Optional `morning` or `afternoon`; absent means the whole day, on every date |
| `levels`, `grades` | Optional, non-empty lists of known, distinct profile codes; grades must belong to the named levels |

Device-local `schoolId`, personal entries, national entries, exams, Ramadan hours, lunar confirmations, A/B changes, rotations and additional lessons are not accepted here. Their semantic fields are refused, not silently converted to a closure. A notice contains no pupils, attendance, teacher notes or record history. Do not put such information in a title, sender or source either.

## Match, preview and save

The teacher selects one of their schools and explicitly confirms that the notice applies. Country, year, wilaya and any taught-level/grade restriction must match. For a school notice, codes must match when both exist; otherwise the exact trimmed name and wilaya must match. A code or name match is not proof of identity.

Only then does the same calendar engine preview the affected unrecorded sessions and preserved recorded lessons. Adding uses the ordinary durable history queue, with the current recording date and a local `schoolId`. The history entry retains the allowlisted sender and portable school description in `received`. No clock time, URI, file path, image or raw JSON is saved.

A received entry is read-only but can be withdrawn. A correction requires withdrawal and a reviewed replacement; importing a changed notice under an existing ID never overwrites it. Repeating identical content is a no-op, even when its claimed sender differs. Ignoring, cancelling or refusing input appends nothing.

A matching reference entry under the same ID, layer, effect and scope prevents a second active copy. A different reference under that ID is a conflict. This establishes identity matching only, not a release-update system: verified issuers, release revision ordering, withdrawal tombstones and preventing a removed reference from reviving a received copy remain in #223. No complete signed-update deduplication claim is made here.

## Trust boundary

Validation establishes a supported shape and scope. It does **not** authenticate the sender or prove the file is unchanged since sending. The preview says so; the design's stronger integrity sentence is deliberately not used. Signed official updates need the verification process from #223, not a checksum or a QR code.

Input is temporary. Only an explicitly accepted, allowlisted closure reaches encrypted history. This stage does not add a share/export path for that history or its provenance.

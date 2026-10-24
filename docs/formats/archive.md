# The Minhajna archive

The Minhajna archive is everything a teacher recorded in Minhajna, taken out of the app free and at any time. It holds the history of every change, in an open format that every later version of Minhajna reads ([PRD §5.9](../prd/PRD.md#59-files-minhajna-reads-and-writes), R-5.9-01). This page describes version 1.0.

The format is written by `archiveOf` and read by `readArchive` in [`packages/core/src/archive.ts`](../../packages/core/src/archive.ts) and [`archive-read.ts`](../../packages/core/src/archive-read.ts).

## The file

The app saves the archive as a ZIP file holding one file, `minhajna-archive.json`, in UTF-8. Without a password, the ZIP is a plain deflated one. When the teacher protects it with a password, which is the default, the ZIP is encrypted with AES-256 in the WinZip AE-2 form. 7-Zip, WinRAR and WPS open it with the password. The password is never kept, and the project cannot recover it.

The archive holds pupil data. Keep it on a computer, an SD card or a USB key, not in a messaging app.

## The fields

The file is one JSON object:

| Field | What it holds |
|---|---|
| `format` | Always `"minhajna-archive"`. |
| `version` | `{"major": 1, "minor": 0}`. A reader reads its own major version, and a newer minor version as far as it knows. It refuses a newer major version. |
| `made` | The day the archive was made, `YYYY-MM-DD`. Minhajna never records a clock time. |
| `app` | The version of the app that made it, such as `"0.5.0"`. |
| `country` | The country profile, such as `"dz"`. |
| `calendarRelease` | The release of the school calendar bundled with the app. The signed calendar updates in the history follow it. |
| `privateNotes` | Whether the teacher included the private notes. |
| `leftOut` | The IDs of the entries whose content was left out by choice. |
| `packs` | The plan pack releases bundled with the app that a class is pinned to, in the plan pack format. A later version that no longer bundles a release still reads it. Packs the teacher added as signed files are already in the history. |
| `entries` | Every history entry, in order. |

### An entry

Each entry is one change, exactly as the app stores it ([PRD §5.5](../prd/PRD.md#55-history-corrections-and-signatures)):

| Field | What it holds |
|---|---|
| `id` | The entry's random ID. |
| `seq` | Its place in the history, from 0. |
| `day` | The day of the change, never its time. |
| `layer` | The layer the record belongs to: `private`, `pupil-records`, `lesson-record`, and so on. |
| `kind` | The kind of change, such as `class.set` or `roll-call.taken`. |
| `digest` | SHA-256 of the content's text, below, in lowercase hex. |
| `previous` | The `hash` of the entry before it, or `""` for the first. |
| `hash` | SHA-256 of the header's text, below, in lowercase hex. |
| `salt` | The random salt, in hex, or `null` when the entry has no content. |
| `body` | The change itself, or `null` when the entry has no content. |

### The hashed texts

Both texts are hashed as their UTF-8 bytes, with `\n` a line feed:

- **The content's text:** `minhajna/content/1\n`, the salt, `\n`, then the body's canonical JSON.
- **The header's text:** `minhajna/entry/1\n`, then the canonical JSON of an object with the entry's `id`, `seq`, `day`, `layer`, `kind`, `digest` and `previous`.

Canonical JSON, as [`canonical.ts`](../../packages/core/src/canonical.ts) writes it:

- no spaces or line breaks;
- an object's keys sorted by their UTF-16 code units, as JavaScript's default sort does, with any key whose value is undefined dropped;
- strings as `JSON.stringify` writes them, with any lone surrogate written as `\uXXXX` in lowercase hex;
- numbers as `JSON.stringify` writes them; only finite numbers are allowed;
- `true`, `false` and `null` as they are.

### Content

An entry has no content when it was erased, or when it was left out of the archive.

- **Erased.** A later entry of kind `erasure`, in the same layer, lists it. Erasure is real: the content and its salt are gone, and the erasure keeps only the fact and the day.
- **Left out.** Its ID is in `leftOut`.

## What is left out

- **Always:** the `device` layer. It holds the teacher card's personal fields and the drawn signature. They are typed and drawn again on another phone (R-3.2-03, R-3.8-47).
- **Unless the teacher includes them:** private notes, entries of kind `session.noted`.

A left-out entry keeps its header. An erasure is never left out, as it names only entries. So the chain still checks.

## Checking an archive

A reader checks, in order:

1. The format and the major version.
2. Every field, with no field it does not know, unless the minor version is newer than its own. No two entries share an ID.
3. Every entry in `leftOut` has no content, and is of the `device` layer or a private note.
4. The history's chain:
   - each entry's `seq` is its place;
   - its `previous` is the hash of the entry before it;
   - its `hash` matches its header;
   - its `digest` matches its salt and body, when it has content;
   - an entry with no content is erased or left out.

The chain shows an entry changed, removed or reordered after the archive was made. It does not prove who made it: entries are not yet signed with the teacher's key (PRD §5.5).

A restore records every left-out entry as erased, in the layer it belongs to, on the day of the restore.

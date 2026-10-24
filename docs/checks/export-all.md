# Export everything (#248)

Checks of 24 October 2026 for [#248](https://github.com/djazairdev/minhajna/issues/248), on `feat/248-archive` and `feat/248-export-screen`. Made-up classes and records only.

A teacher's records are theirs: they can take everything out, free, at any time (answer 472). This page covers the first two pull requests: the Minhajna archive in the core, and the «تصدير كل البيانات» screen with its files. Erasing a pupil who left and erasing the phone follow.

## Part 1: the Minhajna archive (core)

- **Every history entry exactly as stored,** so the chain checks again on another phone, and the bundled plan releases a class is pinned to. The format is described in [`docs/formats/archive.md`](../formats/archive.md).
- **Left out:** the teacher card's personal fields and the drawn signature always, and private notes unless the teacher includes them. Their entries keep their header and are listed as left out. Erasures always stay in.
- **Read back strictly:**
  - a changed or dropped entry is refused, and so is a repeated ID;
  - so is content missing without an erasure, or a false claim that content was left out;
  - an unknown field is refused, unless the minor version is newer;
  - a newer major version is refused.

## Part 2: «تصدير كل البيانات»

- **In Settings,** the export row now opens the screen, with its line: the archive or CSV files, free, at any time.
- **The archive** is one file, `minhajna-archive.json`, in a ZIP.
- **The CSV choice** is three files in one ZIP: `marks.csv`, `roll-call.csv` and `lessons.csv`. They are written in the term export's dialect, and each is marked «داخلي · سري» on its first line.
  - **Marks:** a line for each mark recorded. A mark for a test since removed is left out.
  - **Roll call:** a line for each absence or lateness.
  - **Lessons:** a line for each session, with what the daily journal says of it, and its homework in columns of its own.
  - **Sorting:** lines are sorted by what they are: a term by its number, the morning before the afternoon, a pupil by their list number, and «4م2» before «4م10». This holds in every language.
- **Protection:** on by default, with the password rule of the term export. The password is never kept or logged. Without it, the ZIP is a plain one.
- **Saving** goes through the phone's file picker only, under a name made of the kind of export and the day. The screen shows the files' size before compression.
- **The activity log** records each export with its kind, never its content. A cancelled save is neither said nor logged.

| Check | Result |
|---|---|
| Core tests (`archive.test.ts`, 8 tests) | Pass. They cover:<br>• what is left out;<br>• the notes when included;<br>• the pinned packs;<br>• reading back and rebuilding the state;<br>• an erased personal field;<br>• every refusal listed above. |
| Android tests (`export-all.test.tsx`, 7 tests, and the log and Settings tests) | Pass. They cover:<br>• the archive saved protected, read back with the core, without the notes or the personal fields, and logged;<br>• the notes when included, and protection off;<br>• a refused password;<br>• the three CSV files and their lines;<br>• the order in French, and a removed test left out;<br>• a cancelled save;<br>• every text in French and English;<br>• the log's lines;<br>• the Settings row opening the screen. |
| ZIP writer, instrumented tests (`AesZipTest.kt`) | Two new tests:<br>• several AES entries, each found from the central directory;<br>• a plain ZIP read back with its Arabic names. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |
| Android emulator, release build signed with the debug key, on Saturday 24 October | Pass. Set up from scratch, with the 4AM demo class of 45 made-up pupils, the example plan pinned and a made-up personal name on the teacher card.<br>• **The screen:** «تصدير كل البيانات» opened from Settings with the archive chosen, the private notes off, protection on, «كل السنوات حتى الآن: 2026-2027» and «نحو 35 كيلوبايت».<br>• **The archive:** with a password, «اختيار مكان الحفظ» opened the file picker on «أرشيف منهاجنا 2026-10-24.zip», and the screen said «حُفظ الملف.». The 11 KB file held one AES-256 entry, `minhajna-archive.json`. Decrypted with the password, its authentication code checked, and a wrong password was refused. The core's `readArchive` accepted it: 53 entries, 1 left out (the personal fields), the example pack, one class and 45 pupils. The made-up name was not in it.<br>• **The CSV files:** with protection off, «بيانات منهاجنا CSV 2026-10-24.zip» was a plain ZIP that `unzip` opened. It held the three files, each with its byte-order mark, the «داخلي · سري» line and its heads.<br>• **The activity log** showed both exports, «تصدير كل البيانات · 24/10/2026 · أرشيف «منهاجنا»» and «… · CSV», and the chain was intact. |

Still to check, on [#206](https://github.com/djazairdev/minhajna/issues/206):
- the screen with TalkBack in Arabic;
- a phone in French and English, with text at 200%;
- the protected ZIP opened with 7-Zip or WinRAR on a computer, and the CSV files opened in Excel;
- an archive of a teacher's full term, for its size and the time it takes.

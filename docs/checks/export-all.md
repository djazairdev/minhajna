# Export everything (#248)

Checks of 24 October 2026 for [#248](https://github.com/djazairdev/minhajna/issues/248), on `feat/248-archive`, `feat/248-export-screen`, `feat/248-pupil-erase` and `feat/248-erase-screen`. Made-up classes and records only.

A teacher's records are theirs: they can take everything out, free, at any time (answer 472), and erase a pupil who left (answer 473). This page covers the first four pull requests:
- the Minhajna archive in the core;
- the «تصدير كل البيانات» screen with its files;
- the core's erasure of a pupil who left;
- the erasure's screen.

The books' line for an erased pupil and erasing the phone follow.

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

## Part 3: erasing a pupil who left (core)

- **Only once the director confirmed the departure.** A pupil still on the list, or one whose departure waits for confirmation, is refused, and nothing is written.
- **Every version of the pupil's own records goes:**
  - the pupil with their movements;
  - their marks and mark corrections;
  - what was tapped for them;
  - their observations and appreciations.
- **The class's records are restated without them:**
  - every roll call in which they were absent or late;
  - every seating plan with their seat.

  Each version keeps its day, its place in the history and its reason, so the roll-call book and its corrections read as before. The old versions are then erased.
- **The history keeps one fact:** the class, and the entries erased. It still verifies.
- **No other pupil's number changes:** the pupil's place on the class list stays taken. A pupil who joins later takes the next number.
- **The activity log** shows one line, «حُذفت بيانات تلميذ · دون محتواها». A correction that touched only the erased pupil leaves the log, and the others keep their own day.
- **A second pupil's erasure** restates what the first restated.
- **An erasure the app stopped in** reads in order meanwhile. It is finished when the history opens again, or when it is tried again, without a second fact.

## Part 4: «حذف بيانات هذا التلميذ»

- **On the pupil's page in the roll-call book:**
  - the row shows once a departure is recorded;
  - it opens once the director's confirmation is recorded;
  - a pupil still on the list has no row.
- **The sheet:**
  - names the pupil, the class and the day they left;
  - lists what goes and what stays;
  - offers «التصدير أولاً», which opens «تصدير كل البيانات»;
  - shows the activity log's one line.
- **«حذف البيانات»** is closed until «فهمت أن الحذف لا رجوع فيه.» is ticked. It erases once, however often it is tapped, then closes the page. A failed erasure is said, and the page stays.
- **The words follow the pupil:** «هذا التلميذ», «هذه التلميذة», «غادر», «غادرت».

| Check | Result |
|---|---|
| Core tests (`archive.test.ts`, 8 tests) | Pass. They cover:<br>• what is left out;<br>• the notes when included;<br>• the pinned packs;<br>• reading back and rebuilding the state;<br>• an erased personal field;<br>• every refusal listed above. |
| Android tests (`export-all.test.tsx`, 7 tests, and the log and Settings tests) | Pass. They cover:<br>• the archive saved protected, read back with the core, without the notes or the personal fields, and logged;<br>• the notes when included, and protection off;<br>• a refused password;<br>• the three CSV files and their lines;<br>• the order in French, and a removed test left out;<br>• a cancelled save;<br>• every text in French and English;<br>• the log's lines;<br>• the Settings row opening the screen. |
| ZIP writer, instrumented tests (`AesZipTest.kt`) | Two new tests:<br>• several AES entries, each found from the central directory;<br>• a plain ZIP read back with its Arabic names. |
| Core tests (`pupil-erase.test.ts`, 6 tests) | Pass. They cover:<br>• the erasure and what stays;<br>• the three refusals;<br>• a second erasure over the first;<br>• an erasure finished on opening;<br>• an erasure tried again after a failure, which finishes the first fact;<br>• restatements that do not hold. |
| Android tests (`erased-numbers.test.ts`, and the log's words in each language) | Pass. They cover:<br>• the other pupils' numbers kept, and the next number for a pupil who joins;<br>• the log's one line, with a correction's pupil number unchanged. |
| Android tests (`pupil-erase.test.tsx`, 5 tests) | Pass. They cover:<br>• no row for a pupil on the list, and a closed one while the confirmation waits;<br>• the sheet's words, the export row, the closed button, the erasure, the closed page and the log's line;<br>• two quick taps erasing once;<br>• a girl's wording, and a failed erasure said with the page kept;<br>• every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |
| Android emulator, release build signed with the debug key, on Saturday 24 October | Pass. Set up from scratch, with the 4AM demo class of 45 made-up pupils, the example plan pinned and a made-up personal name on the teacher card.<br>• **The screen:** «تصدير كل البيانات» opened from Settings with the archive chosen, the private notes off, protection on, «كل السنوات حتى الآن: 2026-2027» and «نحو 35 كيلوبايت».<br>• **The archive:** with a password, «اختيار مكان الحفظ» opened the file picker on «أرشيف منهاجنا 2026-10-24.zip», and the screen said «حُفظ الملف.». The 11 KB file held one AES-256 entry, `minhajna-archive.json`. Decrypted with the password, its authentication code checked, and a wrong password was refused. The core's `readArchive` accepted it: 53 entries, 1 left out (the personal fields), the example pack, one class and 45 pupils. The made-up name was not in it.<br>• **The CSV files:** with protection off, «بيانات منهاجنا CSV 2026-10-24.zip» was a plain ZIP that `unzip` opened. It held the three files, each with its byte-order mark, the «داخلي · سري» line and its heads.<br>• **The activity log** showed both exports, «تصدير كل البيانات · 24/10/2026 · أرشيف «منهاجنا»» and «… · CSV», and the chain was intact. |
| Android emulator, part 3's release build signed with the debug key and installed over part 2's, with its data | Pass. Opened with the PIN on Today, with the demo class and its exam-window warning. «سجل النشاط» said «السلسلة سليمة» and listed both exports in their order. The erasure itself is checked with its screen in part 4. |
| Android emulator, part 4's release build signed with the debug key, over part 3's data | Pass. In the demo class, «عثماني لينة», number 33.<br>• **Before the departure:** her page had no erase row.<br>• **Departure recorded** through «تسجيل انتقال أو مغادرة» from Sunday 25 October, by transfer: «حذف بيانات هذه التلميذة» showed with «يُتاح بعد المغادرة وتأكيد المدير», and tapping it opened nothing.<br>• **Director's confirmation recorded:** the sheet opened with «عثماني لينة · القسم التجريبي · غادرت في 25/10/2026», the four lines that go, the two that stay, «التصدير أولاً» (which opened «تصدير كل البيانات», and back), «حُذفت بيانات تلميذ · 24/10/2026 · دون محتواها», and «حذف البيانات», which did nothing before the tick.<br>• **After the tick, «حذف البيانات»:** the page closed back to the class page. It showed «44 تلميذاً», no line 33, and «فرحات حمزة» still number 34.<br>• **«سجل النشاط»** said «السلسلة سليمة» and showed one line under «الحذف», «حُذفت بيانات تلميذ · دون محتواها», above the two exports. |

Still to check, on [#206](https://github.com/djazairdev/minhajna/issues/206):
- the screen with TalkBack in Arabic;
- a phone in French and English, with text at 200%;
- the protected ZIP opened with 7-Zip or WinRAR on a computer, and the CSV files opened in Excel;
- an archive of a teacher's full term, for its size and the time it takes.

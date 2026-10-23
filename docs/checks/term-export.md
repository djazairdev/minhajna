# The term export (#242)

Checks of 23 October 2026 for [#242](https://github.com/djazairdev/minhajna/issues/242), on `feat/242-export-core`, `feat/242-export-screen` and `feat/242-mark-sheet`. Made-up classes and records only.

Filling the school's own workbook waits for the blank templates of [#45](https://github.com/djazairdev/minhajna/issues/45), since its cells cannot be guessed (answer 466). Everything else is built in four pull requests: this core first, then the Export screen with the ostad view, the printed sheet, and saving and sharing with the check before signing.

## Part 1: the sheet, the CSV file and the check (core)

- **The sheet** (R-3.7-01, R-3.6-07): for a course and term with a grade book, each pupil in list order, which is the order of the school's grid. Each row has the parts the formula weighs, the average and the appreciation chosen. The sheet is not ready while any part or appreciation is missing, and it says which. An absence counts as a value, «غائب», not as a gap. A term whose marks observations replace has no export.
- **The route:** the school's choice, its workbook or the ostad grid, is kept with the school once the teacher makes it.
- **The CSV file** (R-5.9-03, R-5.9-15):
  - It is UTF-8 with a byte-order mark, so Excel reads its Arabic. Its cells are split by semicolons and its numbers have a decimal comma, the list separator and decimal mark of Excel set in French or Arabic for Algeria. Whether Excel and WPS open it in columns, with numbers they can add up, is checked on a phone in part 4, which may still switch to a decimal point; the check before signing reads either.
  - The first line marks it «داخلي · سري», with the class, subject, term and year. Then come the header and a line for each pupil, with numbers to two decimals and «غائب» for an absence.
  - A cell a spreadsheet would run as a formula starts with an apostrophe. A cell with a separator, a quote or a line break is quoted.
- **Reading a file back:**
  - A file is split by its own separator, semicolon, comma or tab, the one that splits the most of its first lines, since a spreadsheet may change it when saving again. Quoted cells and line breaks are kept.
  - The check before signing (R-3.7-09) sets each pupil's name, parts and average in the register beside the file's, matched by the pupil's number. A comma decimal is read as a point, and a file's number is compared with the value the register shows, never rounded, so 16.504 differs from 16.50.
  - The check shows each value or name that differs, a pupil's line missing, a column missing, and the file's numbers that are not on the list or are there twice. It changes neither the register nor the file.

| Check | Result |
|---|---|
| Core tests | The sheet not ready with parts and appreciations missing, then ready, an absent exam counting as a value; no sheet for an unknown course; the CSV text in full, with its byte-order mark, semicolons, decimal commas, marking line, header, two decimals, «غائب», quoted cells, and a name that would run as a formula made safe; files read back with semicolons, commas, tabs, quoted line breaks, CRLF and a one-cell title line; the check with every row the same, a comma file with a comma decimal and extra spaces in a name, a value that differs, a third decimal, a name that differs, a line missing, a number not on the list and one there twice, and a column missing. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator | Not run: nothing on screen changes until the screen's pull request. |

## Part 2: «التصدير الفصلي» and the ostad view

- **The hub** (Export, answer 466): after «التقديرات», «التصدير الفصلي» reads «جاهز للتصدير», or «نقاط ناقصة: 0 · تقديرات ناقصة: 3». A term whose marks observations replace has no such row. «اكتملت التقديرات» also leads to the export.
- **The screen:**
  - The line, «التصدير الفصلي · 4م1 · اللغة العربية · الفصل الأول».
  - What is complete: «النقاط كاملة: التقويم والفرض والاختبار», or «خانات نقاط ناقصة: 3 · التلاميذ المعنيون: 1 من 4»; the averages by the formula and its release; the appreciations, «التقديرات: 0 من 3», with the list's note.
  - While anything is missing, a notice says nothing is exported until the marks and appreciations are complete (R-3.6-07).
- **The route:** «ملف Excel من الإدارة» or «شبكة ostad», recorded with the school, so it holds for all the teacher's classes there.
  - **The workbook** says that filling it waits for the blank templates being collected from schools, and asks for no file yet.
  - **The ostad view**, once everything is complete, lists each pupil in the grid's order with their parts in large numbers to copy by hand, an absence as «غائب». TalkBack reads each pupil as one line.
- **Never:** the screen says Minhajna never asks for the ostad or amatti password, never goes into those platforms for the teacher, and never makes report cards.

| Check | Result |
|---|---|
| Android tests | The hub's row before and after the appreciations; the screen's lines and its notice; the route recorded with the school; the workbook's notice; the ostad view, each pupil's spoken line and an absence; a missing mark counted; «إلى التصدير الفصلي»; no row in 1AP's first term, a row in its second; every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, the only class on the emulator, on Friday 23 October:<br>• «التقويم والنقاط» showed «التصدير الفصلي», «نقاط ناقصة: 132 · تقديرات ناقصة: 45», after «التقديرات».<br>• The screen read «التصدير الفصلي · القسم التجريبي · اللغة العربية · الفصل الأول», then «خانات نقاط ناقصة: 132 · التلاميذ المعنيون: 45 من 45», «المعدلات بالصيغة الرسمية، الإصدار 2026.1», «التقديرات: 0 من 45» and the list's note, then the notice «لا تصدير بعد».<br>• «شبكة ostad» was recorded as checked, and showed no view since nothing is complete. «ملف Excel من الإدارة» showed the notice that it waits for the templates, and was still chosen after the app was stopped and opened again.<br>• No pupil of the demo class has all their marks, so the ostad view was checked in the tests only. |

## Part 3: the printed mark sheet

- **Where** (Marks-sheet, answer 466): once the export is ready, «التصدير الفصلي» shows «ملفات أخرى» with «كشف النقاط المطبوع», what it holds, and «طباعة» and «حفظ PDF». Each goes into the activity log as «كشف النقاط والتقديرات» with the term.
- **The page:**
  - It is A4 portrait, framed «داخلي · سري», with the class's school and the school year, «كشف النقاط والتقديرات», and the class, subject, term and the teacher's name when the card has it.
  - Each pupil is in the grid's order, with their number, name, each part and the average to two decimals, «غ» for a part missed, and the appreciation chosen in its own wide column.
  - Then comes the teacher's box, dated.
- **The signature:** a middle-school page offers «خانة التوقيع» while the drawn signature is in use, as the grade book does (answer 462). Left blank, the page carries none, and a primary or lycée page never carries it.

| Check | Result |
|---|---|
| Android tests | Not offered before the export is ready; the page printed and saved, with the teacher's name, a pupil's parts, average and appreciation, «داخلي · سري» and the signature, the file's name, and both logged with the term; no signature when left blank; the log's line for a printed sheet; every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, on Friday 23 October: «التصدير الفصلي» showed its lines, the notice «لا تصدير بعد», the route still on «ملف Excel من الإدارة» with its notice, and the closing line, with no «ملفات أخرى», since no pupil of the demo class has all their marks. The page itself was checked in the tests. |

## Part 4a: the files the export keeps or sends (Android)

- **Making a file:** the CSV text is written as UTF-8, or a made PDF is moved, under the name the teacher will see. Each goes in its own folder of the app's cache, named by a random token, and only the token crosses to the screens.
- **With a password** (R-5.9-15): the file goes into a ZIP archive encrypted with AES-256, the WinZip AE-2 format, made for 7-Zip, WinRAR and WPS to open with the password; that is still to be checked on Windows. The password is taken as UTF-8, and the archive keeps no CRC of the plain file.
- **Keeping and sending:**
  - Saving goes through the system's file picker, and sending through Android's share screen (R-5.9-17), so the app asks for no storage permission.
  - A saved or cancelled file is deleted at once. A shared file stays until the app's next start, which empties the folder.
- **Reading back:** a file the teacher picks gives its text: as UTF-16 after its byte-order mark, as Excel saves Unicode text, else as UTF-8, or else as Arabic Windows' code page, as Excel saves a CSV file there. A file over 2 MB is refused, and so is a file that is not text: a ZIP archive, such as one made under a password or an .xlsx workbook, an old .xls workbook, or a PDF.
- The screens that use all this come in part 4b.

| Check | Result |
|---|---|
| Instrumented tests on the emulator (`AesZipTest`, 2 tests) | Pass. They cover the archive's headers (AES method, AE-2 field, sizes, UTF-8 name), that the plain text never shows in it, and that two archives of the same file differ. They also cover the file-name rules, the types, files known not to be text, and text read as UTF-16, UTF-8 or Windows-1256. |
| The archive opened on a Mac | The archive the test left was pulled from the emulator and opened with bsdtar 3.5.3 (libarchive 3.7.4) and the password. It gave back the exact bytes of the made-up CSV file; a wrong password was refused. |
| Release build, type check, ESLint, Prettier, root lint, typecheck and tests | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the hub's row, the status card, the route choice, and each pupil of the ostad view read as one line.
- **On a phone in French and English:** the screen and the ostad view.
- **On Windows:** a password-protected CSV file and PDF, opened with 7-Zip, WinRAR and WPS, with a Latin and an Arabic password. If one refuses the Arabic password, part 4b keeps passwords to Latin letters and digits.
- **On paper:** the printed mark sheet on a real A4 printer, with a 45-pupil class and long appreciations.
- **With a teacher:** copying a real term's marks from the ostad view into the ostad grid, and saying whether the numbers are large enough and the order matches the grid.

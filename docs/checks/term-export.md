# The term export (#242)

Checks of 23 October 2026 for [#242](https://github.com/djazairdev/minhajna/issues/242), on `feat/242-export-core`. Made-up classes and records only.

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

# The class-council pack (#244)

Checks of 23 October 2026 for [#244](https://github.com/djazairdev/minhajna/issues/244), on `feat/244-council-core`. Made-up classes and records only.

Before each class council, teachers work out averages, extremes, success rates and lists by hand. The pack gives them for each class, subject and term (answer 470). Three pull requests: this core, then «ملف مجلس القسم», then its printed document.

## Part 1: the figures and the thresholds (core)

- **Every figure** is taken over the pupils with an average, on the full value (R-3.5-17):
  - the class average, the highest and lowest averages, and the standard deviation of the population, divided by the number of averages, since a class is the whole group;
  - how many reach 10, or 5 in primary (R-3.7-11, R-3.7-12).
- **The bands** are fixed on 20: below 5, 5 to 8, 8 to 10, 10 to 12, 12 to 14, 14 to 16, and 16 or more. Each lower bound is reached on the full value, and the bands are halved on 10 (R-3.7-13).
- **Boys and girls**, from the pupil record: how many have an average, how many reach the threshold, and their mean (R-3.7-13).
- **The ranks** are the grade book's, with equal values sharing a rank, listed highest first, then in list order (R-3.7-14).
- **From term 2**, the previous term's class average and how many reached the threshold, and each pupil's previous rank (R-3.7-15).
- **Remediation and distinction** (R-3.7-16):
  - Pupils below the first threshold may need remediation, and pupils at or above the second are in line for a distinction.
  - The teacher sets both thresholds, since no text does: 8 and 15 on 20 by default, halved on 10.
  - They are one setting for every class, kept as `council-thresholds.set` on 20. It is refused outside 0 to 20, with more than two decimals, or out of order.
  - The setting is private, and it leaves only on the teacher's own routes.
- **The attendance summary** is the class's roll-call book over the term's dates up to today, under the teacher's counting rules: half-days missed, lateness, and the attendance rate (R-3.7-17). With no roll call taken, there is none, even when the teacher counts the units without one as present.

| Check | Result |
|---|---|
| Core tests (`council-pack.test.ts`, 6 tests) | Pass. They cover:<br>• the figures, with a 9.75 left below 10;<br>• the standard deviation;<br>• the bands, and boys and girls apart;<br>• the ranks;<br>• the default thresholds, then the teacher's, refused out of range, out of order or with three decimals, private and on the teacher's own routes only;<br>• a 10 scale, with the bands and thresholds halved;<br>• term 2 beside term 1, with each previous rank, and term 3 with no average yet;<br>• the roll-call book's absences, lateness and rate, with nothing counted before the term;<br>• no summary with no roll call taken, even when units without one count as present. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |
| Android emulator | Not run: this part adds no screen. Part 2 checks the pack on the emulator. |

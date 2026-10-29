# Screen map

Every screen of Minhajna's design, with the PRD sections and requirements it implements. An implementation ticket names its screen by the **screen ID** and cites the requirement IDs it must meet, defined in [requirements.md](requirements.md). Each ID links to the screen as an image; the HTML beside it carries the exact wording and styles.

- **The PRD:** [docs/prd/PRD.md](../prd/PRD.md). When a screen and the PRD disagree, the PRD wins.
- **The design system:** [system/](system/brand.md): tokens, components and the logo. Each component lists the screens that use it.
- All names and entries on the screens are made up.

**Stage** proposes when each screen is built, from PRD §2.5 and §10.1:
- *Field check:* the prototype of setup, Today and roll call.
- *Pilot:* the rest of the teacher app and reader mode.
- *Launch:* the timetable package, handover, sync and the yearly cycle.
- *Insights:* 2027/28.
- *National:* after the Ministry adopts Minhajna.
- *Curators:* the pack editor.

## Is every teacher screen designed?

Yes, except 1 requirement partly designed: R-6.2-02 (Privacy still shows a placeholder for the data-protection contact: the PRD does not name it). Of the 575 teacher-facing requirements in the PRD, 539 are designed, 1 partly, 0 have no screen, and 35 are rules with no screen of their own. The contradictions with the PRD and the screens to add or change are listed under "What is missing or wrong" in [requirements.md](requirements.md).

| Scope | PRD | Requirements | Designed | Partial | Missing | Rule only |
|---|---|---|---|---|---|---|
| A. Getting started, Today and roll call | §2.3, §2.5–2.6, §3.1–3.4 | 164 | 156 | 0 | 0 | 8 |
| B. Marks, documents, digest, sharing and the pilot | §3.5–3.11, §9.3, §10.3 | 158 | 147 | 0 | 0 | 11 |
| C. Plan packs, the calendar and the engine | §4 (teacher-facing parts) | 106 | 102 | 0 | 0 | 4 |
| D. Data, privacy, security and the school space | §1.5–1.6, §1.11, §5.5, §5.7–5.9, §6.2, §6.4–6.6, §6.8, §7 (teacher parts), §8.4 | 147 | 134 | 1 | 0 | 12 |

## Today and the book

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Main`](screens/Main.png) ([HTML](screens/Main.html)) | Today: the opening screen | Phone | Teacher | Field check | §2.3, §2.5, §2.6, §3.1, §3.3, §3.8, §3.11, §4.2, §4.7, §4.11 | R-2.3-03, R-2.3-07, R-2.3-14, R-2.5-02, R-2.5-03, R-2.6-01, R-3.1-01, R-3.1-02, R-3.1-05, R-3.1-15, R-3.3-01, R-3.3-02, R-3.3-03, R-3.3-04, R-3.3-06, R-3.8-23, R-3.11-01, R-4.2-03, R-4.7-03, R-4.7-05, R-4.11-05 |
| [`Today-done`](screens/Today-done.png) ([HTML](screens/Today-done.html)) | Today, after one tap | Phone | Teacher | Field check | §2.3, §3.1, §3.3, §4.7 | R-2.3-07, R-2.3-11, R-2.3-12, R-3.1-01, R-3.3-04, R-3.3-06, R-3.3-07, R-4.7-02, R-4.7-03, R-4.7-11, R-4.7-13, R-4.7-35 |
| [`Sheet`](screens/Sheet.png) ([HTML](screens/Sheet.html)) | Another outcome: two taps | Phone | Teacher | Field check | §2.3, §3.1, §3.3, §4.5, §4.7, §4.11 | R-2.3-08, R-2.3-12, R-2.3-15, R-3.1-06, R-3.1-07, R-3.1-15, R-3.3-07, R-3.3-08, R-3.3-09, R-3.3-10, R-3.3-11, R-3.3-12, R-4.5-17, R-4.7-02, R-4.7-11, R-4.7-12, R-4.7-33, R-4.11-05 |
| [`Sheet-reason`](screens/Sheet-reason.png) ([HTML](screens/Sheet-reason.html)) | A session not held: the optional private reason and make-up mark | Phone | Teacher | Pilot | §3.3 | R-3.3-13 |
| [`Sheet-nostage`](screens/Sheet-nostage.png) ([HTML](screens/Sheet-nostage.html)) | An item with no stages: in progress or done | Phone | Teacher | Field check | §4.2, §4.7 | R-4.2-06, R-4.7-12 |
| [`Entry`](screens/Entry.png) ([HTML](screens/Entry.html)) | Session details: the one entry | Phone | Teacher | Field check | §2.3, §3.2, §3.3, §3.8, §4.7, §6.5 | R-2.3-10, R-2.3-15, R-3.2-28, R-3.3-15, R-3.3-19, R-3.3-20, R-3.3-21, R-3.3-22, R-3.3-23, R-3.3-24, R-3.3-25, R-3.8-14, R-4.7-09, R-4.7-16, R-6.5-02 |
| [`Entry-lesson`](screens/Entry-lesson.png) ([HTML](screens/Entry-lesson.html)) | Another lesson for this session | Phone | Teacher | Field check | §2.3 | R-2.3-15 |
| [`Entry-fix`](screens/Entry-fix.png) ([HTML](screens/Entry-fix.html)) | Correcting a confirmed session | Phone | Teacher | Field check | §3.1 | R-3.1-06 |
| [`Session-extra`](screens/Session-extra.png) ([HTML](screens/Session-extra.html)) | A session outside the timetable: class, type, date, typed times | Phone | Teacher | Pilot | §3.3, §3.8 | R-3.3-16, R-3.3-17, R-3.3-18, R-3.8-26 |
| [`P09`](screens/P09.png) ([HTML](screens/P09.html)) | Book page 09: Arabic sessions (full page) | Phone | Teacher | Pilot | §3.3, §3.8 | R-3.3-19, R-3.3-25, R-3.8-14 |
| [`P10`](screens/P10.png) ([HTML](screens/P10.html)) | Book page 10: Arabic, today's entry | Phone | Teacher | Pilot | §2.3, §2.5, §2.6, §3.1, §3.3, §3.8, §4.7 | R-2.3-07, R-2.3-11, R-2.3-14, R-2.5-04, R-2.6-02, R-3.1-01, R-3.1-05, R-3.3-25, R-3.8-14, R-4.7-02 |
| [`P10-4m1`](screens/P10-4m1.png) ([HTML](screens/P10-4m1.html)) | Book page 10 of 4m1: continued entries | Phone | Teacher | Pilot | §3.8, §4.7 | R-3.8-28, R-4.7-13 |
| [`P10-ramadan`](screens/P10-ramadan.png) ([HTML](screens/P10-ramadan.html)) | Book page in Ramadan | Phone | Teacher | Pilot | §4.5 | R-4.5-14 |
| [`P67`](screens/P67.png) ([HTML](screens/P67.html)) | Book page 67: Arabic homework record | Phone | Teacher | Pilot | §3.1, §3.8 | R-3.1-01, R-3.8-19, R-3.8-20, R-3.8-21, R-3.8-22, R-3.8-23, R-3.8-24 |
| [`P90`](screens/P90.png) ([HTML](screens/P90.html)) | Book page 90: French, today's entry | Phone | Teacher | Pilot | §2.5, §3.1, §3.8 | R-2.5-09, R-3.1-17, R-3.1-18, R-3.8-14, R-3.8-59, R-3.8-63 |
| [`P90-print`](screens/P90-print.png) ([HTML](screens/P90-print.html)) | Page 90 printed, Arabic header | Phone | Teacher | Pilot | §3.8 | R-3.8-63 |
| [`Print`](screens/Print.png) ([HTML](screens/Print.html)) | Print: with my signature, or blank | Phone | Teacher | Pilot | §3.1, §3.3, §3.8, §5.9, §6.4 | R-3.1-09, R-3.1-13, R-3.3-25, R-3.8-01, R-3.8-02, R-3.8-15, R-3.8-17, R-3.8-39, R-3.8-42, R-3.8-43, R-3.8-45, R-3.8-46, R-5.9-04, R-5.9-15 |
| [`Print-strip`](screens/Print-strip.png) ([HTML](screens/Print-strip.html)) | Texts book: a strip to paste, with cut marks | Phone | Teacher | Pilot | §3.8 | R-3.8-15 |
| [`Signature`](screens/Signature.png) ([HTML](screens/Signature.html)) | Teacher card: the drawn signature | Phone | Teacher | Pilot | §3.2, §3.8 | R-3.2-03, R-3.8-39, R-3.8-40, R-3.8-41, R-3.8-43, R-3.8-44, R-3.8-45, R-3.8-47, R-3.8-48, R-3.8-49 |

## Getting started

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Setup-1-Welcome`](screens/Setup-1-Welcome.png) ([HTML](screens/Setup-1-Welcome.html)) | 1. Welcome | Phone | Teacher | Field check | §1.5, §2.5, §3.1, §3.2, §3.11, §4.8, §6.2, §6.8 | R-2.5-09, R-3.1-11, R-3.1-16, R-3.2-01, R-3.11-04, R-4.8-01, R-1.5-01, R-1.5-03, R-6.2-01, R-6.8-01 |
| [`Setup-2-Teaching`](screens/Setup-2-Teaching.png) ([HTML](screens/Setup-2-Teaching.html)) | 2. Level and subject | Phone | Teacher | Field check | §3.2 | R-3.2-01, R-3.2-02, R-3.2-18, R-3.2-23 |
| [`Setup-2b-Schools`](screens/Setup-2b-Schools.png) ([HTML](screens/Setup-2b-Schools.html)) | 2b. Level and subject in two schools | Phone | Teacher | Field check | §3.2 | R-3.2-02 |
| [`Setup-3-Card`](screens/Setup-3-Card.png) ([HTML](screens/Setup-3-Card.html)) | 3. Teacher card | Phone | Teacher | Field check | §3.2, §3.8 | R-3.2-01, R-3.2-03, R-3.8-41, R-3.8-47 |
| [`Setup-4-Classes`](screens/Setup-4-Classes.png) ([HTML](screens/Setup-4-Classes.html)) | 4. Classes and pupils | Phone | Teacher | Field check | §3.2, §5.9 | R-3.2-01, R-3.2-12, R-5.9-05 |
| [`Setup-4b-Import`](screens/Setup-4b-Import.png) ([HTML](screens/Setup-4b-Import.html)) | 4b. Importing a class list | Phone | Teacher | Field check | §3.2, §5.9 | R-3.2-01, R-3.2-09, R-5.9-05, R-5.9-14 |
| [`File-refused`](screens/File-refused.png) ([HTML](screens/File-refused.html)) | A file refused (class list, backup): nothing saved | Phone | Teacher | Field check | §5.9 | R-5.9-14 |
| [`Setup-5-Week`](screens/Setup-5-Week.png) ([HTML](screens/Setup-5-Week.html)) | 5. The week | Phone | Teacher | Field check | §2.5, §3.2, §3.11, §4.6, §4.8, §5.5, §5.9, §7.4 | R-2.5-11, R-3.2-01, R-3.2-16, R-3.2-26, R-3.11-03, R-4.6-01, R-4.6-04, R-4.8-04, R-5.5-07, R-5.9-07, R-7.4-01, R-7.4-03 |
| [`Setup-5a-Wait`](screens/Setup-5a-Wait.png) ([HTML](screens/Setup-5a-Wait.html)) | 5. The week before the school's timetable arrives | Phone | Teacher | Launch | §3.2 | R-3.2-16 |
| [`Setup-5b-Package`](screens/Setup-5b-Package.png) ([HTML](screens/Setup-5b-Package.html)) | 5. The school's package and the differences | Phone | Teacher | Launch | §3.2, §7.4 | R-3.2-16, R-7.4-03 |
| [`Setup-5c-Refused`](screens/Setup-5c-Refused.png) ([HTML](screens/Setup-5c-Refused.html)) | 5. A refused timetable file | Phone | Teacher | Launch | §3.2 | R-3.2-16 |
| [`Setup-6-Plan`](screens/Setup-6-Plan.png) ([HTML](screens/Setup-6-Plan.html)) | 6. Plan and calendar | Phone | Teacher | Field check | §2.3, §3.2, §4.2, §4.8, §4.11, §5.9 | R-2.3-01, R-3.2-01, R-3.2-27, R-3.2-29, R-4.2-01, R-4.2-08, R-4.2-09, R-4.8-01, R-4.11-02, R-5.9-10 |
| [`Setup-6b-Packs`](screens/Setup-6b-Packs.png) ([HTML](screens/Setup-6b-Packs.html)) | 6b. Choosing a plan pack: status, edition, release and signer | Phone | Teacher | Field check | §3.2, §4.1, §4.2, §4.11, §5.9 | R-4.2-01, R-4.11-01, R-5.9-10 |
| [`Setup-7-Ready`](screens/Setup-7-Ready.png) ([HTML](screens/Setup-7-Ready.html)) | 7. Ready, with the September check | Phone | Teacher | Field check | §2.3, §3.2, §4.2, §4.7, §4.11 | R-2.3-02, R-3.2-01, R-4.2-07, R-4.7-23, R-4.11-06 |
| [`Sept-check`](screens/Sept-check.png) ([HTML](screens/Sept-check.html)) | The September check, printed for an inspector (print, PDF, QR) | Phone | Teacher | Field check | §4.11 | R-4.11-06 |
| [`Privacy`](screens/Privacy.png) ([HTML](screens/Privacy.html)) | Before first use: the privacy notice | Phone | Teacher | Field check | §1.5, §2.6, §3.1, §5.8, §6.2, §6.4, §6.8, §10.3 | R-2.6-09, R-3.1-11, R-10.3-01, R-1.5-01, R-1.5-03, R-1.5-04, R-1.5-05, R-1.5-07, R-6.2-01, R-6.2-02 |
| [`Restore`](screens/Restore.png) ([HTML](screens/Restore.html)) | Restoring from another phone or a backup | Phone | Teacher | Field check | §3.1, §3.2, §3.8, §3.10, §5.8, §5.9, §6.4, §6.5 | R-3.1-11, R-3.2-03, R-3.8-47, R-3.10-17, R-5.8-10, R-5.8-11, R-5.8-12, R-5.9-02, R-5.9-18, R-6.4-08, R-6.5-01, R-6.5-05, R-6.5-09 |
| [`Setup-4c-Type`](screens/Setup-4c-Type.png) ([HTML](screens/Setup-4c-Type.html)) | 4c. Typing a class list | Phone | Teacher | Field check | §3.2 | R-3.2-01, R-3.2-11, R-3.2-12 |
| [`Setup-4d-Joint`](screens/Setup-4d-Joint.png) ([HTML](screens/Setup-4d-Joint.html)) | 4d. Adding a joint class (primary) | Phone | Teacher | Field check | §3.2 | R-3.2-13 |
| [`Week-draw`](screens/Week-draw.png) ([HTML](screens/Week-draw.html)) | 5b. Drawing the week by hand | Phone | Teacher | Field check | §2.3, §3.2, §4.6, §7.4 | R-2.3-17, R-3.2-17, R-3.2-19, R-3.2-21, R-3.2-25, R-4.6-02, R-4.6-04, R-4.6-07, R-4.6-09, R-7.4-03 |
| [`Week-slot`](screens/Week-slot.png) ([HTML](screens/Week-slot.html)) | 5c. One slot: group, weeks, time outside classes | Phone | Teacher | Field check | §3.2, §4.6, §4.7 | R-3.2-17, R-3.2-18, R-3.2-19, R-3.2-20, R-3.2-23, R-3.2-25, R-4.6-02, R-4.6-07, R-4.7-01, R-4.7-15 |
| [`Settings-times`](screens/Settings-times.png) ([HTML](screens/Settings-times.html)) | Bell times: each slot's time, the Ramadan template, which applies today | Phone | Teacher | Field check | §4.6 | R-4.6-01 |

## Classes and roll call

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Classes`](screens/Classes.png) ([HTML](screens/Classes.html)) | Classes tab | Phone | Teacher | Field check | §2.3, §3.1, §3.9, §4.7 | R-3.1-15, R-3.9-01, R-4.7-10, R-4.7-21 |
| [`Class`](screens/Class.png) ([HTML](screens/Class.html)) | A class: its records and pupils | Phone | Teacher | Field check | §2.3, §4.7 | R-2.3-16, R-4.7-10, R-4.7-21, R-4.7-22 |
| [`Roll`](screens/Roll.png) ([HTML](screens/Roll.html)) | Taking the roll: only the exceptions | Phone | Teacher | Field check | §2.5, §3.1, §3.4, §3.11 | R-2.5-03, R-2.5-05, R-3.1-03, R-3.4-01, R-3.4-05, R-3.4-06, R-3.4-09, R-3.4-11, R-3.4-12, R-3.4-15, R-3.4-16, R-3.11-01 |
| [`Roll-seats`](screens/Roll-seats.png) ([HTML](screens/Roll-seats.html)) | Taking the roll on a seating plan | Phone | Teacher | Field check | §3.1, §3.4, §3.11 | R-3.1-03, R-3.4-09, R-3.4-13, R-3.4-14, R-3.11-01 |
| [`Roll-seats-setup`](screens/Roll-seats-setup.png) ([HTML](screens/Roll-seats-setup.html)) | The seating plan's first setup: room shape, empty seats, one plan per group | Phone | Teacher | Field check | §3.4 | R-3.4-13 |
| [`Pupil`](screens/Pupil.png) ([HTML](screens/Pupil.html)) | A pupil: absences, justification, history | Phone | Teacher | Pilot | §2.6, §3.1, §3.2, §3.4, §5.5, §7.8 | R-2.6-04, R-3.1-06, R-3.2-14, R-3.4-08, R-3.4-10, R-3.4-11, R-3.4-18, R-3.4-20, R-3.4-21, R-3.4-28, R-5.5-01, R-5.5-02, R-5.5-06, R-7.8-01 |
| [`Pupil-year`](screens/Pupil-year.png) ([HTML](screens/Pupil-year.html)) | A pupil's school year, month by month | Phone | Teacher | Pilot | §3.4 | R-3.4-21 |
| [`Month`](screens/Month.png) ([HTML](screens/Month.html)) | The month: roll-call book view | Phone | Teacher | Pilot | §2.5, §3.4, §3.8 | R-2.5-04, R-3.4-01, R-3.4-17, R-3.4-20, R-3.4-21, R-3.4-24, R-3.4-25, R-3.4-27, R-3.8-35, R-3.8-62 |
| [`Month-year`](screens/Month-year.png) ([HTML](screens/Month-year.html)) | The roll-call book's yearly summary, September to June | Phone | Teacher | Pilot | §3.4 | R-3.4-21 |
| [`Roll-past`](screens/Roll-past.png) ([HTML](screens/Roll-past.html)) | A past session's roll call, entered from the paper sheet | Phone | Teacher | Field check | §3.4 | R-3.4-17 |
| [`Roll-print`](screens/Roll-print.png) ([HTML](screens/Roll-print.html)) | Printing the roll-call book | Phone | Teacher | Pilot | §2.5, §3.1, §3.4, §3.8, §5.5, §5.9, §6.4 | R-2.5-05, R-3.1-09, R-3.1-10, R-3.1-13, R-3.4-16, R-3.4-21, R-3.4-23, R-3.4-24, R-3.4-25, R-3.4-26, R-3.4-27, R-3.4-28, R-3.4-29, R-3.4-30, R-3.4-31, R-3.8-01, R-3.8-02, R-3.8-04, R-3.8-35, R-5.5-12, R-5.9-04, R-5.9-15 |
| [`Roll-rules`](screens/Roll-rules.png) ([HTML](screens/Roll-rules.html)) | Counting rules are settings | Phone | Teacher | Field check | §3.4 | R-3.4-19, R-3.4-22 |
| [`Pupil-move`](screens/Pupil-move.png) ([HTML](screens/Pupil-move.html)) | A pupil joins or leaves | Phone | Teacher | Field check | §3.2 | R-3.2-14, R-3.2-15 |
| [`Pupil-erase`](screens/Pupil-erase.png) ([HTML](screens/Pupil-erase.html)) | Erasing the data of a pupil who has left | Phone | Teacher | Pilot | §5.5 | R-5.5-13 |
| [`Correct`](screens/Correct.png) ([HTML](screens/Correct.html)) | Correcting a past roll call, with a reason | Phone | Teacher | Field check | §2.6, §3.1, §3.3, §3.4, §5.5 | R-2.6-04, R-3.1-06, R-3.3-25, R-3.4-10, R-3.4-18, R-5.5-02, R-5.5-03, R-5.5-05 |
| [`Classes-closed`](screens/Classes-closed.png) ([HTML](screens/Classes-closed.html)) | A closed school year (2025-2026): classes, corrections, export | Phone | Teacher | Launch | §5.7 | R-5.7-01 |

## Plan and calendar

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Plan`](screens/Plan.png) ([HTML](screens/Plan.html)) | A class plan, with the September check | Phone | Teacher | Pilot | §2.3, §2.6, §3.2, §4.2, §4.5, §4.6, §4.7, §4.11 | R-2.3-01, R-2.3-02, R-2.3-12, R-2.3-16, R-2.6-01, R-3.2-27, R-4.2-01, R-4.2-02, R-4.2-03, R-4.2-04, R-4.2-07, R-4.2-09, R-4.2-12, R-4.2-20, R-4.5-07, R-4.6-08, R-4.7-05, R-4.7-06, R-4.7-09, R-4.7-10, R-4.7-17, R-4.7-22, R-4.7-23, R-4.7-31, R-4.7-34, R-4.7-36, R-4.7-37, R-4.11-06 |
| [`Plan-details`](screens/Plan-details.png) ([HTML](screens/Plan-details.html)) | A pack's details sheet | Phone | Teacher | Pilot | §4.2 | R-4.2-10 |
| [`Plan-details-link`](screens/Plan-details-link.png) ([HTML](screens/Plan-details-link.html)) | A link-only pack | Phone | Teacher | Pilot | §4.2 | R-4.2-10 |
| [`Plan-layers`](screens/Plan-layers.png) ([HTML](screens/Plan-layers.html)) | District and school layers | Phone | Teacher | Pilot | §4.2 | R-4.2-15, R-4.2-16 |
| [`Plan-item`](screens/Plan-item.png) ([HTML](screens/Plan-item.html)) | One item: the teacher changes the class plan | Phone | Teacher | Pilot | §2.3, §4.2, §4.3, §4.7 | R-2.3-17, R-4.2-02, R-4.2-10, R-4.2-11, R-4.2-14, R-4.3-01, R-4.7-16, R-4.7-31, R-4.7-35 |
| [`Plan-changes`](screens/Plan-changes.png) ([HTML](screens/Plan-changes.html)) | The class's own changes | Phone | Teacher | Pilot | §4.2 | R-4.2-14 |
| [`Plan-free`](screens/Plan-free.png) ([HTML](screens/Plan-free.html)) | No plan pack: typing the items | Phone | Teacher | Pilot | §1.7, §3.2, §4.1, §4.2, §4.7, §4.11 | R-3.2-23, R-3.2-28, R-4.2-06, R-4.2-20, R-4.2-21, R-4.7-01, R-4.11-01 |
| [`Plan-offer`](screens/Plan-offer.png) ([HTML](screens/Plan-offer.html)) | Offering my list | Phone | Teacher | Pilot | §1.7, §4.2 | R-4.2-21 |
| [`Plan-free-published`](screens/Plan-free-published.png) ([HTML](screens/Plan-free-published.html)) | My list, published | Phone | Teacher | Pilot | §1.7, §4.2 | R-4.2-21 |
| [`Plan-error`](screens/Plan-error.png) ([HTML](screens/Plan-error.html)) | Reporting a plan error | Phone | Teacher | Pilot | §4.2, §4.3 | R-4.2-11, R-4.3-01, R-4.3-02, R-4.3-03 |
| [`Calendar`](screens/Calendar.png) ([HTML](screens/Calendar.html)) | The calendar: layers, sources, confidence | Phone | Teacher | Pilot | §3.2, §4.2, §4.5, §4.7, §4.8, §4.11, §5.9 | R-3.2-26, R-3.2-29, R-3.2-31, R-4.2-07, R-4.5-01, R-4.5-02, R-4.5-03, R-4.5-04, R-4.5-05, R-4.5-06, R-4.5-07, R-4.5-09, R-4.5-13, R-4.5-15, R-4.5-16, R-4.7-09, R-4.8-03, R-4.11-02, R-4.11-03, R-5.9-10 |
| [`Calendar-add`](screens/Calendar-add.png) ([HTML](screens/Calendar-add.html)) | Adding a closure, a seminar or a make-up day | Phone | Teacher | Pilot | §2.3, §3.2, §3.3, §4.5, §4.7 | R-2.3-02, R-3.2-30, R-4.5-03, R-4.5-06, R-4.5-08, R-4.5-16, R-4.5-17, R-4.7-08, R-4.7-20, R-4.7-31 |
| [`Calendar-add-sessions`](screens/Calendar-add-sessions.png) ([HTML](screens/Calendar-add-sessions.html)) | Make-up, support or revision sessions | Phone | Teacher | Pilot | §4.5 | R-4.5-08 |
| [`Calendar-receive`](screens/Calendar-receive.png) ([HTML](screens/Calendar-receive.html)) | Receiving an entry | Phone | Teacher | Pilot | §3.2 | R-3.2-31 |
| [`Calendar-ab`](screens/Calendar-ab.png) ([HTML](screens/Calendar-ab.html)) | The A/B week and its reset | Phone | Teacher | Pilot | §4.5, §4.6 | R-4.5-10, R-4.6-03 |
| [`Calendar-groups`](screens/Calendar-groups.png) ([HTML](screens/Calendar-groups.html)) | Rotating groups | Phone | Teacher | Pilot | §4.5 | R-4.5-11 |
| [`Calendar-ramadan`](screens/Calendar-ramadan.png) ([HTML](screens/Calendar-ramadan.html)) | Ramadan times announced | Phone | Teacher | Pilot | §4.5, §4.6, §4.11 | R-4.5-09, R-4.5-12, R-4.5-14, R-4.6-01, R-4.11-03 |
| [`Calendar-update`](screens/Calendar-update.png) ([HTML](screens/Calendar-update.html)) | What a same-day update changed | Phone | Teacher | Pilot | §4.5 | R-4.5-15 |
| [`Calendar-moved`](screens/Calendar-moved.png) ([HTML](screens/Calendar-moved.html)) | The term-2 exams moved | Phone | Teacher | Pilot | §4.11, §7.10 | R-4.11-04, R-7.10-06 |
| [`Catchup-add`](screens/Catchup-add.png) ([HTML](screens/Catchup-add.html)) | Catch-up step 4: adding a session | Phone | Teacher | Pilot | §3.3, §3.8, §4.5, §4.7, §7.7 | R-3.3-16, R-3.3-17, R-3.3-18, R-3.8-28, R-4.5-08, R-4.7-08, R-4.7-28, R-7.7-02 |
| [`Support-queue`](screens/Support-queue.png) ([HTML](screens/Support-queue.html)) | A support queue | Phone | Teacher | Pilot | §4.7 | R-4.7-08 |
| [`Repace`](screens/Repace.png) ([HTML](screens/Repace.html)) | Catch-up step 5: re-pacing the rest of the term | Phone | Teacher | Pilot | §4.7 | R-4.7-14, R-4.7-29, R-4.7-30, R-4.7-31, R-4.7-32, R-4.7-34, R-4.7-35 |
| [`Test-schedule`](screens/Test-schedule.png) ([HTML](screens/Test-schedule.html)) | The test schedule: dates and slots, asking before items move | Phone | Teacher | Pilot | §4.7 | R-4.7-09 |
| [`Exam-window`](screens/Exam-window.png) ([HTML](screens/Exam-window.html)) | A change would push an item past the exam window | Phone | Teacher | Pilot | §4.7 | R-4.7-32 |

## Marks and the term export

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Marks`](screens/Marks.png) ([HTML](screens/Marks.html)) | Marks hub for a class | Phone | Teacher | Pilot | §3.5, §3.6, §3.11, §4.7 | R-3.5-07, R-3.5-12, R-3.5-14, R-3.5-16, R-3.6-07, R-3.11-01, R-4.7-09 |
| [`Marks-setup`](screens/Marks-setup.png) ([HTML](screens/Marks-setup.html)) | Continuous-assessment components | Phone | Teacher | Pilot | §2.5, §3.5 | R-2.5-06, R-3.5-01, R-3.5-02, R-3.5-03, R-3.5-04, R-3.5-08 |
| [`Marks-setup-sum`](screens/Marks-setup-sum.png) ([HTML](screens/Marks-setup-sum.html)) | Assessment components: the total is not 20 | Phone | Teacher | Pilot | §3.5 | R-3.5-03 |
| [`Capture`](screens/Capture.png) ([HTML](screens/Capture.html)) | Capture during the session: one tap per pupil | Phone | Teacher | Pilot | §3.5, §3.8 | R-3.5-07, R-3.8-24 |
| [`Marks-test`](screens/Marks-test.png) ([HTML](screens/Marks-test.html)) | Entering test marks (on the day of the test) | Phone | Teacher | Pilot | §3.5, §7.10 | R-3.5-09, R-3.5-10, R-3.5-11, R-7.10-05 |
| [`Marks-book`](screens/Marks-book.png) ([HTML](screens/Marks-book.html)) | Grade book and averages | Phone | Teacher | Pilot | §3.5, §3.7, §3.8 | R-3.5-14, R-3.5-16, R-3.5-17, R-3.5-18, R-3.7-14, R-3.8-01, R-3.8-36 |
| [`Marks-book-value`](screens/Marks-book-value.png) ([HTML](screens/Marks-book-value.html)) | Grade book: 10.00 shown, 9.996 in full | Phone | Teacher | Pilot | §3.5 | R-3.5-17 |
| [`Gradebook-print`](screens/Gradebook-print.png) ([HTML](screens/Gradebook-print.html)) | Grade book: print preview | Phone | Teacher | Pilot | §3.5, §3.8, §5.9, §6.4 | R-3.5-18, R-3.8-03, R-3.8-36, R-5.9-15 |
| [`Marks-pupil`](screens/Marks-pupil.png) ([HTML](screens/Marks-pupil.html)) | Justifying a continuous-assessment mark | Phone | Teacher | Pilot | §3.5, §3.8 | R-3.5-08, R-3.5-19, R-3.8-01, R-3.8-02, R-3.8-36 |
| [`Apprec`](screens/Apprec.png) ([HTML](screens/Apprec.html)) | Appreciations: suggested, then chosen | Phone | Teacher | Pilot | §2.5, §3.6 | R-2.5-06, R-3.6-01, R-3.6-03, R-3.6-04, R-3.6-05, R-3.6-06, R-3.6-07 |
| [`Apprec-conduct`](screens/Apprec-conduct.png) ([HTML](screens/Apprec-conduct.html)) | Appreciations from average, behaviour and attendance | Phone | Teacher | Pilot | §3.6 | R-3.6-02 |
| [`Export`](screens/Export.png) ([HTML](screens/Export.html)) | The term export: the school picks the route | Phone | Teacher | Pilot | §2.5, §2.6, §3.1, §3.5, §3.6, §3.7, §3.8, §3.11, §5.9, §6.4 | R-2.5-06, R-2.5-07, R-2.6-12, R-3.1-13, R-3.5-12, R-3.6-07, R-3.7-01, R-3.7-03, R-3.7-04, R-3.7-05, R-3.7-06, R-3.7-07, R-3.7-08, R-3.7-09, R-3.7-18, R-3.7-19, R-3.7-20, R-3.8-03, R-3.11-01, R-5.9-03, R-5.9-04, R-5.9-06, R-5.9-15 |
| [`Export-file`](screens/Export-file.png) ([HTML](screens/Export-file.html)) | Saving the term's marks as a confidential file | Phone | Teacher | Pilot | §5.9, §6.4 | R-5.9-15 |
| [`Marks-sheet`](screens/Marks-sheet.png) ([HTML](screens/Marks-sheet.html)) | Printed mark sheet: preview | Phone | Teacher | Pilot | §3.7, §5.9, §6.4 | R-3.7-07, R-5.9-15 |
| [`Marks-check`](screens/Marks-check.png) ([HTML](screens/Marks-check.html)) | Check before signing: the register beside the file | Phone | Teacher | Pilot | §3.7, §5.9, §6.4 | R-3.7-09, R-5.9-15 |
| [`Marks-check-diff`](screens/Marks-check-diff.png) ([HTML](screens/Marks-check-diff.html)) | Check before signing: one row differs | Phone | Teacher | Pilot | §3.7, §5.9, §6.4 | R-3.7-09, R-5.9-15 |
| [`Council`](screens/Council.png) ([HTML](screens/Council.html)) | Class-council pack | Phone | Teacher | Pilot | §2.5, §3.5, §3.7, §3.8, §5.9, §6.4 | R-2.5-07, R-3.5-17, R-3.7-11, R-3.7-12, R-3.7-13, R-3.7-14, R-3.7-15, R-3.7-16, R-3.7-17, R-3.8-01, R-3.8-02, R-5.9-15 |
| [`Council-t2`](screens/Council-t2.png) ([HTML](screens/Council-t2.html)) | Class-council pack in term 2, compared with term 1 | Phone | Teacher | Pilot | §3.7, §5.9, §6.4 | R-3.7-15, R-5.9-15 |
| [`Marks-exam`](screens/Marks-exam.png) ([HTML](screens/Marks-exam.html)) | Entering exam marks | Phone | Teacher | Pilot | §3.5 | R-3.5-09, R-3.5-10, R-3.5-11 |
| [`Export-fix`](screens/Export-fix.png) ([HTML](screens/Export-fix.html)) | A correction after the term, with the teacher's report | Phone | Teacher | Pilot | §3.1, §3.7, §3.8, §5.5 | R-3.7-10, R-3.8-59, R-3.8-61, R-5.5-02, R-5.5-03 |
| [`Share-warn`](screens/Share-warn.png) ([HTML](screens/Share-warn.html)) | Before a file with pupil marks leaves the phone | Phone | Teacher | Pilot | §5.9, §6.4 | R-5.9-15, R-5.9-16, R-5.9-17 |

## Documents

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Docs`](screens/Docs.png) ([HTML](screens/Docs.html)) | Documents tab | Phone | Teacher | Pilot | §2.3, §2.5, §3.1, §3.4, §3.8, §3.11 | R-2.3-11, R-2.5-04, R-3.1-10, R-3.4-01, R-3.8-04, R-3.8-16, R-3.8-36, R-3.11-01 |
| [`Journal`](screens/Journal.png) ([HTML](screens/Journal.html)) | Personal journal: today's page | Phone | Teacher | Pilot | §2.3, §2.5, §3.1, §3.8, §4.7 | R-2.3-11, R-2.3-14, R-2.5-04, R-3.1-01, R-3.1-05, R-3.1-09, R-3.8-01, R-3.8-13, R-3.8-38, R-3.8-59, R-4.7-13 |
| [`Journal-signed`](screens/Journal-signed.png) ([HTML](screens/Journal-signed.html)) | Journal: a recorded day, signed | Phone | Teacher | Pilot | §3.8 | R-3.8-40 |
| [`Note`](screens/Note.png) ([HTML](screens/Note.html)) | Lesson note: from the plan, completed by the teacher | Phone | Teacher | Pilot | §3.8 | R-3.8-01, R-3.8-32, R-3.8-33, R-3.8-34 |
| [`Note-edit`](screens/Note-edit.png) ([HTML](screens/Note-edit.html)) | Lesson note: editing a paragraph | Phone | Teacher | Pilot | §3.8 | R-3.8-33 |
| [`Note-add`](screens/Note-add.png) ([HTML](screens/Note-add.html)) | Lesson note: adding a paragraph | Phone | Teacher | Pilot | §3.8 | R-3.8-33 |
| [`Dist`](screens/Dist.png) ([HTML](screens/Dist.html)) | Distributions: annual, monthly, termly | Phone | Teacher | Pilot | §3.8 | R-3.8-01, R-3.8-02, R-3.8-03, R-3.8-30, R-3.8-31, R-3.8-60 |
| [`Print-set`](screens/Print-set.png) ([HTML](screens/Print-set.html)) | Printing the week: pages and cost | Phone | Teacher | Pilot | §3.1, §3.8 | R-3.1-09, R-3.1-10, R-3.8-01, R-3.8-02, R-3.8-04, R-3.8-15, R-3.8-51, R-3.8-52, R-3.8-54, R-3.8-55, R-3.8-56, R-3.8-57, R-3.8-59, R-3.8-60, R-3.8-61, R-3.8-62 |
| [`Profiles`](screens/Profiles.png) ([HTML](screens/Profiles.html)) | Template profiles: fields, order, labels | Phone | Teacher | Pilot | §3.8 | R-3.8-05, R-3.8-06, R-3.8-07, R-3.8-13 |
| [`Journal-front`](screens/Journal-front.png) ([HTML](screens/Journal-front.html)) | The journal's front pages: card, seminars, holidays | Phone | Teacher | Pilot | §3.8, §4.5 | R-3.8-01, R-3.8-02, R-3.8-08, R-3.8-12, R-3.8-61, R-4.5-02, R-4.5-04 |
| [`Timetable-doc`](screens/Timetable-doc.png) ([HTML](screens/Timetable-doc.html)) | The weekly timetable document | Phone | Teacher | Pilot | §3.8, §4.6 | R-3.8-01, R-3.8-02, R-3.8-37, R-3.8-61, R-4.6-04 |
| [`Doc-output`](screens/Doc-output.png) ([HTML](screens/Doc-output.html)) | Document output: print, PDF, DOCX or blank with headers | Phone | Teacher | Pilot | §3.8 | R-3.8-03, R-3.8-04, R-3.8-42 |
| [`Doc-output-pupils`](screens/Doc-output-pupils.png) ([HTML](screens/Doc-output-pupils.html)) | Document output with pupil data: confidential marking, file password | Phone | Teacher | Pilot | §3.8, §5.9, §6.4 | R-3.8-04, R-3.8-42, R-5.9-15 |
| [`Book-fixes`](screens/Book-fixes.png) ([HTML](screens/Book-fixes.html)) | Texts-book corrections, for the director's monthly check | Phone | Teacher | Pilot | §2.6, §3.1, §3.8, §5.5 | R-2.6-07, R-3.1-06, R-3.8-01, R-3.8-02, R-3.8-16, R-5.5-02, R-5.5-03 |
| [`Supervised`](screens/Supervised.png) ([HTML](screens/Supervised.html)) | Texts book: supervised or additional lessons | Phone | Teacher | Pilot | §3.3, §3.8, §5.9, §6.4 | R-3.3-18, R-3.8-26, R-3.8-28, R-3.8-29, R-5.9-15 |
| [`Supervised-empty`](screens/Supervised-empty.png) ([HTML](screens/Supervised-empty.html)) | Page 08 printed blank | Phone | Teacher | Pilot | §3.8 | R-3.8-29 |

## Digest, sharing and settings

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Digest`](screens/Digest.png) ([HTML](screens/Digest.html)) | Weekly digest (Sunday morning) | Phone | Teacher | Pilot | §2.3, §2.6, §3.1, §3.9, §3.11, §4.7 | R-2.3-04, R-2.3-06, R-2.6-07, R-3.1-15, R-3.9-01, R-3.9-02, R-3.9-03, R-3.9-04, R-3.9-05, R-3.9-06, R-3.9-07, R-3.11-01, R-4.7-06, R-4.7-17, R-4.7-20, R-4.7-21, R-4.7-22, R-4.7-24 |
| [`Digest-closure`](screens/Digest-closure.png) ([HTML](screens/Digest-closure.html)) | The digest after a closure: calendar losses apart, the drift warning | Phone | Teacher | Pilot | §3.9, §4.7 | R-3.9-03, R-3.9-06, R-4.7-37 |
| [`Catchup`](screens/Catchup.png) ([HTML](screens/Catchup.html)) | Catch-up options, in order | Phone | Teacher | Pilot | §3.1, §3.8, §3.9, §4.2, §4.7 | R-3.1-15, R-3.8-28, R-3.9-05, R-4.2-02, R-4.2-04, R-4.2-05, R-4.7-17, R-4.7-19, R-4.7-21, R-4.7-24, R-4.7-25, R-4.7-26, R-4.7-27, R-4.7-28, R-4.7-31, R-4.7-32, R-4.7-33, R-4.7-35 |
| [`Today-backlog`](screens/Today-backlog.png) ([HTML](screens/Today-backlog.html)) | Today: confirming past days at once | Phone | Teacher | Field check | §2.3, §2.6, §3.3, §3.4, §3.9, §5.5 | R-2.3-09, R-2.6-02, R-3.3-14, R-3.4-17, R-3.9-07, R-5.5-12 |
| [`Today-special`](screens/Today-special.png) ([HTML](screens/Today-special.html)) | Today: a seminar and a cover | Phone | Teacher | Field check | §3.3, §7.7, §7.8 | R-3.3-05, R-7.7-01 |
| [`Today-holiday`](screens/Today-holiday.png) ([HTML](screens/Today-holiday.html)) | Today: a national day | Phone | Teacher | Field check | §2.3, §3.3, §3.9, §4.5, §4.7 | R-2.3-12, R-3.3-05, R-3.9-03, R-4.5-06, R-4.7-20 |
| [`Today-council`](screens/Today-council.png) ([HTML](screens/Today-council.html)) | Today with a class council in the afternoon, opening the council pack | Phone | Teacher | Field check | §3.3 | R-3.3-05 |
| [`Today-exams`](screens/Today-exams.png) ([HTML](screens/Today-exams.html)) | Today in the exams week: sessions replaced, the plan paused | Phone | Teacher | Field check | §3.3 | R-3.3-05 |
| [`Today-ramadan`](screens/Today-ramadan.png) ([HTML](screens/Today-ramadan.html)) | Today in Ramadan | Phone | Teacher | Pilot | §4.5, §4.11 | R-4.5-09, R-4.5-12, R-4.5-14, R-4.11-03 |
| [`Calendar-update-today`](screens/Calendar-update-today.png) ([HTML](screens/Calendar-update-today.html)) | Today with a same-day update | Phone | Teacher | Pilot | §4.5 | R-4.5-15 |
| [`Today-backup`](screens/Today-backup.png) ([HTML](screens/Today-backup.html)) | Today with the 30-day reminder: no sync and no backup, a backup in two taps | Phone | Teacher | Launch | §6.5 | R-6.5-07 |
| [`Share`](screens/Share.png) ([HTML](screens/Share.html)) | Progress statement: no pupil data | Phone | Teacher | Pilot | §3.3, §3.10, §3.11, §4.5, §4.7, §4.9, §5.5, §5.9 | R-3.10-01, R-3.10-02, R-3.10-03, R-3.10-04, R-3.10-05, R-3.10-06, R-3.10-07, R-3.10-08, R-3.10-09, R-3.10-10, R-3.11-01, R-4.5-17, R-4.7-19, R-4.7-20, R-4.9-01, R-4.9-02, R-5.5-06, R-5.5-07, R-5.9-08, R-5.9-18 |
| [`Share-qr`](screens/Share-qr.png) ([HTML](screens/Share-qr.html)) | The statement's QR on the phone: signed, read offline, no expiry | Phone | Teacher | Pilot | §3.10, §5.5, §5.9 | R-5.5-07, R-5.9-08, R-5.9-18 |
| [`Share-to`](screens/Share-to.png) ([HTML](screens/Share-to.html)) | To whom: after a print, a PDF or the QR, kept in the sharing history by date | Phone | Teacher | Pilot | §3.10 | R-3.10-10 |
| [`Handover`](screens/Handover.png) ([HTML](screens/Handover.html)) | Handover package | Phone | Teacher | Launch | §3.10, §3.11, §4.7, §5.5, §5.8, §5.9 | R-3.10-11, R-3.10-12, R-3.10-13, R-3.11-03, R-4.7-40, R-5.5-07, R-5.8-10, R-5.9-09, R-5.9-18 |
| [`Devices`](screens/Devices.png) ([HTML](screens/Devices.html)) | Devices, sync and backup | Phone | Teacher | Launch | §1.5, §3.10, §3.11, §5.8, §6.2, §6.4, §6.5, §6.8, §9.1, §9.3 | R-3.10-16, R-3.10-17, R-3.11-02, R-3.11-03, R-9.3-01, R-9.3-02, R-9.3-04, R-9.3-06, R-1.5-01, R-1.5-04, R-5.8-01, R-5.8-07, R-5.8-08, R-5.8-09, R-5.8-10, R-5.8-11, R-5.8-12, R-6.2-03, R-6.5-01, R-6.5-03, R-6.5-04, R-6.5-05, R-6.5-06, R-6.5-07, R-6.5-09, R-6.8-02, R-6.8-03 |
| [`Devices-pilot`](screens/Devices-pilot.png) ([HTML](screens/Devices-pilot.html)) | The pilot: sync not open yet, direct transfer and backup files | Phone | Teacher | Pilot | §3.11, §6.2, §9.3 | R-3.11-02, R-9.3-03, R-6.2-03 |
| [`Devices-add`](screens/Devices-add.png) ([HTML](screens/Devices-add.html)) | Adding a device: the phone scans the new device's one-time QR, then approves | Phone | Teacher | Launch | §6.5 | R-6.5-03 |
| [`Transfer`](screens/Transfer.png) ([HTML](screens/Transfer.html)) | Direct transfer: the old phone's one-time QR, progress, failure, the encrypted file | Phone | Teacher | Pilot | §3.10, §5.8 | R-3.10-17, R-5.8-10 |
| [`Recovery-sheet`](screens/Recovery-sheet.png) ([HTML](screens/Recovery-sheet.html)) | The recovery sheet: the key in groups, print or write, check, reprint | Phone | Teacher | Pilot | §6.2, §6.5 | R-6.2-02, R-6.5-05 |
| [`Device-remove`](screens/Device-remove.png) ([HTML](screens/Device-remove.html)) | Removing a device: confirmation, removed, the Log entry | Phone | Teacher | Pilot | §6.5 | R-6.5-04 |
| [`Notif`](screens/Notif.png) ([HTML](screens/Notif.html)) | Notifications, reminders and quiet hours | Phone | Teacher | Pilot | §2.3, §3.9, §5.7, §6.4, §6.5, §6.8 | R-2.3-04, R-2.3-05, R-2.3-06, R-3.9-01, R-3.9-09, R-3.9-10, R-3.9-11, R-5.7-04, R-6.4-06, R-6.5-07, R-6.8-03 |
| [`Lock`](screens/Lock.png) ([HTML](screens/Lock.html)) | App lock | Phone | Teacher | Pilot | §2.6, §6.4 | R-2.6-05, R-6.4-02, R-6.4-05 |
| [`Settings`](screens/Settings.png) ([HTML](screens/Settings.html)) | Settings | Phone | Teacher | Pilot | §1.6, §2.5, §3.2, §3.8, §3.10, §4.2, §5.7, §5.8, §8.4, §9.3, §9.5 | R-2.5-01, R-2.5-12, R-3.8-41, R-3.10-19, R-9.3-06, R-9.3-07, R-4.2-01, R-1.6-01, R-1.6-08, R-5.7-02, R-5.7-04, R-5.8-09 |
| [`Settings-lengths`](screens/Settings-lengths.png) ([HTML](screens/Settings-lengths.html)) | Session lengths per level | Phone | Teacher | Pilot | §4.5, §4.6 | R-4.5-12, R-4.6-01 |
| [`Import-update`](screens/Import-update.png) ([HTML](screens/Import-update.html)) | Importing a signed update offline | Phone | Teacher | Pilot | §4.8, §5.9 | R-4.8-03, R-4.8-04 |
| [`Import-refused`](screens/Import-refused.png) ([HTML](screens/Import-refused.html)) | A tampered update refused | Phone | Teacher | Pilot | §4.8 | R-4.8-05 |

## Privacy, data and help

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Security`](screens/Security.png) ([HTML](screens/Security.html)) | Lock and security: screenshots blocked unless allowed | Phone | Teacher | Pilot | §1.5, §1.11, §2.6, §5.8, §6.4 | R-2.6-05, R-1.5-04, R-1.5-11, R-1.11-02, R-6.4-01, R-6.4-02, R-6.4-05, R-6.4-06, R-6.4-07, R-6.4-08 |
| [`Sync-signin`](screens/Sync-signin.png) ([HTML](screens/Sync-signin.html)) | Sync account: a login, no real name | Phone | Teacher | Launch | §2.6, §3.1, §3.10, §5.8, §6.2, §6.5, §9.3 | R-2.6-09, R-3.1-11, R-3.10-16, R-9.3-01, R-9.3-04, R-9.3-05, R-9.3-06, R-5.8-01, R-5.8-06, R-6.2-02, R-6.5-01, R-6.5-03, R-6.5-05, R-6.5-08, R-6.5-09 |
| [`Sync-account`](screens/Sync-account.png) ([HTML](screens/Sync-account.html)) | What the project keeps about the sync account: see, correct, delete | Phone | Teacher | Launch | §6.2 | R-6.2-02 |
| [`Conflict`](screens/Conflict.png) ([HTML](screens/Conflict.html)) | Two devices changed the same thing | Phone | Teacher | Launch | §5.8 | R-5.8-08 |
| [`Log`](screens/Log.png) ([HTML](screens/Log.html)) | The activity log: dates, no clock times | Phone | Teacher | Pilot | §1.6, §2.6, §3.1, §3.3, §3.4, §3.10, §5.5, §5.7, §5.8, §5.9, §6.5, §7.8 | R-2.6-04, R-3.1-06, R-3.3-25, R-3.4-05, R-3.4-18, R-3.10-10, R-1.6-03, R-5.5-01, R-5.5-04, R-5.5-05, R-5.5-06, R-5.5-13, R-5.7-02, R-5.8-08, R-5.9-05, R-5.9-14, R-6.5-05, R-7.8-01 |
| [`Log-broken`](screens/Log-broken.png) ([HTML](screens/Log-broken.html)) | The log: changed outside the app | Phone | Teacher | Pilot | §5.5 | R-5.5-04 |
| [`Help`](screens/Help.png) ([HTML](screens/Help.html)) | Help: demo class, reports, what the app connects to | Phone | Teacher | Pilot | §1.5, §1.11, §4.3, §4.8, §6.2, §9.3, §9.5, §10.3 | R-9.3-06, R-9.3-07, R-10.3-01, R-4.3-01, R-4.8-02, R-1.5-05, R-1.5-06, R-1.5-07, R-1.5-09, R-1.5-10, R-1.11-01, R-1.11-02, R-1.11-03, R-6.2-01 |
| [`Pilot-timings`](screens/Pilot-timings.png) ([HTML](screens/Pilot-timings.html)) | Pilot: my timings | Phone | Teacher | Pilot | §3.11, §10.3, §10.6 | R-3.11-05, R-10.3-02, R-10.3-03, R-10.3-04 |
| [`Report`](screens/Report.png) ([HTML](screens/Report.html)) | Reporting a problem: names replaced, shown first | Phone | Teacher | Pilot | §1.5, §1.11 | R-1.5-10, R-1.5-11, R-1.11-02 |
| [`Crash-preview`](screens/Crash-preview.png) ([HTML](screens/Crash-preview.html)) | A crash report before sending | Phone | Teacher | Pilot | §1.5 | R-1.5-07 |
| [`Language`](screens/Language.png) ([HTML](screens/Language.html)) | Interface language | Phone | Teacher | Pilot | §2.5, §3.1, §3.8, §3.11, §6.8 | R-2.5-09, R-3.1-16, R-3.1-17, R-3.1-18, R-3.8-59, R-3.11-04, R-6.8-01 |
| [`Export-all`](screens/Export-all.png) ([HTML](screens/Export-all.html)) | Exporting everything, free | Phone | Teacher | Pilot | §3.10, §5.7, §5.9, §6.4, §6.5 | R-3.10-19, R-5.7-01, R-5.9-01, R-5.9-03, R-5.9-15, R-6.4-08, R-6.5-01 |
| [`Archive-open`](screens/Archive-open.png) ([HTML](screens/Archive-open.html)) | Opening a Minhajna archive: password, preview, imported as a closed year | Phone | Teacher | Launch | §5.9 | R-5.9-02 |
| [`Settings-retention`](screens/Settings-retention.png) ([HTML](screens/Settings-retention.html)) | How long records are kept | Phone | Teacher | Pilot | §5.7 | R-5.7-02 |
| [`Erase`](screens/Erase.png) ([HTML](screens/Erase.html)) | Erasing this device | Phone | Teacher | Pilot | §5.7, §5.8, §6.4 | R-5.7-05, R-5.8-09 |

## During the year and at its end

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`TT-change`](screens/TT-change.png) ([HTML](screens/TT-change.html)) | A new timetable version from the school | Phone | Teacher | Launch | §2.3, §2.5, §3.2, §3.11, §4.6, §5.5, §5.9, §7.4, §7.8 | R-2.3-17, R-2.5-11, R-3.2-16, R-3.11-03, R-4.6-04, R-4.6-05, R-4.6-09, R-5.5-07, R-5.9-07, R-7.4-01, R-7.4-03, R-7.4-04, R-7.4-05, R-7.4-06, R-7.4-07, R-7.8-04 |
| [`Handover-in`](screens/Handover-in.png) ([HTML](screens/Handover-in.html)) | Receiving a handover (the substitute's phone) | Phone | Teacher | Launch | §3.10, §4.7, §5.5, §5.8, §5.9 | R-3.10-12, R-3.10-13, R-3.10-14, R-3.10-17, R-4.7-40, R-5.5-07, R-5.8-10, R-5.9-09 |
| [`Handover-in-fail`](screens/Handover-in-fail.png) ([HTML](screens/Handover-in-fail.html)) | A handover package that fails its check: changed, or not from the same teacher | Phone | Teacher | Pilot | §5.5 | R-5.5-07 |
| [`Pack-release`](screens/Pack-release.png) ([HTML](screens/Pack-release.html)) | A new pack release: moving each class, asking first when its own change meets a split | Phone | Teacher | Launch | §4.2, §4.8, §4.12, §5.9 | R-4.2-12, R-4.2-13, R-4.2-17, R-4.2-18, R-4.8-02, R-4.8-04, R-5.9-10 |
| [`Today-june`](screens/Today-june.png) ([HTML](screens/Today-june.html)) | Today in June: the year-end card, and in July 2028 the erase card | Phone | Teacher | Launch | §5.7 | R-5.7-04 |
| [`Year-close`](screens/Year-close.png) ([HTML](screens/Year-close.html)) | Closing the school year | Phone | Teacher | Launch | §3.2, §3.4, §3.8, §4.2, §5.7 | R-3.2-32, R-3.4-14, R-3.4-29, R-3.8-47, R-3.8-60, R-4.2-12, R-5.7-01, R-5.7-02, R-5.7-04 |
| [`Year-erase`](screens/Year-erase.png) ([HTML](screens/Year-erase.html)) | A year later: erasing that year's pupil records | Phone | Teacher | Launch | §3.4, §5.5, §5.7 | R-5.5-13, R-5.7-03, R-5.7-04 |
| [`TT-change-day`](screens/TT-change-day.png) ([HTML](screens/TT-change-day.html)) | A one-off timetable change for one day: recorded, or received from the school | Phone | Teacher | Launch | §4.6 | R-4.6-05 |

## Primary school

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`P-Today`](screens/P-Today.png) ([HTML](screens/P-Today.html)) | Primary: Today in morning and afternoon bands | Phone | Teacher | Pilot | §2.3, §2.5, §3.3, §3.4, §3.8, §4.1, §4.2, §4.6, §4.7, §4.11 | R-2.3-02, R-2.3-03, R-2.3-09, R-2.5-02, R-3.3-01, R-3.3-03, R-3.3-14, R-3.4-06, R-3.8-11, R-4.2-03, R-4.6-06, R-4.7-04, R-4.7-07, R-4.7-14, R-4.11-01, R-4.11-05 |
| [`Today-ramadan-primary`](screens/Today-ramadan-primary.png) ([HTML](screens/Today-ramadan-primary.html)) | Primary: Today in Ramadan | Phone | Teacher | Pilot | §4.5, §4.11 | R-4.5-09, R-4.5-12, R-4.5-14, R-4.11-03 |
| [`Plan-primary`](screens/Plan-primary.png) ([HTML](screens/Plan-primary.html)) | Primary: a week behind | Phone | Teacher | Pilot | §4.2, §4.7 | R-4.2-04, R-4.7-09, R-4.7-18, R-4.7-19, R-4.7-37 |
| [`Week-slot-primary`](screens/Week-slot-primary.png) ([HTML](screens/Week-slot-primary.html)) | Primary: one slot, its activity type and remediation | Phone | Teacher | Pilot | §4.6, §4.7 | R-4.6-06, R-4.7-07 |
| [`Week-draw-primary`](screens/Week-draw-primary.png) ([HTML](screens/Week-draw-primary.html)) | Primary: a double shift, two classes sharing one room | Phone | Teacher | Pilot | §3.2 | R-3.2-21 |
| [`P-Roll`](screens/P-Roll.png) ([HTML](screens/P-Roll.html)) | Primary: roll call by half-day | Phone | Teacher | Pilot | §2.5, §3.4 | R-2.5-02, R-3.4-06, R-3.4-09, R-3.4-19 |
| [`P-Multi`](screens/P-Multi.png) ([HTML](screens/P-Multi.html)) | Primary: a multigrade class, one plan per level | Phone | Teacher | Pilot | §2.5, §3.2, §4.1, §4.2, §4.6, §4.7, §4.11 | R-2.5-02, R-3.2-13, R-4.2-03, R-4.6-06, R-4.7-04, R-4.7-38, R-4.11-01 |
| [`Plan-stale`](screens/Plan-stale.png) ([HTML](screens/Plan-stale.html)) | Primary: a stale 3AP plan | Phone | Teacher | Pilot | §4.1, §4.2, §4.11 | R-4.11-01 |
| [`P-Journal`](screens/P-Journal.png) ([HTML](screens/P-Journal.html)) | Primary: the daily journal, A4 landscape | Phone | Teacher | Pilot | §2.5, §3.8, §4.6, §4.7 | R-2.5-04, R-3.8-01, R-3.8-02, R-3.8-09, R-3.8-10, R-4.6-06, R-4.7-17 |
| [`P-Journal-front`](screens/P-Journal-front.png) ([HTML](screens/P-Journal-front.html)) | Primary journal: front pages | Phone | Teacher | Pilot | §3.8 | R-3.8-08 |
| [`Print-set-primary`](screens/Print-set-primary.png) ([HTML](screens/Print-set-primary.html)) | Primary: printing the week, with the subject order | Phone | Teacher | Pilot | §3.8 | R-3.8-42, R-3.8-53 |
| [`P-Marks`](screens/P-Marks.png) ([HTML](screens/P-Marks.html)) | Primary: monthly assessment, averages out of 10 | Phone | Teacher | Pilot | §3.5, §3.7 | R-3.5-05, R-3.5-13, R-3.5-18, R-3.7-12 |
| [`P-Obs`](screens/P-Obs.png) ([HTML](screens/P-Obs.html)) | Primary: descriptive observations (1AP, term 1) | Phone | Teacher | Pilot | §3.5 | R-3.5-06 |
| [`Digest-primary`](screens/Digest-primary.png) ([HTML](screens/Digest-primary.html)) | Primary: the digest in plan weeks and minutes | Phone | Teacher | Pilot | §4.7 | R-4.7-18, R-4.7-19 |
| [`Repace-primary`](screens/Repace-primary.png) ([HTML](screens/Repace-primary.html)) | Primary: re-pacing waits for the director's approval | Phone | Teacher | Pilot | §4.7 | R-4.7-30 |

## Lycée

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`L-Today`](screens/L-Today.png) ([HTML](screens/L-Today.html)) | Lycée: Today with a half-group and directed work | Phone | Teacher | Pilot | §2.3, §2.5, §3.2, §3.3, §3.4, §4.2, §4.6, §4.7, §4.11 | R-2.3-03, R-2.3-09, R-2.5-02, R-3.2-19, R-3.2-20, R-3.2-22, R-3.3-01, R-3.3-02, R-3.3-03, R-3.3-14, R-3.4-07, R-4.2-03, R-4.6-03, R-4.7-05, R-4.7-06, R-4.7-14, R-4.7-15, R-4.11-05 |
| [`Today-saturday`](screens/Today-saturday.png) ([HTML](screens/Today-saturday.html)) | Lycée: Today on a Saturday | Phone | Teacher | Pilot | §3.2 | R-3.2-21 |
| [`Plan-lycee`](screens/Plan-lycee.png) ([HTML](screens/Plan-lycee.html)) | Lycée: a hybrid-anchor plan | Phone | Teacher | Pilot | §4.2 | R-4.2-03, R-4.2-04 |
| [`L-Marks`](screens/L-Marks.png) ([HTML](screens/L-Marks.html)) | Lycée: the grade book and its three formulas | Phone | Teacher | Pilot | §3.5 | R-3.5-15 |
| [`Reorient`](screens/Reorient.png) ([HTML](screens/Reorient.html)) | Lycée: reshaping 2AS classes and merging class history | Phone | Teacher | Pilot | §4.7 | R-4.7-39 |

## French and English, left to right

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`PS-Today`](screens/PS-Today.png) ([HTML](screens/PS-Today.html)) | Primary French specialist: Today, in French | Phone | Teacher | Pilot | §2.3, §2.5, §3.1, §3.2, §3.3, §3.4, §3.8, §4.1, §4.2, §4.11, §6.8, §7.4 | R-2.3-03, R-2.5-09, R-3.1-16, R-3.1-17, R-3.2-18, R-3.2-24, R-3.3-01, R-3.4-08, R-3.8-11, R-4.11-01, R-6.8-01, R-7.4-02 |
| [`PS-Classes`](screens/PS-Classes.png) ([HTML](screens/PS-Classes.html)) | Primary French specialist: 14 groups in two schools | Phone | Teacher | Pilot | §3.1, §3.2, §3.4, §6.8, §7.4 | R-3.1-17, R-3.2-18, R-3.2-24, R-3.4-08, R-6.8-01, R-7.4-02 |
| [`PS-Journal`](screens/PS-Journal.png) ([HTML](screens/PS-Journal.html)) | French specialist's journal | Phone | Teacher | Pilot | §3.8 | R-3.8-11 |
| [`Setup-5d-Two-schools`](screens/Setup-5d-Two-schools.png) ([HTML](screens/Setup-5d-Two-schools.html)) | Primary French specialist: two schools in one week | Phone | Teacher | Launch | §3.2, §7.4 | R-3.2-18, R-7.4-02 |
| [`Week-slot-fr`](screens/Week-slot-fr.png) ([HTML](screens/Week-slot-fr.html)) | Primary French specialist: one slot, a clash between two schools' timetables | Phone | Teacher | Pilot | §3.2 | R-3.2-18 |
| [`Settings-two-schools`](screens/Settings-two-schools.png) ([HTML](screens/Settings-two-schools.html)) | Settings, two schools | Phone | Teacher | Pilot | §3.2, §4.2, §4.5, §4.6, §4.7, §4.8 | R-3.2-18, R-4.2-08, R-4.5-12, R-4.6-01, R-4.7-18, R-4.8-03 |
| [`EN-Today`](screens/EN-Today.png) ([HTML](screens/EN-Today.html)) | CEM English teacher: Today, in English | Phone | Teacher | Pilot | §2.3, §2.5, §3.1, §3.3, §3.8, §4.7, §6.8 | R-2.3-03, R-2.5-09, R-3.1-16, R-3.1-17, R-3.1-18, R-3.3-04, R-3.8-11, R-4.7-03, R-6.8-01 |

## PC web app

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Devices-join-install`](screens/Devices-join-install.png) ([HTML](screens/Devices-join-install.html)) | Web app's first run: the browser's install prompt | PC | Teacher | Pilot | §5.2, §6.5, §6.6 | R-6.5-03, R-6.6-05, R-6.6-06, R-6.6-08 |
| [`Devices-join`](screens/Devices-join.png) ([HTML](screens/Devices-join.html)) | Web app's first run: the PC's one-time QR or the recovery sheet, passphrase, storage | PC | Teacher | Launch | §6.5 | R-6.5-03 |
| [`Web-unlock`](screens/Web-unlock.png) ([HTML](screens/Web-unlock.html)) | Web app: unlocking on a PC | PC | Teacher | Pilot | §1.5, §2.5, §3.1, §3.10, §5.2, §5.7, §6.4, §6.6, §6.8 | R-2.5-08, R-3.1-13, R-3.10-18, R-1.5-03, R-5.7-05, R-6.4-01, R-6.4-05, R-6.6-01, R-6.6-05, R-6.6-06, R-6.6-07, R-6.6-08 |
| [`Web-unlock-risk`](screens/Web-unlock-risk.png) ([HTML](screens/Web-unlock-risk.html)) | Web app: storage the browser may clear, sync check, backup now | PC | Teacher | Pilot | §5.2, §6.5, §6.6 | R-6.5-03, R-6.6-05, R-6.6-06, R-6.6-08 |
| [`Web-erase`](screens/Web-erase.png) ([HTML](screens/Web-erase.html)) | Web app: erasing this PC in one step, then adding it again | PC | Teacher | Pilot | §5.7, §6.4 | R-5.7-05 |
| [`Web-week`](screens/Web-week.png) ([HTML](screens/Web-week.html)) | Web app: the week, with the selected session | PC | Teacher | Pilot | §2.3, §2.5, §2.6, §3.1, §3.10, §4.6, §4.7 | R-2.3-14, R-2.5-08, R-2.6-02, R-3.1-05, R-3.1-13, R-3.10-16, R-4.6-08, R-4.7-02, R-4.7-13 |
| [`Web-update`](screens/Web-update.png) ([HTML](screens/Web-update.html)) | Web app: an update with its build checksum, install or later | PC | Teacher | Pilot | §5.2, §6.5, §6.6 | R-6.5-03, R-6.6-05, R-6.6-06, R-6.6-08 |

## Director: reader mode and the timetable

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`R-Open`](screens/R-Open.png) ([HTML](screens/R-Open.html)) | Reader mode: a teacher's statement, checked | Phone | Director, inspector, coordinator | Pilot | §3.10, §4.9, §5.5, §5.9 | R-3.10-08, R-4.9-01, R-5.5-04, R-5.5-07, R-5.9-08, R-5.9-18 |
| [`R-Picture`](screens/R-Picture.png) ([HTML](screens/R-Picture.html)) | Reader mode: the school's picture from the statements received | PC | Director, inspector, coordinator | Pilot | §3.10, §4.9 | R-4.9-01 |
| [`R-Spot`](screens/R-Spot.png) ([HTML](screens/R-Spot.html)) | Reader mode: the inspector's spot-check sheet | Phone | Director, inspector, coordinator | Pilot | §7.2 | — |
| [`R-Merge`](screens/R-Merge.png) ([HTML](screens/R-Merge.html)) | The coordinator's merge for the teaching council | PC | Director, inspector, coordinator | Pilot | §4.7 | R-4.7-10 |
| [`D-TT-import`](screens/D-TT-import.png) ([HTML](screens/D-TT-import.html)) | Timetable package: version 1, checked and sent | PC | Director | Launch | §7.4 | — |
| [`D-TT-change`](screens/D-TT-change.png) ([HTML](screens/D-TT-change.html)) | Timetable package: version 2, only the affected teachers told | PC | Director | Launch | §4.6 | R-4.6-05 |

## 2027/28: the opt-in insights

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`Insights-optin`](screens/Insights-optin.png) ([HTML](screens/Insights-optin.html)) | Anonymous insights: the exact payload first | Phone | Teacher | Insights | §1.6, §4.2, §4.9, §7.10, §8.4, §10.3 | R-10.3-05, R-4.2-11, R-4.9-03, R-1.6-01, R-1.6-02, R-1.6-03, R-1.6-04, R-1.6-05, R-1.6-06, R-1.6-08, R-7.10-09, R-8.4-01 |
| [`Insights-compare`](screens/Insights-compare.png) ([HTML](screens/Insights-compare.html)) | Anonymous insights: my class against its peers | Phone | Teacher | Insights | §1.6, §4.9, §8.4 | R-4.9-03, R-1.6-05, R-1.6-07, R-8.4-02, R-8.4-03, R-8.4-04 |
| [`Log-insights`](screens/Log-insights.png) ([HTML](screens/Log-insights.html)) | The log: each insights sending | Phone | Teacher | Insights | §1.6 | R-1.6-03 |
| [`Help-insights`](screens/Help-insights.png) ([HTML](screens/Help-insights.html)) | Help with insights on | Phone | Teacher | Insights | §1.5 | R-1.5-06 |
| [`Obs-Report`](screens/Obs-Report.png) ([HTML](screens/Obs-Report.html)) | Anonymous insights: the term report, drafted for the IGP first | PC | Observatory | Insights | §8.4 | — |
| [`Settings-school`](screens/Settings-school.png) ([HTML](screens/Settings-school.html)) | Settings after School-join | Phone | Teacher | Insights | §1.6, §8.4 | R-1.6-08 |
| [`Insights-optin-school`](screens/Insights-optin-school.png) ([HTML](screens/Insights-optin-school.html)) | Insights off for school classes | Phone | Teacher | Insights | §1.6, §8.4 | R-1.6-08 |
| [`Settings-retired`](screens/Settings-retired.png) ([HTML](screens/Settings-retired.html)) | Settings after insights retire | Phone | Teacher | Insights | §1.6, §8.4 | R-1.6-08 |
| [`Insights-optin-retired`](screens/Insights-optin-retired.png) ([HTML](screens/Insights-optin-retired.html)) | Insights retired | Phone | Teacher | Insights | §1.6, §4.9, §8.4 | R-4.9-04, R-1.6-08 |

## The national system: the teacher (example 2029/30)

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`School-join`](screens/School-join.png) ([HTML](screens/School-join.html)) | The national system: the notice, then joining by the school's QR | Phone | Teacher | National | §1.5, §2.5, §2.6, §3.1, §3.2, §3.8, §3.11, §5.5, §5.7, §5.8, §5.9, §6.4, §6.5, §6.8, §7.5, §7.8, §9.3 | R-2.5-11, R-2.6-03, R-2.6-04, R-2.6-05, R-2.6-06, R-2.6-08, R-2.6-11, R-3.1-12, R-3.2-04, R-3.2-05, R-3.2-06, R-3.2-08, R-3.2-10, R-3.8-18, R-3.11-06, R-9.3-05, R-1.5-02, R-1.5-03, R-5.5-10, R-5.7-07, R-5.8-02, R-5.8-03, R-5.8-05, R-5.9-11, R-6.4-03, R-6.4-04, R-6.5-02, R-7.5-01, R-7.5-03, R-7.5-04, R-7.8-02 |
| [`School-join-trial`](screens/School-join-trial.png) ([HTML](screens/School-join-trial.html)) | The national system: the voluntary trial term end, removed at the national launch | Phone | Teacher | National | §7.5 | R-7.5-05 |
| [`Devices-moved`](screens/Devices-moved.png) ([HTML](screens/Devices-moved.html)) | The national system: own-device sync on the Ministry's server, the project account closed | Phone | Teacher | National | §9.3 | R-9.3-05 |
| [`School-mine`](screens/School-mine.png) ([HTML](screens/School-mine.html)) | The national system: my classes as the director sees them | Phone | Teacher | National | §1.11, §2.3, §2.5, §2.6, §3.4, §4.7, §5.5, §7.5, §7.6, §7.7, §7.8 | R-2.3-18, R-2.5-05, R-2.6-03, R-2.6-07, R-2.6-08, R-2.6-11, R-3.4-03, R-4.7-20, R-4.7-21, R-1.11-04, R-1.11-05, R-5.5-05, R-5.5-06, R-5.5-08, R-7.5-02, R-7.5-06, R-7.5-08, R-7.6-01, R-7.6-02, R-7.6-03, R-7.7-01, R-7.8-03, R-7.8-05 |
| [`School-mine-report`](screens/School-mine-report.png) ([HTML](screens/School-mine-report.html)) | The national system: my classes' term report, as the director sees it | Phone | Teacher | National | §7.5 | R-7.5-08 |
| [`Week-sign`](screens/Week-sign.png) ([HTML](screens/Week-sign.html)) | The national system: signing the week, once a week per class | Phone | Teacher | National | §1.11, §2.3, §2.6, §3.2, §3.3, §3.4, §3.8, §3.11, §4.5, §4.7, §5.5, §5.8, §6.4, §6.5, §7.5, §7.6, §7.8 | R-2.3-13, R-2.3-18, R-2.6-05, R-3.2-06, R-3.3-12, R-3.3-26, R-3.3-27, R-3.3-28, R-3.3-29, R-3.4-04, R-3.4-05, R-3.8-18, R-3.11-06, R-4.5-17, R-4.7-02, R-1.11-05, R-5.5-08, R-5.5-09, R-5.5-10, R-5.5-11, R-5.5-12, R-5.8-02, R-6.4-03, R-6.5-02, R-7.5-09, R-7.6-02, R-7.8-02 |
| [`Week-sign-today`](screens/Week-sign-today.png) ([HTML](screens/Week-sign-today.html)) | The national system: Today with a make-up session | Phone | Teacher | National | §7.7 | R-7.7-02 |
| [`Web-staff`](screens/Web-staff.png) ([HTML](screens/Web-staff.html)) | The national system: signing in on a staffroom PC, by phone or security key | PC | Teacher | National | §2.6, §3.1, §3.2, §3.10, §5.8, §6.4, §6.6, §7.5 | R-2.6-04, R-2.6-06, R-3.1-14, R-3.2-06, R-3.2-07, R-3.10-18, R-5.8-04, R-6.4-03, R-6.4-04, R-6.6-01, R-6.6-02, R-6.6-03, R-6.6-04, R-6.6-07, R-6.6-09, R-7.5-03 |
| [`Web-signin-phone`](screens/Web-signin-phone.png) ([HTML](screens/Web-signin-phone.html)) | The national system: approving a staffroom PC sign-in on the phone | Phone | Teacher | National | §6.6 | R-6.6-02 |
| [`Web-staff-session`](screens/Web-staff-session.png) ([HTML](screens/Web-staff-session.html)) | The national system: a staffroom PC session, lock and end, nothing left | PC | Teacher | National | §6.6 | R-6.6-02 |
| [`Week-fix`](screens/Week-fix.png) ([HTML](screens/Week-fix.html)) | The national system: correcting a signed week, both versions kept | Phone | Teacher | National | §1.5, §2.3, §3.1, §3.3, §3.4, §5.5, §5.9, §7.8 | R-2.3-13, R-3.1-06, R-3.1-07, R-3.1-08, R-3.3-30, R-3.4-04, R-3.4-05, R-3.4-10, R-1.5-02, R-5.5-02, R-5.5-03, R-5.5-09, R-5.9-12, R-7.8-01 |
| [`Digest-signed`](screens/Digest-signed.png) ([HTML](screens/Digest-signed.html)) | The national system: the weekly digest, with a week left to sign | Phone | Teacher | National | §1.11, §2.6, §3.1, §3.3, §3.9, §4.7, §5.5, §5.8, §7.5, §7.6 | R-2.6-08, R-3.1-08, R-3.1-15, R-3.3-30, R-3.9-02, R-3.9-08, R-4.7-06, R-4.7-19, R-4.7-21, R-1.11-05, R-5.5-08, R-5.8-02, R-7.5-06, R-7.5-09, R-7.6-02 |
| [`TT-propose`](screens/TT-propose.png) ([HTML](screens/TT-propose.html)) | The national system: proposing a timetable change, checked live | Phone | Teacher | National | §4.6, §7.4, §7.8 | R-4.6-04, R-4.6-09, R-7.4-04, R-7.4-07, R-7.8-04 |
| [`Handover-school`](screens/Handover-school.png) ([HTML](screens/Handover-school.html)) | The national system: a substitute receives the classes through the school's space | Phone | Teacher | National | §3.10, §4.7, §5.9, §6.5, §7.5 | R-3.10-15, R-4.7-21, R-4.7-40, R-5.9-11, R-6.5-02, R-7.5-07 |
| [`Handover-end`](screens/Handover-end.png) ([HTML](screens/Handover-end.html)) | The national system: the appointment ends, the classes return | Phone | Teacher | National | §7.5 | R-7.5-07 |
| [`Handover-end-sub`](screens/Handover-end-sub.png) ([HTML](screens/Handover-end-sub.html)) | The national system: the appointment ends, the substitute's phone | Phone | Teacher | National | §7.5 | R-7.5-07 |
| [`Rejoin`](screens/Rejoin.png) ([HTML](screens/Rejoin.html)) | The national system: a new phone after a loss | Phone | Teacher | National | §3.1, §3.2, §3.8, §5.5, §5.8, §6.5 | R-3.1-12, R-3.2-03, R-3.8-47, R-5.5-10, R-5.8-03, R-5.8-12, R-6.5-02, R-6.5-04 |
| [`Term-send`](screens/Term-send.png) ([HTML](screens/Term-send.html)) | The national system: signing the term's marks, sent to the state's system | Phone | Teacher | National | §1.5, §2.6, §3.5, §3.7, §3.11, §5.5, §5.9 | R-2.6-10, R-2.6-12, R-3.5-12, R-3.7-02, R-3.7-09, R-3.7-19, R-3.7-20, R-3.11-06, R-1.5-02, R-5.5-11, R-5.9-12, R-5.9-13 |
| [`Leave`](screens/Leave.png) ([HTML](screens/Leave.html)) | The national system: leaving for another school, what stays and what goes | Phone | Teacher | National | §3.8, §3.10, §5.7, §7.5 | R-3.8-47, R-3.8-60, R-3.10-19, R-5.7-06, R-5.7-07 |
| [`Help-national`](screens/Help-national.png) ([HTML](screens/Help-national.html)) | Help in the national system | Phone | Teacher | National | §1.5 | R-1.5-06, R-1.5-07 |

## The national system: the director (example 2029/30)

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`D-Dashboard`](screens/D-Dashboard.png) ([HTML](screens/D-Dashboard.html)) | The national system: the director's dashboard | PC | Director | National | §1.11, §7.6 | R-1.11-04, R-7.6-01, R-7.6-04 |
| [`D-Cover`](screens/D-Cover.png) ([HTML](screens/D-Cover.html)) | The national system: today's cover, the sheet and the log | PC | Director | National | §7.7 | R-7.7-02 |
| [`D-Record`](screens/D-Record.png) ([HTML](screens/D-Record.html)) | The national system: a class's signed week, with the visa | PC | Director | National | §5.5, §7.5 | — |
| [`D-Record-fix`](screens/D-Record-fix.png) ([HTML](screens/D-Record-fix.html)) | The national system: a corrected week as the director reads it, both versions | PC | Director | National | §3.1, §3.3, §5.5 | R-3.1-08, R-3.3-30, R-5.5-02, R-5.5-04, R-5.5-09 |
| [`D-Report`](screens/D-Report.png) ([HTML](screens/D-Report.html)) | The national system: the term's delivery report | PC | Director | National | §7.5, §7.7 | R-7.5-08, R-7.7-02 |
| [`D-Substitute`](screens/D-Substitute.png) ([HTML](screens/D-Substitute.html)) | The national system: a substitute's appointment and the inspector's grant | PC | Director | National | §7.5 | R-7.5-07 |
| [`D-TT-proposal`](screens/D-TT-proposal.png) ([HTML](screens/D-TT-proposal.html)) | The national system: a teacher's timetable proposal, accepted or declined | PC | Director | National | §7.4, §7.8 | — |
| [`D-Issue`](screens/D-Issue.png) ([HTML](screens/D-Issue.html)) | The national system: joining codes and security keys, from the official assignments | PC | Director | National | §2.6, §3.1, §3.2, §5.8, §5.9, §6.4, §6.5, §6.6 | R-2.6-04, R-3.1-12, R-3.1-14, R-3.2-04, R-3.2-07, R-5.8-03, R-5.8-04, R-5.8-12, R-5.9-11, R-6.4-04, R-6.6-04 |
| [`D-Keys`](screens/D-Keys.png) ([HTML](screens/D-Keys.html)) | The school key: who holds it, the timetable key and the split recovery (React Flow map) | PC | Director | National | §6.5, §7.5 | — |
| [`D-Exchange`](screens/D-Exchange.png) ([HTML](screens/D-Exchange.html)) | The national system: what enters and leaves the school (a React Flow map) | PC | Director | National | §3.4 | R-3.4-05 |

## The national system: the directorate, the inspector and the operators (example 2029/30)

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`M-Grant`](screens/M-Grant.png) ([HTML](screens/M-Grant.html)) | The national system: the directorate grants an inspector time-limited access | PC | Directorate | National | §7.8 | R-7.8-02, R-7.8-05 |
| [`I-Grant`](screens/I-Grant.png) ([HTML](screens/I-Grant.html)) | The national system: the inspector's phone during a grant, with the spot-check sheet | Phone | Inspector | National | §1.11, §7.8 | R-1.11-05, R-7.8-05 |
| [`M-Totals`](screens/M-Totals.png) ([HTML](screens/M-Totals.html)) | The national system: the directorate's totals, what the system owes teachers and the curriculum report | PC | Directorate | National | §4.9 | R-4.9-04 |
| [`N-Totals`](screens/N-Totals.png) ([HTML](screens/N-Totals.html)) | The national system: the Ministry's totals, wilayas named for what is owed | PC | Ministry | National | §5.10, §7.9 | R-7.9-01 |
| [`Ops-Console`](screens/Ops-Console.png) ([HTML](screens/Ops-Console.html)) | The national system: the operators' map, no key anywhere (a React Flow map) | PC | Operators | National | §5.8 | R-5.8-06 |

## The exam threshold at every level (example 2029/30)

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`T-Threshold-exams`](screens/T-Threshold-exams.png) ([HTML](screens/T-Threshold-exams.html)) | The national system: my exams with a common paper, and where each class stands | Phone | Teacher | National | §3.3 | R-3.3-31 |
| [`T-Threshold`](screens/T-Threshold.png) ([HTML](screens/T-Threshold.html)) | National system: the teacher signs the other setter's cut, proposes another, or chooses none | Phone | Teacher | National | §2.6, §3.3, §7.10 | R-2.6-07, R-2.6-13, R-3.3-31, R-3.3-32, R-3.3-33, R-3.3-34, R-3.3-37, R-3.3-38, R-3.3-39, R-7.10-01, R-7.10-02, R-7.10-03, R-7.10-04, R-7.10-06, R-7.10-07, R-7.10-08 |
| [`T-Threshold-propose`](screens/T-Threshold-propose.png) ([HTML](screens/T-Threshold-propose.html)) | The national system: no cut yet, proposing one first, or none for this exam | Phone | Teacher | National | §3.2, §3.3, §7.10 | R-3.2-06, R-3.3-36, R-7.10-03 |
| [`T-Threshold-after`](screens/T-Threshold-after.png) ([HTML](screens/T-Threshold-after.html)) | The national system: the school's cut published after the exam, with its figures | Phone | Teacher | National | §3.3, §7.10 | R-3.3-39, R-7.10-04 |
| [`T-Threshold-moved`](screens/T-Threshold-moved.png) ([HTML](screens/T-Threshold-moved.html)) | The national system: an exam date moved, with its figures day and signing deadline | Phone | Teacher | National | §7.10 | R-7.10-06 |
| [`T-Threshold-totals`](screens/T-Threshold-totals.png) ([HTML](screens/T-Threshold-totals.html)) | The national system: the directorate's totals on the phone, with no cut | Phone | Teacher | National | §3.3, §7.10 | R-3.3-35, R-7.10-02 |
| [`D-Threshold`](screens/D-Threshold.png) ([HTML](screens/D-Threshold.html)) | The national system: the school's thresholds for its term exams, every subject | PC | Director | National | §2.6, §3.3, §7.10 | R-2.6-13, R-3.3-34, R-3.3-36, R-7.10-02, R-7.10-03 |
| [`M-Threshold`](screens/M-Threshold.png) ([HTML](screens/M-Threshold.html)) | The national system: the directorate's threshold for its mock BEM | PC | Directorate | National | §7.10 | — |
| [`N-Threshold`](screens/N-Threshold.png) ([HTML](screens/N-Threshold.html)) | The national system: the Ministry's BEM threshold, with the wilayas as a range | PC | Ministry | National | §7.10 | — |
| [`N-Published`](screens/N-Published.png) ([HTML](screens/N-Published.html)) | The national system: what is published after the BEM, and how each threshold was set | PC | Ministry | National | §3.3, §7.10 | R-3.3-39, R-7.10-04, R-7.10-06, R-7.10-07 |

## Curators: the pack editor

| Screen ID | Screen | Device | Who | Stage | PRD | Requirements |
|---|---|---|---|---|---|---|
| [`E-Migrate`](screens/E-Migrate.png) ([HTML](screens/E-Migrate.html)) | The pack editor: mapping item IDs from 2026.1 to 2026.2 | PC | Curators | Curators | §4.7 | R-4.7-41 |
| [`E-Release`](screens/E-Release.png) ([HTML](screens/E-Release.html)) | The pack editor: release 2026.2, the checks and the two-person review | PC | Curators | Curators | §4.2 | R-4.2-10, R-4.2-16, R-4.2-17 |

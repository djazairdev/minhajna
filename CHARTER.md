# The teacher data-use charter

These are Minhajna's commitments to teachers: records should support their teaching, not monitor them or rank them against colleagues.

The charter sets the rules we build by. It is not a list of features already available. The [download and testing page](https://djazair.dev/en/minhajna/) explains what the current preview can do, and the [privacy policy](PRIVACY.md) explains how information is handled.

[اقرأ الميثاق بالعربية](docs/ar/charter.md).

## Current features and planned safeguards

The current preview works offline and keeps entries on the teacher's phone, unless the teacher prints them or saves them as a PDF.

These features are not available yet:

- School access to records.
- Inspector access permissions.
- Encrypted sync between devices.
- Signing weekly records.
- Statistics above school level.

## The ten points

1. **Records are for teaching.** They are used only for the teacher's planning, the teaching council's coordination, and the checks that official texts allow directors and inspectors to make. Figures above school level may be used only as point 7 allows.
2. **No career decisions or teacher rankings.** Records are never used to decide pay, promotion, appraisal, bonuses, discipline or transfers. There are no rankings or colour-coded lists of teachers.
3. **No surveillance of your activity.** No clock times anywhere, no sign-in or lesson-start events, and no location. A missing or late entry, or a session awaiting confirmation, never counts as a teacher's absence. None of these ever triggers an alert or a sanction, and none leaves the school.
4. **You can always correct an entry.** The original and the correction both remain visible in the history.
5. **You see what the director sees about your classes.** You also see every access to your records. An inspector's access must come from the authorised body, not the director acting alone. It is limited in time, and you see it.
6. **Private notes stay private.** They never leave your own devices.
7. **Above school level, only combined statistics.**
   - No named teacher's record or individual school's figure is shown.
   - The calculation method and minimum numbers of teachers and schools are published beforehand.
   - The figures are never used for career decisions.
   - Lessons completed may help determine which material an exam covers, but only at the level that sets it:
     - The school's records for its term and mock exams.
     - The directorate's totals for its exams.
     - Wilaya and national totals for national exams.
   - The date for taking the figures is announced at the start of the school year. It changes only if the exam date changes, with the new date announced at least two weeks ahead.
   - Figures are checked against a sample of pupils' exercise books reviewed by inspectors. In a year without that check, they are clearly marked unchecked.
   - After the exam, the figures and an explanation of how they were used are published.
8. **Quiet hours.** No notifications at night or at weekends.
9. **No personal phone required.** Paper and a shared computer remain alternatives.
10. **Teachers are consulted.** The charter is presented to each school's teachers' council before the system is introduced there. The transparency report lists every request for data from an authority, where publication is allowed by law.

## Built into the design

These protections don't depend on anyone's goodwill. They are built into what the servers can read and compute:

- **Nobody who runs a server holds a key.** Records are encrypted on the device before they leave it. Neither the project nor the Ministry holds a key to a named record, so neither can read one on its servers.
- **The school key** opens the school's space: the signed weeks, the pupil records and each session's confirmation status. Only the director and the deputies hold it, so the confirmation status never leaves the school (point 3). Its recovery is split between the school and its directorate, so neither can open the school's records alone.
- **An inspector's grant** opens only the lesson records of the courses and signed weeks it names, between its dates: never pupil records, and never the confirmation status. You see the grant and every access (point 5).
- **Above the school, totals only.** Each school's share of a total is prepared inside its own space, so no school's figure reaches the server. Totals cover at least the published minimum sizes, and totals of how far classes got are formed only on days announced at the start of the year (points 1 and 7).
- **No clock times anywhere.** The school's copy keeps each session's current status, never the day it was confirmed. Nothing records sign-ins, lesson starts or location (point 3).
- **Private notes and reasons** are encrypted for your own devices only (point 6).
- **Corrections are added and signed,** and both versions stay visible (point 4).
- **The Ministry's app is the project's release,** built reproducibly under the Ministry's name. If a build weakens the charter, for example with a key the Ministry holds, the project publishes the finding at once and sends it to the Ministry, and teachers can use the project's own app.

The full technical requirements are in the PRD: [where records may go](docs/prd/PRD.md#54-where-each-record-may-go), [corrections and signatures](docs/prd/PRD.md#55-history-corrections-and-signatures), [access rights](docs/prd/PRD.md#510-the-permission-model), [encryption and recovery](docs/prd/PRD.md#65-keys-sync-and-recovery), and [checking published builds](docs/prd/PRD.md#19-official-builds-releases-the-name-and-security).

## Changing the charter

A change needs a public proposal, at least 30 days for comments and a recorded decision. Teachers hear about it in Arabic, and every comment gets an answer in the record.

The [governance rules](GOVERNANCE.md#changing-a-principle-or-the-charter) set when the project's teacher council must consent. When that consent is required, more than half of all its members must vote in favour. Maintainers cannot bypass that vote.

## Where it comes from

The [PRD](docs/prd/PRD.md#115-institution-mode) and these decision records give the detailed requirements and their history:

- [0010](docs/decisions/0010-institution-mode-and-charter.md): institution mode and the charter;
- [0015](docs/decisions/0015-national-system-protections-by-design.md): protections built into the design;
- [0016](docs/decisions/0016-non-commercial.md): the teacher council's consent;
- [0017](docs/decisions/0017-exam-scope-at-each-level.md): point 7 and exam scope;
- [0018](docs/decisions/0018-charter-purpose-and-figures.md): point 1 and figures above the school.

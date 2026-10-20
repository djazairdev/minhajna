# The teacher data-use charter

These are Minhajna's commitments to teachers: records should support their teaching, not monitor them or rank them against colleagues.

The charter sets the rules we build by. It is not a list of features already available. The [download and testing page](https://djazair.dev/en/minhajna/) explains what the current preview can do, and the [privacy policy](PRIVACY.md) explains how information is handled.

[اقرأ الميثاق بالعربية](docs/ar/charter.md).

## Current features and planned safeguards

The current preview works offline and keeps entries on the teacher's phone.

These features are not available yet:

- School access to records.
- Inspector access permissions.
- Encrypted sync between devices.
- Signing weekly records.
- Statistics above school level.

## The ten points

1. **Records are for teaching.** They are used only for the teacher's planning, the teaching council's coordination, and the checks that official texts allow directors and inspectors to make. Figures above school level may be used only as point 7 allows.
2. **No career decisions or teacher rankings.** Records are never used to decide pay, promotion, appraisal, bonuses, discipline or transfers. There are no rankings or colour-coded lists of teachers.
3. **No surveillance of your activity.** Records and their history use dates, not times of day. There are no lesson-start events or location tracking. A missing or late entry, or a session awaiting confirmation, never counts as a teacher's absence. That status never triggers an alert or a sanction, and never leaves the school.
4. **You can always correct a mistake.** The original entry and its correction both remain visible in the history.
5. **You see what the director sees about your classes.** You also see every access to your records. An inspector's access must come from the authorised body, not the director acting alone. It has a time limit that you can see.
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
9. **No personal phone required.** Paper and a school computer remain alternatives.
10. **Teachers are consulted.** The charter is presented to each school's teachers' council before the system is introduced there. The transparency report lists every request for data from an authority, where publication is allowed by law.

## Technical requirements

The technical requirements remain in the PRD: [where records may go](docs/prd/PRD.md#54-where-each-record-may-go), [corrections and signatures](docs/prd/PRD.md#55-history-corrections-and-signatures), [access rights](docs/prd/PRD.md#510-the-permission-model), [encryption and recovery](docs/prd/PRD.md#65-keys-sync-and-recovery), and [checking published builds](docs/prd/PRD.md#19-official-builds-releases-the-name-and-security).

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

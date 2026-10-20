# Privacy

[ملخّص الخصوصية بالعربية](docs/ar/privacy.md)

This policy covers personal information held by the project through its repositories, teachers' group, website and future services. National-system records will be controlled by the Ministry and are not covered here ([PRD §1.15](docs/prd/PRD.md#115-institution-mode)).

## What the project never holds

- **Pupil data.** Pupils' names, marks and absences never reach the project (principle 2). The preview is for invented pupils only and keeps entries on the phone. Future sync and backup must be end-to-end encrypted before they open, so the project cannot read them.
- **The records of the planned national system.** After adoption, they will be kept on the Ministry's servers, encrypted so that only the teacher and their school can read them, and a granted inspector only the lesson records a grant names. The project will hold none of them, and nobody who runs a server may hold a key to a named record ([PRD §6.5](docs/prd/PRD.md#65-keys-sync-and-recovery)).
- **Anything that tracks teachers.** No clock times, sign-in events or location, and no analytics, advertising or crash-reporting SDKs. No ads or trackers, and no sale or sharing of data, ever (principle 3).
- **Private notes.** They never leave the teacher's own devices.

## The preview

The [Android preview](https://djazair.dev/en/minhajna/) (0.1.0 on 18 October 2026, 0.2.0 on 20 October 2026) is for invited teachers using made-up data only.

- Entries stay in an encrypted database on your phone. There is no account, internet permission, automatic reporting or usage tracking.
- The app is locked with a 4-digit PIN. Unlocking with a fingerprint or the face uses the phone's own prompt, and the app stores no fingerprint or face data.
- Documents print through the phone's print service, or are saved as a PDF where the teacher chooses. That is the only way records leave the app, and only when the teacher does it; the copy is then the teacher's to keep safe. Documents with pupils' names carry «داخلي · سري» on every page.
- There is no sync, backup or recovery. Records are excluded from the phone's cloud backup. Uninstalling, clearing storage or losing the phone can lose your entries; the project cannot restore them.
- «توقيتاتي في التجربة» (My pilot timings) measures, on the phone only, how many seconds confirming a session and taking a roll call take, kept by school week, never by day or time of day, and with no content. What is shared carries no date. The figures leave the phone only if the teacher shares them by hand, and can be cleared at any time.
- The app shows its privacy notice before first use, and keeps it available in Help and privacy.
- Opening the public source link requires a separate confirmation. The browser may then connect to GitHub, but the app attaches no record or identifier. Download links in the guides also open GitHub in the browser, separately from the app.
- Feedback is sent by the teacher, not automatically: [Facebook page messages](https://www.facebook.com/djazairdev), [email](mailto:contact@djazair.dev), or GitHub if preferred. These are external services, not app connections. GitHub posts and Facebook comments are public. Never send real pupil data through any route, even privately.

Sync, reporting and national-system services are future features. Each must meet its published launch requirements before opening.

## What the project holds now

| What | Why | Where, and for how long |
|---|---|---|
| What people post on GitHub: issues, pull requests and comments | To build the project in public | On GitHub, which is run from abroad, under its own terms. Everything there is public, so never post personal details or pupil data |
| Posts in the teachers' Facebook group | To hear from teachers | On Facebook, under its own terms. The group's admins remove posts with real pupil data |
| Feedback voluntarily sent to the Facebook page or `contact@djazair.dev`, including the sender's contact details | To answer questions and improve the preview; not to collect pupil records | On the chosen message or email service, under its own terms, with the maintainer handling the reply. Do not send real pupil data. A sender can ask the maintainer to delete the project's copy; the provider's own retention rules also apply |
| Field-check contacts: a name, and a phone number or an e-mail address, for the teachers and staff who take part ([PRD §10.2](docs/prd/PRD.md#102-the-field-check)) | To run the field check, to ask about each proposal, and to invite members of the teacher council and subject maintainers ([PRD §1.8](docs/prd/PRD.md#18-governance-and-decisions)) | Kept by the lead maintainer only, and never published. Deleted whenever the person asks |

## What it will hold, as each part opens

| What | From | Rules |
|---|---|---|
| Comments sent through the website's form, and how the sender wants to be credited | The form's opening | Used to answer comments on proposals and to take in plans and templates. Answers sum comments up without naming the teacher |
| Pilot contacts | The pilot | Only what the pilot needs. Kept by the lead maintainer, and deleted whenever the person asks |
| Problem reports | The pilot | Built by the app with pupils' names replaced, and shown to the teacher before they are sent ([PRD §1.5](docs/prd/PRD.md#15-pupil-data-and-privacy-rules)). Kept until the problem is fixed, 12 months at most, and the teacher can delete theirs sooner |
| Crash reports | The pilot | Off by default. The teacher sees each one before it is sent, and names and marks are removed |
| Pilot timings | The pilot | In the preview, measured on the phone only and shared by hand, as above. Planned for the pilot: off by default; with the teacher's consent, four figures go once a month: seconds per session, the share confirmed in one tap, minutes a week and whether the term export was done. No identifier, date or class goes with them ([PRD §10.3](docs/prd/PRD.md#103-how-success-is-measured)) |
| Sync accounts | When sync opens | A login, and encrypted records the project cannot read. The server sees memberships, encrypted batches and their sizes, never names or times of activity |
| Pack-editor accounts | For curators and subject maintainers | Only what the editor needs to credit their work |
| Donors' details | Once the association exists | Only what the accounts need. Donations unlock nothing |
| Opt-in insights | 2027/28 | Lesson-level data only, never anything that identifies a teacher, and only after the teacher sees the exact payload ([PRD §1.6](docs/prd/PRD.md#16-anonymous-insights-rules-for-openness)) |

## How it is kept

- **The minimum,** stored apart from everything else ([PRD §1.4](docs/prd/PRD.md#14-what-is-open-and-what-stays-private)).
- **In Algeria.** Every server the project runs that touches personal data is hosted in Algeria, and so is everything on that path: e-mail, monitoring and backups ([PRD §6.1](docs/prd/PRD.md#61-the-legal-position-in-teacher-mode)).
- **Declared first.** Before the project collects personal data through a service of its own, it declares that processing to the ANPDP, as Loi 18-07 requires, with a register of processing and a named data-protection contact. Teachers see an Arabic privacy notice before they first use the app ([PRD §6.2](docs/prd/PRD.md#62-compliance-before-each-launch)).
- **Who answers for it.** Until the association exists, the founder answers for what the project holds. How the declaration is made before then is a question for counsel ([PRD §6.10](docs/prd/PRD.md#610-decisions-and-open-points)).
- **In the transparency report.** Every September, from the launch, the report says what the project holds about teachers, and every request for data from an authority, where the law allows ([PRD §1.11](docs/prd/PRD.md#111-community-transparency-and-building-in-public)).

## Your rights

You can see, correct and delete what the project holds about you. Corrections and deletions are made within 10 days ([PRD §6.2](docs/prd/PRD.md#62-compliance-before-each-launch)).

Email [contact@djazair.dev](mailto:contact@djazair.dev) privately, or contact your field-check organiser. Never include real pupil data or post personal details publicly.

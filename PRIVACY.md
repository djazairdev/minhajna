# Privacy

[ملخّص الخصوصية بالعربية](docs/ar/privacy.md)

This policy covers personal information held by the project through its repositories, teachers' group, website and future services. National-system records will be controlled by the Ministry and are not covered here ([PRD §1.15](docs/prd/PRD.md#115-institution-mode)).

## What the project never holds

- **Pupil data.** Pupils' names, marks and absences never reach the project (principle 2). The preview is for invented pupils only and keeps entries on the phone or in the PC's browser, and in the files the teacher chooses to save. Its backups are encrypted under a key only the teacher holds, and future sync must be end-to-end encrypted before it opens, so the project can read neither.
- **The records of the planned national system.** After adoption, they will be kept on the Ministry's servers, encrypted so that only the teacher and their school can read them, and a granted inspector only the lesson records a grant names. The project will hold none of them, and nobody who runs a server may hold a key to a named record ([PRD §6.5](docs/prd/PRD.md#65-keys-sync-and-recovery)).
- **Anything that tracks teachers.** No clock times, sign-in events or location, and no analytics, advertising or crash-reporting SDKs. No ads or trackers, and no sale or sharing of data, ever (principle 3).
- **Private notes.** They never reach the project. They leave the teacher's phone or PC only inside the teacher's own encrypted backups and transfers, and in an export only if the teacher includes them.

## The preview

The [Android preview](https://djazair.dev/en/minhajna/) (0.1.0 on 18 October 2026 to 0.6.1 on 29 October 2026) is for invited teachers using made-up data only.

- Entries stay in an encrypted database on your phone. There is no account, automatic reporting or usage tracking. Until 0.7.0 there was no internet permission either; from 0.7.0, only a demo world connects, and only to the demo server (below).
- The app is locked with a 4-digit PIN. Unlocking with a fingerprint or the face uses the phone's own prompt, and the app stores no fingerprint or face data.
- Records leave the app only when the teacher does it, and the copy is then the teacher's to keep safe:
  - documents print through the phone's print service, or are saved as a PDF where the teacher chooses;
  - a class's progress statement prints, is saved as a PDF, shows as a QR code, or is shared as a signed file. It carries no pupil data and none of the teacher's reasons for sessions not held. It is signed with the phone's key, so a reader can tell one teacher's statements apart, and «لمن؟» records a role, never a name;
  - «تصدير كل البيانات» saves everything through the phone's file picker, under a password by default. The archive leaves out the teacher's personal fields and drawn signature, and private notes unless the teacher includes them.

  Documents and files with pupils' names carry «داخلي · سري». The activity log records each print, file and share, never its content.
- Records are excluded from the phone's cloud backup. From 0.5.0, the teacher can save a backup through the file picker, encrypted under a recovery key that only the teacher holds, or move everything to a new phone in one encrypted file, sent through the share menu, such as Quick Share or Bluetooth, or saved through the file picker, with a one-time code that is kept nowhere. Personal fields, the drawn signature and the key never go into a backup or a transfer. The project holds no key and cannot restore anything: uninstalling, clearing storage or losing the phone without a backup loses your entries. There is no sync yet.
- «مسح هذا الجهاز» erases everything the app keeps on the phone, and a pupil's data can be erased once the director has confirmed they left the school and that day has come. Neither can be undone. Backups and files saved elsewhere stay where they were put.
- «توقيتاتي في التجربة» (My pilot timings) measures, on the device only, the phone or the PC, how many seconds confirming a session and taking a roll call take, kept by school week, never by day or time of day, and with no content. What is shared carries no date. The figures leave the device only if the teacher shares them by hand, and can be cleared at any time.
- The app shows its privacy notice before first use, and keeps it available in Help and privacy.
- Calendar notices from the school arrive as a file the teacher picks or a QR code the teacher scans. The app reads only the one local file chosen and keeps no lasting access to it. The camera is asked for only when the teacher chooses to scan, here and for a progress statement's QR code or a transfer's one-time code; its frames are decoded on the phone, in memory, and never saved or sent. Signed calendar updates arrive the same way. The phone checks each signature itself, with keys built into the app; it asks no server, and sends nothing about the update or the teacher.
- A plan-error report is shown in full before it leaves: the pack and item IDs, the release, the kind of error, the teacher's note, and a name only if the teacher asks to be credited and types it. The app adds no class, school or pupil data, and the screen asks the teacher not to write pupils' names in the note. The app sends nothing itself: the phone's share menu opens, and the teacher picks the app that sends it to `contact@djazair.dev`. A credited name may appear in the curators' thanks when the error is fixed.
- A problem report from Help is shown in full before it leaves: what happened, where in the app, the app's and Android's versions and the names of the last screens opened. Pupils' names the teacher types are replaced, as the class lists write them, before it is shown; a name spelled another way may remain, which is why the teacher reads it all. Crash reports are off until the teacher turns them on in Help; then a crash keeps only the error's type, where it happened in the code, the names of the last screens and the app's and Android's versions, never the error's message or what the screens showed, and the teacher sees it at the next start. Either report leaves only through the phone's share menu, when the teacher sends it, and the app keeps no copy.
- In reader mode, a director or an inspector opens teachers' progress statements from their QR code or file. The statements are kept on the reader's own devices only, nothing in the school's picture is ranked or coloured for a person, and the spot-check sheet and the subject council's merge keep nothing.
- Opening the public source link requires a separate confirmation. The browser may then connect to GitHub, but the app attaches no record or identifier. Download links in the guides also open GitHub in the browser, separately from the app.
- Feedback is sent by the teacher, not automatically: [Facebook page messages](https://www.facebook.com/djazairdev), [email](mailto:contact@djazair.dev), or GitHub if preferred. These are external services, not app connections. GitHub posts and Facebook comments are public. Never send real pupil data through any route, even privately.

### On a PC

From 0.6.0, the preview also runs on a PC, in the browser, at https://minhajna.djazair.dev.

- Entries stay in that browser, encrypted with a key sealed under a passphrase of at least 12 characters. Nobody can recover a forgotten passphrase, not even the project: the PC must then be erased, and what was kept only there is lost. A browser may clear a site's data when the PC runs short of space, and clearing it by hand deletes it, so keep a backup.
- The app's files come from https://minhajna.djazair.dev, which the project serves through Cloudflare from 0.6.1. Cloudflare sees the PC's IP address and browser at each visit and each update check, under its own policy; the project keeps no access logs. The app loads nothing from anywhere else and sends nothing the teacher records. An update installs only when the teacher accepts it, checked by its checksum.
- Work moves between the phone and the PC only in the encrypted transfer file or backup that the teacher moves; nothing goes through a server. Files leave the PC through the browser's save dialog, or as a download.
- The PC signs progress statements with a key of its own, sealed like the records, so a reader sees it as another key than the phone's.
- Problem and crash reports work as on the phone, without the browser's name or version. Each leaves only when the teacher chooses to share it: through the browser's share menu, or copied for the teacher to paste where it has none.
- «مسح هذا الحاسوب», in Settings or from the lock page when the passphrase is forgotten, erases everything the app keeps in that browser.

### Demo worlds

From 0.7.0, a demo world lets every role, from the Ministry to the teacher, run the national flow with made-up data ([#520](https://github.com/djazairdev/minhajna/issues/520)), on the phone and on a PC.

- A world is entered only by choice. While it is open, the teacher's own records stay shut, and nothing of them reaches the world or the server.
- A world connects only to the project's demo server, https://minhajna-demo.djazair.dev. Outside a world, the phone connects to nothing, and the PC only to its own address. What goes to the server is listed in [NETWORK.md](NETWORK.md#demo-worlds): the world's ID and its pass, its sealed keys and its date, sealed batches, and requests to certify a key the device made for the world. All of it is made up.
- The server erases each world on its 7th day, and its backups within about two days more. It logs no requests, and reads a device's IP address only to limit its requests, in memory. Cloudflare, in front of it, sees the IP address and browser under its own policy.
- Anyone with a world's code can act in any of its roles, so never put real names or real records in a world.

Sync, automatic reporting and national-system services are future features. Each must meet its published launch requirements before opening.

## What the project holds now

| What | Why | Where, and for how long |
|---|---|---|
| What people post on GitHub: issues, pull requests and comments | To build the project in public | On GitHub, which is run from abroad, under its own terms. Everything there is public, so never post personal details or pupil data |
| Posts in the teachers' Facebook group | To hear from teachers | On Facebook, under its own terms. The group's admins remove posts with real pupil data |
| Feedback voluntarily sent to the Facebook page or `contact@djazair.dev`, including the sender's contact details | To answer questions and improve the preview; not to collect pupil records | On the chosen message or email service, under its own terms, with the maintainer handling the reply. Do not send real pupil data. A sender can ask the maintainer to delete the project's copy; the provider's own retention rules also apply |
| No access logs of visits to https://minhajna.djazair.dev | To serve the PC web app | Cloudflare, which serves the address, sees each visitor's IP address and browser under its own policy, and shows the project only aggregate traffic figures in its account |
| Problem and crash reports a teacher sends to `contact@djazair.dev` | To find and fix problems | In the maintainer's e-mail. Kept until the problem is fixed, 12 months at most, and the teacher can have theirs deleted sooner. Pupils' names the app knows are replaced before the teacher sees the report, and a crash report holds no error message ([PRD §1.5](docs/prd/PRD.md#15-pupil-data-and-privacy-rules)) |
| Field-check contacts: a name, and a phone number or an e-mail address, for the teachers and staff who take part ([PRD §10.2](docs/prd/PRD.md#102-the-field-check)) | To run the field check, to ask about each proposal, and to invite members of the teacher council and subject maintainers ([PRD §1.8](docs/prd/PRD.md#18-governance-and-decisions)) | Kept by the lead maintainer only, and never published. Deleted whenever the person asks |

## What it will hold, as each part opens

| What | From | Rules |
|---|---|---|
| Comments sent through the website's form, and how the sender wants to be credited | The form's opening | Used to answer comments on proposals and to take in plans and templates. Answers sum comments up without naming the teacher |
| Pilot contacts | The pilot | Only what the pilot needs. Kept by the lead maintainer, and deleted whenever the person asks |
| Pilot timings | The pilot | In the preview, measured on the device only, the phone or the PC, and shared by hand, as above. Planned for the pilot: off by default; with the teacher's consent, four figures go once a month: seconds per session, the share confirmed in one tap, minutes a week and whether the term export was done. No identifier, date or class goes with them ([PRD §10.3](docs/prd/PRD.md#103-how-success-is-measured)) |
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

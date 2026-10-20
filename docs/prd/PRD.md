# Minhajna: Product Requirements Document

*Minhajna (منهاجنا) is the product's name, chosen on 4 Oct 2026 in decision 0019. Until then it was called Tabachir (طباشير). Repository: [github.com/djazairdev/minhajna](https://github.com/djazairdev/minhajna), since 10 Oct 2026 (decision 0020). Started 26 Sep 2026.*

This PRD is written one section at a time, and we settle each section before starting the next. Each section records decisions and ends with a list of what is still open.

The evidence is in the project's research brief, cited as "brief §n", and in the research files it summarises. The brief stays private because it quotes teachers and names other developers (§1.4). Its conclusions will be published.

| § | Section | Status |
|---|---|---|
| 1 | [Open-source strategy and governing guidelines](#1-open-source-strategy-and-governing-guidelines) | Settled on 27 Sep 2026. Changes accepted on 4 Oct 2026 (decisions 0015, 0016, 0017, 0018 and 0019) and 10 Oct 2026 (decision 0020) |
| 2 | [Goal, users and scope](#2-goal-users-and-scope) | Settled on 27 Sep 2026. Changes accepted on 4 Oct 2026 (decisions 0015 and 0017) |
| 3 | [The teacher app](#3-the-teacher-app) | Settled on 27 Sep 2026. Changes accepted on 4 Oct 2026 (decisions 0015 and 0017). Points clarified on 5 Oct 2026 |
| 4 | [The lesson engine and plan packs](#4-the-lesson-engine-and-plan-packs) | Settled on 27 Sep 2026. Changes accepted on 4 Oct 2026 (decision 0015). Points clarified on 5 Oct 2026 |
| 5 | [Data, formats and foundations](#5-data-formats-and-foundations) | Settled on 27 Sep 2026. Redesign accepted on 4 Oct 2026 (decisions 0015 and 0017). Points clarified on 5 Oct 2026 |
| 6 | [Privacy, security and non-functional requirements](#6-privacy-security-and-non-functional-requirements) | Settled on 27 Sep 2026. Redesign accepted on 4 Oct 2026 (decision 0015). Points clarified on 5 Oct 2026 |
| 7 | [The school layer and institution mode](#7-the-school-layer-and-institution-mode) | Settled on 27 Sep 2026. Changes accepted on 4 Oct 2026 (decisions 0015 and 0017). Points clarified on 5 Oct 2026 |
| 8 | [The state layer](#8-the-state-layer) | Settled on 27 Sep 2026. Changes accepted on 4 Oct 2026 (decisions 0015, 0016 and 0017). Points clarified on 5 Oct 2026 |
| 9 | [Funding and sustainability](#9-funding-and-sustainability) | Settled on 27 Sep 2026. Rewrite accepted on 4 Oct 2026 (decisions 0015 and 0016) |
| 10 | [Roadmap, metrics and risks](#10-roadmap-metrics-and-risks) | Settled on 27 Sep 2026. Changes accepted on 4 Oct 2026 (decisions 0015, 0016 and 0017). Points clarified on 5 Oct 2026 |

## The decisions that changed this PRD

Six decisions changed this PRD after its sections were settled: 0015 to 0019, accepted on 4 Oct 2026, and 0020, accepted on 10 Oct 2026. Each section's note names the ones it carries out, and its decisions table gives their choices.

- **The decisions tables show which rows they changed.** A row decided earlier that one of them changed is marked "(changed by 00NN)", and a row that works out one of them in detail is marked "(takes effect with 00NN)". A row that one of them only adds to is not marked. The marks stay as history.
- **The new name is used throughout,** decided rows included, except in the two rows that 0019 changed: the name and the code host in §1.17. The same goes for the repository's address and 0020.
- **Dates in the text,** such as "(29 Sep)", say when a choice was made. The tables say when it was decided.
- **Two decided rows change steps that earlier records planned,** both in §1.17: `CHARTER.md` is in English, where 0010 planned Arabic and English, and the name is not registered, where 0004, 0007 and 0008 planned to register it. The rows name those records.

| Decision | What it changes | Carried out in |
|---|---|---|
| [0015](../decisions/0015-national-system-protections-by-design.md): the national system, with protections built into its design | Replaces record 0012, and the sync price in record 0014. Changes part of record 0010: institution mode becomes one national system run by the Ministry, the project only publishes the software, and the charter is asked of the Ministry rather than bound into an agreement | §1 to §10 |
| [0016](../decisions/0016-non-commercial.md): a project that sells nothing | Replaces record 0006, and what 0015 left of record 0014. Principle 4 becomes "Free, and never for sale". After adoption, a change to the principles or the charter needs the teacher council's consent | §1, §8, §9 and §10 |
| [0017](../decisions/0017-exam-scope-at-each-level.md): exam scope at each exam's own level | Charter point 7, which said aggregates are never used for exam thresholds: how far classes got may inform an exam's scope at the level that sets it, under three safeguards. Personnel use stays banned, and the opt-in insights keep their ban | §1, §2, §3, §5, §7, §8 and §10 |
| [0018](../decisions/0018-charter-purpose-and-figures.md): charter point 1 and figures above the school | Charter point 1 gains a sentence: "Above the school, figures drawn from them serve only what point 7 allows." The rest of the point is unchanged | §1 |
| [0019](../decisions/0019-name-minhajna.md): the name Minhajna | Replaces record 0007: the product is called Minhajna (منهاجنا) rather than Tabachir, and the naming rule is loosened. Changes part of record 0005: the repository's name | §1.9 and §1.17, and the name throughout |
| [0020](../decisions/0020-code-host-djazairdev.md): the djazairdev organisation | Changes part of records 0005 and 0019: the repository is `djazairdev/minhajna`. Nothing else changes | §1.17 |

---

## 1. Open-source strategy and governing guidelines

*Changes proposed on 29 and 30 Sep 2026 in decisions 0015, 0016, 0017 and 0018, for the project's goal: national adoption, with the Ministry running Minhajna on government servers, nothing sold, and exam scope set at each exam's own level. Decision 0019 renamed the product Minhajna. All five were accepted on 4 Oct 2026. The founder's choices of 29 Sep 2026 are marked "(29 Sep)".*

The whole system is open source from its first line of code: the apps, the servers, the tools and the documents. This section sets the rules that govern the project:
- what is open, and under which licence;
- what stays private, and why;
- how pupils' data is protected in public;
- how people contribute and how decisions are made;
- how the project is funded without selling anything;
- how the Ministry runs it as one national system, and the charter that protects teachers;
- why it serves Algeria first, and how other countries can use it later.

The project's goal is for the Algerian state to adopt Minhajna as the official digital record of teaching (principle 6), with the Ministry running it on government servers (29 Sep).

Every later section of this PRD must comply with this one. When a feature conflicts with a principle in §1.2, the feature changes, not the principle.

### 1.1 Why open source

- **Proof instead of promises.** Anyone can have the code checked: a teacher, a director, an inspector or the ANPDP. It shows three things:
  - pupils' data never reaches the project;
  - there are no ads or trackers;
  - marks stay as confidential as circular 465 §3.5 requires.

  By contrast, at least one paid rival stores teachers' data on servers abroad (brief §10).
- **The tool outlives its maker.** This year one developer's whole Google Play account vanished, and its teacher apps went with it (research 04). With open code and an open file format, teachers are never stranded.
- **State-ready by construction, because state adoption is the goal.** The Ministry can audit the code, run it on government servers as one national system (§5.2), or reuse parts of it in the digital دفتر النصوص on its July 2025 roadmap (brief §9). It needs nothing from the project to do so, and there is nothing to buy: the project sells nothing (§1.10).
- **A community for the yearly data.** Timetables, plans and print templates change every September (brief §8). Teachers already share them on blogs and in groups; the open data repository gives that sharing a home.

Open source earns trust, but it does not bring installs by itself. Teachers find their tools through content sites, Facebook groups, YouTube and staffrooms (brief §12). So the project builds in public in those places, in Arabic (§1.11), with the open code as the proof behind it.

### 1.2 Principles

These eight principles override everything else in this PRD.

1. **Open by default.** Every part of the system is public from its first line: code, documents, decisions and roadmap. Only the items listed in §1.4 stay private, each for a stated reason.
2. **Pupil data never reaches the project.** Pupils' names, marks and absences live on the teacher's devices, or, in institution mode, on the institution's own systems (§1.15). Sync and backup are end-to-end encrypted, so the project cannot read them. No pupil data goes to any third party, SDK or AI service (brief §10).
3. **No ads, no trackers, and no sale or sharing of data. Ever.**
4. **Free, and never for sale.** Everything Minhajna does is free, for teachers and for the state. The project sells nothing: no features, services, support or data. Until the Ministry adopts Minhajna, it is funded by public grants and prizes, teachers' donations and sponsors who get no access to data. After adoption, the Ministry maintains Minhajna with its own staff, in the project's public process (§1.10).
5. **Open code is not open data.** The code is public and teachers' records are private. Figures leave a teacher's device only in two ways:
   - through the opt-in insights in §1.6;
   - in institution mode (§1.15), where a school or an education authority is the controller.

   Above the school, only aggregates that meet the minimum group sizes are shown or published.
6. **Built to become the official record, never by default.** The goal is for the state to adopt Minhajna as the official digital record of teaching. Until a competent authority adopts it in writing, as controller, Minhajna is a teacher's tool:
   - it prepares and prints what the school and the state's platforms ask for;
   - it never claims official status on its own;
   - it never works around a protection in an official file. For example, it fills only the unlocked cells of the school's grade workbook (brief §9, §11).
7. **Teachers own their working records.**
   - A teacher can export everything, for free, in an open and documented format, at any time.
   - Records that an institution requires, as controller, belong to that institution. The teacher still keeps a full copy of their own lesson records and sees every access to them.
   - Private notes never leave the teacher's devices.

   No agreement can override these principles, whoever it is with: the Ministry, a directorate, a school, a sponsor or a funder.
8. **Build in public, in Arabic first.** Plans, decisions, progress and money are public. Teachers hear about them where they already are.

**Changing a principle** needs a public proposal, at least 30 days of comments and a recorded decision (§1.8). After adoption, it also needs the teacher council's consent (§1.8, 30 Sep). Principles 2 and 3 are permanent.

### 1.3 Licences

| What | Licence | Notes |
|---|---|---|
| Code: the apps (phone, PC or web), the servers (sync, insights, observatory), build and data tools | **AGPL-3.0-or-later** | "Or later" lets the project adopt a future version of the same licence without asking every contributor |
| The apps' interface texts, in every language | **AGPL-3.0-or-later** | Part of the program, so translators sign off like code (15 Oct, decision 0022) |
| Documents: this PRD, design documents, decision records, the file-format specification, print layouts, and their translations | CC BY-SA 4.0 | |
| Content teachers make for the data repository: plans, distributions, templates, corrections | CC BY-SA 4.0 | Each item records its source and its contributor |
| Official texts and plans | Not relicensed | Included only when counsel clears them, otherwise linked. Ord. 03-05 Art. 11 excludes regulations from copyright; the national inspectorate's (IGP) plans are unclear (brief §8) |
| Fonts | SIL OFL 1.1 | Amiri, Noto Naskh Arabic, Noto Sans Arabic (brief §11) |
| Name and logo | Not licensed | The name policy (§1.9) |

- **Why AGPL.** Anyone who distributes a modified app, or runs a modified server for others, must offer the changed source to its users. A permissive licence would let a rival close the code and add ads. The Ministry can still use, host and change the code freely. If it runs a changed version for teachers, it must offer them the changed source.
- **Copyright.** Each contributor keeps the copyright in their contribution. Until a legal entity exists, the founder holds the copyright in their own work and owns the name and logo. Both move to the entity when it is created.
- **Contributor terms: the DCO.** Every code commit carries a "Signed-off-by" line under the [Developer Certificate of Origin 1.1](https://developercertificate.org/). With it, the contributor certifies that they have the right to submit the work under the project's licence.
  - There is no CLA, so nobody can relicense others' contributions without their consent, the founder included.
  - A GitHub no-reply email address is fine in the sign-off.
- **Licence hygiene.**
  - Every file carries an SPDX licence identifier, and the repositories follow the [REUSE specification](https://reuse.software/), so a machine can check the licence of every file.
  - Dependencies must use licences compatible with AGPL-3.0.
  - The apps use no proprietary libraries (for example Google Play Services or Firebase), so anyone, F-Droid included, can build them from source.

### 1.4 What is open and what stays private

**Open from the start:**
- the source code;
- build and release scripts;
- server configuration, without secrets;
- the file-format specification and print layouts;
- the data repository;
- this PRD and the decision records;
- the roadmap, the changelog and the transparency reports.

**Private, each for a stated reason:**

| Item | Why | Rule |
|---|---|---|
| Signing keys, server passwords, tokens | Whoever holds them can impersonate the project | Held by named maintainers, with an offline backup. Never in a repository. Secret scanning runs on every change |
| Security reports, until fixed | Publishing first would expose teachers | Sent to a private reporting address. A public advisory follows the fix (§1.9) |
| Raw insight submissions | Could single out a teacher | Only groups above the minimum size are published (§1.6) |
| What the project holds about teachers: sync accounts, pack-editor accounts, problem reports, pilot contacts, support messages and donors' details | Personal data under Loi 18-07, for which the project is the controller | Kept to the minimum, hosted in Algeria and stored apart from everything else. Covered by the project's own ANPDP declaration (brief §10) |
| The raw research: verbatim quotes with links, the competitor dossier | The privacy and copyright of the people quoted. It also names small Algerian developers alongside their install counts | Publish the conclusions only, scrubbed |
| Pupil data | — | Never reaches the project (principle 2) |
| The records of the national system | The Ministry is their controller (§1.15) | Held on the Ministry's servers, encrypted so that only the teacher and their school can read them, and a granted inspector only the lesson records a grant names (§5.4). The project holds none of them |

### 1.5 Pupil data and privacy rules

**In the product**
- **Nothing leaves the device by default.** In teacher mode, pupil data leaves the device only inside the end-to-end encrypted sync or backup, and only if the teacher turns it on.
  - **In the national system,** the school's copy of the teacher's pupil records is kept in the school's space, encrypted so that only the teacher and the school can read it. Marks, and absences where the school chooses, go to the state's systems, encrypted for them alone (§5.4, §5.9).
  - The app never needs a server, the project's or the Ministry's, to open or to do the daily work.
  - The storage rules in brief §10 apply: no OS cloud backup of pupil data, an encrypted database, and an app lock.
- **No third-party SDKs that send data.** No analytics, advertising, crash-reporting or AI SDKs.
- **A public network inventory.** `NETWORK.md` lists every address the app can contact, what it sends and why. A change that adds or widens a network call is a *privacy-sensitive change* (§1.7).
- **Crash reports are off by default.** The teacher sees each report before it is sent. Names and marks are removed, and the report goes to the server in Algeria that the teacher uses: the project's, or the Ministry's in the national system.
- **AI follows the same rules.** If the product ever uses AI, no pupil data goes to an AI service abroad. The model, the prompts and where it runs are public.

**In the project's public spaces** (the code host, the website, the teacher group, videos and support chats)
- **No real pupil data, ever.** That covers issues, pull requests, screenshots, videos, forum and Facebook posts, support messages and test data. Two reasons:
  - civil-service secrecy covers pupils' marks and attendance (Ord. 06-03 Art. 48);
  - ANPDP deliberation 04 treats publishing through a foreign-run platform, such as GitHub, Facebook or WhatsApp, as a transfer abroad (brief §10).
- **A demo class.** The app ships a demo class of made-up pupils for screenshots, tutorials and reproducing bugs. Tests use made-up data only.
- **Safe bug reports.** A "report a problem" button builds a report with pupils' names replaced, and shows it to the teacher before sending. Support always asks for this report or the demo class, never a real screenshot.
- **Moderators remove leaks.** When they see a post containing real pupil data, they remove it and tell its author privately why.
- **No images of pupils or staff** in any project channel (circular 460 Art. 44; Loi 15-12 Art. 140).

### 1.6 Anonymous insights: rules for openness

The insights layer is opt-in and shares lesson-level data only. A later section designs it; the rules below bind that design. It runs in teacher mode from 2027/28, and is retired once the national system's totals exist (§5.10, §8.4, 29 Sep).

- **Publish before collecting.** The insights server's code, the exact payload and the aggregation method are public at least one month before collection starts.
- **The teacher is in control.**
  - It is off by default, and the teacher can turn it off at any time.
  - Before the teacher opts in, the app shows the exact payload. Afterwards it keeps a log of everything sent.
- **What it may contain.** Lesson-level data only: what was taught, never when, and never why a session was not held. It never contains:
  - pupil data;
  - anything that identifies a teacher;
  - data from institution mode.
- **How it is grouped.** By level, subject and wilaya.
  - Minimum group sizes count teachers and schools, not only pupils. A group below the minimum is never shown.
  - Cells that would let a hidden figure be worked out by subtraction are hidden too.
  - §8.4 sets the numbers.
- **What the figures may be used for.** The published method states that the figures describe the curriculum plan, not classes or teachers. They are never used:
  - to set the scope of exams ("thresholds"). Only the national system's figures may inform exam scope, under charter point 7 (§1.15);
  - to rank anyone;
  - for personnel decisions.
- **Hosted in Algeria.**
- **Protection without secrecy.** The code is public, so protection against fake or flooded submissions comes from rate limits, outlier filtering and the minimum group size.
- **Who sees what.**
  - Each teacher sees how their class compares with their peers.
  - The IGP receives each report first and has 30 days to comment. Publication then follows the published method.
  - Public figures stay coarse and follow a method published in advance.
- **A legal check before the first collection.** Counsel confirms that teachers may send lesson-level data to the insights service without written authorisation (Ord. 06-03 Art. 48).

### 1.7 Contributions

**Paths**
- **Teachers, no Git needed.** They send suggestions, bug reports, plan corrections, templates and translations through a simple form on the website or through the teacher group.
  - The form states the licence (CC BY-SA 4.0) and asks how the teacher wants to be credited.
  - A data curator turns each submission into a change. The curator signs it off, relying on the licence the teacher accepted in the form.
- **Developers** open pull requests on GitHub following `CONTRIBUTING.md`, with every commit signed off.

**Review**
- **Every change.** A maintainer other than the author reviews it, from the day the project has two maintainers.
- **Privacy-sensitive changes** need two maintainers' approval and a plain-Arabic line in the release notes. While there is only one maintainer, a public notice goes out at least a week before the release instead. A change is privacy-sensitive if it touches:
  - network calls;
  - encryption;
  - sync;
  - insights;
  - the export of marks;
  - anything that reads or writes the school's official files.
- **Data contributions.**
  - Each one cites its source: an official text, an inspector's distribution, or the contributor's own work.
  - Each one states the level, subject and school year it applies to.
  - A curator checks it against its source.
- **AI-assisted contributions** are welcome. The contributor answers for them like any other work: they reviewed and tested it, and they have the right to submit it. The DCO covers this.

**Credit and language**
- **Credit.** Contributors are credited in the release notes and on a contributors screen in the app. Only those who agree are listed, under the name they choose.
- **Language.**
  - Spaces for teachers are in Arabic.
  - Code, commits and developer documents are in English, with Arabic summaries of anything teachers need to know.
  - Templates for French and English teachers are in their language.

### 1.8 Governance and decisions

- **Until launch in September 2027, the founder leads.** The founder is the lead maintainer and decides, in public, after hearing contributors.
- **From launch, the lead maintainer still decides** (3 Oct), in public, after hearing contributors and the teacher council, and invites new maintainers in public (`GOVERNANCE.md`).
- **Roles:**
  - lead maintainer;
  - maintainers, who can merge changes;
  - data curators, for the data repository;
  - community moderators, for the teachers' spaces;
  - security contacts.
- **Decision records.** Any decision about a principle, a licence, a data flow, the insights layer, money or a partnership gets a short public record in `docs/decisions/`: context, options, decision, date.
  - **Teachers hear about each proposal where they are** (30 Sep, principle 8). An Arabic summary goes on the website and in the teachers' Facebook group, with the website's form for comments, and the field-check teachers are asked directly. Every comment gets an answer in the record. The summaries live outside the repositories, which stay in English.
- **The teacher council, from launch.**
  - **Members:** practising teachers from several levels and wilayas, starting with the field-check group, plus a director and an inspector where possible.
  - **Role:** it advises on the roadmap, the data repository and the print layouts. Its notes are public.
  - **Overrides:** when the lead maintainer goes against its advice, the decision record says why.
  - **Consent after adoption** (30 Sep). Once the Ministry's staff are maintainers, a change to the principles or the charter passes only with the council's consent, after its 30 days of comments. The Ministry's maintainers can propose a change, but never decide one alone. The council consents when more than half of all its members vote for the change, in public (3 Oct). Without that vote, the change fails (`GOVERNANCE.md`).
- **Partnerships in the open.** Every agreement with the Ministry, a directorate, a school, a sponsor or a funder is announced, with its parties, scope and money. It is also listed in the transparency report.
  - Every agreement includes a clause allowing it to be published (Ord. 21-09 Art. 8).
  - An agreement that would break a principle is refused.
  - In the national system, the Ministry runs Minhajna itself, and the project is only the publisher of the software, never the controller (§1.15). Before adoption, the project runs no deployment for a school or an authority (29 Sep).
- **The state may adopt, host or fork the project** under its licence. The project publishes the deployment guide, the administration manual and the training material, free, so the state can do the work itself. It sells the state nothing (§1.10).
- **After adoption, the Ministry's own staff maintain Minhajna** (29 Sep). They join the project's public process as maintainers, so releases, the principles and the charter are still decided in public, the last two only with the teacher council's consent (§5.2, 30 Sep).
- **Accounts.** The code lives in a GitHub organisation, not a personal account, so it can be handed over without breaking links. Every maintainer uses two-factor authentication.

### 1.9 Official builds, releases, the name and security

- **Built only from the public source.** Official builds contain nothing that is not in the public repositories.
- **Official sources.** Google Play, the project's `.dz` website (Android APK, PC or web) and F-Droid. The website and the README say that no other source is official.
- **The Ministry's app** (29 Sep). In the national system, the Ministry's app is the project's release, with the Ministry's name and icon as settings. It is built reproducibly, so anyone can check it against the published code, and the project publishes its checksums with each release. The project's own app can always connect to the national system too (§5.2).
  - **A build that weakens the charter is made public at once** (30 Sep). If a check finds that the Ministry's build differs from the published code in a way that weakens the charter, such as a key the Ministry holds, the project publishes the finding at once and sends it to the Ministry. Teachers can then use the project's own app.
- **Signed releases.**
  - Every release is signed.
  - The fingerprint of the signing key and the checksums of each release are published on the website and in the README.
  - The goal is reproducible builds, so that anyone, F-Droid included, can check that a build matches the source.
- **The release calendar follows the school year.** In the two weeks before each term-end export window, only fixes ship. The windows fall around mid-December, March and May (brief §14).
- **Changelog.** Every release has notes written for teachers. `CHANGELOG.md` is in English (29 Sep). Teachers read the notes in Arabic in the app and in the teacher group.
- **The name: Minhajna (منهاجنا)** (4 Oct, decision 0019). Until then it was Tabachir (طباشير).
  - **Meaning.** "Our curriculum": the app follows the official curriculum, through the yearly plan, down to each lesson.
  - **Spelling.** Always "Minhajna" in Latin letters, never "Minhadjna" or "Manhajna". The Arabic form is منهاجنا. In Arabic sentences it is written «منهاجنا», so that it reads as the app's name rather than as "our curriculum".
  - **The line under the name.** «من المخطط السنوي إلى درس اليوم», in English "From the yearly plan to every lesson". It replaced «من التدرّج إلى الحصّة» on 20 October 2026.
  - **Store listings.** The words teachers search for go after the name, never in the name itself, for example "Minhajna: الكراس اليومي ودفتر المناداة والتنقيط" or "Minhajna: the teacher's class logbook".
  - **Not the state's app by its name.** Neither the name nor the app suggests that it comes from the Ministry. It becomes the official record only through a competent authority's written decision (principle 6).
  - **Not registered** (29 Sep). The name and logo are not registered as trademarks. They are protected only by use, by the official sources above and by the published checksums.
  - **Forks.** The name policy (`TRADEMARKS.md`) lets anyone fork, but under another name and logo, and without suggesting that the fork is the project's app. The Ministry's deployment runs under its own name (§5.2).
  - **Official builds.** Unmodified official builds may be shared as they are.
- **Naming rule**, for the product and for anything the project later names. Decision 0019 loosened it on 4 Oct. Since the name is not registered, a name no longer has to be distinctive. Since the project's repositories live under `djazairdev` (decision 0020), it is no longer checked on GitHub. The echo rules now cover only exact official names and the apps that teachers use in Algeria.
  - **Easy to say.** It must be easy to say in Algerian Arabic, French and English, with one fixed Latin spelling.
  - **No official name.** Never the exact name of an official document (دفتر النصوص, كراس القسم, سجل المناداة, المنهاج), a state body or a state platform (ostad, amatti, awlyaa, mowadaf, the "ديوان" offices, Morocco's Massar). A word they share, such as منهاج, is allowed.
  - **No echo of the apps that teachers use in Algeria.**
  - **Neutral.** No religious or political words. No translation of a well-known mark (Ord. 03-06, Art. 7 point 8).
  - **Fits every teacher**, whatever the number of classes or the level.
  - **Available** on Google Play, the `.dz` registry and Facebook, checked before adoption.
- **Security.**
  - `SECURITY.md` gives a private reporting address. Reports are acknowledged within three working days. After the fix, a public advisory credits the reporter.
  - Secrets never enter a repository, and scanning checks every change.
  - Dependencies are watched for known vulnerabilities.
  - The encryption design is published for review before sync launches.

### 1.10 Money

**Why nothing is sold** (29 Sep). The goal is a Ministry that runs Minhajna without the project. Selling services to schools and authorities would make the project the state's supplier, with a stake in the Ministry depending on it. And teachers fear that a free tool will start charging once their records are in it (research 04, 05).

- **Teachers never pay.** Every feature is free, and so are sync, backup and every export. Donations are voluntary and unlock nothing.
- **Nobody else pays the project either.** It takes no payment from the Ministry, directorates or schools, for Minhajna or for help with it. The deployment guide, the administration manual and the training material are published free, so the Ministry can do the work itself.
- **Funding until adoption:**
  - public grants and prizes that are open to any project, such as INRE's Tarbya-Up Challenge;
  - teachers' donations, once the association exists, through channels approved in Algeria (brief §12);
  - sponsors who get no access to data.

  Every source is disclosed, and every income and cost appears in the transparency report (§1.11).
- **No money from abroad** (30 Sep). No foreign grants, prizes, funds or sponsors, and donations only through channels approved in Algeria. Algerian law restricts foreign funding for associations, and the Ministry must be able to trust that no foreign funder has a hold on the project. Counsel confirms the rules (§10.2).
- **Sponsors** get no data, no say in the roadmap and no place in the app. They are thanked on the website and in the transparency report.
  - The project refuses sponsors that sell to schools, teachers, pupils or parents, such as publishers, tutoring firms, EdTech firms and private schools, and any party, union or religious body (30 Sep).
  - No sponsor gives more than a quarter of the project's income in any year.
- **After adoption, the Ministry maintains Minhajna** with its own staff, who join the project's public process as maintainers (§1.8).
- **Never:**
  - ads or trackers;
  - selling or sharing data;
  - paid features;
  - charging anyone to get their own data out.
- **No promise beyond the principles.** The charter carries no "free forever" promise, and there is no committed support channel. Volunteers give support as they can.

### 1.11 Community, transparency and building in public

- **Where people meet.**
  - **Teachers:** a Facebook group, plus the form on the website.
  - **Developers:** GitHub issues and discussions.
  - **One-to-one support:** under the rules in §1.5.
- **Building in public.**
  - A public roadmap in Arabic, updated monthly.
  - An Arabic summary of every proposed decision, with the form for comments (§1.8).
  - A monthly progress post or short video in the teacher group.
  - A public beta group.
  - A reply to every store review.
- **Transparency report every September, from launch.** It covers:
  - the pupil data held (none, and why);
  - what the project holds about teachers;
  - how many teachers have opted in to insights;
  - every request for data from any authority, and the answer, where the law allows;
  - security incidents;
  - money in and out, by source;
  - partnerships and sponsors.
- **Code of conduct** (`CODE_OF_CONDUCT.md`, adapted from the Contributor Covenant, in English, 29 Sep). The README summarises it in Arabic.
  - Respect; no harassment or personal attacks.
  - Project spaces stay about the product: no political or union campaigning, and no attacks on named people, whether officials, colleagues, pupils or parents.
- **Neutrality.** The project takes no side in disputes between teachers and the administration. It follows the official texts and cites them.
  - No feature detects, counts or reports collective action.
  - Whether sessions are recorded or still awaiting confirmation never leaves the school. In the national system, only the school key opens it (§6.5).

### 1.12 Continuity pledge

- **Open format, free export.** The file format is documented and public, and teachers can export all their records, for free, at any time.
- **If the project stops or its legal entity closes:**
  - the code, the data repository and the documents stay public as archives;
  - the last release keeps working offline, because the daily work never depended on the project's servers;
  - the sync service gives at least six months' notice, runs until after that school year's last term export, and provides a full export for every teacher. The same applies when the project's server closes after the Ministry's system opens (§5.2);
  - the name and the repositories pass to a successor that keeps these principles, or are archived.

### 1.13 Opening in stages

| Stage | When | What becomes public | Contributions accepted |
|---|---|---|---|
| 1. From the first line | Now to December 2026 (field check) | The repository, the licences, an Arabic and English README, this PRD, the decision records, and the charter, governance, conduct, privacy and name-policy files (3 Oct). The research only after scrubbing (§1.4) | Feedback, plans, templates, translations and code. Code is open to all since 13 Oct 2026 (0021) |
| 2. Pilot | January–March 2027 | A public beta group and the changelog | The same |
| 3. Launch | September 2027 | The teacher council, the F-Droid listing and the first transparency report | The same |
| 4. Insights | 2027/28 | The insights code, payload and method, at least one month before collection | Comments on the method |

### 1.14 Algeria first, flexible for other countries

Minhajna is built for Algerian teachers first. It is also built so that teachers in other countries can use it later. A new country adds its own data instead of rewriting the code, and no principle is weakened.

**Algeria first**
- **Only Algeria until the end of the 2027/28 school year**, the first full year after launch. Until then, the project builds, tests and supports the product for Algerian teachers only, covering:
  - Algerian curricula and the Algerian calendar;
  - the official documents;
  - Algerian law and payment channels.
- **Algeria wins any conflict.** A change that would help another country but cost Algerian teachers time, simplicity or protection is refused.
- **Interest from other countries is welcome and noted.** Before the end of 2027/28, though, the project builds no edition for another country.
- **After that, another country is an option, not a promise.** It is decided in public, with a decision record (§1.8). The decision rests on two things:
  - teachers' demand in that country;
  - local people ready to maintain that country's data.

**Flexible by design**

This is the only work done for other countries before then.
- **Country specifics are data, not code.** The core code must not hard-code an Algerian rule. The following live in the data repository, grouped by country code (`dz` for Algeria):
  - curricula and plans;
  - the school calendar and bell times;
  - levels and subjects;
  - assessment rules;
  - the layouts of official documents.
- **Language and dates.**
  - Every interface text can be translated, and layouts work both right to left and left to right. Arabic comes first (principle 8).
  - The working week, the weekend, and the Hijri and Gregorian calendars are settings, not assumptions.
- **Exports to official files are separate modules,** so another country's official files can be added without touching the core.
- **Servers can run in any country.** Sync, backup and insights can be hosted wherever a country's law requires.
- **Flexible, not generic.** Flexibility must never delay Algeria. When a general design would, the project builds for Algeria and records what another country would need.

**How another country can use Minhajna**
- **A fork, at any time.** The licences let anyone adapt Minhajna for their country, under another name and logo (§1.9).
- **An official country edition** needs:
  - that country's data, with named data curators there;
  - a check of that country's data-protection and education law;
  - hosting and payment channels allowed there;
  - people who can support its teachers in their language;
  - a decision record (§1.8).
- **The principles travel unchanged.** Every principle in §1.2 applies in every country.
  - Section 1 names Algerian laws, bodies, hosting and payment channels, such as Loi 18-07, the ANPDP, the IGP and hosting in Algeria.
  - An edition applies its own country's equivalents, and never a weaker protection.
- **Each country stays separate:** its data, its insights and its servers.
- **The name.** Only an official edition may use the Minhajna name in another country.

### 1.15 Institution mode

Institution mode is how an education authority uses Minhajna as an institution, not only through its teachers' own apps. It is the road to the goal in principle 6.

- **It has one form: the national system** (29 Sep). The Ministry runs Minhajna on government servers, as one national system with a space for each directorate and each school (§5.2).
- **Until the Ministry's system opens, Minhajna runs in teacher mode only** (29 Sep). Before then, the project runs no deployment for a school or an authority, and seeks no official acceptance of printed pages.
- **The design protects teachers** (29 Sep). No legal text is required before the Ministry hosts Minhajna, so the protections are built into what the servers can read and compute (§5.1, §6.5).

**Who is responsible**
- **The Ministry is the controller** of the records it requires, and runs the servers. The project is only the publisher of the software. It holds none of the records and runs none of the servers.
- **The roles within the Ministry.** Counsel confirms how the Ministry, its directorates and its schools share the controller's role.
- **Students and parents** (29 Sep). Minhajna builds no features for them. Parents see marks, and absences where the school chooses, in the state's awlyaa space (§5.9). Pupil data still never reaches the project (principle 2).

**What the national system needs before the mandate starts**

These are the Ministry's to meet (§6.2, §7.12). The project asks for them, and builds the system so that its protections hold even where one is missing.
- the ministerial text that makes the record official (below);
- the Ministry's declaration to the ANPDP, an impact assessment where the law requires one, and a data-protection officer;
- notice to the teachers concerned (Loi 18-07 Art. 32);
- consultation of the staff technical committees and the representative unions before the rollout, with the results published (29 Sep), and every objection answered in public before the mandate starts: by the project on the software, and by the Ministry on the mandate (30 Sep);
- the charter presented to every school's teachers' council (29 Sep);
- the launch gate: a load test at national scale, a trial term end, the independent security review and a full restore from backup (§6.8).

**The path to official status**
- **Now: a teacher's tool.** Minhajna prepares and prints what the school and the state's platforms ask for, and nothing it makes is official.
- **The first ask** (29 Sep): a ministerial text that makes the full digital record official, and compulsory from the national launch. It covers the texts book, the journal, roll call and marks (§5.1, §5.5). The ask includes the charter's protections, with the three safeguards on exam scope (point 7), as a request, not a condition.
- **The national launch.** The mandate starts only once the national system has passed the launch gate (§6.8). Its date is set once the Ministry adopts Minhajna (29 Sep).
- **Once a record is official,** the weekly signed record is the official record, with signed exports and a history that cannot be altered (§5.5).

**The data-use charter**

The charter is:
- published as `CHARTER.md`, in English (29 Sep). The README summarises it in Arabic;
- asked for in the Ministry's text, but not required (29 Sep);
- presented to every school's teachers' council before the national launch (29 Sep);
- built into the design wherever the design can enforce it (§5, §6);
- changed only through the process for changing a principle (§1.2).

It has ten points:
1. **Purpose.** The records serve three things: the teacher's planning, the teaching council's coordination, and the checks the official texts give directors and inspectors. Above the school, figures drawn from them serve only what point 7 allows. Nothing else.
2. **No personnel use.** Entries never feed pay, promotion, appraisal, bonuses, discipline or transfers. No rankings, and no colour-coded lists of teachers.
3. **No surveillance.**
   - No clock times, no "started" events, no location.
   - A missing or late entry, or a session awaiting confirmation, is never an absence.
   - It never triggers an alert or a sanction, and it never leaves the school.
4. **Corrections, not locks.** A teacher can always correct an entry, and the history keeps both versions.
5. **Symmetry.**
   - Teachers see everything their director sees about their classes.
   - Teachers see every access to their records.
   - The authority grants inspectors' access. It is limited in time and visible to the teacher.
6. **Private stays private.** Private notes never leave the teacher's devices.
7. **Aggregates only above the school.** Minimum sizes and methods are published in advance. Aggregates are never used for personnel decisions.
   - How far classes got may inform the scope of an exam only at the level that sets it: a school's own records for its term and mock exams, a directorate's totals for its exams, and wilaya and national totals for national exams.
   - The figures are taken on a date announced at the start of the school year. It moves only if the exam does, and is then announced again at least two weeks ahead. The figures are checked against the inspectors' sample of pupils' exercise books, or marked unchecked in a year without one, and are published with how they were used once the exam is over.
8. **Quiet hours.** No notifications at night or at weekends.
9. **No personal phone required.** Paper and shared-computer routes remain.
10. **Consultation and transparency.** The charter goes to the teachers' council before a deployment starts. The transparency report lists every request an authority makes for data, where the law allows.

### 1.16 Files that put these rules into the repositories

| File | Holds |
|---|---|
| `LICENSE`, `LICENSES/` | Licence texts (REUSE) |
| `README` (Arabic and English) | What the project is, the official download sources, the signing-key fingerprint |
| `CONTRIBUTING.md` | Ways to contribute, the DCO sign-off, review rules, rules on data sources |
| `CODE_OF_CONDUCT.md` | Conduct rules, in English. The README summarises them in Arabic |
| `GOVERNANCE.md` | Roles, how decisions are made, how principles change, the teacher council |
| `SECURITY.md` | Private reporting, response times |
| `TRADEMARKS.md` | The name policy: what forks may and may not do with the name and logo |
| `PRIVACY.md` | What the project holds about teachers and why, and what it never holds |
| `CHARTER.md` | The data-use charter (§1.15), in English. The README summarises it in Arabic |
| `NETWORK.md` | Every address the app contacts, what it sends and why |
| `docs/decisions/` | Decision records |
| `CHANGELOG.md` | Release notes, in English. Teachers read them in Arabic in the app (§1.9) |
| `transparency/` | The yearly reports |

The code and the reference data live in separate repositories, because they have different licences, contributors and review rules.

### 1.17 Decisions and open points

**Decided on 26 and 27 Sep 2026**

| Decision | Choice |
|---|---|
| Scope | The whole system is open source, from the first line of code |
| Code licence | AGPL-3.0-or-later |
| Contributor terms | DCO; no CLA and no relicensing |
| Copyright and trademark | Held by the founder until a legal entity exists |
| Code host (changed by 0019 and 0020) | A GitHub organisation: the repository is `founderscoffee/tabachir`, which is public |
| Money (changed by 0016) | Charge for services, never for features; the term export is free |
| Name (changed by 0019) | **Tabachir** (طباشير), chosen from about 60 candidates. On 26 Sep 2026 the GitHub name `tabachir` was free, `tabachir.dz` and `tabachir.com.dz` were free in the registry, and no app on Google Play Algeria used the name. `tabachir.com` is taken |
| Countries | Algeria first: until the end of the 2027/28 school year, the project builds only for Algerian teachers. Country specifics are data, not code, so other countries can use Minhajna later (§1.14) |
| Goal | The state adopts Minhajna as the official digital record of teaching. Principle 6 now reads: built to become the official record, never by default |
| Institution mode (changed by 0015) | The school or authority is the controller; the project is only the publisher or a processor. Gates and the data-use charter bind every deployment (§1.15) |
| Insight figures | The IGP sees each report first and has 30 days to comment. Figures are never used for exam thresholds or personnel decisions (§1.6) |
| Section 1 | Settled on 27 Sep 2026. From now on, changing a principle follows §1.2 |

**Decided on 29 Sep 2026**

| Decision | Choice |
|---|---|
| Languages | `CHARTER.md`, `CODE_OF_CONDUCT.md` and `CHANGELOG.md` are in English. The README summarises them in Arabic, and teachers read the release notes in Arabic in the app. 0010 had planned `CHARTER.md` in Arabic and English |
| The name | Not registered as a trademark. Protected by use, the official sources and the published checksums. 0004, 0007 and 0008 had planned to register it |

**Decided on 30 Sep 2026**

| Decision | Choice |
|---|---|
| Comments on proposals | Each proposal gets an Arabic summary on the website and in the teachers' Facebook group, with the website's form for comments. The field-check teachers are asked directly, and every comment gets an answer in the record |

**Decided on 3 Oct 2026**

| Decision | Choice |
|---|---|
| Repository files | `CHARTER.md`, `GOVERNANCE.md`, `CODE_OF_CONDUCT.md`, `PRIVACY.md` and `TRADEMARKS.md` are published in stage 1. The README summarises the charter and the code of conduct in Arabic (§1.13, §1.16) |
| After launch | The lead maintainer still decides, in public, after hearing contributors and the teacher council, and invites new maintainers in public |
| The council's consent (takes effect with 0016) | After adoption, a change to the principles or the charter needs the votes of more than half of all the council's members |
| Reports | Until the project has an address of its own, conduct problems are reported through GitHub's tool for reporting content to maintainers, or to the admins of the teachers' Facebook group, and privacy questions go in an issue, without personal details |
| Which requirements govern | Plans aim at this PRD as written, and mark what rests on a proposal. A proposal takes effect when its record is accepted |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Goal | National adoption, with the Ministry running Minhajna on government servers |
| Institution mode | One form: the national system, run by the Ministry. Teacher mode only until it opens. No school or directorate deployments before then |
| Who is responsible | The Ministry is the controller and runs the servers. The project only publishes the software |
| The first ask | A ministerial text making the full digital record official and compulsory from the national launch, with the charter's protections asked for, not required |
| Before the mandate | The Ministry's own compliance, the consultation of teachers' representatives with every objection answered in public, the charter presented to every teachers' council, and the launch gate |
| Students and parents | No features for them. Parents use the state's awlyaa space |
| The Ministry's app | The project's release, with the Ministry's name and icon as settings, built reproducibly. The project's own app can always connect. A build that weakens the charter is made public at once |
| After adoption | The Ministry's staff maintain Minhajna, as maintainers in the project's public process |
| Insights | Opt-in, in teacher mode, from 2027/28 until the national totals exist |

**Decided on 4 Oct 2026 (decision 0016, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Principle 4 | "Free, and never for sale." Everything Minhajna does is free, for teachers and for the state, and the project sells nothing |
| Funding | Until adoption: public grants and prizes open to any project, teachers' donations, and sponsors with no access to data. No money from abroad |
| Sponsors | None that sell to schools, teachers, pupils or parents, and no party, union or religious body. None gives more than a quarter of a year's income |
| After adoption | The Ministry maintains Minhajna with its own staff (§1.8). A change to the principles or the charter then needs the teacher council's consent |
| Legal entity | An association, which counsel confirms |

**Decided on 4 Oct 2026 (decision 0017, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Charter point 7 | How far classes got may inform the scope of an exam only at the level that sets it: the school's own records, the directorate's totals, or wilaya and national totals. The figures are taken on a date announced in advance, which moves only with the exam, published after the exam and checked against the inspectors' sample, or marked unchecked in a year without it. Never for personnel decisions |
| Insight figures | Keep their ban: never used for exam scope (§1.6) |

**Decided on 4 Oct 2026 (decision 0018, proposed on 30 Sep)**

| Decision | Choice |
|---|---|
| Charter point 1 | Adds "Above the school, figures drawn from them serve only what point 7 allows." Nothing else in the charter changes |

**Decided on 4 Oct 2026 (decision 0019)**

| Decision | Choice |
|---|---|
| Name | **Minhajna** (منهاجنا), with the line «من المخطط السنوي إلى درس اليوم», "From the yearly plan to every lesson". It replaces Tabachir. On 3 and 4 Oct 2026, `minhajna.dz`, `minhajna.com.dz`, `minhajna.com` and `minhajna.org` were free, and no app on Google Play Algeria or the App Store used the name |
| Naming rule | Loosened: a name no longer has to be distinctive, it is no longer checked on GitHub, and the echo rules cover only exact official names and the apps that teachers use in Algeria |
| Code host (changed by 0020) | The repository is `founderscoffee/minhajna`, renamed on 4 Oct 2026. The GitHub name `minhajna` belongs to a person, so there is no organisation of the product's name to reserve |

**Decided on 10 Oct 2026 (decision 0020)**

| Decision | Choice |
|---|---|
| Code host | The repository is `djazairdev/minhajna`, in djazairdev, the organisation of open-source projects for Algeria, since 10 Oct 2026. GitHub redirects the old addresses. Principles, licences, governance and the opening plan are unchanged |

**Decided on 13 Oct 2026 (decision 0021)**

| Decision | Choice |
|---|---|
| Code contributions | Open to all from now, at stage 1, rather than at the launch. Review, the DCO and agreeing larger changes in an issue first are unchanged (§1.7, §1.13) |

**Decided on 15 Oct 2026 (decision 0022)**

| Decision | Choice |
|---|---|
| Interface translations | The apps' interface texts, in every language, are under AGPL-3.0-or-later like the code, and signed off under the DCO. Translations of documents stay under CC BY-SA 4.0 (§1.3) |

**Decided on 16 Oct 2026 (decision 0023)**

| Decision | Choice |
|---|---|
| Translation platform | Our own Weblate, from its Docker Compose setup with every setting in `infra/weblate`, so the Ministry can run the same instance. It pushes signed-off commits to a `weblate` branch; a maintainer merges them by pull request. The host is chosen before translators are invited |

**Open**
- **Protecting the name.** Two steps, since the name is not registered:
  - register `minhajna.dz` and `minhajna.com.dz`, under the registry's conditions;
  - check that the name is free on Facebook, and reserve the page.
- **The association** (29 Sep). Counsel confirms the form, and the rules for an association that receives donations and grants (§9.8).
- **Questions for counsel.** There is no budget for counsel yet, so the project will look for free help, for example university law clinics or incubators. The questions:
  - how the Ministry, its directorates and its schools share the controller's role in the national system (§1.15);
  - whether teachers may send lesson-level insights without written authorisation (§1.6);
  - the copyright status of the IGP plans (brief §8);
  - whether the scrubbed research may be published.
- **Funding the team's time** until adoption, from grants, prizes, donations and sponsors (§9.7).
- **Members of the teacher council.** Chosen after the field check.
- **Other countries.** Whether another country follows Algeria, and which, is decided after the 2027/28 school year (§1.14).

---

## 2. Goal, users and scope

*Changes proposed on 29 Sep 2026 in decisions 0015 and 0017, for the national system run by the Ministry and its exam thresholds. Those decisions were accepted on 4 Oct 2026.*

This section sets out:
- what Minhajna is for;
- who uses it;
- how the daily workflow runs;
- what version 1 covers.

It complies with Section 1. Later sections design each part: the teacher app, the lesson engine and plan packs, data and formats, privacy and security, institution mode, the state layer, funding and sustainability, and the roadmap.

### 2.1 The problem

- **Teachers copy the same lesson by hand, every day, into several documents.** The Ministry's plans reach teachers as PDF files. From them, teachers write out (brief §1, §4):
  - their distributions;
  - their daily journal;
  - the texts-book entry for each class;
  - their lesson notes.
- **These documents are required, and someone checks them.**
  - Primary teachers keep the daily journal (الكراس اليومي) and the roll-call book (Decision 831 of 1991). The director countersigns them, and the inspector checks them at visits.
  - In CEM and lycée, each class has a texts book (دفتر النصوص, Decision 155 of 1991). The teacher signs it every session, and the director endorses it.
  - Since 2025/26, CEM teachers also keep a continuous-assessment book (circular 270).
- **The pieces exist, but the chain does not.** No product carries a lesson from the official plan to the day's session, and on to every document the teacher must keep, at every level (brief §1).
- **The state's platforms cover marks, absences and parents, not lessons.** Lesson records are still on paper. A digital texts book is on the Ministry's July 2025 roadmap (brief §9).
- **Scale.** About 630,000 teachers (February 2026) and 12 million pupils (September 2026) (brief §2).

### 2.2 The goal and the end state

- **The goal** (principle 6). The Algerian state adopts Minhajna as the official digital record of teaching, and the Ministry runs it on government servers as one national system (29 Sep).
- **The end state: Minhajna replaces the paper procedures completely.** It is not a supplement to them.
  - The Ministry publishes its plans through Minhajna.
  - The system gives every class its lesson for every session.
  - Teachers confirm what was taught instead of writing it.
  - The texts book, the journal, roll call and marks become the official record, which the teacher signs each week (§5.5, 29 Sep). The distributions and the lesson notes are made from the plan.
  - Marks go to the state's system through the national interoperability system (§5.9).
- **Paper goes when the law says so.** Official texts require the paper books. They give way once a ministerial text makes the digital record official, and compulsory from the national launch (§1.15). Until then, Minhajna removes the copying and prints what the paper rules still require. After that, paper stays only as the fallback (§5.5).
- **The path** (§1.15). It has three parts:
  - teachers first, in teacher mode, until the Ministry's system opens, because the state adopts what teachers already use;
  - a design built for the national system from the first release (§5.1);
  - the state track worked in parallel, with the first ask: the full digital record, compulsory from the national launch (Section 8).

### 2.3 The core workflow

1. **The plan goes in.** The Ministry uploads its plan as a PDF, or fills in a form.
   - Both produce the same plan pack, which is reviewed before it is published and then available to every teacher.
   - Until the Ministry joins, the project's curators and teacher-reviewers run the same process (§1.7).
2. **Lessons get dates.** For each class, the system assigns each lesson to a session, using three inputs: the plan, the class timetable, and the calendar (holidays, exams, closures).
   - Primary plans are numbered by week, so the dates follow directly.
   - CEM and lycée plans give hours per sequence, so each class's dates depend on its timetable.
3. **The teacher sees the day's lessons** on the Today screen.
   - A weekly digest comes by default. A daily preview comes only if the teacher turns it on.
   - There are no notifications at night or at weekends.
4. **The teacher confirms, and never writes.**
   - After the session, one tap confirms "done as planned".
   - Any other outcome takes one more tap: continued next time, merged, skipped, re-taught, or not held.
   - A whole day or week can be confirmed at once, with its exceptions.
   - Free text is always allowed.
5. **Everything else follows.**
   - The system writes the journal and texts-book entries, the distributions and the lesson-note drafts.
   - It re-paces the following lessons from what was actually taught.
6. **In the national system, the teacher signs each week** of each course, in one step, with the fingerprint prompt or a PIN. The signed week is the official record, and it can always be corrected (§5.5).

**Five rules**
1. **A proposed lesson is never a taught lesson.** Only the teacher's confirmation records it. A record that filled itself in could show a lesson on a day the teacher was absent or the school was closed.
2. **Changing the proposal costs no more than confirming it.**
3. **Progress belongs to the class,** the subject and the school year, not to the teacher.
4. **History is only ever added to.** A new plan, timetable or assignment never rewrites a recorded session.
5. **A missing entry is never an absence** (§1.15, charter point 3).

### 2.4 Who uses Minhajna

| Participant | What they do and get | When |
|---|---|---|
| **Teacher** (primary, CEM, lycée) | The app, with:<br>• the day's lessons and one-tap confirmation<br>• roll call and continuous assessment<br>• the documents and the term export<br>• a weekly digest<br>• progress statements and handovers<br>• in the national system, joining the school's space with a QR code, and signing each week (§5.5, §5.8)<br>• in the national system, where their classes stand against each exam's date, as the director sees it, and signing a school exam's cut as one of its setters (§7.10) | Pilot, then launch. The national system after adoption |
| **Subject coordinator and teaching council** | A merge of the progress statements that teachers choose to share, for the council's pacing plan | Pilot |
| **Director and deputies**, the censeur (ناظر) among them | • **Reader mode:** opens what teachers share, with no account<br>• **The timetable package:** imports the school timetable (FET or Excel) and sends each teacher their part<br>• **The school's space, in the national system:** the signed weeks, and an operational view of workload, sessions awaiting confirmation and classes behind the plan. It updates a few times a day, stays inside the school, and only the school key opens it. The teacher sees the same view (§7.6)<br>• **Exam thresholds** for the school's term and mock exams, first on its dashboard (§7.10) | Reader mode in the pilot; the package at launch; the school's space in the national system |
| **Inspector** | Progress statements before a visit. In the national system, a grant from the authority opens the lesson records of the named courses and weeks, between its dates, and the teacher sees it (§5.10) | Pilot; the national system |
| **Directorate** | In the national system, totals only, above the minimum group sizes: the threshold of its own unified and mock exams, first on its dashboard (§7.10); what the system owes teachers, such as cover provided, vacant posts and sessions lost to closures; and the curriculum report. Never a figure for one school or one teacher (§5.10) | The national system |
| **Ministry and IGP** | • Publishes plans through Minhajna (upload or form)<br>• The IGP sees insight reports first (§1.6)<br>• Adopts Minhajna by a ministerial text, and runs the national system on government servers (§5.2)<br>• Sees totals only, above the minimum group sizes (§5.10)<br>• Sets the threshold of national exams, such as the BEM and the BAC, through its committee with inspectors (§7.10) | When the Ministry joins. The national system after adoption |
| **Students and parents** | Nothing in Minhajna (29 Sep). Parents see marks, and absences where the school chooses, in the state's awlyaa space, fed through the national interoperability system (§5.9) | — |
| **The project's curators and teacher-reviewers** | Turn plan PDFs into plan packs, with help from AI and a two-person review, until the Ministry does it itself | From now |

### 2.5 Version 1

Version 1 is tested in a pilot from January to March 2027 and launched in September 2027, in teacher mode. The national system's launch date is set once the Ministry adopts Minhajna (29 Sep).

| Area | Version 1 |
|---|---|
| Levels | Primary, CEM and lycée.<br>• The pilot covers a few grades and subjects per level, wherever a reviewed plan pack exists.<br>• The launch covers all three levels, with the packs that are ready by then |
| Features | The lesson log and the register, joined by the session |
| Documents | • Texts-book entries (دفتر النصوص)<br>• The primary journal (الكراس اليومي) and the CEM and lycée personal journal<br>• Distributions<br>• Lesson notes (المذكرة), as templates filled in from the plan<br>• The roll-call book (دفتر المناداة), with its monthly summary |
| Roll call | It replaces the paper book, as the teacher's own record.<br>• It can be taken in class or after the lesson, with a paper fallback (circular 460 Art. 48).<br>• The school's official absence system is not replaced |
| Assessment | • Continuous-assessment components chosen by the teacher, within the circular<br>• Averages by the official formula<br>• Appreciations suggested from the official list and confirmed by the teacher for each pupil (circular 244) |
| Term export | • The school's Excel workbook, filling only its unlocked cells<br>• A view ready for the ostad grid<br>• Printed sheets<br>• The class-council pack |
| Devices | An Android app, and an installable web app for PCs. Both work offline |
| Languages | Arabic, French and English interfaces. Documents come out in the subject's language |
| AI | For curators only, never with pupil data. None in the teacher app |
| School layer | • Reader mode in the pilot<br>• The timetable package at launch<br>• The school's space only in the national system, after adoption (§1.15) |
| Not in version 1 | • The national system: school spaces, legal signatures, the interoperability connector and the totals, built for the national launch (§5.1)<br>• The insights observatory (2027/28)<br>• An iPhone app<br>• AI in the teacher app |

### 2.6 What Minhajna never does

- **Ask anyone to assign lessons to sessions by hand,** or record a lesson as taught without the teacher's confirmation.
- **Track teachers.** No attendance, absence reasons, clock times, "started" events, sign-in events, location or biometric data, and no personal phone required. The phone's fingerprint prompt never leaves the phone (§6.4).
- **Judge teachers.** No scores, rankings or colour codes for teachers, and no inference of their effort or performance. Whether sessions are confirmed stays inside the school, and in the national system only the school key opens it (§1.11, §6.5).
- **Hold pupil data that a server can read,** whoever runs the server (principle 2, §6.5). Only the state's own systems read the marks and absences sent to them (§5.9).
- **Build features for students or parents.** The state's awlyaa space serves them (29 Sep).
- **Duplicate what the state's systems already hold,** such as teacher assignments and hours, official absences and official results. It imports from them or exports to them.
- **Connect to or automate state platforms without an agreement.** In teacher mode, data moves as files. In the national system, it moves only through the national interoperability system (§5.9).
- **Let its figures be used for personnel decisions,** or for exam scope outside charter point 7. The opt-in insights never inform exam scope (§1.6). The national system's figures inform it only at the level that sets each exam, under three safeguards (§1.15, §7.10).

### 2.7 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| End state (changed by 0015) | Full replacement of the paper procedures, once a ministerial text allows it |
| Core workflow | The plan goes in (Ministry upload or form) → each class gets dated lessons → the teacher confirms with one tap → the documents follow |
| Levels | Primary, CEM and lycée |
| Version 1 | The lesson log and the register, with the documents listed in §2.5 |
| Roll call | Replaces the paper roll-call book, as the teacher's own record |
| Assessment | The official formula; components chosen by the teacher; appreciations suggested, then confirmed |
| Notifications | A weekly digest by default; a daily preview only if the teacher turns it on |
| The director's view (changed by 0015) | An operational dashboard in school mode, inside the school |
| Students and parents (changed by 0015) | Designed for now, built later, and only in institution mode |
| Devices and languages | Android and web; Arabic, French and English |
| AI | For curators only |
| Dates | Pilot January–March 2027; launch September 2027 |
| Section 2 | Settled on 27 Sep 2026 |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Goal | The Ministry runs Minhajna on government servers, as one national system |
| End state | The texts book, the journal, roll call and marks become the official record, signed each week and always correctable. Compulsory from the national launch |
| The path | Teacher mode only until the Ministry's system opens. The first ask is the full digital record |
| The director's view | The school's space in the national system: confirmation status stays inside the school, opened only by the school key, updated a few times a day |
| Students and parents | No features in Minhajna. The state's awlyaa space serves them |
| The national launch | No date yet. It is set once the Ministry adopts Minhajna |

**Decided on 4 Oct 2026 (decision 0017, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Exam thresholds | In the national system, each exam's threshold at the level that sets it: the school, the directorate or the Ministry. Teachers see what the director sees |
| What Minhajna never does | Its figures never feed personnel decisions, and inform exam scope only under charter point 7 |

**Open**
- **The pilot slice.** Which grades, subjects and schools. It is chosen after the field check, by December 2026.
- **Plan packs for lycée.** An archive of 89 lycée plan files from September 2022, covering 23 subjects, was found (research 09). The field check finds out which of them are in force (§4.12).
- **The lesson-note template for each level,** and whether inspectors accept it. The field check tests this.
- **When the Ministry would issue its text** for national adoption, with the Council of Ministers' decision (§1.15, §8.7). The state track finds out.

---

## 3. The teacher app

*Changes proposed on 29 Sep 2026 in decisions 0015 and 0017, for the national system run by the Ministry and its exam thresholds. Those decisions were accepted on 4 Oct 2026.*

This section specifies what the teacher does and gets. Three later sections cover the parts it relies on:
- Section 4, the lesson engine that proposes each session's lesson;
- Section 5, the data, file formats and sync;
- Section 6, privacy, security and the non-functional requirements.

### 3.1 Design rules

Every screen follows these rules.

1. **One entry, every output.** A session is recorded once. That record feeds the journal, the texts-book entry, the roll call, continuous assessment and every printout.
2. **Faster than paper.**
   - An ordinary session takes about 5 seconds to confirm.
   - Marking the roll for 40 or more pupils is at least as fast as paper.
   - Both are measured in the pilot, against the paper routine timed in the field check.
3. **Proposed, never assumed.** The app proposes; only the teacher's confirmation records (§2.3).
4. **Correct anything, lose nothing.**
   - Any entry can be corrected at any time, and the history keeps both versions.
   - There are no deadlines, time windows or locks.
   - In the national system, a signed week can still be corrected. The correction is signed too, and both versions show (§5.5).
5. **Print what is checked.**
   - Every document prints the way directors and inspectors expect.
   - Every document can also print blank, with its headers filled in.
6. **Offline, with no account.** The app opens and does all the daily work without a network or an account (§1.5). In the national system, the teacher joins their school's space once, with a QR code, and still needs no password (§5.8).
7. **The phone alone is enough.** Everything works on a budget Android phone, including the PDFs to print and the term export. A PC is optional, because far fewer teachers have laptops than phones (brief §11). In the national system, no personal phone is required either: a teacher without a smartphone works on a school PC, with a security key the school issues (§6.6).
8. **Neutral words.** The app states facts, such as "3 sessions awaiting confirmation" or "2 weeks behind the plan". It never judges, as in "you are late" or "you can do better".
9. **Arabic first.**
   - The interface is in Arabic, French and English.
   - Layouts run right to left and left to right.
   - Documents come out in the subject's language.

### 3.2 Getting started

The goal is a usable app in about 10 minutes, without importing anything.

**The teacher**
- The teacher picks their levels, schools and subjects.
- A teacher card holds the details the documents print. The personal fields are optional and never leave the device.

**Joining the school's space** (national system, 29 Sep)
- **One QR code.** The school gives each teacher a QR code made from the official assignment list. The teacher scans it once, and the app links the key in their phone to their assignments (§5.8).
- **Nothing typed twice.** The school, the classes and the class lists come from the sector's information system, through the national interoperability system (§5.3, §5.9).
- **Signing in** uses the phone's fingerprint prompt or a PIN, and is never recorded. A teacher without a smartphone joins and signs in on a school PC with a security key the school issues (§6.4, §6.6).
- **Moving from teacher mode.** The app shows what will move into the school's space, and moves it once the teacher agrees. Private notes stay on the teacher's devices. What the teacher kept before joining stays their own, unsigned and exportable: the school's space starts with the first week signed after joining, and no past week is signed (§5.8, 5 Oct).

**Classes and pupils**
- **Import** the pupil list from the official Excel file, keyed on the official registration number. Only the columns the app needs are kept. In the national system, class lists come in by themselves (§5.9).
- **Or type** the list.
- **No fixed limit on class size.** The paper roll-call book stops at 52 rows, and a class of 57 has been reported (brief §5.2).
- **Multigrade classes.** A primary class can hold up to three levels, each on its own plan (brief §4.3).
- **Pupil movements.**
  - Transfers in and out during the year are recorded with their date and reason.
  - A pupil who has left stays listed, with the reason, until the teacher records the director's confirmation.

**The week**
- **Where the week comes from.** The teacher accepts the school's timetable package, sent as a file or a QR code, or draws the week by hand.
- **Several schools.** A teacher who works in more than one school gets one merged week, with warnings about clashes. The teacher can change one day in their own week to get round a clash. Only a new version from either school settles it, and the app writes to no school (§7.4).
- **The timetable handles:**
  - A/B weeks;
  - half-groups;
  - double shifts, each with its own bell times (§4.6), Saturday classes and a fifth morning slot;
  - the same class twice in a day;
  - bivalent CEM subjects, such as Arabic with Islamic education;
  - specialists who teach up to about 20 groups;
  - time that belongs to the teacher rather than a class: the pedagogical half-day, hours in another school, duties and reductions.
- **Ramadan hours** come from the calendar, not from the timetable (Section 4).

**The plan and the calendar**
- **A plan pack for each class.** The teacher pins one plan pack to each class, and the class stays on that release. Without a pack, the log still works with free entry.
- **The calendar.**
  - The national calendar comes with the app.
  - Closures for a wilaya or a school can be added by the teacher, or received. The teacher's wilaya, asked at setup, decides which wilaya's dates apply. It is never sent to a server (§4.5).

**The next school year** reuses last year's teacher card, template profiles and lesson notes. Last year's records stay available.

### 3.3 Today and the session

**The Today screen** lists the day's sessions in order. For each one it shows:
- the class, the subject and the group;
- the proposed lesson: its plan item and stage;
- what carried over from last time.

Special days are marked on it: holidays, seminars, councils, exam weeks, and cover for another teacher's class. A class council goes on the journal's page for seminars, training and meetings, or, in primary, whose journal has no such page, on that day's daily page. An invigilation duty goes in the journal, like cover (§3.8, §7.7). Neither goes in the texts book, and the app keeps no count of them.

**Confirming a session**

| Outcome | Taps | What it records |
|---|---|---|
| Done as planned | 1 | The proposed plan item and stage |
| Last stage reached | 2 | The stages covered; the rest continues next time (تابع) |
| Merged | 2 | Two plan items taught together |
| Skipped | 2 | An item left out |
| Re-taught | 2 | An item taught again |
| Not held | 2 | That the session did not take place |

- **Reasons are optional and private.** A skipped item or a session not held can carry a reason that stays on the teacher's own devices (§5.4): closure, exam, holiday, event, teacher absent, class absent, few pupils present, or other. No reason names collective action; the teacher uses "other" (§1.11).
- **A session owed a make-up.** When recording a session not held, the teacher can mark it to be made up («تُعوَّض هذه الحصة»). Only that mark, or a make-up the director asks for, makes a session owed. The app never decides it on its own (§7.7, 5 Oct).
- **A whole day or a whole week** can be confirmed at once, marking only the exceptions.
- **Session types** follow Algerian practice: درس، إدماج، أعمال موجهة، معالجة، استقبال, and فراغ for a free slot, plus tests and exams.
- **Sessions outside the timetable** can be logged too, for one of the teacher's classes: support, catch-up, review or supervised study. With no timetable slot, the teacher enters the date and the time, as on paper; the app never records when they tapped. These sessions do not move the plan, and they fill the texts book's page for supervised or additional lessons (§3.8). They are not the make-up sessions of the catch-up ladder, which the teacher schedules with the administration, which count as plan sessions and which go on the subject's pages (§4.7).
- **Every session can also record:**
  - homework, with its due date;
  - any test given;
  - free text, and content that wasn't in the plan.
- **Two layers of note:**
  - a factual line that can go into the texts-book entry and into shared statements;
  - a private note that never leaves the teacher's own devices (§5.4).

  The app warns against writing pupils' health or discipline details in either.
- **No clock times.** A session is identified by its date and timetable slot. Printed times come from the timetable, never from when the teacher tapped.

**Signing the week** (national system, 29 Sep)
- **Once a week, for each course,** the app shows the week's record: the sessions and their outcomes, homework and tests, roll call and marks. The teacher signs it in one step, with the fingerprint prompt or a PIN (§5.5).
- **Until then,** the week is the teacher's working record and changes freely. Once signed, it is the school's record, and the official record.
- **Sessions still awaiting confirmation** are shown first. The teacher confirms them, or signs the week as it stands: a session left unconfirmed is never an absence (charter point 3).
- **Corrections stay possible** after signing, and show as corrections (§3.1, rule 4).

**Exam thresholds** (national system, 29 and 30 Sep)
- **For each of the teacher's classes,** the app lists the coming exams with a common paper: the school's term and mock exams, the directorate's exams and the national exams. For each, it shows the day its figures are taken, and where the class stands (§7.10).
- **The same charts as the director:** the school's chart for the subject and level, and the directorate's totals, exactly as the director and the directorate see them (charter point 5).
- **Setting a school exam's cut.** It is optional: the school's teachers of the subject set one when they wish, and otherwise set the paper as they do today (30 Sep). Each signs the proposed cut, proposes another, or chooses no cut. A proposal applies once every setter has signed, the earliest when they differ, so no class is examined on what it did not reach. If a setter has not signed by the signing deadline, which the school's calendar announces with the figures day, or chose no cut, the director decides. Before the exam, only the setters and the director see a proposed cut (§7.10, 5 Oct).
- **Other cuts** appear once the exam is over and the cut is published.
- **Monthly tests,** the common test (الفرض المشترك) included, stay the teacher's own, with nothing to sign.

### 3.4 Roll call: the digital roll-call book

Roll call replaces the paper roll-call book (دفتر المناداة) as the teacher's own record. It never notifies parents, and it does not replace the school's official absence system (§2.5). In the national system, roll call becomes part of the official record, signed each week (§5.5). Where the school chooses, pupils' absences also go to the state's absence system, and parents see them in awlyaa (§5.9).

**Taking it**
- **Unit.** Per half-day in primary; per session in CEM and lycée. The same class can be taken twice in a day.
- **Specialists** keep one register per class and count only their own sessions.
- **Everyone is present by default.** The teacher marks only the exceptions:
  - absent, marked justified or unjustified. The cause is never typed (§5.6);
  - late, which can happen several times a day, carries the date and doesn't count as an absence.
- **A list or a seating plan** (3 Oct). The teacher marks the exceptions on the class list, or on a seating plan of the class or of one of its timetable groups, arranged once by placing each pupil on a seat. Tapping a seat marks the same exceptions as the list, and both record the same roll call. The seating plan stays on the teacher's devices, in the private layer (§5.4), and prints on one A4 page, for example for a substitute. It is erased with that year's pupil records (§5.7).
- **When.** In class or after the lesson, because circular 460 Art. 48 limits phones in class.
- **Paper fallback.** A printable blank sheet, entered later. It also serves a substitute or a day without the phone.
- **A roll call not yet saved.** Since everyone is present by default, Today lists the sessions whose roll call was never saved, until the teacher saves or dismisses each one, for example once a paper sheet is entered. Nothing about them is sent or printed. Until each is saved or dismissed, the month's printout leaves the teacher's signature box blank (§3.8).
- **Corrections.** Past days can be corrected, and an audit trail keeps every change, because roll calls carry legal weight.

**Counting**, following the roll-call templates (brief §13.4)
- **The half-day is the unit.** An absence in the morning or in the afternoon counts 1; a whole day counts 2.
- **Totals are automatic, for each pupil and each month:**
  - possible attendance (ح-ك);
  - absences (غ);
  - actual attendance (ح-ف);
  - the rate.
- **A yearly summary** runs from September to June.
- **Counting rules are settings,** with defaults: holidays, seminars, half-days, the start date, and days the class was not held. Teachers disagree on these rules, and no official text settles them.

**Printing**
- **The monthly two-page spread**, on A4 portrait:
  - one column per day, with weekends and national days shaded;
  - the paper book's symbols: `-` absent in the morning, `ǀ` absent in the afternoon, `+` absent all day;
  - the matching Hijri month;
  - signature boxes for the teacher, and for the director and the inspector with dates.
- **Lateness**, which has no symbol on paper, prints in its own column with its dates.
- **Each pupil's absence dates**, not only the counts.
- **The yearly summary page,** on one A4 landscape page per class.
- **The front pages** print what the app holds. The two confidential pupil-record pages print blank, to be filled in by hand: the app does not collect parents' details or home addresses.
- **For CEM and lycée,** an absence sheet for each session, for the supervisors' route.

### 3.5 Continuous assessment, marks and averages

- **Components per class and subject.**
  - An official preset for each level, built from the year's circulars as data. Until the year's assessment circular is published, the preset keeps last year's rules.
  - The teacher chooses the components and their weights within the circular, and can add columns.
  - Primary continuous assessment is kept month by month and rolled up per term.
  - In terms where descriptive observations replace marks, such as 1AP term 1, the teacher records observations instead.
- **Captured during the session:** participation, homework, notebook and behaviour. Roll call can feed the attendance and discipline component if the teacher turns that on (circular 270 allows it).
- **Tests (فروض) and exams.** Entry is checked for:
  - marks above the maximum;
  - empty cells;
  - pupils who are not on the class list.
- **Averages** follow the official formula for each level, kept as versioned data (brief §5.4). T is continuous assessment, F the tests and E the exam.
  - Primary, out of 10: (T + E)/2 for languages and maths; E alone for the other examined subjects.
  - CEM: ((T + F)/2 + 2E)/3.
  - Lycée: (T + F + 2E)/4, or (T + F + P + 2E)/5 with practical work, or with an oral in place of P.
- **Rounding.** Full precision is stored and 2 decimals are shown. Thresholds are compared on the unrounded value.
- **Printouts:**
  - the grade book;
  - a per-pupil justification of the continuous-assessment mark. This doubles as the continuous-assessment book that circular 270 requires, and as the teacher's answer to a parent's appeal.

### 3.6 Appreciations

- **Suggested, then chosen.** The app suggests a phrase from the versioned official list, by mark band and, if the teacher wants, by behaviour and attendance. The teacher confirms or changes it for each pupil. Until circular 244's list is found, the project's editors publish an interim list, marked as interim and versioned like a pack.
- **No "fill all".** Circular 244 requires a manual choice.
- **Guards:**
  - banned phrases are blocked;
  - a phrase that only restates the mark is flagged;
  - the export refuses to run while any box is empty.

### 3.7 The term export

The school chooses the route: the ostad grid, or the Excel workbook the administration extracts from amatti (brief §5.6). In the national system, marks are part of the official record, and go straight to the state's system through the national interoperability system. The routes below stay as the fallback (§5.9, 29 Sep).

- **The school's Excel workbook.**
  - The app fills only the unlocked cells, keeping the workbook's protection, structure and file type.
  - The workbook's variants are handled as data.
  - Every result is tested in Microsoft Excel and in WPS for Android.
- **A view ready to copy into the ostad grid.**
- **Printed mark sheets,** and PDF, DOCX and CSV files. A CSV file starts with a marking line, and goes in an encrypted ZIP when the teacher sets a password (§5.9).
- **A check before signing.** The app compares the register with the exported file, in the same form as the official control printout. In the national system, where marks go straight to the state's system, it compares them with the printed control sheet.
- **The correction window** after term is supported, with the teacher's report that each correction needs.
- **The class-council pack.** Class statistics:
  - average, highest and lowest mark, and standard deviation;
  - the success rate: 10/20, or 5/10 in primary;
  - the distribution by band, and counts by sex;
  - pupils' ranks, and a comparison with last term: the class average, the share at or above the pass mark, and each pupil's rank and its change;
  - pupils who may need remediation, and pupils in line for a distinction, with thresholds the teacher sets, since none are official;
  - the attendance summary.
- **Never:**
  - ask for ostad or amatti passwords;
  - automate the state's platforms, outside the national interoperability system;
  - produce a report card (§2.6).

### 3.8 The documents

Each document can be printed, saved as PDF or DOCX, and printed blank with its headers filled in. The texts book's blank is the paper book itself. A blank document that lists pupils, such as the grade book, holds pupil data: it is marked like any other (§5.9) and never carries the drawn signature.

**Template profiles** can set the fields, their order and their labels for an inspector or a district, because no official layout exists (brief §13). Signature and visa boxes are always kept.

| Document | What it contains |
|---|---|
| **Primary journal** (الكراس اليومي) | • **Front pages:** cover, teacher card, holidays and national days, seminars and training, the pupil list, and the weekly timetable with an "approved on" box<br>• **Daily page:** A4 landscape, with morning and afternoon bands. Columns: duration, subject, activity, content, competence indicator, plus the domain and the lesson-note number<br>• **A visa box for the director** (Decision 831 Art. 9), which the paper templates leave out<br>• **Specialists** in French, English and Tamazight get their own journal, in their language |
| **CEM and lycée personal journal** | • **Front pages:** teacher card; seminars, training and meetings; holidays and national days<br>• **Daily page:** A4 portrait: date, from–to, class, how the session went, remarks. Plus domain, sequence and resource |
| **Texts-book entries** (دفتر النصوص) | For each session:<br>• date and duration<br>• lesson title and stages<br>• any test<br>• homework and its due date<br><br>The teacher copies each entry in, or pastes a printed strip if the school accepts that. A strip keeps the paper book's column widths and line spacing, which are set for each edition of the book, not by template profiles. The app shows each entry's corrections, for the director's monthly check. The teacher signs each entry by hand, or with the drawn signature below. In the national system, the signed week replaces the paper book (§5.5) |
| **Texts-book homework record** | A record in each subject's section of the book. For each homework:<br>• the date it was set, and the date it comes back<br>• the activity<br>• how many pupils did not do it, and how many relied on someone else<br>• each count as a percentage of the pupils on the class list, rounded to a whole number<br><br>Class counts only, never names. The teacher enters the two counts when the homework comes back. If homework was marked for each pupil (§3.5), the app proposes the counts it can work out from those marks. The counts are pupil records (§5.4), and a file of them is marked like one (§5.9) |
| **Texts-book supervised or additional lessons** | The book's page for these lessons (Decision 835 of 1991). For each session logged outside the timetable (§3.3):<br>• its number, in order. The app numbers the teacher's own rows. The book's page is shared by all the class's teachers, so when printing onto it the teacher gives the next free line<br>• the subject<br>• the type: support, catch-up, review or supervised study<br>• the date and the time<br><br>The page has no column for a topic or free text, which stay in the session's record. Nothing is generated from the timetable or from the school's report on how it runs, and the app never shows a teacher's unused hours. Make-up sessions go on the subject's pages (§7.7). With no such sessions, the page prints blank |
| **Distributions** | Annual and monthly distributions from the plan pack, fitted to the class timetable, and the termly distribution the texts book needs (Decision 155 Art. 6) |
| **Lesson notes** (المذكرة) | • A numbered template, filled in from the plan item: objectives, stages, resources, competence indicator<br>• The teacher completes it<br>• Last year's notes can be reused |
| **Roll-call book and absence sheet** | See §3.4 |
| **Grade book and continuous-assessment justification** | See §3.5 |
| **Weekly timetable** | With signature boxes for the teacher, the director and the inspector |

**One journal or several.** A teacher with several classes, streams or levels chooses one journal per class or one combined journal (brief §4.3).

**The teacher's signature**
- **By hand, or drawn once.** The teacher signs by hand, as on paper. Or the teacher turns on a drawn signature: they draw it once on the screen, and the app puts it in the signature column of each confirmed texts-book entry and in the teacher's signature boxes on the other documents.
- **Always the teacher's choice.** It is off by default. Any printout can still leave the teacher's boxes blank, to sign by hand.
- **Only what the teacher confirmed.** An entry awaiting confirmation never carries it, and a session recorded as not held counts as confirmed. A journal day with a session awaiting confirmation keeps the teacher's box blank, and so does a roll-call month with a roll call never saved (§3.4). A marks document carries it once the teacher has checked the document (§3.7). The director's and the inspector's boxes always stay blank.
- **Printouts and PDFs only.** It never goes into a DOCX file, which anyone can edit. Before a PDF that carries it is shared, the app says that anyone who receives the file can copy the signature.
- **Kept like the teacher card.** The drawing is one of the teacher card's personal fields: optional, and it never leaves the device (§3.2). It is not synced or backed up, so on another device the teacher draws it again. Only the image is kept, never the speed, pressure or timing of the strokes (§2.6).
- **Not a legal signature.** Like a printed strip, it counts only where the school accepts it. The legal signature comes with the national system: the weekly signature, with a key made on the teacher's device and certified by the state under Law 15-04 (§5.5).

**Print rules** (brief §11)
- **Paper and ink.** Safe in black and white, with binding margins. One PDF that a print shop can use.
- **Settings.** Subject order, for documents that list several subjects, such as a primary week printed at once (a primary daily page follows the day's sessions); one- or two-sided printing; and which pages to print. Teachers pay for their own printing, about 5 DA a page, so layouts waste no paper.
- **Fonts.** Fonts are embedded (Amiri, Noto Naskh Arabic). DOCX files name the Microsoft fonts that official documents use.
- **Dates.** Gregorian dd/mm/yyyy with Western digits, the Algerian month names (جانفي … أوت), and the school year as "2026-2027". The Hijri date is optional. The texts book's pages, on screen and in print, keep the paper book's form instead (2026/09/21), as teachers know it.
- **Mixed directions.** Arabic headers over a French or English body must render correctly.
- **Tamazight.** Latin script at least.

### 3.9 The weekly digest and notifications

**The weekly digest** goes to the teacher only, for each class. It shows:
- the class's position in the plan, and weeks ahead or behind;
- sessions lost to the calendar, shown separately, so that a closure never reads as slow teaching;
- spare sessions before the next exam window;
- catch-up options (Section 4);
- make-up sessions owed: those the teacher marked to be made up, or the director asked for (§7.7);
- sessions still awaiting confirmation;
- in the national system, weeks not yet signed.

**Other notifications**
- **A daily preview**, only if the teacher turns it on.
- **The year-end prompts** to export and to erase (§5.7), and **the reminder after 30 days with no sync and no backup** (§6.5). Both are on by default, and the teacher can turn each one off.
- **Quiet hours.** No notification between 20:00 and 07:00, or from Thursday 20:00 to Sunday 07:00. Teachers who work on Saturdays can adjust this.

### 3.10 Sharing, handover and devices

- **The progress statement.**
  - One per class, as a print, a PDF or a QR code (§5.9).
  - Its fields follow the state's April 2026 request:
    - the last domain or sequence completed;
    - the last main-plan resource taught, finished or in progress;
    - weeks of delay in the main plan, counted after the buffers, with TD on its own line (§4.7);
    - sessions not held, TD sessions included, shown only as calendar causes or "other". The reasons stay on the teacher's devices (§5.4);
    - the plan pack and its release.
  - It carries no pupil data.
  - The teacher decides when to share it, and a sharing history shows what went to whom, and on which day. The recipient is optional, and recorded by role only, never by name.
- **The handover package**, for a substitute or an incoming teacher. It is organised by topic:
  - the plan position;
  - the journal history;
  - the next item.

  The pupil list and marks travel only by direct transfer, and only if the teacher chooses. The incoming teacher's app re-paces from the last entry. In the national system, the incoming teacher receives the class's record through the school's space (§5.4).
- **Phone and PC.** Two ways to move data between devices:
  - the optional end-to-end encrypted sync, free for teachers (§5.8);
  - a direct transfer between devices.

  Section 5 designs both.
- **Staffroom PCs** (national system). The teacher signs in with their phone, or with a security key the school issues, and nothing stays behind when the session ends (§6.6).
- **Export.** A full export of everything, free, at any time (principle 7), except the teacher card's personal fields and the drawn signature, which never leave the device (§3.2).

### 3.11 Pilot and launch

| | Pilot (January–March 2027) | Launch (September 2027) |
|---|---|---|
| Levels | A few grades and subjects per level, chosen after the field check | All three levels, with the plan packs ready by then |
| In the app | Setup, Today and confirmation, roll call by list or seating plan, continuous assessment and marks, the term-2 export in March, the documents, the weekly digest, the progress statement. Sync only if its gates are met (§6.2) | All of this, plus the school's timetable package, handover, and sync, free |
| Languages | Arabic at least; French and English as their translations are ready | Arabic, French and English |
| Measured | • Seconds per session: median and 90th percentile<br>• Minutes per week. Paper is timed only in the field check (§10.2)<br>• The share of sessions confirmed in one tap<br>• Term exports completed | Published before launch |

The national system adds joining with a QR code, the weekly signature, the school's space and marks sent to the state's system, once the Ministry adopts Minhajna (§5.1). Its date is set then.

### 3.12 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| Design rules | The nine rules in §3.1 |
| Session outcomes | "Done as planned" in one tap; any other outcome in two. A whole day or week at once, with its exceptions |
| Reasons | Optional and private. None names collective action |
| Roll call | Half-days in primary, sessions in CEM and lycée. Everyone present by default. The paper book's counts, symbols, spreads and signature boxes |
| Pupil details | Only what the documents need. The confidential pupil-record pages print blank |
| Assessment | Official presets as data, the teacher's components, full precision |
| Appreciations | Suggested, then chosen for each pupil. No "fill all" |
| Term export | The workbook's unlocked cells, an ostad-ready view, printed sheets and a check before signing. Never passwords |
| Documents | Those in §2.5, plus the grade book and the weekly timetable. Each has template profiles and a blank version |
| Notifications | The weekly digest; a daily preview if the teacher turns it on; quiet hours |
| Pilot (changed by 0015) | The slice in §3.11, measured against paper |
| Section 3 | Settled on 27 Sep 2026 |

**Decided on 28 Sep 2026**

| Decision | Choice |
|---|---|
| Homework record | A texts-book record for each subject: the dates, the activity, and two class counts with their percentages of the class list. Never names |
| The teacher's signature | By hand, or a drawn signature that the teacher turns on. Kept like the teacher card's personal fields. Not a legal signature |

**Decided on 30 Sep 2026**

| Decision | Choice |
|---|---|
| Supervised or additional lessons | The texts book's page for them is filled only from sessions the teacher logs outside the timetable, and prints blank when there are none. The app never shows a teacher's unused hours |

**Decided on 3 Oct 2026**

| Decision | Choice |
|---|---|
| Seating plan | Roll call by list or by seating plan, from the pilot. The plan stays on the teacher's devices, in the private layer, and prints on one page |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Joining | In the national system, one QR code from the official assignment list. Class lists come in by themselves |
| Signing in | The fingerprint prompt or a PIN, never recorded. Without a smartphone, a school-issued security key on a school PC |
| The weekly signature | Each course's week, signed in one step. Unconfirmed sessions can stay unconfirmed. Corrections stay possible |
| What becomes official | The texts book, the journal, roll call and marks, in the national system |
| Marks and absences | Marks go to the state's system through the national interoperability system. Absences too, where the school chooses. The files stay as the fallback |
| Sync | Free for teachers |
| The pilot | No longer measures pages that directors countersign: before adoption, the project seeks no official acceptance of printed pages |

**Decided on 4 Oct 2026 (decision 0017, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Exam thresholds | In the national system, each exam's date and where the teacher's classes stand, as the director sees them. A school exam's cut is optional. When the subject's teachers use it, they sign it, and the earliest proposed cut applies. Monthly tests have nothing to sign |

**Decided on 5 Oct 2026**

| Decision | Choice |
|---|---|
| Dates in the texts book | The book's pages, on screen and in print, keep the paper book's form (2026/09/21). Every other screen and document uses dd/mm/yyyy |
| Catch-up | Lessons outside the timetable never move the plan and fill the page for supervised or additional lessons. The make-up sessions of the catch-up ladder count as plan sessions and go on the subject's pages |
| A roll call not yet saved | Listed on the teacher's Today until it is saved or dismissed. Nothing is sent or printed |
| Reminders | The year-end prompts and the 30-day reminder are on by default, and the teacher can turn each one off |
| Records kept before joining | They stay the teacher's own, unsigned and exportable. The school's space starts with the first week signed after joining, and no past week is signed |
| A session owed a make-up | Only when the teacher marks it «تُعوَّض هذه الحصة», or the director asks for a make-up. The app never decides it on its own |
| A school exam's cut | Before the exam, only the setters and the director see it. It applies once every setter has signed, the earliest when they differ, or when the director decides. Until then any setter can choose no cut |
| The pilot's timings | Kept on the phone, and compared with nothing. With the teacher's consent, they go once a month to the project's server, with no identifier |

**Open.** The field check, the pilot or the year's texts will settle these:
- **Primary continuous assessment.** Whether it is by activity (circular 1711) or by learning domain (the 2024–2026 grade books) in 2026/27.
- **The 2026/27 assessment circular.** How many tests (فروض), and when.
- **The 2026/27 grade workbook.** Its file type and columns.
- **Circular 244's list of appreciations.** It has not been found.
- **Roll-call counting rules.** Directors confirm them.
- **The lesson-note template** for each level.
- **Tamazight teachers.** What they keep, and in which script.

---

## 4. The lesson engine and plan packs

*Changes proposed on 29 Sep 2026 in decision 0015, for the national system run by the Ministry. That decision was accepted on 4 Oct 2026.*

This section specifies how Minhajna knows the lesson for each session:
- the plan packs, which hold the official plans as data;
- the pipeline that makes them, and who runs it each year;
- the calendar;
- the engine, which turns a plan, a timetable and a calendar into each class's lessons.

It carries out steps 1 and 2 of the core workflow (§2.3) and feeds the teacher app (Section 3). Section 5 specifies the file formats.

### 4.1 What exists today

- **The Ministry issues no lesson list.** It issues a chain of documents (research 09):
  - the curriculum and its accompanying document (2016), from the national curriculum commission;
  - annual plans (المخططات السنوية والتدرجات), from the IGP with each level's directorate. They call themselves "complementary working tools": teachers apply them, and inspectors may adapt them. The newest editions found date from September 2022;
  - textbooks and teachers' guides, which hold most lesson titles;
  - primary session plans, a 2020 trial edition that was never updated.
- **Teachers do the rest by hand:** dated distributions, lesson notes and texts-book entries (§2.1).
- **Nothing machine-readable exists.** There is no lesson list with identifiers, no dated distribution and no rule for lost sessions.
  - The plans circulate as PDFs on teachers' sites, with corrupted text layers and some scanned pages.
  - Communiqués are published as images.
  - No file carries a licence.
- **2026/27 has no new edition.** None had been published by 26 September 2026. The 3AP and 4AP plans no longer match those grades' timetables (Decision 16).
- **So Minhajna holds the plans as data itself,** as plan packs, until the IGP publishes them through Minhajna (§2.3, step 1).

### 4.2 Plan packs

A plan pack holds one official plan as data. There is one pack for each level, grade, subject, stream and edition.

**What a pack holds**
- **Items, in the plan's order.** Each item has one kind from a closed list:
  - diagnostic;
  - sequence or unit;
  - lesson or resource;
  - launch situation, integration, and solving the launch situation;
  - assessment and remediation;
  - project;
  - term assessment;
  - TD.

  The plan's own wording goes in the item's title.
- **A time anchor, which each pack declares,** because it varies by subject, not only by level:
  - **weeks:** primary Arabic, maths and history. A week can carry the plan's weekly model of session types, as primary Arabic does;
  - **budgets,** in hours or sessions per item: CEM plans, primary Islamic education and science, lycée French and physics;
  - **hybrid:** budgets, with week targets as checkpoints, as in lycée maths and Arabic.
- **Buffers,** which the plans build in and call a precaution:
  - the primary half-week of integration, assessment and remediation after each sequence;
  - lycée remediation weeks.

  A buffer is a spare session (§4.7). The diagnostic week is planned work, not a buffer (5 Oct).
- **Essential and optional items, and proposed merges.** A merge is only ever a proposal to the teacher.
- **Stage templates, as the official material prints them.** For example: تهيئة → بناء → تطبيق → تقويم, from the primary session plans. An item without a template uses "in progress / done".
- **Textbook references,** by page.
- **Provenance:** the issuer as printed, the edition, the source pages and where the file was found. Personal names are removed.
- **A licence mode:** link only, structure only, or full text once counsel clears it (§1.3). A link-only pack shows its item titles and session counts offline. Each item's text opens from its source, online, and is never copied into the app.
- **Tests and exams are not items.** The calendar places them (§4.5), and they reduce the sessions available.

**Every pack shows its status**

| Status | Meaning |
|---|---|
| Official | Published by the issuing authority itself, through Minhajna |
| In force | Keyed by the project, and an official text confirms that this edition applies this year |
| Latest found | The newest edition found, keyed and checked |
| Stale | A later decision changed the subject's hours or content. For example, the 2022 3AP pack still has rows for subjects removed in 2025/26 |
| Community | A teacher's or a district's plan, reviewed |

**Identity and releases**
- **Pack IDs** follow `dz.<level>.<grade>.<subject>[.<stream>].<edition>`, for example `dz.cem.3am.math.igen-2022`.
- **One release per school year,** for example `2026.1`, with quick fixes as `2026.2`, `2026.3`.
- **Item IDs never change meaning.** A renamed, split or merged item gets a migration entry, so every class's progress survives an update.
- **A class stays on the release it pinned** (§3.2). When a new release ships, the teacher sees what changed and chooses when to move. Recorded sessions never change.

**Variants are layers, not copies**
- The layers, from the bottom up:
  - the national pack;
  - a district variant: an inspector's distribution, credited and used with their consent;
  - a school variant, for parallel classes, set by the subject's teaching council and sent by its coordinator. Each teacher applies it class by class;
  - the teacher's own changes.
- Each layer holds only operations: reorder, merge, split, re-budget, skip and add. A fix to the national pack still reaches every class.
- When a class moves to a new release, the migration entries that carry its progress also carry every layer's operations. The app does this on the device:
  - an operation on a renamed item stays as it is;
  - an operation on a split or merged item is carried across when its meaning stays clear. Skipping a split item skips every part, and an item added after it comes after the last part;
  - when the meaning is not clear, the app asks the teacher before the move, and never guesses. For example, the teacher gave an item two sessions, and the new release splits it in two. The answer goes into the teacher's own layer.
- A variant is never labelled official: the app shows it as a variant, not official.

**Where each pack comes from is always shown.** Until the IGP publishes a pack itself, the app says so, for example: "Based on the September 2022 national edition, keyed by Minhajna's curators. Check with your inspector." (principle 6).

**Without a pack,** the teacher can type their own list of items, and it works like a pack. They can offer it to the data repository, where it is reviewed as a community pack (§1.7).

### 4.3 The pack pipeline

**Two ways in, one pack out** (§2.3, step 1)
- **Upload the PDF.** Software extracts a draft: rows, weeks and item titles. People then retype and check every number and every Arabic word against the page images, because the text layers of these files are corrupted. In one plan, "2022" reads "2222".
- **Fill in the form.** The author enters the plan directly: items, anchors, budgets and stages. The form is also the editor that curators use for every pack.

**The states of a pack release:** draft → under review → published → superseded or withdrawn.

**Who runs it**
- **Now:** the project's data curators and subject maintainers. Subject maintainers are practising teachers of that subject and level, with at least two for each widely used pack.
- **Inspectors** may review a pack. They are credited only with their consent, and their review is never presented as official approval.
- **When the IGP joins,** it runs the same pipeline, through accounts on the project's editor or on its own hosting. Its packs carry the status "official".
- **The teacher council** advises on which packs come first (§1.8).

**Checks before a release is published**
- **Automated:**
  - every item cites a source page, and every pack has an issuer, edition, status and licence mode;
  - a week pack has no missing weeks, and each week covers its weekly model;
  - a budget pack fits the timetable grid's hours across the teaching weeks, and the plan's own horizon. A plan that cannot fit is a finding to report to the IGP: one 2022 plan admits that most teachers don't finish the 2AS science maths programme;
  - no extraction artefacts remain, and every number was typed twice;
  - every ID change has a migration entry.
- **Human:** two people, a curator and a subject maintainer, check the pack against the page images and compare it with last year's release.

**AI** helps extract drafts, for curators only (§2.5). It never sees pupil data, and the model, the prompts and where it runs are public (§1.5). Personal names are removed from files before any processing.

**Uploaded files are untrusted.** They are opened in isolation, their metadata is removed, and any active content in them is never run (§5.9).

**Sources are kept as references,** not copies, until counsel clears their text (§1.3).

**Errors from the field.** "Report a plan error", in the app, sends the item's ID with the teacher's note. The teacher sees the report before it is sent and chooses whether to be credited (§1.5, §1.7).

### 4.4 The yearly cycle

| When | Work |
|---|---|
| Late July | Decisions on timetables and curricula appear. Next year's branch opens, and the packs they affect are flagged |
| August | New or changed packs are keyed, textbook references are updated, and drafts go to subject maintainers |
| From teachers' return to pupils' start (13–21 September in 2026) | **The September release**, with status flags and a calendar holding the start dates |
| The first four weeks | Quick fixes for reversals and freezes. In 2026, Decision 19 was frozen on 17 September |
| When the Ministry publishes them | The calendar release: holidays and exam windows |
| All year | Calendar fixes within 24 hours of a communiqué or closure |
| June | Error reports and plan feedback are reviewed, and next year's work is planned |

**Nothing arrives as a feed.** Changes come as decisions, the yearly framework circular, correspondences relayed by the press, communiqués posted as images, and closure notices in posts, the press and local radio. A curator keys each change by hand, with its source attached.

### 4.5 The calendar

**Four layers,** from broadest to narrowest:
1. **National:** holidays, public and religious days, exam windows, Ramadan hours.
2. **Wilaya:** the wilaya's own dates and weather closures. The teacher's wilaya is asked at setup and never sent (§3.2).
3. **School:** events, local closures and make-up days.
4. **Teacher:** training days, seminars and duties, and sessions not held, which stay private (§3.3).

**Every entry carries its source and its confidence:** announced, expected (lunar dates, give or take a day) or projected. When the moon sighting is announced, one tap confirms a lunar holiday.

**What an entry can do to the sessions** (research 12):
- cancel them: a holiday or a closure;
- replace them: an exam week. The plan pauses, and the sessions it replaces are neither held nor lost, since the September check already leaves the exam windows out (§4.7);
- add them: support, remediation, or revision during the holidays;
- change their times: Ramadan;
- set or reset the A/B week;
- switch to rotating groups, as in the October 2020 emergency. An item taught to each group counts once, on the day the second group has it. The repeat lessons count as lost to the calendar, so they never read as delay.

**Session lengths.** A session-length profile holds the Ramadan rules for each level.
- In 2026, CEM and lycée sessions kept their places and shrank from 60 to 45 minutes. Primary periods were shortened. Sessions keep their start times until the year's Ramadan notice gives others, which arrive with the calendar. The primary profile stays an example until that notice.
- A shortened session still counts as one session.
- The texts-book entry prints the real duration.

**Late news is normal.** In 2025/26 alone (research 09):
- classes were suspended for two days in dozens of wilayas;
- a whole wilaya, and single schools, closed for the weather;
- Ramadan hours were announced two or three days ahead;
- term-3 exams were moved seven weeks ahead.

So the calendar takes updates the same day, received with the reference data (§4.8) or added by the teacher.

### 4.6 How sessions are generated

- **Slots point to bell times.** A timetable entry names a slot, not a clock time. Bell times come from templates for each level, shift and kind of day, so Ramadan changes the times without touching the timetable. A school's timetable package carries its bell times when it has them, and the teacher can set each slot (§7.4). A double shift has one template for each shift.
- **Week patterns.** An entry runs every week, in A weeks or in B weeks. The calendar stores each teaching week's parity. By default it alternates and skips holidays, and it can be reset each term. The school sets the letter. Holidays take none, and exam weeks keep theirs.
- **Versions.** A new timetable applies from its effective date, and a one-off change touches only its own date. The teacher can record a one-off change in their own week, such as a swap with a colleague, even when the school sends the timetable. The school's version stays as sent (§7.4).
- **Primary activity slots.** A primary slot can carry its activity type, such as "reading, session 3", which week packs use.
- **Teacher blocks,** such as the pedagogical half-day, hours in another school, duties and reductions, take time out of the week without belonging to any class.
- **Generation.** Each class's dated sessions come from the timetable version in force, the calendar and the bell times.
- **The past never moves.** Regenerating touches only future sessions that have not been recorded. A new timetable never rewrites a recorded session (§2.3, rule 4).

### 4.7 The engine

**The chain**

```text
plan pack → course (class × subject × school year) → timetable version → dated session
          → proposed lesson → the teacher's record → progress, documents and exports
```

**The states of a session**
1. Scheduled.
2. Proposed.
3. Recorded: done, changed or not held.
4. Covered, or carried over from the stage reached.
5. An official snapshot, once the teacher signs the week in the national system (§5.4, §5.5).

**The proposal**
- **It is always the class's next unfinished item,** starting at the first stage not yet covered.
  - Week packs match the slot's activity type within the weekly model. A plan week's maths lessons spread over that week's maths slots, in order.
  - Budget and hybrid packs take the next item in order.
- **TD, remediation and support slots have their own queues.** They never advance the main plan. They are real slots: circular 465 put the TD guide into use and ordered remediation in 3AP and 5AP. Each queue is counted apart: the September check, the buffers and the delay count main-plan sessions only, and TD, remediation and support show their own counts.
- **Tests and exams come from the calendar** and the teacher's test schedule, never from the pack.
- **Where the plan says the class should be** is worked out separately, only as a reference:
  - for week packs, from the teaching week;
  - for budget packs, from the budgets that fit into the main-plan sessions scheduled so far, today's included.

**Progress**
- **Stages, not percentages.** "Last stage reached" keeps the item at the head of the queue. Its remaining stages move to the next ordinary session of the same class and subject, not to a TD, remediation or exam session. The journal and the texts-book entry read "تابع: <title>", with the stages still to cover.
- **No template:** "in progress / done", plus the sessions spent.
- **Fractions** such as "2 of 4 stages" can be shown, but never typed.
- **Half-groups.** An item taught in fortnightly TD counts as done for the class only when every half-group has had it.
- **Never locked to the plan.** Free text and unplanned content are always allowed. Abroad, registers that locked the log to the plan made teachers republish the plan just to merge two topics (research 11).

**Counting time**
- **In sessions, not hours.** Hour budgets are converted with the class's session length: 1 hour in CEM and lycée, 30 to 90 minutes in primary. Counting in minutes is an option. With it on, minutes show beside the sessions, but a shortened session still counts as one, so the buffers and the class's position don't change. The texts book records the actual time.
- **Delay,** in sessions, and in plan weeks for week packs. Sessions lost to the calendar are counted separately, so a closure never reads as slow teaching.
- **Buffers first.** While the buffers left before the next exam window can absorb a delay, the digest shows it as buffer used, not as a delay. A buffer is a spare session: a "تابع" session uses one only when its item runs past its planned sessions (5 Oct). When a closure takes the last buffer, the digest lists the session as lost to the calendar and shows no buffer left.
- **Spare time:** the sessions left before the next exam window, minus what the plan still needs by then.
- **The September check.** From the first day, each class shows: "The plan needs N sessions before the term-1 exams. Your timetable and the calendar give M." Plans assume fewer weeks than the calendar holds: 31–32 in primary and 27 in lycée French, against about 34–36 in 2026/27. The gap goes to exams, tests, diagnostic work and disruptions, so it is not spare time.

**The catch-up ladder.** When a class falls behind, the options come in this order:
1. **Compress** the item in progress. The teacher does this; the app does nothing.
2. **Use the pack's buffers.**
3. **Merge items, or leave out optional ones,** from the pack's proposals. The teacher confirms each one.
4. **Add make-up sessions,** which the teacher schedules with the administration. They count as plan sessions and go on the subject's pages, unlike the lessons outside the timetable (§3.3).
5. **Re-pace the rest of the term.** The app builds a new distribution for the teacher to review and print. In primary, the director approves it (Decision 839 Art. 12). Until then, the current distribution applies.

**Never:**
- drop an item silently;
- push an item past an exam window silently. The app warns, and the warning stays until the teacher decides, now or later;
- apply a merge on its own.

**Fixed points.** Tests, exams and TD sessions keep their dates, and lessons flow around them, skipping holidays. Moving lessons backward never deletes one, and every move can be undone from the history.

**Special cases**
- **Parallel classes.** Each class keeps its own queue. "Align with class X" copies a position. The app warns before a common test or exam window if parallel classes have drifted apart.
- **Multigrade classes.** One queue for each level (§3.2).
- **Lycée reorientation.** 2AS classes reshaped on 8 October get a "merge class history" step. Each new class says where its pupils came from and which old class's history and plan position it takes, and nothing changes before the teacher confirms. Pupils carry their marks into their new class. The marks of pupils who go to a class the teacher doesn't teach stay in the archived old class, ready to export for their new teacher.
- **A new teacher mid-year.** The class's queue carries over in the handover package (§3.10).

**On the device.** The engine runs on the teacher's device, with no network and no server (§1.5). Its results belong to the teacher.

### 4.8 Getting packs and calendars to the app

- **The app ships with** the current packs and calendar.
- **Updates** come from the data repository, or its mirror in Algeria. Downloads need no account and send no identifier, and `NETWORK.md` lists them (§1.5).
- **Offline too.** An update can travel as a file or a QR code, for example from a colleague or the school.
- **Signed data.** Every release of reference data is signed, and the app checks the signature. A pack passed from phone to phone cannot be changed without the app noticing.

### 4.9 What goes upward

- **The teacher's own sharing.** Progress statements carry the pack ID and release, so statements from different classes and schools can be compared (§3.10).
- **Plan feedback, in the opt-in insights (§1.6).** Which items teachers most often merge, skip, split or re-teach. That describes the plan, never a teacher, and it can show where a programme is too dense to finish. Section 8 designs the insights.
- **In the national system,** the curriculum report gives the same feedback as totals above the school (§5.10). It replaces the opt-in insights once it exists (§8.4).

### 4.10 The rest of the reference data

The same repository, review and yearly cycle hold the other data the app needs (brief §8). Each item is versioned, with its source and the dates it applies to (§1.14).

| Data | Source | Status on 27 September 2026 |
|---|---|---|
| Timetable grids | Ministerial decisions | Primary: Decision 16. CEM: the 2025/26 grid, restored when Decision 19 was frozen. Lycée: the 2006/07 grids |
| Bell times | Schools, and the Ramadan communiqués | Templates by level and shift |
| The school calendar | Ministry communiqués | Only the start dates are published |
| Formulas and coefficients | The yearly assessment circular | The 2026/27 circular is not out. Two sources disagree on the CEM coefficients |
| Number and timing of tests | The same circular | Unknown |
| Appreciations and banned phrases | Circular 244 | The list has not been found |
| Grade workbook variants | The administration's file | File type and columns not confirmed |
| Print layouts | Teachers' templates and inspectors' profiles | No official layout |

**A text that changes a rule mid-year** applies from the date it sets. Marks already recorded never change. Averages follow the rule in force for their term, and the history shows any change.

### 4.11 Field check, pilot and launch

| | Field check (now to December 2026) | Pilot (January–March 2027) | Launch (September 2027) |
|---|---|---|---|
| Packs | About five packs keyed in full, once the pilot slice is chosen, for example:<br>• primary 5AP Arabic and maths (weeks)<br>• CEM 1AM maths and 3AM French (budgets)<br>• one lycée pack, such as 1AS maths (hybrid)<br><br>3AP and 4AP wait while their plans are stale | The same packs, with fixes from the field | The first full September release, for 2027/28, at all three levels, as far as packs exist. Lycée packs allow for the streams announced from 1AS in 2027/28 |
| Calendar | The 2026/27 calendar, as the Ministry publishes it | Ramadan 1448 (about 7 February to 8 March 2027) and a probable move of the term-2 exam week: a live test of the layers and session lengths | Fixes within 24 hours, all year |
| Tested or measured | The anchors and the stage picker, with teachers. The September check, shown to an inspector | • Sessions confirmed as proposed, per pack<br>• Plan errors reported, and the time to fix them<br>• Time from a communiqué to the calendar fix | Published before launch |

### 4.12 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| Plan packs | One per level, grade, subject, stream and edition. Each declares its time anchor, uses the closed item kinds and the stages as printed, and shows its status and source |
| Official status | Only for packs the issuing authority publishes itself. A variant is never labelled official |
| Variants | Layers of operations over the national pack, never copies |
| Pipeline | A PDF or a form becomes one pack, which two people check before it is published. Curators run it now; the IGP can run it when it joins |
| AI | Extraction help for curators only. The model and prompts are public; no pupil data |
| Calendar | Four layers. Each entry has a source and a confidence level. Fixes within 24 hours |
| Engine | Runs on the device. It proposes the next unfinished item, counts in sessions, uses buffers before it reports a delay, and follows the catch-up ladder. It never drops an item, or moves one past an exam, without the teacher |
| Updates | A class stays on its release until the teacher moves it. Recorded sessions never change |
| Pilot packs | About five packs, keyed in full by December 2026, once the pilot slice is chosen |
| Section 4 | Settled on 27 Sep 2026 |

**Decided on 29 Sep 2026**

| Decision | Choice |
|---|---|
| Layers across releases | When a class moves to a new release, the migration entries carry every layer's operations, on the device. What they cannot carry clearly, the teacher decides before the move |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Official snapshot | A session becomes part of the official record once the teacher signs its week, in the national system |
| Plan feedback | In the national system, the curriculum report's totals, which replace the opt-in insights once they exist |

**Decided on 5 Oct 2026**

| Decision | Choice |
|---|---|
| Counting the queues | Each queue is counted apart: the September check, the buffers and the delay count main-plan sessions only |
| One-off changes | The teacher can record one in their own week, even when the school sends the timetable. The school's version stays as sent |
| Buffers | Counted in sessions. A "تابع" session uses one only when its item runs past its planned sessions. The diagnostic week is planned work, not a buffer |
| A session owed a make-up | Only the teacher's mark, or the director's request, makes a session owed (§7.7) |

**Open**
- **The copyright status of the IGP's plans** (§1.17). Until counsel answers, packs hold structure and links only.
- **The 2026/27 plans.** Whether new editions reach teachers through their accounts, and which plans cover 3AP, 4AP (including French from scratch) and English in 1AM and 2AM.
- **Which lycée plans are in force.** An archive of 89 lycée plan files from September 2022, covering 23 subjects, was found (research 09). The 2027/28 streams may change them.
- **Stage templates** for the many CEM and lycée items that have none.
- **How schools set A/B weeks.**
- **Whether parallel classes sit common exams** in CEM and lycée.
- **Ramadan in primary:** which sessions shrink or drop.
- **Subject maintainers:** at least two for each pilot pack, recruited from the field-check group.
- **Whether the IGP will run the pipeline** or adopt the format. The state track (Section 8) finds out.

---

## 5. Data, formats and foundations

*Redesign proposed on 29 Sep 2026 in decision 0015, for the project's goal: national adoption, with the Ministry running Minhajna on government servers, and in decision 0017, for exam scope. Those decisions were accepted on 4 Oct 2026. The founder's choices of 29 Sep 2026 are marked "(29 Sep)".*

This section specifies:
- how the apps and the server fit together, and who runs the server;
- the data Minhajna keeps, and where each kind of record may go;
- the history, signing, sync and retention rules;
- the files Minhajna reads and writes;
- the foundations that make the records official when the Ministry adopts them.

Section 6 covers keys, encryption, security and the other non-functional requirements.

### 5.1 Built for the national system from day one

- **The target is one national system, run by the Ministry** on government servers (29 Sep). The teacher app comes first, and every part of it is built for that system from the first release. Later means a later deployment, not a later architecture.
- **The design is the teachers' protection** (29 Sep). No agreement or ministerial text is required before the Ministry hosts Minhajna. So everything that protects teachers must hold whoever runs the servers: what the server can read and compute is limited by the design itself (§5.2, §6.5).
- **Version 1 builds these foundations,** even where no screen uses them yet:
  - stable identities for every record (§5.3);
  - a history that is only ever added to, and shows any tampering (§5.5);
  - record layers that decide where each record may go and who holds its keys (§5.4, §6.5);
  - the weekly signed record (§5.5);
  - a permission model for every role, enforced by keys (§5.10);
  - logs of every correction, export, share, access and deletion, which the teacher sees;
  - retention, archive and deletion rules (§5.7);
  - documented open file formats (§5.9).
- **Built for the national launch,** before the mandate starts (§6.8):
  - school spaces on the server (§5.8);
  - legal electronic signatures (§5.5);
  - the school archive (§5.7);
  - the connector to the national interoperability system (§5.9);
  - the totals above the school (§5.10);
  - sign-in with a security key, for teachers without a smartphone (§6.6).
- **Being ready does not make a record official.** That starts only when the Ministry adopts Minhajna by a ministerial text (§1.15). The founder's first ask to the Ministry is that text: the full digital record, official and compulsory from the national launch, covering the texts book, the journal, roll call and marks (29 Sep). The ask includes the charter's protections, as a request, not a condition (29 Sep).
- **Until the Ministry's system opens, Minhajna runs in teacher mode only** (29 Sep). The project runs no school or directorate deployments before then.

### 5.2 Architecture

| Part | Built with | What it does |
|---|---|---|
| Android app | React Native, for Android 8 and later | The whole teacher app, offline. The phone holds the teacher's working record (device first, 29 Sep) |
| Web app for PCs | React, installable, offline | The same app in the browser. On the teacher's own PC, the data stays in that browser. On a shared staffroom PC, the teacher signs in with their phone, and nothing stays behind (§6.6) |
| Shared core | TypeScript | The engine, the assessment rules, the file formats, the document templates, and all encryption and signing. Both apps use the same code, so they give the same results and enforce the same protections |
| Server package | NestJS | One package, installed by whoever runs it. It stores and passes on encrypted records, mirrors the reference data, hosts the pack editor (§4.3) and receives problem reports. In the national system it also holds the school and directorate spaces (§5.8), forms the totals above the school (§5.10) and connects to the national interoperability system (§5.9) |

**Maps on the web screens** (29 Sep)
- **Four web screens show who holds what as a map:** the pack editor's release map (§4.3), the school key and its recovery (§6.5), what enters and leaves the school's space (§5.9, §7.5), and the operators' view of the server package.
- **They are drawn with React Flow** (MIT). It needs a browser, so the Android app has no maps.
- **The maps are for reading.** Keys, devices and flows change only through buttons, never by dragging a link.

**Charts on the web screens** (29 Sep)
- **Progress and totals are drawn with Apache ECharts** (Apache-2.0), run by the Apache Software Foundation: how far classes got, the totals above the school (§5.10), and each exam's threshold (§7.10).
- **Charts of a school's own records are drawn on the device,** since the server cannot read them. Reports that carry only totals, such as the published threshold of a directorate or national exam, are rendered on the server as SVG for printing.
- **ECharts has no right-to-left mode and no keyboard navigation,** so the app mirrors the axes and puts a table of the same figures beside every chart.
- **The Android app draws its few charts itself** with react-native-svg, with labels as native text so that Arabic is shaped correctly.

**One package, two operators**
- **Until teachers have moved to the Ministry's system, the project runs the server package** in Algeria, free for teachers (29 Sep).
- **After adoption, the Ministry runs it** on government servers: one national system, with a space for each directorate and each school (29 Sep).
- **The Ministry's app is the project's release,** with the Ministry's name and icon as settings, built reproducibly so that anyone can check it against the published code (29 Sep). The Ministry runs its deployment under its own name; only the project's builds are called Minhajna (29 Sep, §1.9). The project's own app can always connect to the national system too. If a check finds that the Ministry's build weakens the charter, the project publishes the finding at once (§1.9, 30 Sep).
- **The Ministry needs nothing from the project to run it.** It installs the releases the project publishes, on servers with no internet access. There is no project key, licence server or call home.
- **After adoption, the Ministry's own staff maintain Minhajna** (29 Sep), as maintainers in the project's public process, where releases, the principles and the charter are still decided. The Ministry deploys each release within an agreed window, and security fixes for critical flaws within 7 days (29 Sep, §6.7).
- **Teachers move from the project's server to the Ministry's** one by one, when they join their school's space, with their consent (§5.8). The project's server closes once they have moved (29 Sep).

**Rules that hold whoever runs the server**
- **The apps never need the server** to open or to do the daily work (§1.5). No deadline depends on the server (§6.8).
- **The server cannot read named records.** Everything it stores about a teacher, a class or a pupil is encrypted to keys held only by the teacher and their school, and, for a limited time, by their inspector, for lesson records only (§6.5). The Ministry's staff cannot read it, even though the Ministry runs the servers.
- **Above the school, only totals,** formed so that the server never learns a figure for one school or one teacher (§5.10).
- **Nothing on the server tells time.** No clock times, "started" events, sign-in events or locations exist anywhere to be read, and sync arrives in fixed batches that reveal nothing about when a teacher worked (§5.8).
- **No proprietary libraries,** such as Google Play Services or Firebase (§1.3). Builds must be reproducible and pass F-Droid's checks. This is tested before the pilot (§5.13).
- **Notifications are scheduled on the device.** There is no push service.
- **Documents are made on the device.** Each document is built as a web page with print styles, then turned into a PDF by the device's own web engine, which shapes Arabic and mixes directions correctly. DOCX files are generated directly. Nothing that names a teacher, a class or a pupil is rendered on a server.
- **The web app runs no code on the server.** It updates only when the teacher accepts the update, and it shows its build checksum, which anyone can compare with the published one (§1.9). Section 6 covers how that code is checked.
- **One set of rules, one set of tests.** The formulas, the averages and the engine are checked against published test cases, run in both apps.

### 5.3 The data model

**Reference data.** Public and versioned, with effective dates, grouped by country code (§1.14). Section 4 lists it (§4.10):
- the school year and the calendar layers;
- bell-time templates and session-length profiles;
- timetable grids;
- plan packs, their releases and stage templates;
- assessment rules: components, formulas, coefficients and the number of tests;
- appreciation lists and banned phrases;
- grade-workbook variants and print layouts.

**The teacher's records.** Kept on the teacher's devices. When the teacher belongs to a school space, the school's copy is kept on the server, encrypted so that only the teacher and the school can read it (§5.4, §6.5).

| Record | What it holds |
|---|---|
| Teacher card | The details the documents print. The personal fields are optional |
| School | Its official code, name, level and wilaya, from the sector's information system. In teacher mode, typed by the teacher. A teacher can work in several |
| Class and group | Level, stream and pupil counts. Groups: the whole class, half-groups and option groups |
| Pupil | Only the fields in §5.6 |
| Course | Class × subject × school year, the anchor for progress (§2.3, rule 3). It holds the pinned pack release and the teacher's changes to the plan (§4.2) |
| Assignment | Who teaches the course, with dates: the holder, a substitute or a co-teacher |
| Timetable version | Its entries (day, slot, week pattern, group, room), teacher blocks, effective dates and source |
| Session | One dated occurrence of a course, and its state (§4.7) |
| Session record | The outcome, the items and stages covered, the session type, homework, any test, the factual line and the private note |
| Attendance entry | For each pupil, session or half-day: absent or late, and whether an absence is justified |
| Seating plan | A class's or group's seats, as the teacher arranges them for roll call. Private layer (§3.4) |
| Assessment | Components and weights, marks, observations and the appreciations chosen |
| Sharing record | What was shared, with whom, and on which day |
| Signed week | One week of a course's records, signed by the teacher. In the national system, it is the official record (§5.5) |
| School membership | A teacher's place in a school space: the assignments it covers and the teacher's device keys (§5.8) |
| Inspection grant | An inspector's access to the lesson records of named courses and weeks, granted by the authority, with its start and end dates (§5.10) |
| Exam threshold | For an exam with a common paper: its announced date, the figures taken that day, the cuts proposed and the one adopted, with the setters' signatures. Kept in the space of the level that sets the exam (§7.10) |

**Identities**
- **Every record gets a random ID on the device,** so records made on different devices never clash and can be merged.
- **Reference data uses readable IDs** that never change meaning (§4.2).
- **Official identifiers come from the state.** In the national system, schools, class groups and assignments carry the codes of the sector's information system, imported through the interoperability connector (§5.9), so nobody types them twice. A new school appears when the state's system lists it.
- **Pupils are matched by their official registration number,** never by name.
- **Progress belongs to the course,** not to the teacher, so it survives a change of teacher.

### 5.4 Where each record may go

Every record belongs to a layer, and the layer travels with it. Every sync, export and share checks the layer, so a private note can never slip into a statement. Each layer's keys decide who can read it on a server (§6.5), so the rules hold whoever runs the server.

| Layer | Examples | Where it may go | Who can read it on a server |
|---|---|---|---|
| **Private** | Private notes; the reason a session was not held or an item skipped; the seating plan (3 Oct) | Only the teacher's own devices, the teacher's own full export, and the seating plan's printout (§3.4). Never into a statement, a handover, a school space or any total | Nobody. It never reaches a server, except encrypted for the teacher's own devices |
| **Pupil records** | Class lists, roll call, marks, observations, appreciations | The teacher's devices and the files the teacher makes. In a school space, the school's copy, once the teacher signs the week (29 Sep). Class lists come in from the sector's information system (§5.9). Marks go to the state's system through the interoperability connector (29 Sep), and absences too if the school chooses (29 Sep). To a successor through the school space, or by direct transfer | The teacher and the school. The state's system receives marks, and absences where the school chooses, encrypted for it alone |
| **Lesson record** | Items and stages, session types, homework, tests, the factual line, and each session's confirmation status | Statements and handover packages. In a school space, each session's confirmation status as it syncs, for the director's view (29 Sep), and the full record once the teacher signs the week (§5.5). The school's copy holds each session's current status, never the day it was confirmed (§7.6). In teacher mode, lesson-level insights only if the teacher opts in (§1.6) | The teacher and the school. The teacher's own inspector, during a grant, reads the signed weeks it names, never the confirmation status as it syncs |
| **Shared statement** | Progress statements and handover packages | Whoever the teacher gives it to. Each one goes into the sharing history | Only those it is given to |
| **Official snapshot** | The signed weeks, in the national system | The school's archive, signed, kept for the declared period. Corrections are added, never overwritten (§5.5) | The teacher and the school. The teacher's own inspector, during a grant, reads their lesson record, never their pupil records |
| **Totals** | Figures above the school | The directorate's and the Ministry's screens, only above the minimum group sizes (§5.10). The figures behind a directorate's or a national exam's threshold are published after the exam (§7.10) | The directorate and the Ministry, as totals only. Never a figure for one school or one teacher |

### 5.5 History, corrections and signatures

- **The history is the record.** Every change adds an entry, and nothing is overwritten. What the screens show is worked out from the history.
- **Corrections keep both versions** (§3.1, rule 4). Corrections to roll call and marks ask for a short reason; other corrections may carry one.
- **Tampering shows.** Each change is chained to the one before it, so an edit or a deletion made outside the app is detected.
- **Dates, not clock times.** The history records the day and the order of each change, never the time of day (charter point 3).
- **The teacher sees everything:** the change log, and every export, share, access and deletion.
- **Signed files.** Each teacher has a signing key, made on their device. Statements, handover packages and timetable packages are signed, so a reader can check that nothing changed since they were issued, and that they come from the same teacher as before. The key never leaves its device. A new phone makes its own key, and the old phone or the recovery sheet vouches for it: a reader sees that the same teacher has had a new key since that day, and what was signed before stays valid. A new key that nobody vouched for fails the check (5 Oct). In teacher mode, this is not a legal signature.
- **The weekly signature** (29 Sep). The teacher signs each week of each course, in one step, with the fingerprint prompt or the PIN. Until then, the week is the teacher's working record and changes freely. Once signed, it becomes the school's record, and in the national system the official record: the official snapshot (§5.4).
- **Corrections are always possible** (29 Sep). A signed week can still be corrected. The correction is added and signed, and both versions stay and show, so an honest correction never looks like tampering. Official records are legal evidence; being able to correct them is what keeps that fair to teachers.
- **Legal signatures in the national system.** When a teacher joins their school space, the state's certification authority certifies the signing key made on their device, so the weekly signature counts under Law 15-04. The authority receives only the key's public half and the official assignment. The key never leaves the device. Counsel confirms the route.
- **The date is set on the device.** A signed week or a term export counts from the day it was signed on the device, even if the network delays it (§6.8). The Ministry's text sets this rule.
- **Paper stays the fallback** (charter point 9). A session recorded on paper, when no device was at hand, is entered afterwards, with the day it was taught.
- **Deletion is real.** When the teacher deletes a pupil's data or a past year, the content is erased. The history keeps only the fact that something was deleted, and on which day. Erasing the data of a pupil who has left changes no total already printed, signed or sent. Open views and reprints leave the pupil out, with a note that one pupil's records were erased (5 Oct).

### 5.6 The minimum data

- **Pupils:** the official registration number, the name (in Arabic, and in Latin letters if the list has them), sex, class and group, and movements with their dates and reasons. Nothing else is imported or asked for.
- **Never collected:**
  - health, disability, religion, ethnicity or biometric data;
  - pupil photos;
  - parents' details or home addresses. The confidential pages of the roll-call book print blank (§3.4).
- **Absences are justified or unjustified.** The cause itself is never typed, because it is often a health matter.
- **Imports keep only the listed columns** and drop the rest before anything is saved (§5.9).
- **The teacher card's personal fields** are optional and never leave the device.
- **Teachers, in the national system:** the official staff identifier and name from the assignment list, used only to join the school space (§5.8). No phone number, e-mail address or password.

### 5.7 Retention and the yearly archive

- **Each school year closes into its own archive.** It stays available, can still be corrected, and can be exported whole.
- **Retention classes,** with defaults the teacher can change:

| Records | Default | The teacher can choose instead |
|---|---|---|
| Lesson records | Kept until the teacher deletes them. For comparison, schools keep the texts book in their archive for at least 3 years after the school year (Decision 155 of 1991, Art. 13, and the Ministry's 1999 schedule of school documents) | Erasure offered 3 years after the school year |
| Pupil records | Once the following school year ends, the app offers to erase that year's pupil records and seating plans, keeping the lesson records. A closed year imported from an archive follows the same rule, counted from its own school year | Erasure offered once their own school year ends |
| Private notes | Kept until the teacher deletes them | Erased with their year's pupil records |
| Logs | Kept as long as the records they describe | Nothing: they follow what they describe |

- **Year-end prompts** remind the teacher to export and to erase what they no longer need.
- **"Erase this device"** removes everything from a phone or browser in one step.
- **In the school's space, in the national system,** the school's copy and the official record follow the retention the Ministry declares as controller (§1.15). For example, the signed weeks are kept for 3 years, like the texts book. The teacher's own copy keeps the teacher's settings.
- **A teacher who leaves the school** keeps a full copy of their own lesson records (principle 7). The school keeps its copy and the official record.

### 5.8 Sync, school spaces, backup and moving between devices

- **Two kinds of sync, both end-to-end encrypted.** The server only stores and passes on data it cannot read.
  - **Between the teacher's own devices,** readable only by the teacher. Free for teachers: on the project's server until the teacher moves to the Ministry's system, then on the Ministry's (29 Sep).
  - **To the school space, in the national system:** the school's copy of the teacher's courses (§5.4), readable only by the teacher and the school.
- **Joining a school space** (29 Sep). The school gives each teacher a QR code made from the official assignment list. The teacher scans it once. The app links the key in the teacher's phone to their assignments in the school's space, and from then on the teacher signs in with the fingerprint prompt or a PIN (§6.4). There is no password, no account to activate and no reset through the director. The app keeps working offline without signing in, and the teacher is never locked out of their own copy. A teacher who has no smartphone, or doesn't want to use their own, joins on a school PC with a security key the school issues (§6.6).
- **Moving to the Ministry's system** (29 Sep). When the national system opens, the teacher joins their school's space there by scanning its QR code. The app shows what will move, and moves it once the teacher agrees. Only the teacher's app holds the keys, so only it can move the records. Private notes stay on the teacher's devices. What the teacher kept before joining stays their own, unsigned and exportable, and no past week is signed (5 Oct). The project's sync account closes once everything has arrived and been checked, and what it held is erased within 10 days. The recovery sheet stays valid. From then on, the Ministry's server knows the phone by its key and the official assignment.
- **Fixed batches.** The app sends to the server in batches of a fixed size, at set times of day, whether or not anything changed. So the server cannot tell when a teacher confirmed a session, or whether they did anything at all. The director's view of confirmation status (§7.6) updates with each batch, a few times a day.
- **Only new changes travel.** Because the history is only ever added to, sync sends the changes made since the last sync. The payloads are small, and an interrupted sync resumes over mobile data.
- **No change is ever lost.** If two devices change the same thing before they sync, both changes stay in the history. When they differ, the app asks the teacher which one to keep.
- **The app shows how many changes are waiting to sync.**
- **Direct transfer,** without the server, over the local network after scanning a QR code, or as an encrypted file that opens with the recovery key (§3.10).
- **Backup.** An encrypted backup file that the teacher keeps on a PC, an SD card or a USB key. The phone's cloud backup never receives pupil data (§1.5).
- **A lost phone** is recovered from sync or from a backup, with the teacher's recovery key. In a school space, the school can also issue a new QR code. The lost phone is removed and receives nothing new. Section 6 designs the keys.

### 5.9 Files Minhajna reads and writes

| File | In or out | What it holds | Rules |
|---|---|---|---|
| **The Minhajna archive** (the open format) | Both | Everything: records, history and pinned releases, except the teacher card's personal fields and the drawn signature (§3.2) | Documented and versioned. Every older version can be imported. Free, at any time (principle 7) |
| CSV | Out | Marks, roll call and the lesson log | For spreadsheets |
| PDF and DOCX | Out | The documents (§3.8) | Made on the device |
| The official class list (Excel) | In | Pupils | Only the columns in §5.6 |
| The school's grade workbook | In, then out | Marks and appreciations | Only the unlocked cells change. The file is edited in place, so every other part stays exactly as it was (§3.7) |
| Timetable package | In | A teacher's part of the school timetable | Signed, with stable IDs and no pupil data. Made from FET, an Excel or CSV template, or by hand (Section 7) |
| Progress statement | Out | The fields in §3.10 | Signed, with no pupil data. Printed, as a PDF or as a QR code |
| Handover package | Both | The class's progress, by topic (§3.10) | Signed. Pupil data only by direct transfer, if the teacher chooses |
| Reference-data release | In | Packs, calendars and rules | Signed by whoever issues it: the IGP for its official packs, the project for the others (§4.8). The app shows who signed |

**The national interoperability system.** In the national system, exchanges with the state's other systems go only through the national interoperability system, on its separate network (Decree 25-320). The server package has a connector for it:
- **In:** schools, class groups, class lists and assignments from the sector's information system, so nobody types them (§5.3).
- **Out:** marks, in place of the workbook and ostad round trip (29 Sep); and pupils' absences, where the school chooses (29 Sep).
- **The connector cannot read what it carries.** Marks and absences are encrypted on the teacher's or the school's device for the receiving state system alone.
- **The files stay** as the fallback, and for teacher mode.
- **Parents use the state's awlyaa space** (29 Sep). Marks, and absences where the school chooses, reach parents there. Minhajna builds no features for students or parents.
- **A data catalogue** is generated from the data model, with each record's layer and classification, as Decree 25-320 requires of public bodies.

**Every file that comes in is untrusted**
- It is opened in isolation and checked against its format.
- Anything outside the allowed fields is dropped before saving.
- Macros and formulas in workbooks are never run.
- **FET files.** The importer is written from FET's documented file format, without using FET's code, which is licensed AGPL-3.0-only. It is tested with made-up files (research 12). Counsel confirms this approach.

**Files that go out**
- Files that hold pupil data are marked "internal / confidential", and can be protected with a password.
- Before a file goes to a messaging or social app, the app warns that pupils' marks and attendance are covered by civil-service secrecy (Ord. 06-03 Art. 48).
- There are no public links.

**QR codes.** A progress statement fits inside a QR code, signed, so reading it needs no network. Larger files, such as a handover package, use the QR code only to open a short-lived direct transfer on the local network.

### 5.10 The permission model

Every role is enforced by keys, not only by screens. A role that holds no key cannot read a record, whoever runs the server (§6.5).

| Role | Can read | How |
|---|---|---|
| Teacher | All their own records | Their device keys |
| Director and deputies | Their school's space: the signed weeks, the pupil records, and each class's confirmation status as it syncs (29 Sep, §7.6) | The school key, on their devices |
| Timetable preparers (3 Oct) | The school's timetables, and the assignments they are built from. Never pupil records, lesson records or the confirmation status | The timetable key, on their devices. Never the school key |
| Coordinator | The statements teachers share | Files, with no account |
| Inspector | The lesson records of the courses and signed weeks named in a grant, only between its dates (29 Sep). Never pupil records (30 Sep) | Keys shared for the grant. The teacher sees the grant and every access |
| Directorate and Ministry | Totals only, above the minimum group sizes (29 Sep) | Totals formed across schools. No key to any named record |
| Whoever runs the server | Nothing named: encrypted records, and the minimum metadata needed to run the service | No key |

**Totals above the school** (29 Sep)
- **What they cover:**
  - the curriculum report: sessions spent on each item, items merged, skipped or re-taught, how far classes got by term end, and plans that run long;
  - what the system owes teachers: cover given, vacant posts and unassigned hours, and sessions lost to closures, worked out from the public calendar.
- **Never** a figure for one school or one teacher, a ranking, a count of sessions not held, or anything from the private layer.
- **How they are formed.** Each school's space prepares its share of each total from the school's records, on a device that holds the school key (29 Sep). The shares are combined across schools, so the server learns only totals covering at least the minimum group sizes: 10 teachers and 3 schools for a wilaya or national figure, 5 teachers and 3 schools for a directorate (§7.9). No school's figure reaches the server. The method comes from a widely reviewed open-source library (§6.5).
- **Only on announced days** (29 and 30 Sep). Totals of how far classes got are formed only on days announced at the start of the school year: each term's end and each exam's own date, which moves only if the exam does (§7.10). There is no weekly or monthly series, for exam figures and the curriculum report alike. They count only what classes completed in signed weeks, and classes' own plans stay inside the school.
- **Exam scope** (charter point 7). How far classes got may inform the scope of an exam only at the level that sets it: a school's own records for its term and mock exams, formed in its space and never sent out; a directorate's totals for its exams; and wilaya and national totals for national exams. The system forms each exam's figures only on its announced date, keeps each signed cut with the figures it came from, and publishes them after the exam, so no unpublished figure from it can be used (§7.10).

- **Access is granted per course and per layer.** The private layer is never granted to anyone.
- **Every access appears in the teacher's access log** (charter point 5).

### 5.11 Formats offered to the state

Four open formats are published, with examples and test files, and offered to the IGP and the national institute for research in education (INRE):
1. **The plan pack** (§4.2).
2. **The session log and progress statement,** with boxes for the director's visa and the teacher's signature. In the national system, the signed week replaces re-copying (§5.5).
3. **The timetable package,** with FET as the exchange format.
4. **The insights payload** (§1.6).

Their specifications are licensed CC BY-SA 4.0 (§1.3). Section 8 covers how they are offered.

### 5.12 Test data

- **Made-up data only** (§1.5): the demo class, and made-up class lists, workbooks and FET files.
- **Published test cases** for every formula and every engine rule, run in both apps.
- **Round trips.** Every export can be imported back, and it gives the same records.
- **Blank workbook templates** collected in the field check, with any pupil rows removed, to test the term export in Excel and WPS.

### 5.13 Checks before the pilot

These five technical risks are tested early, before the pilot depends on them:
1. **The Android build:** React Native, reproducible, passing F-Droid's checks, with no proprietary libraries.
2. **Arabic PDFs** from the device's web engine: letter shaping, mixed directions, A4 landscape pages and embedded fonts.
3. **The workbook fill:** real blank templates, in `.xls` and `.xlsx`, filled cell by cell, then opened in Excel and WPS.
4. **The web app's storage:** its size limits, whether the browser may clear it, and encryption with the teacher's key.
5. **Sync on weak mobile data:** resuming, payload sizes and conflict notices.

### 5.14 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| Foundations | Built into version 1: stable IDs, a history that is only added to and shows tampering, record layers, the permission model, logs, retention rules and open formats |
| Architecture (changed by 0015) | An Android app and a web app sharing one TypeScript core. A NestJS server in Algeria that relays encrypted sync data, mirrors the reference data, hosts the pack editor and receives reports. Notifications on the device, documents made on the device |
| Record layers (changed by 0015) | Private, pupil records, lesson record, shared statement and official snapshot, each with the routes in §5.4 |
| History | Only added to, chained, with dates but no clock times. Roll-call and mark corrections ask for a reason. Deletion erases the content |
| Minimum data | Pupils: registration number, name, sex, class and group, and movements. Absences: justified or unjustified, with no cause. No parents' details |
| Retention | A yearly archive. Each year's pupil records are offered for erasure once the following school year ends. In institution mode, the institution's rules |
| Sync (changed by 0015) | Optional and end-to-end encrypted, sending only new changes. Differing changes are both kept, and the teacher chooses. Direct transfer and an encrypted backup file |
| Files | The open Minhajna archive; allowlisted imports; the workbook edited in place; signed statements and packages |
| Early checks | The five checks in §5.13, before the pilot |
| Section 5 | Settled on 27 Sep 2026 |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| The target | One national system, run by the Ministry on government servers, with a space for each directorate and school. The project runs the same package, free, until teachers have moved to the Ministry's system |
| The protection | The design alone. Named records are readable only by the teacher, the school and a granted inspector, who reads lesson records only, whoever runs the server |
| The main copy | Device first. The school's copy is kept on the server, encrypted |
| The official record | The weekly signed record: texts book, journal, roll call and marks. Always correctable, with both versions shown |
| Joining | The school's QR code, made from the official assignment list. Fingerprint or PIN sign-in, no password. Without a smartphone, a security key on a school PC |
| The state's systems | Through the national interoperability system: assignments and class lists in, marks out, absences out where the school chooses |
| Above the school | Totals only. Each school's share is prepared in its space, on a device that holds the school key, and the shares are combined so the server never learns a figure for one school or one teacher. Totals of how far classes got are formed only on announced days |
| Moving to the Ministry | Teacher by teacher, on joining the school space, with consent. The project's server then closes |
| Before adoption | Teacher mode only. No school or directorate deployments until the Ministry's system opens |
| The Ministry's app | The project's release, with the Ministry's name and icon as settings, built reproducibly. The project's own app can always connect. A build that weakens the charter is made public at once |
| After adoption | The Ministry's staff maintain Minhajna, as maintainers in the project's public process |
| Parents | Served by the state's awlyaa space. No student or parent features in Minhajna |
| Record layers | A sixth layer, totals, for figures above the school (§5.4) |

**Decided on 4 Oct 2026 (decision 0017, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Totals above the school | Formed only on days announced at the start of the year: each term's end and each exam's own date, which moves only with the exam. Signed weeks only. No weekly or monthly series |
| Exam scope | At each exam's own level, under charter point 7. Each signed cut is kept with the figures it came from, and both are published after the exam |

**Decided on 5 Oct 2026**

| Decision | Choice |
|---|---|
| The archive and the recovery sheet | Everything except the teacher card's personal fields and the drawn signature, which never leave the device |
| Erasing a pupil who has left | Totals already printed, signed or sent stay as they were. Open views and reprints leave the pupil out, with a note that one pupil's records were erased |
| The signing key on a new phone | The new phone makes its own key, and the old phone or the recovery sheet vouches for it. What was signed before stays valid |
| Records kept before joining | They stay the teacher's own and unsigned. The school's space starts with the first week signed after joining |

**Open**
- **Legal retention periods** for teachers' own records once the year ends. Counsel answers.
- **The 2026/27 class-list file:** its columns, and whether it has names in Latin letters. The field check finds out.
- **Legal signatures in the national system:** whether the state's certification authority can certify keys made on teachers' phones. Counsel confirms.
- **The day a signed record counts:** the Ministry's text must say that the day signed on the device counts, not the day the server receives it.
- **The method for totals** that hides each school's figure from the server, and its cost on budget phones. Tested before the national launch.
- **Access to the interoperability system,** the agreements it needs with the bodies that issue the data, and how class lists and the assignment list reach the school's space without the server reading them (§2.6).
- **Whether the FET importer may call FET's command-line program** as a separate tool. Counsel confirms.

---

## 6. Privacy, security and non-functional requirements

*Redesign proposed on 29 Sep 2026 in decision 0015, with Section 5, for the national system run by the Ministry on government servers. That decision was accepted on 4 Oct 2026.*

This section:
- turns the privacy principles (§1.2, §1.5) into requirements;
- sets out the compliance steps before each launch;
- specifies the security design: threats, the device, keys, the web app and the server;
- sets the non-functional requirements: devices, speed, reliability, national scale, accessibility and languages.

The national system adds the Ministry's own steps (§6.2), and what it needs before the mandate (§1.15, §7.12).

### 6.1 The legal position in teacher mode

- **The project is the software's publisher, not a controller of pupil data,** because pupil data never reaches it in readable form (principle 2). It is the controller only of what it holds about teachers itself: sync accounts, pack-editor accounts, problem reports, pilot contacts, support messages and donors' details (§1.4).
- **In the national system, the Ministry is the controller,** and runs the servers. The project publishes the software and holds nothing.
- **The teacher's own position is open.** Teachers must keep their registers and journal (Decision 831 Art. 8–10). For official records, the school or the Ministry is plausibly the controller, with the teacher acting under its authority. A working copy in a private app is a grey zone. Counsel answers this first (research 06).
- **Whatever the answer, the product protects pupil data as if the strictest reading applied:**
  - the minimum data (§5.6);
  - nothing leaves the device by default (§1.5);
  - encryption and the app lock (§6.4);
  - real deletion (§5.5);
  - no transfer abroad.
- **Hosting in Algeria.** No rule found requires a private tool to store data in Algeria. But storing personal data abroad is a transfer that needs an ANPDP licence, and the ANPDP treats foreign-run platforms as transfers (deliberation 04). So every server that touches personal data runs in Algeria, and so does everything on that path: e-mail, monitoring and backups.
- **Hidden routes abroad are closed:** the phone's cloud backup, crash and analytics SDKs, advertising and cloud AI (§1.5). Sending a file to another app is the teacher's own act, so the app warns first (§5.9).

### 6.2 Compliance before each launch

| Before | What must be in place |
|---|---|
| **The pilot** (January 2027) | • An Arabic privacy notice, shown before first use (Loi 18-07 Art. 32)<br>• `PRIVACY.md` updated for the app, and `NETWORK.md` published (§1.5, §1.16)<br>• The project's ANPDP declaration for what it processes itself, such as pilot contacts and problem reports, with a register of processing and a named data-protection contact |
| **Sync** | • The encryption design published and reviewed (§1.9)<br>• The declaration extended to sync accounts, with its receipt<br>• Servers in Algeria, with no foreign sub-processor<br>• Processor terms in the terms of service, in case counsel finds that the teacher or the school is the controller<br>• The automated log for server-side processing, and the breach runbook (§6.7) |
| **The national system** | The Ministry's own:<br>• its ANPDP declaration or authorisation, and its data-protection officer<br>• its Decree 26-07 security and data-protection unit<br>• the data catalogue and classification (Decree 25-320), and access to the interoperability system<br>• the HCN's review of the sector plan, and the Council of Ministers' decision (§8.7)<br>• the launch gate in §6.8 |

- **Sync opens only when its gates are met.** If they are not met by January 2027, the pilot runs without sync, using direct transfer and backup files (§5.8).
- **Teachers' rights.** Teachers can see, correct and delete what the project holds about them. Corrections and deletions are made within 10 days, and a deleted sync account stops at once.

### 6.3 Threats the design must resist

| Threat | Main defences |
|---|---|
| A lost or stolen phone | The app lock, the encrypted database and the automatic lock. The lost phone is removed from sync, and the teacher restores their data on a new device (§6.5) |
| A shared or family device | The app lock. No pupil data in notifications. Screens with pupil data hidden from the recent-apps view |
| A shared school PC | Sign-in with the phone or a security key, and a session that leaves nothing behind (§6.6) |
| A curious or compromised server, or a demand for data to whoever runs it | End-to-end encryption: the server holds nothing named that it can read, whoever runs it. Minimal metadata. The project lists every demand it receives in the transparency report (§1.11) |
| The operator reading teachers' records, or tracking entry across schools, for example during a strike | Named records readable only by the teacher, the school and a granted inspector (§6.5). Fixed sync batches, so arrival times reveal nothing (§5.8). Totals formed so that no school's figure reaches the server (§5.10) |
| A national outage at term end | Device first: every task works offline, and a signed record counts from the day signed on the device (§5.5). The launch gate (§6.8) |
| A lost school key, or a director who leaves | The school key is held by several of the school's staff, with recovery split between the school and its directorate (§6.5) |
| An attacker on the network | Encryption in transit, a check of the server's identity, and signed reference data (§4.8) |
| A malicious file | Every incoming file is untrusted: opened in isolation, allowlisted, and its macros never run (§5.9) |
| A forged statement or package | Signed with the teacher's key (§5.5) |
| A tampered web app | Updates the teacher accepts, a visible checksum and reproducible builds (§6.6) |
| A compromised dependency or build | Few dependencies, pinned and reviewed. Reproducible, signed releases (§1.9). Two-factor sign-in for maintainers (§1.8) |
| The records used against teachers | Record layers (§5.4), no clock times (§5.5), the charter (§1.15) and neutrality (§1.11) |
| Leaks by sharing | Files marked confidential, an optional password, warnings, and no public links (§5.9) |

### 6.4 Security on the device

- **An encrypted database.**
  - **Android:** the key is kept in the phone's hardware-backed keystore where there is one, and released by the app lock.
  - **Web:** the key is derived from the teacher's passphrase, and held only in memory while the app is unlocked.
- **The app lock:** a PIN, or the phone's own fingerprint or face prompt. The app never stores biometric data.
- **Signing in to a school space uses the same prompt** (29 Sep). It unlocks a key kept in the phone's secure chip, and that key proves who the teacher is. The fingerprint or face never leaves the phone, so no server ever handles biometric data. A PIN always works too, since many budget phones and most school PCs have no sensor. The app holds its own key rather than using Google's passkeys, which need Google Play Services (§1.3).
- **Sign-ins are never recorded as events,** on the device or on a server. A sign-in log would work as an attendance clock (charter point 3).
- **The automatic lock** after a few minutes of inactivity. The teacher can change the delay.
- **Nothing readable outside the app.**
  - Notifications never show pupils' names or marks.
  - Screens with pupil data are hidden from the recent-apps view and block screenshots. The teacher can allow screenshots.
  - The phone's cloud backup never includes the database (§1.5).
- **Minimal permissions.** No location, contacts or microphone. The camera is used only to scan QR codes, and is asked for on first use. Files are opened and saved only through the system's file picker.
- **"Erase this device"** removes everything (§5.7).
- **Exports that hold pupil data** can be protected with a password (§5.9).

### 6.5 Keys, sync and recovery

- **Proven cryptography only,** from a widely reviewed open-source library. The project writes no cryptography of its own.
- **Nobody who runs a server holds a key** (29 Sep). Records are encrypted on the device before they leave it. Neither the project nor the Ministry holds a key to a named record on its servers.
- **The keys, and who holds them:**

| Key | Held by | Opens |
|---|---|---|
| Device key | Each device, in its secure chip where it has one | That device's database |
| The teacher's keys | The teacher's own devices | Everything the teacher records, including the private layer |
| The teacher's signing key | Made on the teacher's device, which it never leaves. A new phone makes its own, vouched for by the old phone or the recovery sheet. In the national system, certified by the state (§5.5) | Nothing: it signs the weeks, statements and packages |
| The school key | The director and deputies, on their devices | The school's space: the signed weeks, the pupil records and the confirmation status |
| The timetable key | The director and deputies, and the staff who help prepare the master timetable (3 Oct) | Only the school's timetables, and the assignments they are built from |
| Grant keys | The inspector's device, for the dates of a grant | Only the lesson records of the courses and weeks named in the grant |
| The receiving system's key | The state system that receives marks or absences | Only what is sent to it (§5.9) |

- **Private notes are encrypted for the teacher's own devices only,** never for the school.
- **Grants end.** After a grant's end date, the inspector's device receives no new keys and deletes what it holds. What an inspector has already read cannot be unread, so a grant names only the courses and the weeks it needs.
- **Each device has its own key.**
  - The teacher adds a device from one that is already set up: the new device shows a one-time QR code, and the device already set up, usually the phone, scans it and approves with the fingerprint or a PIN, as on a staffroom PC (§6.6). A PC needs no camera. A home PC with no camera, if it is the only device set up, restores a new phone with the recovery sheet instead.
  - A lost device can be removed, so it receives nothing new.
- **Recovery.**
  - **The recovery sheet.** When sync or backup is set up, the app gives the teacher a recovery key to print or write down. It restores everything on a new device, except the teacher card's personal fields and the drawn signature, which are typed and drawn again (§3.2). The signing key doesn't move either: the new device makes its own, and the sheet vouches for it (§5.5). A new sheet replaces the old one. Backups made before it stay on the old key, so the app saves a new backup after printing.
  - **In a school space,** a lost phone doesn't lose the class. The school's copy stays, and the school issues a new QR code.
  - **The school key** is held by several of the school's staff. Its recovery is split between the school and its directorate, so neither can open the school's records alone.
- **Nobody but the teacher can recover the teacher's private notes.** That is the price of end-to-end encryption. So:
  - making a backup takes two taps;
  - the app reminds the teacher when there has been no sync and no backup for 30 days, unless the teacher turns the reminder off (§3.9).
- **What the server sees:** memberships, encrypted data in fixed batches (§5.8), and their sizes. No names or times of activity appear in what it stores or logs. Classes and subjects appear only as assignment codes, and in the totals above the school (§5.10).
- **No account needs a real name or a password.** In teacher mode, sync uses a login. In a school space, the teacher is known by their key and their assignment (§5.8).
- **Reviewed before launch.** The design is published (§1.9), and an independent reviewer checks it before sync opens, and again before the national launch.

### 6.6 The web app

- **Served by whoever runs the server,** from the project's site in Algeria or from the Ministry's, as a fixed bundle (§5.2). It loads no scripts, fonts or trackers from anywhere else, and a strict security policy blocks them.
- **On a shared staffroom PC** (29 Sep), the teacher signs in by scanning a QR code on the screen with their phone, and approving with the fingerprint prompt. The session keeps the teacher's records in memory only, and leaves nothing behind when it closes or locks. It opens the school's copy of the teacher's records, never the private notes, and the week is still signed on the phone. On the teacher's own PC, Windows Hello can replace the phone.
- **Without a smartphone** (charter point 9). A teacher who has no smartphone, or doesn't want to use their own, signs in on a school PC with a security key the school issues: a small USB key with its own PIN, which unlocks the teacher's keys for the session. Their records are kept in the school's space, encrypted like everyone's. A lost security key is replaced like a lost phone: the school issues a new one.
- **Installed for offline use.** After installation, it changes only when the teacher accepts an update.
- **Checkable.** It shows its version and build checksum. The published checksums and reproducible builds let anyone check them (§1.9).
- **Its data** stays in the browser on the teacher's own computer, encrypted with the passphrase (§6.4). The app asks the browser to keep that storage, and warns if the browser may clear it.
- **Browsers:** current Chrome, Edge and Firefox, on Windows 10 and 11. Safari is not a target in version 1. Installing and keeping storage work differently in each, so the checks before the pilot cover both, and the case where the app can't be installed (§5.13).

### 6.7 The server and its operators

- **What the server holds, and nothing more:**
  - encrypted records: the teachers' own sync (§5.8);
  - in the national system only: the school and directorate spaces, the memberships that link device keys to assignments, and the totals above the school (§5.8, §5.10);
  - pack-editor accounts;
  - the problem reports teachers chose to send, until the problem is fixed and for 12 months at most. A teacher can delete theirs sooner. In the national system the Ministry keeps them, on its servers, for 12 months at most, and the project receives only what the Ministry forwards, with no names (5 Oct).
- **Built to run on government servers:**
  - it installs and updates from the published release, with no internet access;
  - it makes no outbound calls, except through its connector to the national interoperability system (§5.9): no content networks, web fonts, analytics or error trackers;
  - it runs as containers on ordinary servers, in the national data centre or with any host in Algeria;
  - it comes with an admin console, monitoring, backups with regular restore tests, and a deployment guide.
- **Hosted in Algeria,** with its backups, and encrypted.
- **Administration** by named people only, with two-factor sign-in. Every administrative action is logged. Nobody administers it from abroad.
- **Security logs** are kept apart from everything else, for the shortest time the law allows, and never used to measure or judge teachers.
- **Fixes.** Security fixes for critical flaws ship within 7 days, and the Ministry deploys them within the same window (§5.2). Dependencies are watched for known flaws (§1.9).
- **The breach runbook,** for whoever runs the server:
  1. contain the breach and assess it;
  2. notify the ANPDP within 5 days, a conservative target;
  3. tell the teachers affected;
  4. record it in the breach register;
  5. on the project's server, report it in the transparency report (§1.11).
- **Demands for data** from any authority are answered only as the law requires. The project lists those it receives in the transparency report (§1.11). Whoever runs the server holds no named record it can read.

### 6.8 Non-functional requirements

| Area | Requirement |
|---|---|
| Devices | Android 8 and later, which reaches about 97.9% of Algerian Android traffic. Designed for 360×800 screens, the most common size, and tested on budget Samsung, Xiaomi, Oppo and Realme phones. The web app runs on Windows 10 and 11 |
| Speed, on a budget phone | • The app opens on Today in under 2 seconds<br>• Confirming a session responds at once<br>• Roll call for 45 pupils scrolls smoothly<br>• A month of journal pages becomes a PDF in under 10 seconds |
| Size and data | A small install. Reference-data updates are small, and sync sends only new changes (§5.8). The teacher can limit sync to Wi-Fi |
| Offline | Every daily task works offline. Only sync, updates and reports need a network |
| No lost work | Every change is saved the moment it is made, so a crash or a flat battery loses nothing |
| Battery | Nothing runs in the background except scheduled notifications and, if the teacher allows it, sync |
| Accessibility | • Right to left first<br>• Works with the Android screen reader in Arabic, French and English<br>• Text can be enlarged to 200% without breaking a layout<br>• Touch targets of at least 48 dp<br>• Colour is never the only signal<br>• Contrast meets WCAG 2.2 level AA |
| Languages | Arabic, French and English, with every text translatable (§1.14). Western digits, and dates as in §3.8 |
| Print | Documents print at 100% on A4, in black and white, as the layouts specify. Any release that changes a layout is checked against printed samples |
| Server | The daily work never depends on it, and neither does any deadline: a record counts from the day it was signed on the device (§5.5). Sync aims to be available 99.5% of each month. Maintenance happens outside school hours, and never in the two weeks before a term-end export (§1.9) |
| National scale | Every public-school teacher, about 630,000 in February 2026 (research 00), and their classes. Fixed sync batches spread the load across the day (§5.8). The peak is the term-end export of marks to the state's systems |
| Time budget | About 5 seconds per ordinary session (§3.1), measured in the pilot |

The speed and size figures are targets. The pilot confirms them on budget phones.

**The launch gate** (proposed). Minhajna is compulsory from the national launch (29 Sep), so the national system must be proven before that day. The mandate starts only once the national system has passed:
- a load test at national scale, including the term-end peak;
- a trial term end with real schools;
- the independent security review (§6.5);
- a full restore from backup.

Morocco's national register shows the cost of skipping this: its top complaint is that it won't load (research 04).

### 6.9 Security and privacy while building

- **A threat model,** published and updated with each major change.
- **Every release is checked:**
  - dependencies, for licences and known flaws;
  - secrets scanning;
  - `NETWORK.md` against the code;
  - a reproducible, signed build (§1.9).
- **Privacy-sensitive changes** need two maintainers' approval (§1.7).
- **Tests use made-up data only** (§5.12).
- **Security reports** go to the private address in `SECURITY.md`, and are acknowledged within three working days (§1.9).

### 6.10 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| Legal position | The project publishes the software, and controls only the teacher data it holds. Pupil data is protected as if the strictest reading applied |
| Hosting | Everything that touches personal data stays in Algeria, with no foreign sub-processor |
| Sync gates | Sync opens only once its design is published and reviewed, the declaration is filed and hosting is in place. Otherwise the pilot uses direct transfer and backup files |
| Device | An encrypted database, the app lock and the automatic lock. No pupil data in notifications. Screenshots blocked on screens with pupil data unless the teacher allows them. Minimal permissions |
| Keys (changed by 0015) | Held by the teacher, one per device, with a recovery sheet. The project cannot recover data, so backups are easy and reminded |
| Web app | A fixed bundle with no outside scripts, updated only when the teacher accepts. A visible checksum |
| Server | The minimum data, logs kept apart and short, the breach runbook and the transparency report |
| Non-functional (changed by 0015) | The targets in §6.8, confirmed in the pilot |
| Section 6 | Settled on 27 Sep 2026 |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Keys | Nobody who runs a server holds a key to a named record. The school key is held by the school's staff, with recovery split between the school and its directorate |
| Sign-in | The fingerprint or face prompt unlocks a key in the phone's secure chip. The biometric never leaves the phone, sign-ins are never recorded, and a PIN always works |
| Shared PCs | Sign-in with the phone, or with a security key the school issues for teachers without a smartphone. A session that leaves nothing behind |
| The server | One package for the project and the Ministry. Installs with no internet access and makes no outbound calls, except through the connector to the national interoperability system |
| The launch gate | The national system passes a national load test, a trial term end, the security review and a restore before the mandate starts |

**Decided on 5 Oct 2026**

| Decision | Choice |
|---|---|
| Adding a device | The new device shows a one-time QR code, and a device already set up scans it and approves with the fingerprint or a PIN |
| Deletion | Within 10 days, like corrections. A deleted sync account stops at once |
| Problem reports | Kept until the problem is fixed, 12 months at most. A teacher can delete theirs sooner |
| Problem and crash reports in the national system | The Ministry keeps them, 12 months at most. The project receives only what the Ministry forwards, with no names |

**Open**
- **Traffic analysis.** Whether fixed sync batches cost too much battery or data on budget phones. Tested before sync opens.
- **Security keys on school PCs.** Whether current Chrome and Edge, on Windows 10 and 11, can unlock a teacher's keys with one. Tested before the national launch.
- **Who controls pupil data in teacher mode,** and the legal basis for minors' data. Counsel answers first.
- **The ANPDP declaration and the data-protection officer before a legal entity exists:** whether the founder can file the declaration, and whether a DPO can be the founder or external. Counsel answers.
- **Whether the sync service counts as a service provider** that must keep traffic data for a year (Loi 09-04). Counsel answers.
- **Phones in class.** Whether roll call on a phone counts as a "pedagogical purpose" under circular 460. Also, whether keeping pupil data in a private app needs written authorisation (Ord. 06-03 Art. 48).
- **Who does the independent security review,** with no budget. Candidates: university security labs and volunteer reviewers.
- **The speed and size targets,** confirmed on budget phones in the pilot.

---

## 7. The school layer and institution mode

*Changes proposed on 29 Sep 2026 in decisions 0015 and 0017, for the national system run by the Ministry and its exam thresholds. Those decisions were accepted on 4 Oct 2026.*

This section designs how schools and education authorities use Minhajna:
- reader mode and the coordinator's merge, which need no accounts;
- the timetable package;
- the school's space in the national system, the only form of institution mode (§1.15);
- what directorates and the Ministry see: totals only;
- each exam's threshold, at the level that sets the exam.

The rules in §1.15 and the data-use charter bind all of it. Section 8 covers the Ministry and the IGP.

### 7.1 Three steps for schools

| Step | What the school gets | When | What it needs |
|---|---|---|---|
| 1. Reader mode and the coordinator's merge | Directors, coordinators and inspectors open what teachers share | The pilot, from January 2027 | Nothing beyond teacher mode: no accounts and no copy on a server |
| 2. The timetable package | The director or the censeur sends each teacher their part of the school timetable | Launch, September 2027 | Counsel confirms that sending staff data as files needs no further formality |
| 3. The school's space | In the national system: the signed weeks, the master timetable, cover, handovers, the operational dashboard and exam thresholds | Once the Ministry adopts Minhajna (29 Sep) | What the national system needs before the mandate (§7.12) |

Before adoption, no school runs Minhajna as an institution. Steps 1 and 2 are part of teacher mode (29 Sep).

### 7.2 Reader mode

- **What it does.** A director, a deputy or an inspector opens the progress statements that teachers share, by scanning the QR code or opening the file. There is no account and nothing to enter.
- **It checks each statement.** The reader verifies the signature and shows the statement's date (§5.5).
- **The school's picture.** It lays the statements received side by side, by class and subject: plan position, weeks ahead or behind, and sessions lost to calendar causes and to other causes.
- **Nothing leaves the reader's device,** and no copy goes to a server.
- **Legal basis.** This stays inside the hierarchy and within the needs of the service (Ord. 06-03 Art. 48), so it needs no new formality (research 13). Counsel confirms.
- **A spot-check sheet for inspectors.** The reader picks three dates at random from the period a statement covers. The inspector compares the teacher's record for those dates with pupils' exercise books. Checks like this, independent of the teacher's own entries, are what made figures credible abroad (research 11).

### 7.3 The coordinator's merge

- **For the teaching council.** The subject coordinator merges the statements that the subject's teachers choose to share. It feeds the council's pacing plan and the figures the coordinator brings to its meetings (Decision 69).
- **What it shows:** each class's position against the plan, side by side. It prints for the council's register.
- **Only what is shared.** Anything a teacher didn't share stays invisible. There are no accounts and no server.

### 7.4 The timetable package

**Making it**
- The director or the censeur (ناظر), helped by an education counsellor or a supervisor where the school has one, brings in the school timetable in one of three ways:
  - from FET, which most CEMs and lycées probably use (an estimate: no survey exists);
  - from an Excel or CSV template;
  - by hand, with live conflict checks.
- Minhajna never builds a timetable automatically. FET already does that (research 12).
- **Checks:** clashes of teachers, classes and rooms; each class's hours against the official grid; A/B weeks.
- **Printouts:** class, teacher and room grids, with the official header, the A/B week, and signature boxes for the director and the censeur, plus the inspector in primary.

**Sending it**
- Each teacher receives only their own part: a signed file with stable IDs and no pupil data. It carries the school's bell times when the school has them (§4.6). It goes by file or QR code (§5.9), and in the national system through the school's space.
- A teacher who works in several schools receives one package from each, merged on their device, with warnings about clashes (§3.2). Only a new version from either school settles a clash. Until then the teacher can change one day in their own week, and the app writes to no school.
- A teacher who drew their own week sees the differences before accepting the school's version.

**Changing it**
- **A change is a new version,** with an effective date, by default the next Sunday. A one-off change touches only its own date, and a teacher can also record one in their own week (§4.6).
- **A teacher's proposal** goes to those who can change the timetable: the director and deputies, and the timetable preparers (§7.8). Accepting it makes a new version. The first decision settles it.
- **The effect is previewed** before publishing. Only the teachers affected are notified, in plain words, for example: "From Sunday 11 October, your Monday slot 3 moves from class 2م1 to 2م3."
- **Receipt.** A teacher can confirm receipt, which replaces signing the paper notice if the school wants.
- **Recorded sessions are never rewritten** (§4.6).

**Limits**
- Assignments and weekly hours come from the state's system or from FET. Minhajna never manages them (§2.6).
- The package holds staff data, such as names and loads, but no pupil data.

### 7.5 The school's space

**What it is**
- **Each school has a space in the national system,** which the Ministry runs on government servers (§5.2). The Ministry is the controller (§1.15).
- **Compulsory from the national launch** (§1.15). During the trial term end before it, taking part is voluntary, and a class whose teacher hasn't joined shows its timetable only, marked "not joined". Records count as official only from the launch, so paper stays official during the trial. A teacher who joined stays joined.
- **Primary schools** have a space like any other school. Counsel confirms how the Ministry, the directorates and the schools share the controller's role (§1.15).

**What it adds**
- **The master timetable,** owned by the director and prepared by the censeur (ناظر), with versions as in §7.4. Others who help prepare it, such as an education counsellor, a supervisor or a teacher, hold a timetable role (3 Oct, §7.8).
- **The operational dashboard** (§7.6).
- **Exam thresholds** for the school's term and mock exams (§7.10).
- **Cover and make-up sessions** (§7.7).
- **Handovers.** When the directorate appoints a substitute, the school records the appointment, and the substitute receives each course's record through the school's space (§3.10). The appointment ends when the holder returns. The substitute keeps their own lesson records, as a teacher who leaves does (§5.7).
- **The director's visa, as a comment.** The director can visa or comment on a signed week, but never change it. The paper visa stays until the Ministry's text says otherwise (Decision 155).
- **A delivery report for each course, every term:** sessions planned, held and lost. Lost sessions show only as calendar causes or "other".
- **Inspectors' access,** through a grant from the authority (§7.8).

**What enters the school's space, and what never does**

| Enters | Never enters |
|---|---|
| Each session's confirmation status, as it syncs (§7.6) | Private notes, and the reasons a session was not held or an item skipped |
| The signed weeks: the texts book, the journal, roll call and marks, with their corrections (§5.5) | The teacher's working record before it is signed, including what they kept before joining (§5.8), and the days on which sessions were confirmed |
| Timetables, cover and handovers, and the class lists and assignments from the sector's information system (§5.9) | Clock times, "started" events, sign-in events and location |
| Each teacher's access log, which that teacher sees | Any score, rank or rating of a teacher |
| The school's exam thresholds: the cuts, the setters' signatures and the figures they came from (§7.10) | — |

- **Everything in it is encrypted,** so that only the teacher and the school can read it, and an inspector the lesson records a grant names (§6.5). The Ministry's staff, who run the servers, cannot.
- **What teachers record about pupils enters when the teacher signs the week,** as part of the official record (29 Sep). Marks go on to the state's system, and absences too where the school chooses. Class lists come in from the sector's information system (§5.9).

**Teachers**
- **Every teacher is told,** in Arabic, before the start (Loi 18-07 Art. 32), and sees their own access log.
- **No personal phone is needed** (charter point 9). A school PC works, with the phone or a security key the school issues, and paper is the fallback. A session on a shared PC leaves nothing behind (§6.6).
- **A teacher who leaves** takes a full copy of their own lesson records (principle 7).

### 7.6 The operational dashboard

The director's view of the school's space (§2.4). It updates with each sync batch, a few times a day (§5.8), and shows:
- **exam thresholds, first:** each subject's term and mock exams, where each class stood on the announced day, and the setters' signatures (§7.10);
- **workload:** each teacher's weekly hours from the timetable, and the cover they gave. They are never set against a statutory load, so no one's unused hours appear (§3.12);
- **sessions awaiting confirmation,** for each class;
- **classes behind the plan:** each class's position, weeks ahead or behind, the buffer used, and sessions lost to calendar causes and to other causes, in separate columns.

**Guardrails** (charter points 2, 3 and 5; §1.11)
- **"Awaiting confirmation" is neutral.** It is never an absence, never triggers an alert or a sanction, and never leaves the school. Only the school key opens it (§6.5).
- **It lives only on the screen.** It is never printed, exported, totalled across the school or kept as history. The school's copy holds each session's current status, never the day it was confirmed, so no one can work out afterwards how late a teacher confirmed. A school-wide total or a trend would measure collective action, which no feature may do (§1.11).
- **Classes, never rankings.** Classes appear in the school's own order. A filter can show the classes behind the plan, but nothing is sorted by delay, and no list of teachers is ever ranked.
- **No colours for people and no clock times.** Dates only.
- **The teacher sees the same view** for their own classes.
- **Nothing from it** feeds pay, promotion, appraisal or discipline (charter point 2).

### 7.7 Cover and make-up sessions

- **Cover starts from the sessions that need it.** The director or a deputy marks the sessions that need cover.
  - No reason is recorded, and nothing counts a teacher's absences (§2.6).
  - The official absence channel stays the state's.
- **A cover choice for each session,** with supervision as the default. The other choices:
  - a study room;
  - merging with another class;
  - a swap or a move;
  - a free colleague;
  - letting pupils go, if it is the day's last session.
- **A daily cover sheet** for the supervisors, printed or sent.
- **The cover log** counts the cover each person gave, so it can be shared fairly. The app suggests; the director decides.
- **Make-up sessions** are new sessions linked to the ones they replace, so progress stays right. A session is owed one only when the teacher marks it to be made up, or the director asks for a make-up. The app never decides it on its own (§3.3, 5 Oct). Whether a missed session affects pay is decided in the official channel, never in Minhajna (charter point 2).

### 7.8 Who can see and do what in the school's space

| Data | Teacher | Director and deputies | Timetable preparers | Inspector, during a grant |
|---|---|---|---|---|
| Pupil records | All, for their classes | Read, in the signed weeks | None | None |
| Lesson records | All. Corrections keep a history | Read the signed weeks, by class. May visa or comment; never edit | None | Read the signed weeks of the courses the grant names |
| Private notes and reasons | All | None | None | None |
| Class progress | All | By class, in the dashboard | None | The courses in the grant, from their signed weeks |
| Timetables | Their own. Can propose changes | Create and change them | Create and change them | None |
| Cover | Cover for their classes, and the cover they gave | Mark the sessions that need cover, and assign it | None in this role. Supervisors get the daily cover sheet (§7.7) | None |
| Access log | Every access to their own records | Their own actions | Their own actions | Their own actions |

- **The censeur (ناظر)** is the director's pedagogical deputy, and holds the school key like the other deputies (research 08).
- **Timetable preparers** (3 Oct). Staff who help prepare the master timetable without being the director or a deputy, such as an education counsellor, a supervisor or a teacher, hold a timetable role. Its key opens only the timetables and the assignments they are built from (§6.5). The school key stays with the director and the deputies.
- **Inspectors' access** is granted by the authority, never by the director. A grant names the courses and weeks, is limited in time and is visible to the teacher (charter point 5, §6.5). It opens their lesson records only, never pupil records or the confirmation status as it syncs (30 Sep).
- **Never in Minhajna:** evaluating teachers, transferring them between schools, approving overtime or pay, or connecting to amatti or ostad outside the national interoperability system (§2.6).

### 7.9 Directorates and the Ministry: totals only

- **No directorate deployments** (29 Sep). Directorates use the national system, like the Ministry (§5.2).
- **They see totals only,** formed so that the server never learns a figure for one school or one teacher (§5.10):
  - each exam's threshold, for the exams they set, first on their dashboards (§7.10);
  - what the system owes teachers: cover provided, vacant posts and unassigned hours, and sessions lost to closures, from the calendar;
  - the curriculum report: sessions spent on each item, items merged, skipped or re-taught, how far classes got by term end, and plans that run long.
- **Only on announced days.** Totals of how far classes got are formed at each term's end and on each exam's own date, set at the start of the year and moved only if the exam moves (§7.10). There is no weekly or monthly series (§5.10).
- **Minimum group sizes** count teachers and schools. A directorate figure covers at least 5 teachers and 3 schools, and a wilaya or national figure at least 10 teachers and 3 schools. Anything smaller is hidden, along with any cell that would reveal it by subtraction.
- **Never:** named teachers, except for inspectors during a grant; league tables of schools; reasons; any count of strikes (§1.11).

### 7.10 Exam thresholds

An exam's threshold is the last lesson it may cover. Every exam with a common paper has one, so it is a primary figure on the dashboards of the school, the directorate and the Ministry (charter point 7; 29 and 30 Sep).

**Each exam at its own level**

| Exam | Figures | Who sets the cut | Who sees it before the exam | Published after the exam |
|---|---|---|---|---|
| A school's term and mock exams, with a common paper for parallel classes | The school's own records, formed in its space. They never leave it | The school's teachers of the subject | The setters and the director. Deputies see it once it is published (5 Oct) | Inside the school's space, to the subject's teachers at that level and the management team |
| A directorate's unified and mock exams | The directorate's totals | The directorate's committee | The committee and the directorate's exams office | To the public |
| National exams, such as the BEM and the BAC | Wilaya and national totals | The Ministry's committee, with inspectors | The committee and the body that runs the exam | To the public |

- **Monthly tests,** the common test (الفرض المشترك) included, stay with each teacher, with nothing to sign.
- **A school's cut is optional** (30 Sep). The subject's teachers use it when they wish. Without one, they set the paper as they do today, nothing is published, and nothing counts which schools went without.
- **No figure for one class or one teacher leaves the school.** Every total above it meets the minimum group sizes (§7.9).
- **Before adoption, there are no thresholds.** Teacher mode forms no figures for exam scope, and the opt-in insights are never used for it (§1.6).

**The figures**
- **Taken on announced days.** Each exam's figures are taken on a date announced at the start of the school year, in the calendar of the level that sets the exam, never through a sudden collection. If the exam's date moves, the figures' date moves with it, announced again at least two weeks before the new figures day, and the published page shows both dates and why (30 Sep).
- **No standing series.** Above the school, totals of how far classes got are formed only on those days: each term's end and each exam's own date (§5.10). Only the figures from an exam's own date shape its cut. Term-end totals are shown for comparison.
- **Only signed progress above the school.** Totals count what classes completed in signed weeks. Classes' own plans stay inside the school, so above it the chart compares classes with the plan pack's plan, the same for every class.

**The system shows, people decide**
- **On the announced day,** the chart shows the share of classes that completed each lesson, and marks the last lesson taught in common.
- **The setters choose the cut and sign it.** The system never sets a cut by itself.
- **When a school's cut applies:** once every setter has signed it. The school's calendar announces a signing deadline together with the figures day, and moves it with them if the exam moves, so teachers know it well ahead. If a setter has not signed by the deadline, or chose no cut, the director decides. Until then any setter can still choose no cut (5 Oct).
- **When the setters disagree:** at a school, the earliest proposed cut applies, so no class is examined on what it did not reach. In a committee, the majority decides, so one member cannot narrow an exam alone.
- **Kept and published.** The system keeps each signed cut with the figures it came from, and publishes both after the exam, so no unpublished figure from it can be used.

**The three safeguards** (charter point 7)
1. **A date set in advance,** at the start of the school year, which moves only with the exam.
2. **Published after the exam:** the cut, its date, the figures used and how the setters shaped the exam, in their own words.
3. **Checked:** inspectors compare pupils' exercise books with the texts book in a random sample of classes, twice a year, and the results are published with the figures, as totals only (§8.5). In a year without the sample, the figures are still used, and published as unchecked (30 Sep).

The Ministry is asked to adopt all three in its text, as a request, not a condition (§1.15).

**Who sees what**
- **Teachers see what the director sees** (§3.3): where each of their classes stands against each exam's date, the school's chart for their subject and level, and the directorate's totals. They see a cut when they sign it as a setter, or once it is published.
- **The director's dashboard opens with the school's thresholds** (§7.6): each subject's term and mock exams, where each class stood on the announced day, each class's plan up to the exam, marked as a forecast, and the setters' signatures.
- **The directorate's dashboard puts the threshold first:** the share of classes that completed each lesson on each announced day, the committee's proposed cut and its signatures, and sessions lost to closures, from the public calendar.
- **The Ministry** sees the national curve, with the wilayas as a range, never named or ranked, each subject's committee and its signatures, and the inspectors' sample.
- **Never:** a ranking of classes, schools or wilayas, a figure for one teacher, or any personnel use (charter point 2).

**Charts.** Drawn with Apache ECharts on the web screens and react-native-svg on the phone, each with a table of the same figures (§5.2). A school's charts are drawn on the device, since the server cannot read the school's records. The published reports of directorate and national exams carry only totals, so they are rendered on the server for printing.

### 7.11 How the national system runs

- **A space for each school,** and one for each directorate, in one national system (§5.2). A school's space can be exported whole.
- **Keys.** The school key is held by the director and the deputies, on their devices. Its recovery is split between the school and its directorate, so neither can open the school's records alone (§6.5). Staff who only help with the timetable hold a timetable key, which opens nothing else (§7.8). Nobody who runs the servers holds a key.
- **The project's role:** the publisher of the software. It never sets the purposes, and holds none of the records (§1.15).
- **Paper stays official until the Ministry's text.** The texts book and the journal remain the official records (Decisions 155 and 831) until a ministerial text makes the digital record official (§1.15). After that, paper stays only as the fallback (§5.5).
- **Ready-made documents.** The project keeps templates ready before anyone asks:
  - a register of processing;
  - an impact-assessment template;
  - the charter (`CHARTER.md`);
  - the published security design;
  - a deployment guide and an administration manual.

### 7.12 What the national system needs, as a checklist

Before the mandate starts (§1.15). These are the Ministry's to meet; the project asks for them.
1. **The ministerial text** that makes the digital record official and compulsory, with the Council of Ministers' decision (§8.7). The charter's protections are asked for in it, not required.
2. **The Ministry's ANPDP declaration,** stating:
   - the purposes: the official record of teaching, coordination, coverage checks, pacing statistics and exam thresholds (§7.10), and not evaluation;
   - the recipients: the director and deputies, staff who help with the timetable, for the timetables only, inspectors during a grant, and the state's systems that receive marks and absences;
   - retention: for example 3 years for the signed weeks, like the texts book;
   - the security measures.
3. **A data-protection officer,** and the Ministry's security unit under Decree 26-07.
4. **An impact assessment,** reviewed by that officer.
5. **The state's digital rules:** the data catalogue and access to the national interoperability system (Decree 25-320), the ANPDP's authorisation for the interconnection (Loi 18-07 Art. 19), and the HCN's review of the sector plan (Decree 23-314).
6. **Teachers:** the notice in Arabic; the consultation of the staff technical committees and the representative unions, with the results published and every objection answered in public before the mandate starts (30 Sep); the charter presented to every school's teachers' council; and no personal phone required.
7. **The launch gate** (§6.8): a load test at national scale, a trial term end with real schools, the independent security review, and a full restore from backup.

### 7.13 Timeline

| When | What |
|---|---|
| January–March 2027 (pilot) | Reader mode and the coordinator's merge, with the pilot's directors, coordinators and an inspector |
| September 2027 (launch) | The timetable package |
| After adoption | School spaces in the national system, a trial term end, then the mandate. The date is set once the Ministry adopts Minhajna |

### 7.14 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| Three steps (changed by 0015) | Reader mode and the coordinator's merge in the pilot; the timetable package at launch; school mode after the gates |
| Reader mode | No accounts and no server copy. Signatures checked. A spot-check sheet for inspectors |
| Timetable package | From FET, a template or by hand; no solver. Each teacher gets only their part. Versions with effective dates |
| School mode (changed by 0015) | The school is the controller. Lesson records, progress, timetables and cover enter its space; pupil records, private notes and reasons never do |
| Dashboard | Workload, sessions awaiting confirmation per class, and classes behind the plan. "Awaiting confirmation" lives only on the screen: never printed, exported, totalled or kept. Nothing is ranked |
| Cover | Starts from the sessions that need it, with no reason and no count of absences. Supervision by default. Make-up sessions linked; pay stays in the official channel |
| Participation (changed by 0015) | Voluntary in pilots. A class not shared shows as "not shared". No personal phone needed |
| Directorates (changed by 0015) | Figures on what the system owes teachers, with at least 5 teachers and 3 schools per figure. Never named teachers, except for inspectors in their scope |
| Section 7 | Settled on 27 Sep 2026 |

**Decided on 3 Oct 2026**

| Decision | Choice |
|---|---|
| Timetable preparers (takes effect with 0015) | Staff who help prepare the master timetable without being the director or a deputy hold a timetable role, whose key opens only the timetables and the assignments they are built from. The school key stays with the director and the deputies, the censeur (ناظر) among them (§5.10, §6.5, §7.8) |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| School mode | Replaced by the school's space in the national system, after adoption. Before then, no school runs Minhajna as an institution |
| What enters the school's space | Each session's confirmation status as it syncs, and the signed weeks with roll call and marks. Never the working record before signing, the days sessions were confirmed, private notes or reasons |
| Who reads it | The teacher and the school. An inspector during a grant reads only the lesson records it names. Nobody who runs the servers |
| Participation | Compulsory from the national launch. Voluntary during the trial term end before it |
| Directorates | No directorate deployments. Totals only, in the national system |
| Keys | The school key with the director and the deputies. Recovery split between the school and its directorate |
| Totals of how far classes got | Formed only on announced days, with no weekly or monthly series, for exam figures and the curriculum report alike |
| Consultation | Every objection from the staff committees and the unions gets a public answer before the mandate starts |

**Decided on 4 Oct 2026 (decision 0017, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Exam thresholds | Each exam at its own level: the school's records for its term and mock exams, the directorate's totals for its exams, and wilaya and national totals for national exams. The system shows the share of classes that completed each lesson, and the setters choose and sign the cut |
| Setters who disagree | At a school, the earliest proposed cut. In a committee, the majority |
| Before and after the exam | Before, the cut stays with its setters and the exam's organisers. After, a school's is published in its space, and a directorate's or the Ministry's to the public |
| Figures above the school | Signed progress only, on days announced at the start of the year. An exam's day moves only with the exam. No weekly or monthly series. Classes' plans stay inside the school |
| A school's cut | Optional. Without one, the paper is set as today, and nothing counts which schools went without |
| A year without the sample | The figures are still used, and published as unchecked |
| Dashboards | The threshold first, for the school, the directorate and the Ministry. Teachers see what the director sees |

**Decided on 5 Oct 2026**

| Decision | Choice |
|---|---|
| Timetable proposals | A teacher's proposal goes to the director and deputies and the timetable preparers. Accepting it makes a new version |
| A school exam's cut | Before the exam, only the setters and the director see it. It applies once every setter has signed, the earliest when they differ, or when the director decides |
| Records kept before joining | They stay the teacher's own and unsigned |

**Open.** Counsel answers most of these:
- **How the Ministry, the directorates and the schools share the controller's role** (§1.15).
- **Whether reader mode and the timetable package need any formality.**
- **Consultation duties:** technical committees and unions.
- **Private schools:** whether they join the national system, and who the controller is for the teachers they employ (Loi 90-11).

---

## 8. The state layer

*Changes proposed on 29 Sep 2026 in decisions 0015, 0016 and 0017, for the national system run by the Ministry, with nothing sold and exam scope set at each exam's own level. Those decisions were accepted on 4 Oct 2026.*

This section designs how Minhajna works with the state towards the goal in principle 6:
- what the state already runs, and the rules for working alongside it;
- what Minhajna offers the Ministry, the IGP and INRE;
- the insights observatory, with the numbers §1.6 leaves to this section;
- the state track, the first ask, and what national adoption takes.

### 8.1 What the state already runs

- **The administrative backbone is the state's** (research 10).
  - The sector's information system holds class groups and teacher assignments (compulsory since at least 2018), weekly hours (since 2020), staff records, pupil lists and marks.
  - Pupil absences have been entered by the schools' pedagogical services since April 2026.
  - Teachers enter marks in the teacher space (ostad) or in the grade workbook.
  - Parents see absences, weekly timetables and exam calendars in their own space (awlyaa).
- **Teachers' attendance belongs to HR and payroll.** A November 2024 report said teacher-absence entry had been switched on in the system, with automatic salary deductions.
- **The Ministry is building its own national data layer:** remote monitoring of schools, a system to analyse results, and database links with the High Commission for Digitisation (HCN).
- **The gap is the lesson record.**
  - No state tool records what was taught in each session, how far each programme has got, or the teacher's journal. Coverage is checked on paper.
  - A digital texts book and digital inspection are on the Ministry's July 2025 roadmap, and circular 465 orders accounts for inspectors. Nothing has shipped.
  - Research 10 rates the chance that the state ships a digital texts book within 12–24 months as medium.
- **There is no door for outside software.**
  - There is no public API, developer programme or approval route. Every integration found is between state bodies.
  - Since 6 September 2026, every education proposal goes to the Council of Ministers.
  - The only structured door for outside innovators is INRE's Tarbya-Up Challenge.
- **So Minhajna complements the state and never duplicates it** (§2.6). It covers the lesson record, which no state system covers. It meets the rest through files, and in the national system through the national interoperability system (§5.9).

### 8.2 Rules for working with the state

- **Complement, don't race.** Minhajna keeps the teacher's capture and pacing. It hands the state what it needs in open formats, and never rebuilds what the state runs.
- **Files only, until there is an agreement** (§2.6).
  - No connectors, scraping or automation of ostad or amatti, and never teachers' passwords.
  - Data moves only as files that users download or upload.
  - An automated link needs the Ministry's agreement, the ANPDP's authorisation for interconnection (Loi 18-07 Art. 19) and the national interoperability system (Decree 25-320). In the national system, that link is the connector (§5.9).
- **Outputs, never a tracker.** Minhajna is never described as a way of "tracking teachers". Until adoption, it is the teacher's class logbook, which prepares the official texts book and the term export. In the national system, it is the official record, which the teacher signs each week. The Ministry runs the servers but cannot read named records, and nothing on them tells time (§5.2).
- **Every agreement is public,** and no principle is waived (§1.8). The state may also fork the code: a changed version it runs for teachers must offer them its source (§1.3).
- **Watch and respond** (research 10):

| If the state ships | Minhajna |
|---|---|
| A digital texts book | Adds an export into it, drops the print features it replaces, and keeps the teacher's capture and pacing |
| A timetable screen or export | Adds an importer |
| An inspector module | Aligns the progress statement with its fields |
| A list of approved tools, or a ban | Complies, and offers its code and `NETWORK.md` for audit |

### 8.3 What Minhajna offers the state

1. **Four open formats** (§5.11): the plan pack, the session log and progress statement, the timetable package, and the insights payload.
2. **The plan-pack pipeline** (§4.3). The IGP can publish its plans through Minhajna, by uploading the PDF or filling in the form, and its packs carry the status "official". Once the IGP publishes its own plans this way, the question of their copyright is settled.
3. **The national system** (Section 5): the full digital record, official and compulsory from the national launch, run by the Ministry on government servers, with the protections built into its design. This is the first ask (§1.15, 29 Sep). Paper then stays only as the fallback. Abroad, Ghana declared electronic lesson plans legal, and Russia and Portugal ban paper duplicates (research 11).
4. **A curriculum-pacing observatory** for the IGP and the curriculum designers, until the national system's totals exist (§8.4).
5. **A national progress figure:** the inspectors' sample before adoption, then the national system's totals, which the sample checks (§8.5).
6. **The code, the deployment guide, the administration manual and the training material,** free, for the national system (§7.11, §8.7). The project sells nothing (§1.10).

### 8.4 The insights observatory

It starts in 2027/28, with its code, payload and method published at least a month before collection (§1.13, stage 4). The rules in §1.6 bind it. It runs in teacher mode until the national system's totals exist, and is then retired (§5.10, 29 Sep). A class leaves it as soon as its school's space opens.

**The questions it answers,** for the IGP and the curriculum designers:
- Which items take more sessions than the plan allows?
- Which items do teachers most often merge, skip, split or re-teach?
- How far have classes got by the end of each term, by level, subject and wilaya?
- Did this year's changes to a plan help?

**The payload.** Only what was taught (§1.6), for each class whose teacher opts in:
- the plan pack and release;
- the sessions spent on each item;
- the items merged, skipped, split or re-taught;
- how far the class got by the end of each term.

It never holds the date of a session, a reason a session was not held, pupil data, anything that identifies a teacher, or data from institution mode. Figures from the national system are formed there, as totals (§5.10).

**Indicators,** each shown with its number of classes and a note that opt-in samples are self-selected:
- the median sessions spent on each item, for each pack;
- the items most often merged, skipped, split or re-taught;
- how far classes got by the end of each term, as a median and a spread;
- sessions lost to closures by wilaya, worked out from the public calendar, never from teachers' entries.

**Minimum group sizes.** These are the numbers §1.6 leaves to this section.
- A wilaya or national figure covers at least 10 teachers and 3 schools. Directorate figures in the national system follow §7.9: at least 5 teachers and 3 schools.
- A cell below the minimum is hidden, and so is any cell that would reveal it by subtraction.
- In small cells, shares near 0% or 100% are shown in bands. Sparse cells are pooled across years.

**The teacher's comparison** with their peers (§1.6) is worked out on the teacher's device, from the published figures. Nothing about the class is sent to make it.

**How the figures may be used**
- The method states that the figures describe the plan, not classes or teachers.
- They are never used to set the scope of exams, to rank anyone, or for personnel decisions (§1.6).
- **Why the exam-scope ban matters.** Algeria has set BAC "thresholds" from progress collections before (research 09, 11). When reported progress shrinks the exam scope, a class gains by reporting less. When it feeds pay, a class gains by reporting more. Either use corrupts the figures, so the method bans both. The IGP is asked to commit to this in writing.
- **In the national system,** exam scope follows charter point 7 instead: only signed progress, taken on dates announced in advance, published after the exam and checked against the inspectors' sample (§7.10). Figures from teachers who opted in are never used for it.
- **The IGP sees each report first,** and has 30 days to comment. Publication then follows the method (§1.6).

**Before the first collection**
- Counsel confirms that teachers may send lesson-level data without written authorisation (Ord. 06-03 Art. 48; §1.6). Counsel also checks whether publishing the figures needs the Ministry's consent, or falls under the national statistics rules.
- The pilot's data-quality audit compares two things: logged sessions against pupils' exercise books, and entries made before a director could see them against entries made after.

### 8.5 A national progress figure, checked by a sample

- **Before adoption,** if the state wants a national figure for programme coverage, Minhajna offers a protocol rather than teachers' data. Inspectors compare pupils' exercise books with the texts book in a random sample of classes, twice a year.
- **In the national system,** the figure comes from totals of signed weeks, formed only on announced days (§5.10). The same sample checks them, and the figures behind every exam's threshold (charter point 7, §7.10).
- **The sample's results are published** with the figures they check, as totals only, never for one class or one teacher.
- **A year without the sample** (30 Sep). The figures are still used, and published as unchecked. Refusing them would push the Ministry back to collections that name each school.
- **Why.** Credible figures abroad came from independent samples like this, not from teachers' own reports (research 11). The reader mode's spot-check sheet supports it (§7.2).
- **Honest expectations.** Covering the plan is not the same as learning. The big learning gains abroad came from structured lessons with coaching, never from tracking alone (research 11).

### 8.6 The state track

| When | State track | Gate |
|---|---|---|
| Now to December 2026 | • Find a contact at the IGP, the first step<br>• Read the Tarbya-Up terms<br>• Draft the plan-pack format<br>• Counsel's priority questions<br>• Prepare the association | The field check |
| January–March 2027 | • A director and an inspector in the pilot, in reader mode<br>• The security design published | The pilot's success criteria |
| September 2027 | • The four formats proposed to the IGP and INRE, with the pilot's results<br>• The first ask to the Ministry, with the pilot's results and the national system's design (§1.15)<br>• A Tarbya-Up entry, once its call and terms are known<br>• The association in place (§9.8) | The pilot's results, published |
| 2027/28 | • The observatory's method published, then its first collection | The method published at least a month before collection (§8.4) |
| Once the Ministry adopts Minhajna | • The ministerial text, and the Council of Ministers' decision<br>• The national system on government servers, then a trial term end<br>• Teachers move to it, and the project's server closes (§5.2)<br>• The mandate from the national launch, whose date is set at adoption | What the national system needs (§7.12), and the launch gate (§6.8) |

Before adoption, the track seeks no official acceptance of printed pages, and runs no school or directorate deployments (§1.15, 29 Sep).

**The doors**
- **The IGP:** the plan-pack pipeline, the observatory and the formats. There is no contact yet, so finding one comes first.
- **INRE,** the national institute for research in education: the formats, its incubator, and its journal (مجلة الابتكار التربوي), first published in September 2026.
- **The Tarbya-Up Challenge 2027.** Edition 3 is open to sector staff and researchers, so the founder, a teacher in service, can lead an entry, for example the teacher app, with the pilot's results. Its IP terms are checked against the AGPL and the DCO first.
- **The Ministry's digitisation cell:** the session-log format and the national system's design, once INRE is engaged.

### 8.7 National adoption

National adoption is the first ask (§1.15, 29 Sep). The national launch has no date yet: it is set once the Ministry adopts Minhajna, and the work is planned back from it (29 Sep). Adoption takes:
- **Decisions.** A Council of Ministers decision, and a ministerial text giving the digital record official status, alongside or instead of Decisions 155 and 831, and making it compulsory from the national launch.
- **State plans and data exchange.** HCN review of the sector plan (Decree 23-314), and data exchanged only through the national interoperability system (Decree 25-320).
- **Hosting** on state infrastructure: the Ministry's data centre or the national data centre, with no internet access, and no outbound calls except through the interoperability connector (§5.2, §5.9, §6.7).
- **The ANPDP,** consulted, or its authorisation for a national system.
- **Records fit to be official:** signed exports and a history that cannot be altered (§1.15), with legal signatures under Law 15-04 (§5.5).
- **Minhajna's role:** the code, the deployment guide, the administration manual and the training material, free. The project sells nothing, and signs no support contract (§1.10).
- **After adoption, the Ministry's own staff maintain Minhajna** (29 Sep), as maintainers in the project's public process. A change to the principles or the charter then needs the teacher council's consent (§1.8, 30 Sep). The Ministry deploys each release within an agreed window, and security fixes for critical flaws within 7 days (§5.2, §6.7).
- **The design protects teachers** (§1.15). The ask includes the charter's protections, with the three safeguards on exam scope (charter point 7), as a request, not a condition. Whatever the text says, nobody who runs the servers can read named records, and above the school there are only totals (§5.2, §6.5).
- **The Ministry's app** is the project's release, with the Ministry's name and icon as settings, built reproducibly. The Ministry's deployment runs under its own name, and the project's own app can always connect to it (§1.9, 29 Sep). If its build ever weakens the charter, the project publishes the finding at once (30 Sep).
- **Teachers are consulted first:** the staff technical committees and the representative unions, with the results published and every objection answered in public before the mandate starts (30 Sep), and the charter presented to every school's teachers' council (§1.15).
- **The launch gate** before the mandate: a load test at national scale, a trial term end with real schools, the independent security review and a full restore from backup (§6.8).
- **Paper goes** once the text allows it, and stays only as the fallback (§2.2).

### 8.8 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| Relationship | Complement the state and never duplicate it. Files only until there is an agreement. Watch what the state ships, and respond |
| The offer (changed by 0015 and 0016) | The four formats, the pipeline for the IGP, accepted printouts, the observatory, the aggregator, a protocol for a national figure, and code with support |
| Observatory | Opt-in and lesson-level: sessions per item, merges and skips, how far classes got by term end, and closures from the public calendar. No dates, reasons or institution-mode data |
| Minimum sizes | At least 10 teachers and 3 schools for a wilaya or national figure, with suppression of cells that would reveal a hidden one |
| Peer comparison | Worked out on the teacher's device from the published figures |
| Use of figures | Never for exam scope, rankings or personnel decisions. The IGP sees each report first, with 30 days to comment |
| National figure (changed by 0015 and 0017) | An inspectors' sampling protocol, not teachers' data |
| National adoption (changed by 0015) | The charter binds it. Otherwise the state may fork under another name |
| Section 8 | Settled on 27 Sep 2026 |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| The offer | The four formats, the pipeline for the IGP, the observatory, a protocol for a national figure, the national system, and code with support. No accepted printouts, and no aggregator for directorates |
| Observatory | Collects in teacher mode from 2027/28, and is retired once the national system's totals exist |
| The state track | Teacher mode only until the Ministry's system opens: no accepted printouts, school trials or directorate deployments. The first ask goes with the pilot's results, in September 2027 |
| National adoption | The first ask: a ministerial text makes the full digital record official, and compulsory from the national launch. The charter's protections are asked for, not required, and the design protects teachers either way. The launch date is set once the Ministry adopts Minhajna |
| After adoption | The Ministry's own staff maintain Minhajna in the project's public process. The Ministry's app is the project's release under the Ministry's name, and a build that weakens the charter is made public at once. The project's server closes once teachers have moved |
| Consultation | Every objection from the staff committees and the unions gets a public answer before the mandate starts |

**Decided on 4 Oct 2026 (decision 0016, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| The offer | The code, the deployment guide, the administration manual and the training material, free. The project sells nothing, and signs no support contract |
| After adoption | A change to the principles or the charter needs the teacher council's consent. The Ministry's maintainers can propose one, never decide it alone |

**Decided on 4 Oct 2026 (decision 0017, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Use of figures | The observatory's figures never inform exam scope. In the national system, exam scope follows charter point 7, at each exam's own level (§7.10) |
| National figure | In the national system, it comes from the totals, which the inspectors' sample checks along with every threshold. The sample's results are published as totals only. In a year without the sample, the figures are published as unchecked |
| National adoption | The first ask includes the three safeguards on exam scope, as a request |

**Open**
- **A contact at the IGP.** There is none yet.
- **The Tarbya-Up 2027 call** and its IP terms.
- **Publishing the figures:** whether it needs the Ministry's consent, and whether the national statistics rules apply. Counsel answers.
- **Whether and when the Ministry ships its own digital texts book.**
- **The AGPL in a state deployment,** alongside Ord. 21-09 and the security levels of Decree 25-320. Counsel answers.

---

## 9. Funding and sustainability

*Rewrite proposed on 29 Sep 2026 in decision 0016: Minhajna is free, and the project sells nothing. Decision 0015 also makes sync free. Those decisions were accepted on 4 Oct 2026.*

This section turns the money rules (§1.10) into a plan:
- what everyone gets, and what nobody pays;
- how the project is funded until the Ministry adopts Minhajna;
- what it costs;
- the legal entity;
- how teachers find Minhajna.

Costs are estimates. The pilot tests them.

### 9.1 The model

| Who | Their part | Never |
|---|---|---|
| **Teachers** | Use everything free: every feature, sync and backup, every export and print layout. They may donate, which unlocks nothing | Pay for anything |
| **The Ministry, directorates and schools** | Get the software, the deployment guide, the administration manual and the training material, free. After adoption, the Ministry's staff maintain Minhajna (§1.8) | Pay the project, or buy a service from it |
| **Public grants and prizes** open to any project, never from abroad | Fund the team's time, plan-pack curation, the field check and the security review | Override a principle (§1.2) |
| **Sponsors** in Algeria that sell nothing in education (§9.5) | Are thanked on the website and in the transparency report | Get data, a say in the roadmap or a place in the app, or give more than a quarter of a year's income |

### 9.2 What teachers are used to

- **Free is the norm** (brief §12).
  - Every Algerian register or journal app found is free, often with ads.
  - Teachers pay for paper registers (about 350 DA each), printing and design tools.
- **Teachers fear that a free tool will start charging** once their records are in it, and they have seen teacher apps vanish (research 04, 05). Principle 4 and the continuity pledge answer both (§1.12).
- **The adoption ceiling.** No Algerian register or journal tool has passed about 10,000 real installs. Content apps get about ten times the installs of tool apps (brief §4.6, §12).
- **Seasons.** Demand for export and appreciation tools peaks at the term-end windows in December and March.
- **Scale.** About 630,000 teachers (§2.1).

### 9.3 Sync and backup, free

- **Free for every teacher** (§1.10), once its gates are met (§6.2). There is no price, subscription or payment.
- **The project runs the sync server** in Algeria until the Ministry's system opens. Teachers then move to it, and the project's server closes (§5.2).
- **The same app everywhere.** With nothing to sell, every build is the same, with no prices, payment links or donation links. Donations happen only on the website (§9.5).

### 9.4 What the state gets

- **Everything, free:** the software under the AGPL, the deployment guide, the administration manual and the training material, so the Ministry can do the work itself (§1.10). Nothing goes through public procurement, because nothing is sold.
- **Everything the Ministry's team needs is documented,** from building a release to restoring a backup (decision 0016).
- **No deployments by the project.** Before adoption, it runs none for a school or an authority. After adoption, the Ministry runs the national system, and its staff maintain Minhajna (§1.8, §1.15).

### 9.5 Grants, prizes, donations and sponsors

- **Public grants and prizes open to any project,** such as INRE's Tarbya-Up Challenge (§8.6).
- **No money from abroad** (30 Sep): no foreign grants, prizes, funds or sponsors, and donations only through channels approved in Algeria (§1.10).
- **Teachers' donations,** on the website, once the association exists and has an account, through channels approved in Algeria (§1.10). They are voluntary and unlock nothing, and the app never asks for them.
- **Sponsors** who get no access to data, no say in the roadmap and no place in the app. They are thanked on the website and in the transparency report.
  - The project refuses sponsors that sell to schools, teachers, pupils or parents, such as publishers, tutoring firms, EdTech firms and private schools, and any party, union or religious body (30 Sep).
  - No sponsor gives more than a quarter of the project's income in any year.
- **Every source is disclosed,** and every income and cost appears in the transparency report (principle 8, §1.11).
- **Never:** ads, trackers, selling or sharing data, paid features, or charging anyone to get their own data out (§1.10).

### 9.6 Costs

| Cost | Estimate | Source |
|---|---|---|
| Sync servers in Algeria, until the Ministry's system opens | About 5,000–15,000 DA a month, on one or two servers with redundancy | Research 06 |
| Website, downloads and the reference-data mirror | About 1,000–10,000 DA a month, on shared hosting in Algeria | Research 06 |
| Domains, the ANPDP formalities, setting up the association and its accounts | One-off and yearly fees | To be quoted |
| **People's time:** development, plan-pack curation, support and security | By far the largest cost | The funding plan (§9.7) |

- **Hosting is cheap. People are not.** Grants and donations go first to people's time (§9.7).
- **After adoption,** the Ministry pays for its own servers and staff. Once teachers have moved to its system, the project's costs shrink to the website, the reference data and the public process.
- **Counsel** has no budget yet, so the project looks for free help, such as university law clinics and incubators (§1.17).

### 9.7 Funding until adoption

- **Until launch,** the work runs on the founder's and volunteers' time, plus any grants and prizes.
- **Spending priorities,** when money comes in:
  1. **Plan-pack curation.** It is the slowest part of the work, and it recurs every September (§4.4). Subject maintainers are credited, and paid once money allows.
  2. **The independent security review** before sync opens (§6.5).
  3. **Hosting** in Algeria (§9.6).
- **Support** comes from volunteers, as they can. There is no committed support channel (§1.10).
- **The pilot must answer four questions for this plan:**
  - What share of teachers turn sync on?
  - How much support do 100 teachers need?
  - How long does one plan pack take to key and check?
  - Which content brings installs?

### 9.8 The legal entity

**An association, not a company** (29 Sep), which counsel confirms (§1.17). It must be able to:
- hold the copyright, the name and the repositories, and hand them to a successor (§1.12);
- receive grants, prizes and donations;
- sign agreements with public bodies, none of them a sale (§1.8);
- appoint or share a data-protection officer (§6.2).

- **Why an association.** With nothing sold, the project needs no commercial register entry, and the e-commerce rules of Loi 18-05 no longer apply. Counsel checks the rules for an association that receives donations and grants.
- **When.** If the ANPDP declaration for the pilot cannot be filed by the founder personally (§6.10), the association is needed before January 2027. Donations start once it exists and has an account.

### 9.9 How teachers find Minhajna

Teachers find Minhajna where they already are (§1.1), never through inspectors or schools.
- **The teacher group on Facebook:** the public beta, a monthly progress post and support (§1.11).
- **YouTube tutorials in Arabic:** one short video per task, such as setting up in 10 minutes, the term export or printing the journal. Each is timed to its season.
- **A content website,** because content brings far more installs than tools do. It offers:
  - free templates and blank documents with their headers filled in;
  - plain guides to the official rules: formulas, circulars and the calendar;
  - a public view of the plan packs;
  - the official downloads (§1.9).
- **Word of mouth in the staffroom.** Handover packages and shared statements carry Minhajna from one colleague to the next.
- **The season.** Launch in September, and promote the term export before the windows in mid-December, March and May.
- **Every store review gets a reply** (§1.11).

### 9.10 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| Teachers (changed by 0015 and 0016) | Every feature is free. Sync is the only paid teacher service |
| Sync (changed by 0015 and 0016) | Free in the pilot. Then one payment per school year, per account. The pilot tests 500, 1,000 and 1,500 DA a year |
| Lapsed payment (changed by 0015 and 0016) | Sync stops. Nothing is locked, and exporting stays free |
| Google Play (changed by 0015 and 0016) | No prices or payment links in the Google Play build. Teachers subscribe on the website |
| Institutions (changed by 0015 and 0016) | Paid deployment, training and support, with a public price list. The state buys through public procurement |
| Other income (changed by 0016) | A supporter pass, grants and sponsors, under §1.10 |
| Spending (changed by 0016) | Curation first, then the security review, hosting and support |
| Distribution | The Facebook group, YouTube tutorials and a content website. Never through inspectors or schools |
| Section 9 | Settled on 27 Sep 2026 |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Sync | Free for teachers |

**Decided on 4 Oct 2026 (decision 0016, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| The model | Nothing is sold. Teachers, the Ministry, directorates and schools pay nothing, and the project takes no payment for Minhajna or for help with it |
| Sync | Free for every teacher, with no price or subscription |
| The state | The software, the deployment guide, the administration manual and the training material, free. After adoption, the Ministry's staff maintain Minhajna |
| Funding | Public grants and prizes open to any project, teachers' donations, and sponsors with no access to data. No money from abroad. Every source disclosed |
| Sponsors | None that sell to schools, teachers, pupils or parents, and no party, union or religious body. None gives more than a quarter of a year's income |
| Spending | Curation first, then the security review and hosting. Volunteers give support |
| Legal entity | An association, which counsel confirms |

**Open**
- **Counsel confirms the association,** and the rules for one that receives donations and grants.
- **Which grants and prizes to apply for.**
- **Funding the team's time** until adoption (§1.17).

---

## 10. Roadmap, metrics and risks

*Changes proposed on 29 Sep 2026 in decisions 0015, 0016 and 0017, for the national system run by the Ministry, with nothing sold and exam scope set at each exam's own level. Those decisions were accepted on 4 Oct 2026.*

This section brings the plan together:
- the roadmap and its gates;
- the field check;
- how success is measured, without spying on teachers;
- when to stop and change course;
- the risks, and the response to each.

It gathers the field-check, pilot and launch scopes from Sections 3 to 9.

### 10.1 The roadmap

Two tracks run side by side: the product for teachers and schools, and the state track (§8.6). Each period ends with a gate.

| When | Build | Content | Schools and the state | Legal and money | Gate |
|---|---|---|---|---|---|
| **Now to December 2026:** the field check | • A prototype: setup, Today and roll call<br>• The five technical checks (§5.13) | • About five plan packs keyed in full (§4.11)<br>• The 2026/27 calendar, as the Ministry publishes it | • The field check (§10.2)<br>• A contact at the IGP<br>• The Tarbya-Up terms read, and the plan-pack format drafted | • Counsel's priority questions, with free help<br>• The association set up, if the pilot's declaration needs it (§9.8)<br>• The project's ANPDP declaration for the pilot (§6.2)<br>• The name protected (§1.17) | The field check's stop condition (§10.4) |
| **January–March 2027:** the pilot | • The pilot app (§3.11), reader mode and the coordinator's merge (§7.2–7.3)<br>• The national system designed alongside (§5.1) | Fixes from the field. Ramadan 1448 and any exam move as a live test (§4.11) | A director and an inspector in the pilot, in reader mode | • The security design published<br>• Sync only if its gates are met (§6.2) | The pilot's success criteria (§10.3) |
| **April–August 2027** | The launch scope: every level's flows, the timetable package, handover, and sync, free for teachers | The first full September release prepared (§4.4) | The pilot's results published | • The association in place<br>• The independent security review (§6.5) | Ready for launch |
| **September 2027:** launch | Google Play, the website and F-Droid | The September release for 2027/28 | • The four formats proposed to the IGP and INRE, with the pilot's results<br>• The first ask to the Ministry (§8.6)<br>• A Tarbya-Up entry | • The first transparency report (§1.11)<br>• The teacher council (§1.8) | — |
| **2027/28** | More teachers. The observatory, in teacher mode, with its method published a month before collection (§8.4) | The yearly cycle | No school or directorate deployments before adoption (§1.15) | Counsel confirms that lesson-level data needs no written authorisation (§8.4) | The method published at least a month before collection |
| **2028/29 onwards** | A second country only if one is decided (§1.14) | — | Teacher mode until the Ministry's system opens (§1.15) | — | — |
| **Once the Ministry adopts Minhajna** | • The national system built, on a plan worked back from its launch date (§5.1, §8.7)<br>• The Ministry's staff join as maintainers (§1.8)<br>• Teachers move over, and the project's server closes (§5.2) | — | • The ministerial text (§8.7)<br>• Teachers' committees and unions consulted, and the charter presented to every teachers' council (§1.15)<br>• A trial term end, then the mandate from the national launch | What the national system needs, which is the Ministry's to meet (§7.12) | The launch gate (§6.8) |

### 10.2 The field check

**Who**
- **5 to 10 teachers,** across the three levels. They include a contract teacher, a primary specialist and a teacher who works in two schools.
- **2 or 3 directors, censeurs or education counsellors.**
- **1 or 2 inspectors or subject coordinators,** and a contact at the IGP if possible.
- **Teachers' representatives,** on what they would require before the digital record becomes compulsory (§1.15).

**What it must settle**
- **The paper routine, timed:** the minutes a week that the journal, the texts book and the distributions take today. This is the baseline for the time budget.
- **The pilot slice:** grades, subjects and schools (§2.7).
- **The weekly signature:** whether signing each course's week in one step fits the teacher's routine (§3.3).
- **The plan model:** the time anchors and the stage picker, and whether "weeks behind the plan" means something to teachers (§4.11).
- **Trust:** whether teachers read Minhajna as surveillance, and what would push them to over-report or under-report.
- **Files:** the class list, the grade workbook's type and columns, blank workbook templates and anonymised FET files (§3.12, §5.14, §7.4).
- **Documents:** the lesson-note template, what Tamazight teachers keep, and the roll-call counting rules (§3.12).
- **The April 2026 progress collection:** what it asked, and how schools answered it.

**Counsel's questions, in priority order**
1. Who the controller is in each type of school, and whether a teacher showing their own record to their director is an internal communication.
2. Whether teachers may send lesson-level insights without written authorisation.
3. Whether the founder can file the ANPDP declaration and serve as data-protection officer, and whether a processor that stores only data it can't read is still a processor.
4. The association's form, and the rules for an association that receives donations and grants, including what counts as money from abroad (§1.10, §9.8).
5. Whether the charter's "no personnel use" clause can be written into a ministerial text and enforced.
6. The copyright status of the IGP's plans.
7. The FET importer, under FET's licence.
8. For the first ask (§1.15):
   - how the Ministry, its directorates and its schools share the controller's role;
   - whether the state's certification authority can certify keys made on teachers' phones (§5.5);
   - whether the Ministry's text can make a record count from the day it was signed on the device (§5.5);
   - the access and agreements that the interoperability system needs (§5.9).

Counsel's other questions are in each section's open points.

### 10.3 How success is measured

**The pilot's success criteria**

| Measure | Target |
|---|---|
| Seconds per ordinary session | Median about 5; 90th percentile at most 15 |
| Paperwork time per week | Below the paper baseline timed in the field check (§10.2), for at least 3 in 4 pilot teachers who share their timings |
| Sessions confirmed in one tap | At least 60% |
| Teachers still using it at the end of the pilot | At least 70% |
| The term-2 export | Completed by every pilot teacher who wanted it, with no file rejected |
| Reader mode | At least one director and one inspector check statements with it (§7.2) |
| Privacy incidents | Zero |
| Data-quality audit | Its two comparisons published (§8.4) |

**After launch.** Reported in the monthly progress posts and the transparency report (§1.11):
- **Use:** downloads and active sync accounts. From surveys: term exports, statements shared, and teachers still active after a term.
- **Time:** seconds per session and minutes per week, from surveys and volunteer panels.
- **Trust:** privacy incidents, and security fixes shipped on time.
- **Content:** packs published, by status. Plan errors fixed, and how fast. Calendar fixes made within 24 hours.
- **Money:** income by source, and costs (§9.5, §9.6).
- **The goal** (§1.15): a working contact at the IGP or INRE, the formats proposed, the first ask made, the independent security review passed, and the Ministry's decision to adopt Minhajna. Also: directors and inspectors who check statements in reader mode.

**Measured without spying on teachers**
- **The app sends no usage data** (principle 3, §1.5).
- **In the pilot,** a pilot build times sessions on the device. The teacher sees the figures and decides whether to share them. The figures stay on the phone, and the app compares them with nothing. With the teacher's consent, the same four figures go once a month to the project's server, with no identifier (5 Oct).
- **After launch,** figures come only from what the project sees anyway (downloads, reference-data updates and sync accounts), plus opt-in surveys and the opt-in insights.

### 10.4 When to stop and change course

- **After the field check.** If teachers read Minhajna as surveillance, the design changes before the pilot.
- **After the pilot.** If ordinary sessions take far longer than 5 seconds, or teachers keep paper and Minhajna side by side with no time saved, the flow is reworked before launch. Parallel paper and digital records were the worst case abroad (research 11).
- **Before the mandate.** If the national system fails the launch gate, the mandate waits until it passes (§6.8).
- **In the national system.** If the Ministry's use breaks the charter, the project reports the breach in public, where the law allows: at once if the Ministry's build weakens the charter (§1.9, 30 Sep), and in every case in the transparency report (§1.11). The design still keeps named records and times out of the servers' reach (§5.2).
- **If the state ships its own texts book,** Minhajna follows §8.2 rather than competing.

### 10.5 Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Plan packs cost more to keep up than the team can give, every September | High | High | Curation gets money first (§9.7). Status flags, free entry without a pack (§4.2), and the IGP taking over the pipeline (§8.3) |
| Teachers see Minhajna as surveillance, or it is used against them | Medium | High | The charter, record layers, no clock times, "awaiting confirmation" only on screen, neutrality (§1.11, §5.4, §7.6). In the national system, no server can read named records, and above the school there are only totals (§5.2). The stop conditions (§10.4) |
| Few installs: no Algerian teacher tool has passed about 10,000 | High | High | The content website and tutorials, free features, offline use, the term export as the pull, and word of mouth through handovers (§9.9) |
| The state ships a digital texts book or an inspector space within 12–24 months | Medium | Medium | Offer it the formats and the national system's design (§8.3). Otherwise complement it: export into it, and keep the teacher's capture and pacing (§8.2) |
| Legal questions stay unanswered, with no budget for counsel | High | High | Protect data as if the strictest reading applied (§6.1). Free legal help. The national system's legal steps are the Ministry's to meet before the mandate (§7.12) |
| No association in time for the pilot's declaration or sync | Medium | High | Set it up during the field check if the pilot's declaration needs it (§9.8). The pilot can run without sync (§6.2) |
| Too much scope for a small team: three levels, all the documents, three languages, two platforms, and the national system | High | High | The pilot slice before the launch scope (§3.11, §4.11). The technical checks early (§5.13). The national system is designed alongside the pilot, and built on a plan worked back from its launch date (§5.1, §8.7) |
| Technical blocks: F-Droid builds, Arabic PDFs, filling `.xls` workbooks, browser storage | Medium | High | The five checks before the pilot (§5.13) |
| Reference data changes without warning, and the workbook changes at an export deadline | High | Medium | Versioned data, fixes within 24 hours, and only fixes before each export window (§1.9, §4.4) |
| Directors and inspectors differ on printouts | Medium | Medium | Template profiles and blank versions (§3.8) |
| Phones restricted in class (circular 460) | Medium | Low | Roll call after the lesson, and a paper fallback (§3.4) |
| A lost phone exposes pupil data | Medium | High | Encryption, the app lock, backups and the recovery sheet (§6.4, §6.5) |
| A breach of the server, whoever runs it | Low | High | End-to-end encryption: nobody who runs a server holds a key, so there is nothing readable to steal (§6.5). The breach runbook (§6.7) |
| The Google Play account is lost or the app removed | Low | High | The website and F-Droid as official sources (§1.9). Accounts held by the organisation (§1.8) |
| Too much depends on the founder | High | High | Everything public, the continuity pledge (§1.12), and more maintainers (§1.8). After adoption, the Ministry's staff maintain Minhajna too (§1.8) |
| Money runs out before adoption | Medium | High | Grants, prizes and donations from Algeria, sponsors with no stake in education and none above a quarter of the income, low hosting costs and clear priorities (§1.10, §9.7). The daily work never depends on the project's servers (§1.12) |
| The 6 September 2026 rule slows the first ask | High | Medium | Teacher mode and reader mode need no approval (§7.2). Patience on the state track |
| Self-reported figures mislead, now that they can shape an exam: a class gains by reporting less (research 11) | Medium | High | Only signed progress counts above the school, taken on dates announced in advance, published after the exam and checked against the inspectors' sample, or marked unchecked in a year without it (charter point 7, §7.10). The observatory's figures never inform exam scope. The data-quality audit (§8.4, §8.5) |
| The Ministry does not adopt Minhajna | High | High | Teacher mode stands on its own. The formats, the pipeline and the observatory serve the state anyway (§8.3) |
| A compulsory mandate meets resistance or a boycott, as digital platforms have in Algeria and Morocco (research 13) | High | High | Teachers' committees and unions consulted first, with the results published and every objection answered in public before the mandate starts, and the charter presented to every teachers' council (§1.15). The protections built into the design: corrections always possible, no clock times and no personal phone required (§5.2, §5.5, §6.6). Neutrality, and no count of strikes (§1.11, §7.9) |
| The national system fails at its first term end | Medium | High | Device first: every task works offline, and a record counts from the day it was signed on the device (§5.5). The launch gate, with its load test and trial term end (§6.8) |
| The Ministry's app is modified in a way that weakens the protections | Low | High | Reproducible builds with published checksums, which the web app also shows. Teachers are entitled to the source of any modified version, and the project's own app can always connect. A build that weakens the charter is made public at once (§1.9, §5.2) |

The risk register is reviewed each term, in public (principle 8).

### 10.6 Decisions and open points

**Decided on 27 Sep 2026**

| Decision | Choice |
|---|---|
| Roadmap (changed by 0015 and 0016) | The periods and gates in §10.1 |
| Field check (changed by 0015 and 0016) | The groups and questions in §10.2, with counsel's questions in that order |
| Pilot success (changed by 0015) | The targets in §10.3 |
| Measurement | The app sends no usage data. Pilot timings are shared only if the teacher agrees. After launch, only what the project sees anyway, plus opt-in surveys and insights |
| Stop conditions (changed by 0015) | As in §10.4, including ending support for a deployment that breaks the charter |
| Risks (changed by 0015, 0016 and 0017) | The register in §10.5, reviewed each term in public |
| Section 10 | Settled on 27 Sep 2026 |

**Decided on 4 Oct 2026 (decision 0015, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Roadmap | Teacher mode until the Ministry's system opens, with no school or directorate pilots. The national system is designed alongside the pilot. The first ask at launch, in September 2027. After adoption: the national system built, a trial term end, then the mandate once the launch gate is passed |
| Sync | Free for teachers, so no price and no subscribers |
| Field check | The weekly signature replaces printouts. Teachers' representatives are asked what they would require before the record becomes compulsory. Counsel's questions add the national system's, last |
| Pilot success | Reader mode replaces the printout target |
| Stop conditions | The mandate waits until the national system passes the launch gate. A charter breach in the national system is reported in public, at once if the Ministry's build weakens the charter |
| Risks | Four added: no adoption, resistance to the mandate, the first term end, and a modified app |

**Decided on 4 Oct 2026 (decision 0016, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Money | Nothing is sold. Income is reported by source, with the costs (§9) |
| Legal entity | An association, set up during the field check if the pilot's declaration needs it (§9.8) |
| Field check | Counsel's questions add the association's form, and the rules on donations and grants, including what counts as money from abroad |

**Decided on 4 Oct 2026 (decision 0017, proposed on 29 Sep and amended on 30 Sep)**

| Decision | Choice |
|---|---|
| Risks | Self-reported figures can now shape an exam, so a misleading figure has a high impact. The three safeguards of charter point 7 answer it, and a year without the sample is published as unchecked |

**Open**
- **The pilot's size and schools,** chosen after the field check. About 30 teachers in 3 to 5 schools, across the three levels, is a starting point.
- **A contact at the IGP.**
- **Counsel's confirmation of the association** (§9.8).
- **Funding the team's time** until adoption (§9.7).

# Requirements and their screens

Every requirement of the PRD that a screen should meet, one line each: first the teacher's (audits A to D), then those of the roles above the teacher (audit E and the fix batches), with the screens that meet them and what is still missing. IDs are `R-<PRD section>-<number>`. Line numbers in the PRD column refer to `docs/prd/PRD.md` on 4 Oct 2026 in audits A to D, and on 29 Oct 2026 in audit E. Coverage: *designed*, *partial*, *missing*, or *n/a (rule)* for a rule that needs no screen of its own.

## A. Getting started, Today and roll call (§2.3, §2.5–2.6, §3.1–3.4)

| ID | Requirement | PRD | Screens | Coverage | What is missing or wrong |
|---|---|---|---|---|---|
| R-2.3-01 | The teacher sees which reviewed plan pack and release proposes the lessons, and who prepared it until the Ministry joins | §2.3 L620–622 | Setup-6-Plan (pack card, provenance note), Plan (release 2026.2 notice) | designed | Ministry and curator side is out of scope (E-Release) |
| R-2.3-02 | Each class's lessons are dated from the plan, the class timetable and the calendar (primary by plan week, CEM and lycée by hours per sequence) | §2.3 L623–625 | Plan (dated items, "الأحد 1 نوفمبر عطلة"), P-Today ("الأسبوع 3"), Setup-7-Ready (September check), Calendar-add (effect panel) | designed | — |
| R-2.3-03 | The day's lessons appear on the Today screen | §2.3 L626 | Main, P-Today, L-Today, PS-Today, EN-Today | designed | — |
| R-2.3-04 | A weekly digest arrives by default | §2.3 L627 | Digest, Notif (switch on by default) | designed | — |
| R-2.3-05 | A daily preview comes only if the teacher turns it on | §2.3 L627 | Notif ("معاينة يومية", off by default) | designed | — |
| R-2.3-06 | No notifications at night or at weekends | §2.3 L628 | Notif (quiet hours 20:00–07:00, Thursday 20:00 to Sunday 07:00, Saturday-work switch), Digest footnote | designed | — |
| R-2.3-07 | One tap confirms "done as planned" after the session | §2.3 L630 | Main → Today-done (snack with undo), P10 | designed | — |
| R-2.3-08 | Any other outcome takes exactly one more tap | §2.3 L631 | Sheet (opened by "نتيجة أخرى") | designed | — |
| R-2.3-09 | A whole day or week can be confirmed at once, with its exceptions | §2.3 L632 | Today-backlog (tap a session to exclude it), P-Today and L-Today ("تأكيد اليوم كله كما هو مقترح") | designed | Drawn for two past days; a full week uses the same pattern |
| R-2.3-10 | Free text is always allowed | §2.3 L633 | Entry (factual line, private note, "إضافة محتوى من خارج المخطط") | designed | — |
| R-2.3-11 | Confirming writes the journal and texts-book entries; distributions and lesson-note drafts follow from the plan | §2.3 L635 | Today-done ("كُتبت في دفتر النصوص، الصفحة 10"), P10, Journal, Docs (distributions and notes rows) | designed | Document detail is audited under §3.8 |
| R-2.3-12 | The following lessons re-pace from what was actually taught | §2.3 L636 | Sheet ("ما بقي يُقترح في الحصة القادمة (تابع)"), Today-done (next card "يتابع"), Today-holiday, Plan | designed | — |
| R-2.3-13 | National system: each course's week is signed in one step (fingerprint or PIN), becomes the official record and stays correctable | §2.3 L637 | Week-sign, Week-fix | designed | — |
| R-2.3-14 | A proposed lesson is never a taught lesson; only the teacher's confirmation records it | §2.3 L640 | P10 (dotted "في انتظار التأكيد" against a filled tick), Main ("مقترح من المخطط"), Journal ("تنتظر التأكيد"), Web-week (pencil against ink) | designed | — |
| R-2.3-15 | Changing the proposal costs no more than confirming it | §2.3 L641 | Sheet (every alternative in 2 taps), Entry ("تغيير الدرس"), Entry-lesson | designed | — |
| R-2.3-16 | Progress belongs to the class, the subject and the school year, not to the teacher | §2.3 L642 | Plan (per class), Class | n/a (rule) | — |
| R-2.3-17 | History is only added to: a new plan, timetable or assignment never rewrites a recorded session | §2.3 L643 | TT-change ("الحصص المسجّلة لا تُعاد كتابتها"), Week-draw footer, Plan-item footnote | designed | — |
| R-2.3-18 | A missing entry is never an absence | §2.3 L644 | Week-sign ("الحصة التي لم تُؤكَّد ليست غياباً"), School-mine footnote ("«تنتظر التأكيد» ليست غياباً") | designed | — |
| R-2.5-01 | Version 1 runs in teacher mode; national-system screens appear only as labelled future examples | §2.5 L661, L674–675 | Every national-system board is dated in 2029/30 and labelled "مثال"; Settings has no school-space entry | designed | — |
| R-2.5-02 | Primary, CEM and lycée are all served | §2.5 L665 | P-Today, P-Roll, P-Multi; Main (CEM); L-Today | designed | — |
| R-2.5-03 | The lesson log and the register are joined by the session | §2.5 L666 | Main (the session card carries roll call and homework), Roll (header is the session's slot) | designed | — |
| R-2.5-04 | The version-1 documents are reachable: texts book, primary journal and personal journal, distributions, lesson notes, roll-call book with monthly summary | §2.5 L667 | Docs, P10, Journal, P-Journal, Month | designed | Detail audited under §3.8 |
| R-2.5-05 | Roll call is the teacher's own record, taken in class or after, with a paper fallback; the official absence system is not replaced | §2.5 L668 | Roll (note line), Roll-print (blank sheet), School-mine (cover tab footnote) | designed | — |
| R-2.5-06 | Assessment: teacher's components within the circular, official formula, appreciations suggested then confirmed per pupil | §2.5 L669 | Marks-setup, Export ("المعدلات بالصيغة الرسمية"), Apprec ("لا تعبئة جماعية") | designed | Detail audited under §3.5–§3.6 |
| R-2.5-07 | Term export: the workbook's unlocked cells, an ostad view, printed sheets, the class-council pack | §2.5 L670 | Export, Council | designed | Detail audited under §3.7 |
| R-2.5-08 | An Android app and an installable PC web app, both offline | §2.5 L671 | Web-unlock ("يعمل دون إنترنت بعد تثبيته"), Web-week, the phone boards | designed | — |
| R-2.5-09 | Arabic, French and English interfaces; documents in the subject's language | §2.5 L672 | Setup-1, Language, PS-Today, EN-Today, P90 | designed | — |
| R-2.5-10 | No AI in the teacher app | §2.5 L673 | none | n/a (rule) | None present, as required |
| R-2.5-11 | The school layer is staged: reader mode, then the timetable package, the school's space only after adoption | §2.5 L674 | Setup-5-Week and TT-change (package), School-join (2029 example) | designed | The package appears in the October 2026 scenario, before the September 2027 launch: acceptable as a made-up date |
| R-2.5-12 | Not in version 1: the insights observatory, an iPhone app, AI | §2.5 L675 | Settings ("الإحصاءات المجهولة · متوقفة · تبدأ في 2027-2028"), Insights boards labelled 2027/28 | designed | — |
| R-2.6-01 | Nobody assigns lessons to sessions by hand | §2.6 L679 | Main, Plan (the engine proposes each session) | designed | — |
| R-2.6-02 | No lesson is recorded as taught without the teacher's confirmation | §2.6 L679 | P10, Today-backlog (explicit confirm), Web-week (later sessions stay in pencil) | designed | — |
| R-2.6-03 | No teacher attendance or absence reasons | §2.6 L680 | School-join ("ما لا يدخله أبداً"), School-mine (cover tab "لا يُسجَّل سبب") | designed | — |
| R-2.6-04 | No clock times, "started" events or sign-in events are recorded | §2.6 L680 | Log ("دون ساعات"), Correct, Pupil (log), School-join (joined state), Web-staff, D-Issue | designed | — |
| R-2.6-05 | No location or biometric data; the fingerprint never leaves the phone | §2.6 L680 | Lock, Security, Week-sign footer, School-join | designed | — |
| R-2.6-06 | No personal phone is required | §2.6 L680 | Web-staff (security-key tab), School-join | designed | — |
| R-2.6-07 | No scores, rankings or colour codes for teachers, and no inference of effort | §2.6 L681 | School-mine ("لا ترتيب ولا ألوان للأشخاص"), Digest, T-Threshold, Book-fixes | designed | — |
| R-2.6-08 | Confirmation status stays inside the school; in the national system only the school key opens it | §2.6 L681 | School-mine ("ولا تُطبع ولا تغادر الشاشة"), School-join, Digest-signed | designed | — |
| R-2.6-09 | No pupil data that a server can read | §2.6 L682 | Privacy, Sync-signin ("ما يراه الخادم في الجزائر": "لا أسماء ولا أقسام ولا مواد ولا نقاط") | designed | — |
| R-2.6-10 | No features for students or parents | §2.6 L683 | Term-send footnote | n/a (rule) | — |
| R-2.6-11 | Import from the state's systems instead of duplicating them (assignments, hours, official absences, results) | §2.6 L684 | School-join (assignment list), School-mine ("القناة الرسمية للغياب تبقى قناة الدولة") | designed | — |
| R-2.6-12 | No connection to state platforms without an agreement: files in teacher mode, interoperability in the national system | §2.6 L685 | Export (files), Term-send | n/a (rule) | — |
| R-2.6-13 | Figures never serve personnel decisions; exam scope only under charter point 7 | §2.6 L686 | T-Threshold ("لا يُستعمل في تقييم أحد ولا في ترتيب"), D-Threshold | designed | — |
| R-3.1-01 | One entry, every output: a session recorded once feeds the journal, texts book, roll call, continuous assessment and printouts | §3.1 L747 | Main (roll call and homework on the session card), Today-done, Journal, P10, P67 | designed | — |
| R-3.1-02 | An ordinary session confirms in about 5 seconds | §3.1 L749 | Main (one primary button) | designed | Timing is measured in the pilot |
| R-3.1-03 | Roll call for 40 or more pupils is at least as fast as paper | §3.1 L750 | Roll (all present, exceptions only, one-tap save), Roll-seats | designed | The example class has 36 pupils; the list pattern scales |
| R-3.1-04 | Both speeds are measured in the pilot against paper | §3.1 L751 | — | n/a (rule) | — |
| R-3.1-05 | Proposed, never assumed | §3.1 L752 | P10, Main, Journal, Web-week | designed | — |
| R-3.1-06 | Any entry can be corrected at any time, and the history keeps both versions | §3.1 L754 | Correct, Pupil (log), Book-fixes, Log, Sheet footnote, Week-fix, Entry-fix | designed | — |
| R-3.1-07 | No deadlines, time windows or locks | §3.1 L755 | Sheet ("يمكن تصحيح أي حصة لاحقاً"), Week-fix | designed | Export-fix's "نافذة التصحيح كما تعلنها الإدارة" is the administration's window that §3.7 L938 supports, not a lock in the app |
| R-3.1-08 | A signed week can still be corrected; the correction is signed and both versions show | §3.1 L756 | Week-fix, Digest-signed, D-Record-fix | designed | — |
| R-3.1-09 | Every document prints the way directors and inspectors expect | §3.1 L758 | Print, Roll-print, Journal, Print-set | designed | Detail audited under §3.8 |
| R-3.1-10 | Every document can print blank, with its headers filled in | §3.1 L759 | Print-set ("نسخة فارغة بعناوينها"), Roll-print (blank sheet), Docs header line | designed | — |
| R-3.1-11 | The app does all the daily work offline and with no account | §3.1 L760 | Setup-1 ("بلا حساب ولا كلمة سر", "يعمل دون إنترنت"), Privacy, Restore, Sync-signin | designed | — |
| R-3.1-12 | National system: the teacher joins once with a QR code and needs no password | §3.1 L760 | School-join, Rejoin, D-Issue | designed | — |
| R-3.1-13 | The phone alone is enough, including the PDFs to print and the term export; a PC is optional | §3.1 L761 | Print (PDF on the phone), Roll-print, Export ("WPS للأندرويد"), Web-unlock and Web-week as an option | designed | — |
| R-3.1-14 | National system: a teacher without a smartphone works on a school PC with a school-issued security key | §3.1 L761 | Web-staff (key tab), D-Issue | designed | — |
| R-3.1-15 | Neutral words: the app states facts and never judges | §3.1 L762 | Main, Classes ("وفق المخطط"), Digest, Digest-signed, Catchup, Sheet | designed | — |
| R-3.1-16 | The interface is in Arabic, French and English | §3.1 L764 | Setup-1, Language, PS-Today, EN-Today | designed | — |
| R-3.1-17 | Layouts run right to left and left to right | §3.1 L765 | PS-Today, PS-Classes, EN-Today, P90, Language note | designed | — |
| R-3.1-18 | Documents come out in the subject's language | §3.1 L766 | P90, EN-Today ("Written in the texts book, in English"), Language ("الوثائق بلغة المادة دائماً") | designed | — |
| R-3.2-01 | A usable app in about 10 minutes, without importing anything | §3.2 L770 | Setup-1 footnote, Setup-2 to Setup-7, Setup-4 ("يمكن ترك ذلك لوقت لاحق") | designed | — |
| R-3.2-02 | The teacher picks their levels, schools and subjects | §3.2 L773 | Setup-2, Setup-2b-Schools | designed | — |
| R-3.2-03 | A teacher card holds the printed details; personal fields are optional and never leave the device | §3.2 L774 | Setup-3-Card, Signature, Restore, Rejoin | designed | — |
| R-3.2-04 | Joining the school's space: scan once a QR code made from the official assignment list; the app links the phone's key to the assignments | §3.2 L777 | School-join (scan, check, joined states), D-Issue (school side) | designed | — |
| R-3.2-05 | Nothing typed twice: school, classes and class lists come from the sector's system through interoperability | §3.2 L778 | School-join (assignment card, "لا يُكتب شيء مرتين") | designed | — |
| R-3.2-06 | Signing in uses the fingerprint prompt or a PIN, and is never recorded | §3.2 L779 | School-join (joined state text), Week-sign (two buttons), Web-staff, T-Threshold-propose | designed | — |
| R-3.2-07 | Without a smartphone, the teacher joins and signs in on a school PC with a school-issued security key | §3.2 L779 | Web-staff (key tab), D-Issue (issue and replace a key) | designed | — |
| R-3.2-08 | Moving from teacher mode: the app shows what will move and moves it once the teacher agrees; private notes stay | §3.2 L780 (and §5.8 L1605) | School-join ("ما ينتقل من وضع الأستاذ") | designed | — |
| R-3.2-09 | Import the pupil list from the official Excel file, keyed on the registration number, keeping only the needed columns | §3.2 L783 | Setup-4b | designed | — |
| R-3.2-10 | National system: class lists come in by themselves | §3.2 L783 | School-join ("قوائم التلاميذ تصل وحدها") | designed | — |
| R-3.2-11 | Or type the list | §3.2 L784 | Setup-4c | designed | — |
| R-3.2-12 | No fixed limit on class size | §3.2 L785 | Setup-4, Setup-4c ("لا حدّ لعدد التلاميذ") | designed | — |
| R-3.2-13 | Multigrade classes: a primary class holds up to three levels, each on its own plan | §3.2 L786 | P-Multi, Setup-4d-Joint | designed | — |
| R-3.2-14 | Transfers in and out are recorded with their date and reason | §3.2 L788 | Pupil-move, Pupil (link) | designed | — |
| R-3.2-15 | A pupil who left stays listed, with the reason, until the director's confirmation is recorded | §3.2 L789 | Pupil-move (leaving state, "سُجّل تأكيد المدير") | designed | — |
| R-3.2-16 | Accept the school's timetable package, sent as a file or a QR code | §3.2 L792 | Setup-5-Week (received, "موقّع", "قبول والمتابعة"), TT-change, Setup-5a-Wait, Setup-5b-Package, Setup-5c-Refused | designed | — |
| R-3.2-17 | Or draw the week by hand | §3.2 L792 | Week-draw, Week-slot | designed | — |
| R-3.2-18 | Several schools: one merged week, with warnings about clashes | §3.2 L793 | PS-Today (two schools in one day), PS-Classes, Week-slot (clash warning), Setup-2 ("إضافة مؤسسة أخرى"), Setup-5d-Two-schools, Settings-two-schools, Week-slot-fr | designed | — |
| R-3.2-19 | The timetable handles A/B weeks | §3.2 L795 | Week-draw (switch), Week-slot, L-Today | designed | — |
| R-3.2-20 | Half-groups | §3.2 L796 | Week-slot ("الفوج"), L-Today | designed | — |
| R-3.2-21 | Double shifts, Saturday classes and a fifth morning slot | §3.2 L797 | Week-draw, Week-draw-primary, Today-saturday | designed | — |
| R-3.2-22 | The same class twice in a day | §3.2 L798 | L-Today (1 ج م ع ت 3 at 08سا, then 10سا – 12سا for group 1) | designed | — |
| R-3.2-23 | Bivalent CEM subjects, such as Arabic with Islamic education | §3.2 L799 | Week-slot (subject chips, "فلكل منهما مخططها ودفترها"), Setup-2, Plan-free | designed | — |
| R-3.2-24 | Specialists who teach up to about 20 groups | §3.2 L800 | PS-Classes (14 groups in 2 schools), PS-Today | designed | — |
| R-3.2-25 | Time that belongs to the teacher: pedagogical half-day, hours in another school, duties, reductions | §3.2 L801 | Week-slot ("وقت خاص" types), Week-draw | designed | — |
| R-3.2-26 | Ramadan hours come from the calendar, not the timetable | §3.2 L802 | Setup-5-Week note, Calendar (Ramadan entry) | designed | — |
| R-3.2-27 | One plan pack pinned to each class; the class stays on that release | §3.2 L805 | Setup-6-Plan ("مثبّت لـ"), Plan ("يبقى القسم على 2026.1 حتى يُنقل") | designed | — |
| R-3.2-28 | Without a pack, the log still works with free entry | §3.2 L805 | Plan-free, Entry | designed | — |
| R-3.2-29 | The national calendar comes with the app | §3.2 L807 | Setup-6-Plan ("مدمجة"), Calendar | designed | — |
| R-3.2-30 | Closures for a wilaya or a school can be added by the teacher | §3.2 L808 | Calendar-add | designed | — |
| R-3.2-31 | Closures can be received from the school or a colleague | §3.2 L808 | Calendar (one sentence: "بملف أو رمز QR من المؤسسة أو من زميل"), Calendar-receive | designed | — |
| R-3.2-32 | The next school year reuses the teacher card, template profiles and lesson notes; last year's records stay available | §3.2 L810 | Year-close | designed | — |
| R-3.3-01 | Today lists the day's sessions in order | §3.3 L814 | Main, P-Today, L-Today, PS-Today | designed | — |
| R-3.3-02 | Each session shows the class, the subject and the group | §3.3 L815 | Main, L-Today ("القسم كله", "الفوج 1") | designed | — |
| R-3.3-03 | Each session shows the proposed lesson: its plan item and stage | §3.3 L816 | Main (الميدان، الموضوع and stages), L-Today ("الحصة 3 من 6"), P-Today | designed | — |
| R-3.3-04 | Each session shows what carried over from last time | §3.3 L817 | Main ("يتابع من الحصة السابقة"), Today-done, EN-Today | designed | — |
| R-3.3-05 | Special days are marked on Today: holidays, seminars, councils, exam weeks, cover | §3.3 L819 | Today-holiday, Today-special (seminar and cover), Today-council, Today-exams | designed | — |
| R-3.3-06 | Done as planned: 1 tap, records the proposed item and stage | §3.3 L825 | Main → Today-done | designed | — |
| R-3.3-07 | Last stage reached: 2 taps, records the stages covered; the rest continues next time (تابع) | §3.3 L826 | Sheet (stage chips), Today-done | designed | — |
| R-3.3-08 | Merged: 2 taps, two plan items taught together | §3.3 L827 | Sheet ("دُمج مع الدرس الموالي") | designed | — |
| R-3.3-09 | Skipped: 2 taps, an item left out | §3.3 L828 | Sheet ("تجاوز هذا الدرس") | designed | — |
| R-3.3-10 | Re-taught: 2 taps, an item taught again | §3.3 L829 | Sheet ("إعادة درس سابق") | designed | — |
| R-3.3-11 | Not held: 2 taps, the session did not take place | §3.3 L830 | Sheet ("لم تُنجز الحصة"), Sheet | designed | — |
| R-3.3-12 | Reasons are optional and private, kept on the device, for a skipped item or a session not held | §3.3 L832 | Sheet (note "ذكر السبب اختياري، ويبقى على الهاتف"), Week-sign, Sheet | designed | — |
| R-3.3-13 | The reason list: closure, exam, holiday, event, teacher absent, class absent, few pupils present, other; none names collective action | §3.3 L832 | Sheet-reason | designed | — |
| R-3.3-14 | A whole day or a whole week confirmed at once, marking only the exceptions | §3.3 L833 | Today-backlog, P-Today, L-Today | designed | — |
| R-3.3-15 | Session types: درس، إدماج، أعمال موجهة، معالجة، استقبال، فراغ, plus tests and exams | §3.3 L834 | Entry (type chips) | designed | — |
| R-3.3-16 | Sessions outside the timetable can be logged for one of the teacher's classes: support, catch-up, review, supervised study | §3.3 L835 | Catchup-add, Session-extra | designed | — |
| R-3.3-17 | For those sessions the teacher enters the date and time, as on paper; the tap time is never recorded | §3.3 L835 | Catchup-add (free slots, "موعد آخر"), Session-extra | designed | — |
| R-3.3-18 | Those sessions do not move the plan, and fill the texts book's page for supervised or additional lessons | §3.3 L835 | Catchup-add, Session-extra, Supervised | designed | — |
| R-3.3-19 | Every session can record homework with its due date | §3.3 L837 | Entry, P09 ("الواجب … يُسلَّم يوم") | designed | — |
| R-3.3-20 | Any test given | §3.3 L838 | Entry ("أُجري فرض في هذه الحصة") | designed | — |
| R-3.3-21 | Free text, and content that wasn't in the plan | §3.3 L839 | Entry | designed | — |
| R-3.3-22 | A factual line that can go into the texts-book entry and shared statements | §3.3 L841 | Entry ("سطر إضافي يُكتب في الدفتر") | designed | — |
| R-3.3-23 | A private note that never leaves the device | §3.3 L842 | Entry ("ملاحظة خاصة · لا تغادر هذا الهاتف"), Entry | designed | — |
| R-3.3-24 | A warning against writing pupils' health or discipline details in either note | §3.3 L844 | Entry (warning line) | designed | — |
| R-3.3-25 | No clock times: a session is its date and slot; printed times come from the timetable | §3.3 L845 | Entry header, P09, P10, Print, Log, Correct | designed | — |
| R-3.3-26 | Once a week per course, the app shows the week's record: sessions and outcomes, homework and tests, roll call, marks | §3.3 L848 | Week-sign | designed | — |
| R-3.3-27 | The week is signed in one step, with the fingerprint prompt or a PIN | §3.3 L848 | Week-sign (two buttons) | designed | — |
| R-3.3-28 | Until signed, the week is the working record; once signed, the school's record and the official record | §3.3 L849 | Week-sign (facts list, signed state) | designed | — |
| R-3.3-29 | Sessions awaiting confirmation are shown first; confirm them or sign as it stands; never an absence | §3.3 L850 | Week-sign ("تنتظر التأكيد" card) | designed | — |
| R-3.3-30 | Corrections stay possible after signing and show as corrections | §3.3 L851 | Week-fix, Digest-signed, D-Record-fix | designed | — |
| R-3.3-31 | For each class, the coming exams with a common paper: the school's term and mock exams, the directorate's, the national ones | §3.3 L854 | T-Threshold, T-Threshold-exams | designed | — |
| R-3.3-32 | For each exam, the day its figures are taken | §3.3 L854 | T-Threshold (22/11, 25 April, 18 April) | designed | — |
| R-3.3-33 | For each exam, where the class stands | §3.3 L854 | T-Threshold (the school term exam's chart) | designed | — |
| R-3.3-34 | The school's chart for the subject and level, exactly as the director sees it | §3.3 L855 | T-Threshold chart, D-Threshold ("يرى كل أستاذ هذه الصفحة لمادته ومستواه") | designed | — |
| R-3.3-35 | The directorate's totals, exactly as the director and the directorate see them | §3.3 L855 | T-Threshold-totals | designed | — |
| R-3.3-36 | A school exam's cut is optional: the subject's teachers set one when they wish, otherwise the paper is set as today | §3.3 L856 | D-Threshold ("لم يُقترح حدّ، وهو اختياري"), T-Threshold-propose | designed | — |
| R-3.3-37 | Each setter signs the proposed cut or proposes another | §3.3 L856 | T-Threshold | designed | Fingerprint only (see R-3.2-06) |
| R-3.3-38 | When setters differ, the earliest proposed cut applies | §3.3 L856 | T-Threshold (sent state text, warning line) | designed | — |
| R-3.3-39 | Other cuts appear once the exam is over and the cut is published | §3.3 L857 | T-Threshold (text), N-Published (public page), T-Threshold-after | designed | — |
| R-3.3-40 | Monthly tests stay the teacher's own, with nothing to sign | §3.3 L858 | none | n/a (rule) | Stated nowhere; one line on T-Threshold would help |
| R-3.4-01 | Roll call replaces the paper roll-call book as the teacher's own record | §3.4 L862 | Roll, Month, Docs | designed | — |
| R-3.4-02 | It never notifies parents | §3.4 L862 | — | n/a (rule) | No board offers it, as required |
| R-3.4-03 | It does not replace the school's official absence system | §3.4 L862 | School-mine footnote | n/a (rule) | — |
| R-3.4-04 | National system: roll call is part of the weekly signed official record | §3.4 L862 | Week-sign ("المناداة" row), Week-fix | designed | — |
| R-3.4-05 | Where the school chooses, absences also go to the state's absence system, and parents see them in awlyaa | §3.4 L862 | Week-fix (conditional line), Roll, Log, Week-sign, D-Exchange | designed | — |
| R-3.4-06 | Unit: per half-day in primary, per session in CEM and lycée | §3.4 L865 | P-Roll, P-Today, Roll | designed | — |
| R-3.4-07 | The same class can be taken twice in a day | §3.4 L865 | L-Today (second session, group roll call) | designed | — |
| R-3.4-08 | Specialists keep one register per class and count only their own sessions | §3.4 L866 | PS-Classes, PS-Today, Pupil ("في حصص اللغة العربية وحدها") | designed | — |
| R-3.4-09 | Everyone is present by default; the teacher marks only the exceptions | §3.4 L867 | Roll, P-Roll, Roll-seats | designed | — |
| R-3.4-10 | Absences are marked justified or unjustified; the cause is never typed | §3.4 L868 | Pupil (toggle, "لا يُكتب السبب"), Correct, Week-fix | designed | — |
| R-3.4-11 | Lateness can happen several times a day, carries the date and is not an absence | §3.4 L869 | Roll ("متأخر، ويُعدّ حاضراً"), Pupil (lateness list) | designed | — |
| R-3.4-12 | Roll call on the class list | §3.4 L870 | Roll | designed | — |
| R-3.4-13 | Roll call on a seating plan of the class or group, arranged once by placing pupils; a seat tap marks the same exceptions as the list | §3.4 L870 | Roll-seats, Roll-seats-setup | designed | — |
| R-3.4-14 | The seating plan stays on the teacher's devices, prints on one A4 page and is erased with that year's pupil records | §3.4 L870 | Roll-seats (lock note, print sheet), Year-close | designed | — |
| R-3.4-15 | Taken in class or after the lesson | §3.4 L871 | Roll (note line) | designed | — |
| R-3.4-16 | A printable blank sheet is the paper fallback | §3.4 L872 | Roll-print ("ورقة مناداة فارغة"), Roll (print icon) | designed | — |
| R-3.4-17 | The paper sheet is entered later (substitute, a day without the phone) | §3.4 L872 | Roll-past, Month, Today-backlog | designed | — |
| R-3.4-18 | Past days can be corrected, with an audit trail of every change | §3.4 L873 | Correct, Pupil (log), Log | designed | — |
| R-3.4-19 | The half-day is the unit: a morning or afternoon absence counts 1, a whole day 2 | §3.4 L876 | Roll-rules, P-Roll | designed | — |
| R-3.4-20 | Automatic totals per pupil and month: ح-ك، غ، ح-ف and the rate | §3.4 L877–881 | Pupil, Month | designed | — |
| R-3.4-21 | A yearly summary from September to June | §3.4 L882 | Month ("الملخص السنوي" chip), Pupil ("السنة الدراسية" chip), Roll-print (option, note "مجموع كل شهر لكل تلميذ: ح-ك، غ، ح-ف، والنسبة"), Month-year, Pupil-year | designed | — |
| R-3.4-22 | Counting rules are settings, with defaults: holidays, seminars, half-days, start date, days not held | §3.4 L883 | Roll-rules | designed | — |
| R-3.4-23 | Monthly two-page A4 portrait spread, one column per day, weekends and national days shaded | §3.4 L886–887 | Roll-print | designed | — |
| R-3.4-24 | The paper book's symbols: dash for morning, bar for afternoon, plus for all day | §3.4 L888 | Month legend, Roll-print | designed | — |
| R-3.4-25 | The matching Hijri month | §3.4 L889 | Month header, Roll-print note | designed | — |
| R-3.4-26 | Signature boxes for the teacher, and for the director and the inspector with dates | §3.4 L890 | Roll-print | designed | — |
| R-3.4-27 | Lateness prints in its own column with its dates | §3.4 L891 | Month ("تأخر" column), Roll-print | designed | — |
| R-3.4-28 | Each pupil's absence dates print, not only the counts | §3.4 L892 | Roll-print, Pupil | designed | — |
| R-3.4-29 | The yearly summary page prints | §3.4 L893 | Roll-print option, Year-close | designed | Content: see R-3.4-21 |
| R-3.4-30 | The front pages print what the app holds; the two confidential pupil-record pages print blank | §3.4 L894 | Roll-print ("الصفحات الأولى") | designed | — |
| R-3.4-31 | CEM and lycée: an absence sheet for each session, for the supervisors' route | §3.4 L895 | Roll-print ("ورقة غياب الحصة") | designed | — |

## B. Marks, documents, digest, sharing and the pilot (§3.5–3.11, §9.3, §10.3)

| ID | Requirement | PRD | Screens | Coverage | What is missing or wrong |
|---|---|---|---|---|---|
| R-3.5-01 | Continuous-assessment components are set per class and subject | §3.5 l.899 | Marks-setup (header «4م2 · اللغة العربية») | designed | — |
| R-3.5-02 | An official preset for each level, built from the year's circulars as data | §3.5 l.900 | Marks-setup (card «الإعداد الرسمي · 4 متوسط», badge «مدمج») | designed | The circular's reference and version are not shown on the preset card. |
| R-3.5-03 | The teacher chooses the components and their weights within the circular's limits | §3.5 l.901 | Marks-setup (steppers, total badge), Marks-setup-sum | designed | — |
| R-3.5-04 | The teacher can add columns | §3.5 l.901 | Marks-setup (button «إضافة عمود») | designed | Entry point only; the add-column sheet (name, weight) is not drawn. |
| R-3.5-05 | Primary continuous assessment kept month by month and rolled up per term | §3.5 l.902 | P-Marks (October, November, December columns; T is their mean) | designed | — |
| R-3.5-06 | Descriptive observations instead of marks in terms such as 1AP term 1 | §3.5 l.903 | P-Obs | designed | — |
| R-3.5-07 | Captured during the session: participation, homework, notebook and behaviour | §3.5 l.904 | Capture; Marks (button «تقويم أثناء الحصة») | designed | — |
| R-3.5-08 | Roll call feeds the attendance-and-discipline component if the teacher turns it on | §3.5 l.904 | Marks-setup (checkbox «المواظبة والانضباط من دفتر المناداة»); Marks-pupil (row) | designed | — |
| R-3.5-09 | Test and exam entry rejects marks above the maximum | §3.5 l.905–906 | Marks-test, Marks-exam (error «النقطة أكبر من 20، ولا تُحفظ») | designed | — |
| R-3.5-10 | Entry check: empty cells | §3.5 l.907 | Marks-test, Marks-exam (finish summary «خانات فارغة: N») | designed | — |
| R-3.5-11 | Entry check: pupils who are not on the class list | §3.5 l.908 | Marks-test, Marks-exam («كل التلاميذ من قائمة القسم») | designed | Only the passed check is drawn; no failure state (for example a pupil who left during the term). |
| R-3.5-12 | Averages follow each level's official formula, kept as versioned data | §3.5 l.909 | Marks (formula card, «الإصدار 2026.1»); Export; Term-send | designed | — |
| R-3.5-13 | Primary, out of 10: (T + E)/2 for languages and maths, E alone for the other examined subjects | §3.5 l.910 | P-Marks (subject chips and rule line) | designed | — |
| R-3.5-14 | CEM: ((T + F)/2 + 2E)/3 | §3.5 l.911 | Marks, Marks-book | designed | — |
| R-3.5-15 | Lycée: (T + F + 2E)/4, or (T + F + P + 2E)/5, or an oral in place of P | §3.5 l.912 | L-Marks (three formula radios) | designed | — |
| R-3.5-16 | Full precision stored, 2 decimals shown | §3.5 l.913 | Marks («تُحفظ النقاط كاملة وتُعرض بمنزلتين عشريتين»); Marks-book | designed | — |
| R-3.5-17 | Thresholds compared on the unrounded value | §3.5 l.913 | Marks-book (sort note «المقارنة على القيمة الكاملة»); Council, Marks-book-value | designed | — |
| R-3.5-18 | Printout: the grade book | §3.5 l.915 | Marks-book (print icon); P-Marks (button «طباعة كشف النقاط»), Gradebook-print | designed | — |
| R-3.5-19 | Printout: a per-pupil justification of the continuous-assessment mark, doubling as the circular-270 book and the answer to a parent's appeal | §3.5 l.916 | Marks-pupil (table, print, PDF, «طباعة القسم كله», note on both uses) | designed | — |
| R-3.6-01 | A phrase is suggested from the versioned official list, by mark band | §3.6 l.920 | Apprec («مقترح حسب المعدل», «عبارات أخرى من القائمة الرسمية») | designed | — |
| R-3.6-02 | If the teacher wants, the suggestion also uses behaviour and attendance | §3.6 l.920 | —, Apprec-conduct | designed | — |
| R-3.6-03 | The teacher confirms or changes the phrase for each pupil | §3.6 l.920 | Apprec (confirm, other phrases, typed phrase, previous and next) | designed | — |
| R-3.6-04 | No "fill all" (circular 244) | §3.6 l.921 | Apprec («لا تعبئة جماعية: تُختار العبارة لكل تلميذ على حدة») | designed | — |
| R-3.6-05 | Banned phrases are blocked | §3.6 l.923 | Apprec (typed-phrase state «عبارة محظورة، لا تُقبل») | designed | — |
| R-3.6-06 | A phrase that only restates the mark is flagged | §3.6 l.924 | Apprec («العبارة تكرّر النقطة وحدها، ولا تضيف تقديراً») | designed | — |
| R-3.6-07 | The export refuses to run while any box is empty | §3.6 l.925 | Marks (Export row «بعد اكتمال التقديرات: 12 خانة باقية»); Apprec (complete state); Export («التقديرات: 36 من 36») | designed | The refusal shows only as the hub caption; Export itself has no blocked state. |
| R-3.7-01 | The school chooses the route: the ostad grid or the Excel workbook extracted from amatti | §3.7 l.929 | Export (route radios) | designed | — |
| R-3.7-02 | National system: marks go to the state's system through the interoperability system, and the file routes stay as the fallback | §3.7 l.929 | Term-send (three steps, row «الملفات، إن تعطّل الإرسال») | designed | — |
| R-3.7-03 | Workbook: fill only the unlocked cells and keep its protection, structure and file type | §3.7 l.932 | Export (Excel card) | designed | — |
| R-3.7-04 | Workbook variants handled as data | §3.7 l.933 | Export (badge «مقروء») | n/a (rule) | Advisory: no state for a workbook layout the app does not recognise. |
| R-3.7-05 | Every result tested in Microsoft Excel and WPS for Android | §3.7 l.934 | Export («يُفتح في Excel وفي WPS للأندرويد») | n/a (rule) | — |
| R-3.7-06 | A view ready to copy into the ostad grid | §3.7 l.935 | Export (ostad route: grid order, large figures) | designed | — |
| R-3.7-07 | Printed mark sheets | §3.7 l.936 | Export (chip «كشوف مطبوعة»), Marks-sheet | designed | — |
| R-3.7-08 | PDF, DOCX and CSV files | §3.7 l.936 | Export (chips) | designed | Nothing says the DOCX leaves the teacher's box blank when the drawn signature is on (l.976). |
| R-3.7-09 | A check before signing compares the register with the exported file, in the form of the official control printout | §3.7 l.937 | Export (row «مقارنة قبل التوقيع», links to itself); Term-send (same row, links to Print), Marks-check, Marks-check-diff | designed | — |
| R-3.7-10 | The after-term correction window, with the teacher's report for each correction | §3.7 l.938 | Export-fix (reason, printable report with signature and visa boxes, Excel and ostad update) | designed | — |
| R-3.7-11 | Council pack: average, highest and lowest mark, standard deviation | §3.7 l.940 | Council (stat tiles) | designed | — |
| R-3.7-12 | Council pack: success rate, 10/20, or 5/10 in primary | §3.7 l.941 | Council («55.6% فوق 10»); P-Marks («5 فما فوق») | designed | Council and Marks write «فوق 10» (above 10); the rate is 10 and above, as Export-fix and L-Marks write it. No primary council pack is drawn. |
| R-3.7-13 | Council pack: distribution by band, and counts by sex | §3.7 l.942 | Council (bands, «حسب الجنس») | designed | — |
| R-3.7-14 | Council pack: pupils' ranks | §3.7 l.943 | Council (top three); Marks-book (sort by average, rank numbers) | designed | — |
| R-3.7-15 | Council pack: comparison with last term | §3.7 l.943 | Council («لا مقارنة: هذا الفصل الأول»), Council-t2 | designed | — |
| R-3.7-16 | Council pack: pupils who may need remediation and pupils in line for a distinction, with thresholds the teacher sets | §3.7 l.944 | Council (badges «أقل من 8 · تغيير», «15 فأكثر · تغيير», note on unofficial thresholds) | designed | The threshold-change sheet is not drawn (minor). |
| R-3.7-17 | Council pack: the attendance summary | §3.7 l.945 | Council («الحضور في الفصل», absences and lateness) | designed | — |
| R-3.7-18 | Never ask for ostad or amatti passwords | §3.7 l.947 | Export (lock note) | designed | — |
| R-3.7-19 | Never automate the state's platforms outside the interoperability system | §3.7 l.948 | Export («ولا يدخل إلى المنصات بدلاً من الأستاذ»); Term-send | designed | — |
| R-3.7-20 | Never produce a report card | §3.7 l.949 | Export («ولا يصدر كشوف النتائج للأولياء»); Term-send | designed | — |
| R-3.8-01 | Every document can be printed | §3.8 l.953 | Print, Print-set, Journal, Note, Dist, Timetable-doc, Journal-front, Book-fixes, Marks-book, Marks-pupil, Council, Roll-print, P-Journal | designed | The print icons on Journal, Note, Marks-book, P09 and P67 open no sheet. |
| R-3.8-02 | Every document can be saved as PDF | §3.8 l.953 | Print, Print-set, Dist, Timetable-doc, Journal-front, Book-fixes, Marks-pupil, Council, Roll-print, P-Journal | designed | Not offered on Journal, Note, Marks-book or P67 (print icon only). |
| R-3.8-03 | Every document can be saved as DOCX | §3.8 l.953 | Dist («حفظ DOCX»); Export (chip), Gradebook-print, Doc-output | designed | — |
| R-3.8-04 | Every document can print blank, with its headers filled in | §3.8 l.953 | Print-set (switch «نسخة فارغة بعناوينها»); Roll-print («ورقة مناداة فارغة»); Docs (caption), Doc-output, Doc-output-pupils | designed | — |
| R-3.8-05 | Template profiles set the fields, their order and their labels | §3.8 l.955 | Profiles (field switches, drag handles) | designed | — |
| R-3.8-06 | Profiles for an inspector or a district, received or shared | §3.8 l.955 | Profiles (chip «مفتشية اللغة العربية», «مشاركة النموذج», receiving note) | designed | — |
| R-3.8-07 | Signature and visa boxes are always kept | §3.8 l.955 | Profiles (badge «ثابتة», «خانات التوقيع والتأشيرة تبقى في كل نموذج») | designed | — |
| R-3.8-08 | Primary journal front pages: cover, teacher card, holidays and national days, seminars and training, the pupil list, the weekly timetable with an "approved on" box | §3.8 l.959 | Journal-front (CEM version: card, seminars, holidays), P-Journal-front | designed | — |
| R-3.8-09 | Primary daily page: A4 landscape, morning and afternoon bands; columns duration, subject, activity, content, competence indicator, domain and lesson-note number | §3.8 l.959 | P-Journal | designed | — |
| R-3.8-10 | A visa box for the director on the primary journal (Decision 831 Art. 9) | §3.8 l.959 | P-Journal («تأشيرة المدير» and note) | designed | — |
| R-3.8-11 | French, English and Tamazight specialists get their own journal, in their language | §3.8 l.959 | PS-Today («Écrit dans le cahier journal»); P-Today (note); EN-Today, PS-Journal | designed | — |
| R-3.8-12 | CEM and lycée journal front pages: teacher card; seminars, training and meetings; holidays and national days | §3.8 l.960 | Journal-front | designed | — |
| R-3.8-13 | CEM and lycée daily page: A4 portrait, date, from–to, class, how the session went, remarks, plus domain, sequence and resource | §3.8 l.960 | Journal; Profiles (field list) | designed | — |
| R-3.8-14 | Texts-book entry for each session: date and duration, lesson title and stages, any test, homework and its due date | §3.8 l.961 | P09, P10, P90; Entry (test checkbox, homework and due date) | designed | No sample entry with a test (فرض) on a book page. |
| R-3.8-15 | The teacher copies each entry in, or pastes a printed strip if the school accepts it | §3.8 l.961 | Print (page print); Print-set («ما جدّ منذ آخر طباعة»), Print-strip | designed | — |
| R-3.8-16 | The app shows each entry's corrections, for the director's monthly check | §3.8 l.961 | Book-fixes (both versions, PDF, «طباعة للمدير»); Docs | designed | — |
| R-3.8-17 | The teacher signs each entry by hand, or with the drawn signature | §3.8 l.961 | Print (radios «بتوقيعي المرسوم» and «فارغة، للتوقيع باليد») | designed | — |
| R-3.8-18 | National system: the signed week replaces the paper book | §3.8 l.961 | Week-sign; School-join | designed | — |
| R-3.8-19 | Homework record in each subject's section: date set, date it comes back, activity | §3.8 l.962 | P67 | designed | — |
| R-3.8-20 | Two counts: pupils who did not do it, pupils who relied on someone else | §3.8 l.962 | P67 | designed | — |
| R-3.8-21 | Each count as a percentage of the pupils on the class list, rounded to a whole number | §3.8 l.962 | P67 («من 36 تلميذاً», 6%, 11%) | designed | — |
| R-3.8-22 | Class counts only, never names | §3.8 l.962 | P67 | designed | — |
| R-3.8-23 | The teacher enters the two counts when the homework comes back | §3.8 l.962 | P67 (steppers on the homework due today, «الجميع أنجزه بنفسه»); Main (button «إحصاء») | designed | — |
| R-3.8-24 | When homework was marked per pupil, the app proposes the counts it can work out | §3.8 l.962 | Capture (hint «ومنها يُملأ سجل الواجبات في الصفحة 67»); P67 | designed | — |
| R-3.8-25 | The counts are pupil records (§5.4) | §3.8 l.962 | — | n/a (rule) | — |
| R-3.8-26 | The texts book's page for supervised or additional lessons (Decision 835): number in order, subject, type, date and time of each session logged outside the timetable | §3.8 l.963 | —, Session-extra, Supervised | designed | — |
| R-3.8-27 | Nothing generated from the timetable or the school's report; never show a teacher's unused hours | §3.8 l.963; §3.12 l.1070 | — | n/a (rule) | Catchup-add's list of free slots is a scheduling aid, not a count of unused hours |
| R-3.8-28 | Make-up sessions go on the subject's pages (§7.7) | §3.8 l.963 | Catchup (step 4 «حصصاً تعويضية»); Catchup-add («حصة إضافية ... في دفتر النصوص»), Catchup, Catchup-add, P10-4m1, Supervised | designed | — |
| R-3.8-29 | With no such sessions, the page prints blank | §3.8 l.963 | —, Supervised, Supervised-empty | designed | — |
| R-3.8-30 | Annual and monthly distributions from the plan pack, fitted to the class timetable | §3.8 l.964 | Dist (tabs, «مكيّفة مع استعمال زمن القسم») | designed | Advisory: no signature or visa boxes on the distribution pages. |
| R-3.8-31 | The termly distribution the texts book needs (Decision 155 Art. 6) | §3.8 l.964 | Dist (tab «الفصلي») | designed | — |
| R-3.8-32 | Lesson note: a numbered template filled in from the plan item (objectives, stages, resources, competence indicator) | §3.8 l.965 | Note | designed | — |
| R-3.8-33 | The teacher completes the lesson note | §3.8 l.965 | Note (tap a paragraph to accept or revert it), Note-add, Note-edit | designed | — |
| R-3.8-34 | Last year's notes can be reused | §3.8 l.965 | Note («مذكرتك لهذا المورد من السنة الماضية متوفرة · استعمالها») | designed | — |
| R-3.8-35 | Roll-call book and absence sheet (see §3.4) | §3.8 l.966 | Month, Roll-print | designed | Details belong to the §3.4 audit. |
| R-3.8-36 | Grade book and continuous-assessment justification as documents (see §3.5) | §3.8 l.967 | Marks-book, Marks-pupil, Docs, Gradebook-print | designed | — |
| R-3.8-37 | Weekly timetable with signature boxes for the teacher, the director and the inspector | §3.8 l.968 | Timetable-doc | designed | — |
| R-3.8-38 | One journal per class, or one combined journal | §3.8 l.970 | Journal (chips «دفتر واحد للأقسام», «دفتر لكل قسم») | designed | Not shown for a primary multigrade class (P-Multi). |
| R-3.8-39 | The signature is drawn once on the screen and placed in the signature column of each confirmed texts-book entry | §3.8 l.973 | Signature (pad, «مسح وإعادة الرسم»); Print (preview) | designed | — |
| R-3.8-40 | It is also placed in the teacher's signature boxes on the other documents | §3.8 l.973 | Signature (subtitle), Journal-signed | designed | — |
| R-3.8-41 | Off by default; the teacher turns it on | §3.8 l.974 | Setup-3-Card (badge «غير مفعّل»); Signature (checkbox); Settings | designed | — |
| R-3.8-42 | Any printout can still leave the teacher's boxes blank, to sign by hand | §3.8 l.974 | Print (radio «فارغة، للتوقيع باليد»), Doc-output, Doc-output-pupils, Print-set-primary | designed | — |
| R-3.8-43 | An entry awaiting confirmation never carries it | §3.8 l.975 | Print («على الحصص المؤكّدة فقط», «حصة اليوم تُضاف إلى الصفحة بعد تأكيدها»); Signature | designed | — |
| R-3.8-44 | The director's and the inspector's boxes always stay blank | §3.8 l.975 | Signature («لا في خانات المدير والمفتش») | designed | — |
| R-3.8-45 | Printouts and PDFs only, never in a DOCX | §3.8 l.976 | Signature («ولا في ملفات DOCX»); Print (PDF only) | designed | — |
| R-3.8-46 | Before a PDF carrying it is shared, the app says anyone who receives it can copy the signature | §3.8 l.976 | Print (warning «من يستلم ملف PDF يمكنه نسخ التوقيع») | designed | — |
| R-3.8-47 | Kept like the teacher card: optional, never leaves the device, not synced or backed up, drawn again on another device | §3.8 l.977 | Signature; Setup-3-Card; Restore; Rejoin; Leave; Year-close | designed | Advisory: the PC web app (Web-week) case is not addressed. |
| R-3.8-48 | Only the image is kept, never the speed, pressure or timing of the strokes | §3.8 l.977 | Signature | designed | — |
| R-3.8-49 | Not a legal signature; it counts only where the school accepts it | §3.8 l.978 | Signature («ليس توقيعاً قانونياً، ويُعتمد حيث تقبله المؤسسة») | designed | — |
| R-3.8-50 | Print rule: safe in black and white | §3.8 l.981 | — | n/a (rule) | — |
| R-3.8-51 | Print rule: binding margins | §3.8 l.981 | Print-set (switch «هوامش التجليد») | designed | — |
| R-3.8-52 | Print rule: one PDF that a print shop can use | §3.8 l.981 | Print-set («ملف PDF واحد لمحل الطباعة») | designed | — |
| R-3.8-53 | Print setting: subject order | §3.8 l.982 | —, Print-set-primary | designed | — |
| R-3.8-54 | Print setting: one- or two-sided printing | §3.8 l.982 | Print-set (segment «وجه واحد», «وجهان») | designed | — |
| R-3.8-55 | Print setting: which pages to print | §3.8 l.982 | Print-set (document checkboxes, «ما جدّ منذ آخر طباعة») | designed | — |
| R-3.8-56 | Layouts waste no paper; teachers pay about 5 DA a page | §3.8 l.982 | Print-set (pages, sheets, «نحو 60 دج») | designed | — |
| R-3.8-57 | Fonts are embedded (Amiri, Noto Naskh Arabic) | §3.8 l.983 | Print-set («الخطوط مضمّنة في PDF») | designed | — |
| R-3.8-58 | DOCX files name the Microsoft fonts that official documents use | §3.8 l.983 | — | n/a (rule) | — |
| R-3.8-59 | Dates: Gregorian dd/mm/yyyy with Western digits | §3.8 l.984 | Print-set («التواريخ بصيغة 04/10/2026»); Journal; P90; Export-fix; Language | designed | — |
| R-3.8-60 | Dates: the Algerian month names («جانفي … أوت») | §3.8 l.984 | Dist, Year-close, Leave, Print-set | designed | — |
| R-3.8-61 | The school year written as "2026-2027" | §3.8 l.984 | Journal-front, Timetable-doc, Export-fix, Print-set | designed | — |
| R-3.8-62 | The Hijri date is optional | §3.8 l.984 | Print-set (switch «التاريخ الهجري»); Month | designed | — |
| R-3.8-63 | Mixed directions: Arabic headers over a French or English body render correctly | §3.8 l.985 | P90 (Arabic class code inside a French header), P90-print | designed | — |
| R-3.8-64 | Tamazight: Latin script at least | §3.8 l.986 | — | designed | — |
| R-3.9-01 | A weekly digest, on by default, for the teacher only, for each class | §3.9 l.990; §2.3 l.627 | Digest («يصل إليك وحدك», a card per class, «يصل الملخص صباح الأحد»); Notif (switch on); Classes | designed | — |
| R-3.9-02 | The class's position in the plan, and weeks ahead or behind | §3.9 l.991 | Digest («الموقع», buffer used); Digest-signed («أقل من أسبوع وراء المخطط»), Digest-signed | designed | "Ahead of the plan" is never drawn |
| R-3.9-03 | Sessions lost to the calendar, shown separately | §3.9 l.992 | Digest («لا حصص ضائعة بسبب الرزنامة»); Today-holiday (note), Digest-closure | designed | — |
| R-3.9-04 | Spare sessions before the next exam window | §3.9 l.993 | Digest («تبقى حصتان احتياطيتان قبل الاختبارات») | designed | — |
| R-3.9-05 | Catch-up options (Section 4) | §3.9 l.994 | Digest (button «خيارات التدارك»); Catchup | designed | — |
| R-3.9-06 | Make-up sessions owed | §3.9 l.995 | Digest («ولا حصص تعويضية مستحقة»), Digest-closure | designed | — |
| R-3.9-07 | Sessions still awaiting confirmation | §3.9 l.996 | Digest («15 حصة مؤكّدة من 15»), Digest, Today-backlog | designed | — |
| R-3.9-08 | National system: weeks not yet signed | §3.9 l.997 | Digest-signed | designed | — |
| R-3.9-09 | A daily preview, only if the teacher turns it on | §3.9 l.1000 | Notif (switch, off) | designed | — |
| R-3.9-10 | Quiet hours: 20:00 to 07:00, and Thursday 20:00 to Sunday 07:00 | §3.9 l.1001 | Notif | designed | — |
| R-3.9-11 | Teachers who work on Saturdays can adjust the quiet hours | §3.9 l.1001 | Notif (switch «العمل يوم السبت») | designed | — |
| R-3.10-01 | Progress statement, one per class | §3.10 l.1006 | Share (class chips) | designed | — |
| R-3.10-02 | The statement as a print, a PDF or a QR code | §3.10 l.1006 | Share (buttons), Share | designed | — |
| R-3.10-03 | Field: the last domain or sequence completed | §3.10 l.1008 | Share | designed | — |
| R-3.10-04 | Field: the last learning resource | §3.10 l.1009 | Share | designed | — |
| R-3.10-05 | Field: weeks of delay | §3.10 l.1010 | Share | designed | — |
| R-3.10-06 | Field: sessions not held, only as calendar causes or "other"; the reasons stay on the teacher's devices | §3.10 l.1011 | Share | designed | — |
| R-3.10-07 | Field: the plan pack and its release | §3.10 l.1012 | Share | designed | — |
| R-3.10-08 | The statement carries no pupil data | §3.10 l.1013 | Share (subtitle); R-Open | designed | — |
| R-3.10-09 | The teacher decides when to share it | §3.10 l.1014 | Share (manual buttons) | designed | — |
| R-3.10-10 | A sharing history shows what went to whom | §3.10 l.1014 | Share («سجل المشاركة»); Log, Share-to | designed | — |
| R-3.10-11 | A handover package for a substitute or an incoming teacher | §3.10 l.1015 | Handover | designed | — |
| R-3.10-12 | Organised by topic: plan position, journal history, next item | §3.10 l.1015–1018 | Handover; Handover-in | designed | — |
| R-3.10-13 | The pupil list and marks travel only by direct transfer, and only if the teacher chooses | §3.10 l.1020 | Handover (switches, off; file label «دون التلاميذ والنقاط»); Handover-in | designed | — |
| R-3.10-14 | The incoming teacher's app re-paces from the last entry | §3.10 l.1020 | Handover-in («الوتيرة على هذا الهاتف، من آخر إدخال») | designed | — |
| R-3.10-15 | National system: the incoming teacher receives the class's record through the school's space | §3.10 l.1020 | Handover-school | designed | — |
| R-3.10-16 | Phone and PC: the optional end-to-end encrypted sync, free for teachers | §3.10 l.1022 | Devices; Sync-signin; Web-week («متزامن مع الهاتف»), Devices, Sync-signin | designed | — |
| R-3.10-17 | Phone and PC: a direct transfer between devices | §3.10 l.1023 | Devices (row «نقل مباشر دون خادم», links to itself); Restore (receiving by QR); Handover-in, Transfer | designed | — |
| R-3.10-18 | Staffroom PCs (national system): sign in with the phone or a school security key, and nothing stays behind | §3.10 l.1026 | Web-staff; Web-unlock (shared-PC card) | designed | — |
| R-3.10-19 | A full export of everything, free, at any time | §3.10 l.1027 | Export-all; Settings; Leave | designed | — |
| R-3.11-01 | Pilot app: setup, Today and confirmation, roll call by list or seating plan, marks, the term-2 export, documents, digest, progress statement | §3.11 l.1034 | Setup boards, Main, Roll, Roll-seats, Marks boards, Export, Docs, Digest, Share | n/a (rule) | Release scope; every item has boards. |
| R-3.11-02 | Pilot: sync only if its gates are met, so the app must run without it | §3.11 l.1034; §6.2 l.1788 | Devices, Devices-pilot | designed | — |
| R-3.11-03 | Launch adds the timetable package, handover, and sync, free | §3.11 l.1034 | Setup-5-Week, TT-change, Handover, Devices | n/a (rule) | — |
| R-3.11-04 | Languages: Arabic at least in the pilot, French and English as they are ready; all three at launch | §3.11 l.1035 | Language; Setup-1-Welcome | n/a (rule) | — |
| R-3.11-05 | Pilot measures: seconds per session (median, 90th percentile), minutes per week against paper, share confirmed in one tap, term exports completed | §3.11 l.1036 | —, Pilot-timings | designed | — |
| R-3.11-06 | The national system adds QR joining, the weekly signature, the school's space, marks sent to the state | §3.11 l.1038 | School-join, Week-sign, Term-send | n/a (rule) | Designed on the national-system pages (other audits). |
| R-9.3-01 | Sync free for every teacher: no price, subscription or payment | §9.3 l.2489 | Sync-signin («مجانية، دون اشتراك ولا دفع»); Devices | designed | — |
| R-9.3-02 | Backup free | §9.3 l.2487; §9.1 l.2472 | Devices (backup card, «نسخة الآن») | designed | — |
| R-9.3-03 | Sync opens only once its gates are met (§6.2) | §9.3 l.2489 | —, Devices-pilot | designed | — |
| R-9.3-04 | The project runs the sync server in Algeria until the Ministry's system opens | §9.3 l.2490 | Devices («الخادم في الجزائر»); Sync-signin | designed | — |
| R-9.3-05 | Teachers then move to the Ministry's system, and the project's server closes | §9.3 l.2490 | Sync-signin (note); School-join («ما ينتقل من وضع الأستاذ»), Devices-moved | designed | — |
| R-9.3-06 | The same app everywhere: no prices, payment links or donation links | §9.3 l.2491 | Settings, Help, Devices, Sync-signin | designed | Checked: none on these boards. |
| R-9.3-07 | Donations only on the website; the app never asks | §9.3 l.2491; §9.5 l.2503 | Settings, Help | designed | — |
| R-10.3-01 | The app sends no usage data | §10.3 l.2688 | Help («ولا شيء غير ذلك: لا إعلانات ولا أدوات تحليل»); Privacy («لا تتبّع») | designed | — |
| R-10.3-02 | A pilot build times sessions on the device | §10.3 l.2689 | —, Pilot-timings | designed | — |
| R-10.3-03 | The teacher sees the timing figures | §10.3 l.2689 | —, Pilot-timings | designed | — |
| R-10.3-04 | The teacher decides whether to share them | §10.3 l.2689; §10.6 l.2738 | —, Pilot-timings | designed | — |
| R-10.3-05 | After launch, figures come only from what the project sees anyway, plus opt-in surveys and insights | §10.3 l.2690 | Insights-optin | n/a (rule) | — |

## C. Plan packs, the calendar and the engine (§4 (teacher-facing parts))

| ID | Requirement | PRD | Screens | Coverage | What is missing or wrong |
|---|---|---|---|---|---|
| R-4.2-01 | Pin one plan pack (a release) to each class; the class stays on that release until the teacher moves it | §4.2 (1179); §3.2 (805) | Setup-6-Plan (pack card, «مثبّت لـ» chips, «ويبقى القسم على الإصدار المثبّت حتى يُختار غيره»); Plan (title «الحزمة 2026.1»); Settings («مخطط كل قسم · حزمة 2026.1»), Setup-6b-Packs | designed | — |
| R-4.2-02 | Show each item's kind (closed list), essential or optional flag, stage template, textbook page and source page | §4.2 (1139–1149, 1158–1161) | Plan-item (badges «مورد» «أساسي», stages, «المخطط السنوي، الصفحة 4 · الكتاب المدرسي، الصفحة 24»); Plan (row tags «تشخيصي» «احتياط» «ثابت»); Catchup (an optional item) | designed | — |
| R-4.2-03 | Each pack's time anchor shapes the proposal: weeks (with the weekly model), budgets, or hybrid (budgets with week checkpoints) | §4.2 (1150–1153) | P-Today («مقترح من المخطط · الأسبوع 3», «فهم المنطوق، الحصة 1 من 2»); P-Multi; L-Today («الحصة 3 من 6»); Main and Plan (budget), Plan-lycee | designed | — |
| R-4.2-04 | Pack buffers show as buffers: the diagnostic week, the primary half-week after each sequence, lycée remediation weeks | §4.2 (1154–1157) | Plan (row «الاستقبال والتقويم التشخيصي» tagged «تشخيصي», rows «معالجة» tagged «احتياط»); Catchup (rung 2), Plan-lycee, Plan-primary | designed | — |
| R-4.2-05 | A merge the pack proposes is only a proposal to the teacher | §4.2 (1158) | Catchup (rung 3: «من مقترحات الحزمة، ويُؤكَّد كل واحد وحده», confirm and undo per proposal) | designed | — |
| R-4.2-06 | An item without a stage template is tracked as "in progress / done", plus the sessions spent | §4.2 (1159); §4.7 (1312) | Sheet-nostage, Plan-free | designed | — |
| R-4.2-07 | Tests and exams are not pack items: the calendar places them and they reduce the sessions available | §4.2 (1163) | Plan (rows «الفرض · ثابت», «اختبارات الفصل الأول · ثابت · تقديري»); Setup-7-Ready («بعد الفرض»); Calendar | designed | — |
| R-4.2-08 | Every pack shows its status: Official, In force, Latest found, Stale or Community | §4.2 (1165–1173) | Setup-6-Plan (badge «أحدث طبعة متوفرة»), Settings-two-schools | designed | — |
| R-4.2-09 | Where the pack comes from is always shown: "Based on the September 2022 national edition, keyed by Minhajna's curators. Check with your inspector." | §4.2 (1161, 1194) | Setup-6-Plan, Plan (warn line «مبني على الطبعة الوطنية لسبتمبر 2022، أدخله محرّرو «منهاجنا». يُستحسن التحقق مع المفتش.») | designed | — |
| R-4.2-10 | Pack details: the issuer as printed, edition, source pages, where the file was found, and the licence mode (link only, structure only, full text) | §4.2 (1161–1162) | Plan-item (item source pages only); E-Release (curators' check only: «للحزمة جهة إصدار وطبعة وحالة ونمط ترخيص»), Plan-details, Plan-details-link | designed | — |
| R-4.2-11 | Pack and item IDs are visible where they matter (item page, error report) | §4.2 (1176, 1178) | Plan-item («dz.cem.4am.arabic.igen-2022 · 1.3.2»); Plan-error; Insights-optin | designed | — |
| R-4.2-12 | A new release (the yearly one, or a quick fix such as 2026.2) shows what changed, and the teacher chooses for each class when to move | §4.2 (1177, 1179) | Plan (row «الإصدار 2026.2 متوفر · 3 تصحيحات · يبقى القسم على 2026.1 حتى يُنقل»); Pack-release (changes, class chips, effect per class, «البقاء على 2026.1» or «نقل 4م2 إلى 2026.2»); Year-close («المخطط: إصدار سبتمبر 2027») | designed | — |
| R-4.2-13 | A move keeps each class's progress through renames and splits, and recorded sessions never change | §4.2 (1178–1179) | Pack-release («العنصر نفسه باسم جديد، فلا يضيع موقع أي قسم»; «والحصص المسجّلة تبقى كما هي، على الإصدار الذي سُجّلت به») | designed | — |
| R-4.2-14 | The teacher's own changes are a layer of operations over the national pack (reorder, merge, split, re-budget, skip, add), and a national fix still reaches the class | §4.2 (1186–1187) | Plan-item (move after, merge, «تقسيمه على حصتين», skip, add; note «تغييرات القسم طبقة فوق الحزمة الوطنية: يصلها كل تصحيح للحزمة»), Plan-item, Plan-changes | designed | — |
| R-4.2-15 | A district variant layer: an inspector's distribution, credited and used with their consent | §4.2 (1184) | Plan-layers | designed | — |
| R-4.2-16 | A school variant layer, for parallel classes | §4.2 (1185) | E-Release (curators' note only: «في طبقة أستاذ أو مؤسسة»), Plan-layers | designed | — |
| R-4.2-17 | On a move, the migration entries carry every layer's operations on the device: a renamed item keeps them; a split or merged item carries them when clear; skipping a split item skips every part; an item added after it comes after the last part | §4.2 (1188–1190) | E-Release (curators' note: «عملية «ترك 1.4.5» في طبقة أستاذ أو مؤسسة تصبح «ترك 1.4.6 و1.4.7»»); Pack-release (results per class) | n/a (rule) | — |
| R-4.2-18 | When the meaning is not clear, the app asks the teacher before the move, never guesses, and keeps the answer in the teacher's own layer | §4.2 (1191); §4.12 (1405) | Pack-release (card «سؤال قبل نقل 4م3», three options, move button «الجواب أولاً» until answered, «يُحفظ الجواب في طبقة تغييراتك، ويمكن تغييره لاحقاً من صفحة العنصر») | designed | — |
| R-4.2-19 | A variant is never labelled official | §4.2 (1192) | none (no variant is drawn) | n/a (rule) | Nothing contradicts it. The district and school layer screens, once drawn, must carry a "not official" label |
| R-4.2-20 | Without a pack, the teacher types their own list of items, and it works like a pack | §4.2 (1196); §3.2 (805) | Plan-free (title, kind, session count, list, «فيعمل السجل كما مع الحزمة: يُقترح في كل حصة العنصر التالي»); Plan (row «مادة دون حزمة: كتابة العناصر») | designed | — |
| R-4.2-21 | The teacher can offer that list to the data repository, where it is reviewed as a community pack | §4.2 (1196); §1.7 (196, 216) | Plan-free (row «اقتراح القائمة للمراجعة · تُراجع قبل نشرها حزمةً مجتمعية، ولا يُذكر اسم الأستاذ إلا باختياره», which links to itself), Plan-free-published, Plan-offer | designed | — |
| R-4.3-01 | "Report a plan error" from an item sends the item's ID and release with the teacher's note | §4.3 (1227) | Plan-item (row «الإبلاغ عن خطأ في هذا العنصر»); Help (row «الإبلاغ عن خطأ في المخطط»); Plan-error (error-type chips, note, «العنصر: dz.cem.4am.arabic.igen-2022 · 1.3.2», «الإصدار: 2026.1») | designed | — |
| R-4.3-02 | The teacher sees the report before it is sent | §4.3 (1227) | Plan-error («ما سيُرسل، كما هو»; «لا يُرسل القسم ولا المؤسسة ولا أي بيانات تلاميذ») | designed | — |
| R-4.3-03 | The teacher chooses whether to be credited | §4.3 (1227) | Plan-error (switch «ذكر اسمي في شكر المحرّرين عند التصحيح», name field «الاسم كما يظهر») | designed | — |
| R-4.5-01 | The calendar shows its four layers (national; zone or wilaya; school; teacher) and filters by layer | §4.5 (1245–1249) | Calendar (chips «الكل، وطنية، الولاية والمؤسسة، خاصة بي»; badges «وطني» and «خاص بي») | designed | — |
| R-4.5-02 | The national layer holds holidays, public and religious days, exam windows and Ramadan hours | §4.5 (1246) | Calendar (1 Nov, term-1 exams, winter break, Ramadan, Eid al-Fitr); Journal-front (holidays page) | designed | — |
| R-4.5-03 | Every entry shows its source | §4.5 (1251) | Calendar (footnote «كل إدخال يحمل مصدره ودرجة يقينه»); Calendar-add (source field) | designed | — |
| R-4.5-04 | Every entry shows its confidence: announced, expected (lunar dates, give or take a day) or projected | §4.5 (1251) | Calendar (badges «مُعلن»، «متوقع، بيوم زيادة أو نقصان»، «تقديري»); Journal-front (status column, «التاريخ التقديري يُطبع بكلمة «تقديري» حتى يُعلن») | designed | — |
| R-4.5-05 | When the moon sighting is announced, one tap confirms a lunar holiday | §4.5 (1251) | Calendar (Eid al-Fitr buttons «ثبت: الثلاثاء 9» and «الأربعاء 10»; then «أُكّد بنقرة بعد إعلان رؤية الهلال» and the badge turns «مُعلن») | designed | — |
| R-4.5-06 | An entry can cancel sessions (a holiday or a closure) | §4.5 (1254) | Calendar-add (closure effect per class); Today-holiday; Calendar («عطلة وطنية · 3 حصص لا تُعقد») | designed | — |
| R-4.5-07 | An entry can replace sessions (an exam week) | §4.5 (1255) | Calendar (term-1 exams «تحل محل الحصص»); Plan (exam row «ثابت») | designed | — |
| R-4.5-08 | An entry can add sessions: support, remediation, or revision during the holidays | §4.5 (1256) | Calendar-add (kind «يوم تعويض أو دعم», «تُضاف فيه حصص»); Catchup-add, Calendar-add-sessions | designed | — |
| R-4.5-09 | An entry can change session times (Ramadan) | §4.5 (1257) | Calendar (Ramadan entry text only), Calendar-ramadan, Today-ramadan, Today-ramadan-primary | designed | — |
| R-4.5-10 | An entry can set or reset the A/B week | §4.5 (1258) | Calendar-ab | designed | — |
| R-4.5-11 | An entry can switch classes to rotating groups, as in October 2020 | §4.5 (1259) | Calendar-groups | designed | — |
| R-4.5-12 | A session-length profile holds the Ramadan rules for each level (CEM and lycée sessions keep their places and go from 60 to 45 minutes; primary periods are shortened) | §4.5 (1261–1262) | Settings-lengths, Settings-two-schools, Calendar-ramadan, Today-ramadan, Today-ramadan-primary | designed | — |
| R-4.5-13 | A shortened session still counts as one session | §4.5 (1263) | Calendar (Ramadan entry «والحصة المختصرة تُحسب حصة») | designed | A labelled note only, since no counts are drawn during Ramadan |
| R-4.5-14 | The texts-book entry prints the real duration of a shortened session | §4.5 (1264) | P10-ramadan, Today-ramadan, Calendar-ramadan, Today-ramadan-primary | designed | — |
| R-4.5-15 | Late news: the calendar takes same-day updates with the reference data, and shows what changed | §4.5 (1266–1272) | Calendar («آخر تحديث: الجمعة 2 أكتوبر»; footnote), Calendar-update, Calendar-update-today | designed | — |
| R-4.5-16 | The teacher adds entries (wilaya or school closures, training days, seminars, duties, make-up days, school events), each with its source | §4.5 (1249, 1272); §3.2 (808) | Calendar-add (5 kinds, date, part of day, source «إعلان مدير المؤسسة», effect preview); Calendar (button «إضافة إلى الرزنامة») | designed | — |
| R-4.5-17 | The teacher layer keeps sessions not held, and their reasons, private | §4.5 (1249); §3.3 (832) | Sheet («ذكر السبب اختياري، ويبقى على الهاتف»); Week-sign («السبب على الهاتف وحده»); Calendar-add (seminar: «لا يظهر في بيان التقدم إلا بسبب «الرزنامة»»), Share | designed | — |
| R-4.6-01 | Slots point to bell times from templates by level, shift and kind of day, so Ramadan changes the times without touching the timetable | §4.6 (1276) | Setup-5-Week («مواقيت رمضان تأتي من الرزنامة، لا من استعمال الزمن»), Calendar-ramadan, Settings-lengths, Settings-times, Settings-two-schools | designed | — |
| R-4.6-02 | A timetable entry runs every week, in A weeks or in B weeks | §4.6 (1277) | Week-slot («كل أسبوع / الأسبوع أ / الأسبوع ب»); Week-draw (switch «أسبوعان مختلفان: أ و ب», separate A and B grids) | designed | — |
| R-4.6-03 | The calendar stores each teaching week's parity: it alternates and skips holidays by default, can be reset each term, and the current letter shows | §4.6 (1277) | L-Today («اليوم، الأسبوع أ», «الأحد 11 أكتوبر، الأسبوع ب»), Calendar-ab | designed | — |
| R-4.6-04 | A new timetable version applies from its effective date | §4.6 (1278) | TT-change (version 2 «ابتداءً من الأحد 11 أكتوبر», before and after, «قبول النسخة 2»); Week-draw («ساري من 21/09/2026»); Setup-5-Week; TT-propose (version 3 from 4 Nov); Timetable-doc | designed | — |
| R-4.6-05 | A one-off change touches only its own date | §4.6 (1278) | TT-change (footnote «والتغيير ليوم واحد يمسّ ذلك اليوم وحده»); D-TT-change (director side: toggle «ليوم واحد» and the message teachers receive), TT-change-day | designed | — |
| R-4.6-06 | A primary slot can carry its activity type ("reading, session 3"), which week packs use | §4.6 (1279) | P-Today («قراءة، الحصة 2 من 3»); P-Multi; P-Journal (activity column), Week-slot-primary | designed | — |
| R-4.6-07 | Teacher blocks (pedagogical half-day, hours in another school, duties, reductions) take time out of the week without belonging to a class | §4.6 (1280) | Week-slot («وقت خاص», types «ساعات في مؤسسة أخرى، مهمة، تخفيض، نصف يوم بيداغوجي», «ولا يظهر في الدفاتر»); Week-draw (pen «وقت خاص») | designed | — |
| R-4.6-08 | Each class's dated sessions come from the timetable version in force, the calendar and the bell times | §4.6 (1281) | Plan (dated rows); Web-week | n/a (rule) | — |
| R-4.6-09 | The past never moves: regenerating touches only future sessions not yet recorded | §4.6 (1282) | TT-change («الحصص المسجّلة لا تُعاد كتابتها»); Week-draw (footnote «ولا يغيّر أي حصة مسجّلة»); TT-propose | designed | — |
| R-4.7-01 | Each course (class × subject) has its own plan: a teacher of two subjects in one class keeps a plan and a book for each | §4.7 (1288–1291) | Week-slot («إذا دُرّست المادتان للقسم نفسه، فلكل منهما مخططها ودفترها»); Plan-free (Islamic education for 4م2) | designed | — |
| R-4.7-02 | Session states: scheduled, proposed, recorded (done, changed, not held), covered or carried over, and an official snapshot once the week is signed | §4.7 (1293–1298) | P10 («مقترح · اليوم», pencil); Web-week (pencil and ink); Today-done; Sheet; Week-sign | designed | — |
| R-4.7-03 | The proposal is the class's next unfinished item, from the first stage not yet covered | §4.7 (1301) | Main (4م1: «يتابع من الحصة السابقة: تحليل الخطاب ومناقشته»); Today-done; EN-Today | designed | — |
| R-4.7-04 | Week packs match the slot's activity type within the weekly model, and a plan week's lessons spread over that week's slots in order | §4.7 (1302) | P-Today («الأسبوع 3», «فهم المنطوق، الحصة 1 من 2»); P-Multi | designed | — |
| R-4.7-05 | Budget and hybrid packs take the next item in order | §4.7 (1303) | Main; Plan; L-Today | designed | — |
| R-4.7-06 | TD slots have their own queue and never advance the main plan | §4.7 (1304) | L-Today («قائمة الأعمال الموجهة لهذا القسم», «لحصص الأعمال الموجهة قائمتها، ولا يتقدّم بها المخطط الرئيسي»), Plan, Digest, Digest-signed | designed | — |
| R-4.7-07 | Remediation slots have their own queue (remediation ordered in 3AP and 5AP) | §4.7 (1304) | P-Today, Week-slot-primary | designed | — |
| R-4.7-08 | Support slots have their own queue | §4.7 (1304) | Catchup-add («حصة دعم لها قائمتها الخاصة، ولا يتقدّم بها المخطط الرئيسي»); Calendar-add, Support-queue | designed | — |
| R-4.7-09 | Tests and exams come from the calendar and the teacher's test schedule, never from the pack | §4.7 (1305) | Plan (rows «الفرض · ثابت»); Calendar; Marks (row «الفرض», «الأحد 8 نوفمبر»); Entry («أُجري فرض في هذه الحصة»), Plan-primary, Test-schedule | designed | — |
| R-4.7-10 | Where the plan says the class should be is worked out separately, and shown only as a reference | §4.7 (1306–1308) | Plan, Class, Classes («وفق المخطط»); R-Merge (coordinator only: «الخط المتقطّع: موقع المخطط اليوم») | designed | — |
| R-4.7-11 | Stages, not percentages: "last stage reached" keeps the item at the head of the queue | §4.7 (1311) | Sheet («آخر مرحلة بلغتها الحصة», stage chips); Today-done | designed | — |
| R-4.7-12 | The remaining stages move to the next ordinary session of the same class and subject, never to a TD, remediation or exam session | §4.7 (1311) | Sheet («ما بقي يُقترح في الحصة القادمة (تابع)»), Sheet, Sheet-nostage | designed | — |
| R-4.7-13 | The journal and the texts-book entry read "تابع: <title>", with the stages still to cover | §4.7 (1311) | Journal («المورد: التضامن الاجتماعي (تابع)»); Today-done; Web-week, P10-4m1 | designed | — |
| R-4.7-14 | Fractions such as "2 of 4 stages" can be shown, never typed | §4.7 (1313) | L-Today («الحصة 3 من 6»); P-Today; Repace («(1 من 2)») | designed | — |
| R-4.7-15 | An item taught to half-groups counts as done for the class only when every half-group has had it | §4.7 (1314) | Week-slot («يُحسب عنصر المخطط منجزاً للقسم حين يُنجزه الفوجان»); L-Today (group 1 done, group 2 «الأحد 11 أكتوبر، الأسبوع ب») | designed | — |
| R-4.7-16 | Never locked to the plan: free text and unplanned content are always allowed | §4.7 (1315) | Entry («إضافة محتوى من خارج المخطط», «تغيير الدرس», free line); Plan-item (add an item) | designed | — |
| R-4.7-17 | Time is counted in sessions, and hour budgets are converted with the class's session length | §4.7 (1318) | Plan, Digest, Catchup (all in sessions); P-Journal (durations) | designed | — |
| R-4.7-18 | Counting in minutes is an option | §4.7 (1318) | Digest-primary, Plan-primary, Settings-two-schools | designed | — |
| R-4.7-19 | Delay is shown in sessions, and in plan weeks for week packs | §4.7 (1319) | Catchup («4 حصص خلف المخطط»); Share («أسابيع التأخر»); Digest-signed, Digest-primary, Plan-primary | designed | — |
| R-4.7-20 | Sessions lost to the calendar are counted separately, so a closure never reads as slow teaching | §4.7 (1319) | Today-holiday («3 حصص لم تُعقد بسبب الرزنامة ... فلا تُقرأ تأخراً في التدريس»); Digest («لا حصص ضائعة بسبب الرزنامة»); Calendar-add; School-mine; Share | designed | — |
| R-4.7-21 | Buffers first: while the buffers left before the next exam window can absorb a delay, the digest shows it as buffer used, not as a delay | §4.7 (1320) | Digest (4م1 «استُعملت 4 حصص من الاحتياط»); Classes; Class; School-mine, Digest-signed, Catchup, Handover-school | designed | — |
| R-4.7-22 | Spare time: the sessions left before the next exam window, minus what the plan still needs by then | §4.7 (1321) | Plan («38 حصة متاحة بعد الفرض، ويحتاج المخطط منها 32»); Digest; Class | designed | — |
| R-4.7-23 | The September check: from the first day each class shows "The plan needs N sessions before the term-1 exams. Your timetable and the calendar give M", and the gap is not spare time | §4.7 (1322) | Setup-7-Ready («47 حصة بعد الفرض، ويحتاج المخطط 41», «فليس وقتاً فارغاً»); Plan | designed | — |
| R-4.7-24 | When a class falls behind, the catch-up options come in order | §4.7 (1324) | Catchup (rungs 1 to 5, «الخيارات بالترتيب، ولا يُطبَّق أيّ منها دون تأكيد»); Digest (button «خيارات التدارك») | designed | — |
| R-4.7-25 | Rung 1, compress the item in progress: the teacher does it and the app does nothing | §4.7 (1325) | Catchup (rung 1) | designed | — |
| R-4.7-26 | Rung 2: use the pack's buffers | §4.7 (1326) | Catchup (rung 2, «استُعملت 4 حصص، وتبقى حصتان») | designed | — |
| R-4.7-27 | Rung 3: merge items or leave out optional ones, from the pack's proposals, the teacher confirming each | §4.7 (1327) | Catchup (rung 3, confirm and undo per proposal), Catchup | designed | — |
| R-4.7-28 | Rung 4: add sessions, which the teacher schedules | §4.7 (1328) | Catchup-add (free slots, another time, catch-up or support, effect on buffers), Catchup, Catchup-add | designed | — |
| R-4.7-29 | Rung 5: re-pace the rest of the term into a new distribution for the teacher to review and print | §4.7 (1329) | Repace (summary, «ما تغيّر عن التوزيع الأول», weekly table, «طباعة المسودة», «اعتماد التوزيع», undo note) | designed | — |
| R-4.7-30 | In primary, the director approves the re-paced distribution (Decision 839 Art. 12) | §4.7 (1329) | Repace (footnote «وفي الابتدائي، تُطبع المسودة ليعتمدها المدير»), Repace-primary | designed | — |
| R-4.7-31 | Never drop an item silently | §4.7 (1332) | Catchup (warn line); Plan-item (skip: «يُترك بعلم الأستاذ، ويظهر «متروكاً» ... ويمكن استرجاعه»); Plan (align: «متجاوزة»); Calendar-add; Repace | designed | — |
| R-4.7-32 | Never push an item past an exam window silently | §4.7 (1333) | Catchup (warn line «لا يُسقَط مورد ولا يُؤجَّل بعد الاختبارات دون علم الأستاذ»); Repace («ولا مورد بعدها»), Exam-window | designed | — |
| R-4.7-33 | Never apply a merge on its own | §4.7 (1334) | Catchup (confirm each); Sheet («دُمج مع الدرس الموالي» as the teacher's outcome) | designed | — |
| R-4.7-34 | Fixed points: tests, exams and TD sessions keep their dates, and lessons flow around them, skipping holidays | §4.7 (1336) | Plan (rows «ثابت», «الأحد 1 نوفمبر عطلة»); Repace («الفرض، الإثنين 9 نوفمبر، في موعده») | designed | Plan does not tag its TD rows «ثابت» |
| R-4.7-35 | Moving lessons never deletes one, and every move can be undone from the history | §4.7 (1336) | Plan-item («ويُسترجع من السجل»); Catchup; Repace («ويُسترجع السابق من السجل»); Today-done (undo) | designed | — |
| R-4.7-36 | Parallel classes keep their own queues, and "Align with class X" copies a position | §4.7 (1339) | Plan (toggle «مواءمة موقع قسم آخر مع 4م2», class chips, effect «يُنسخ الموقع وحده، ولا يتغير ما سُجّل في دفتر القسم الآخر») | designed | — |
| R-4.7-37 | The app warns before a common test or exam window if parallel classes have drifted apart | §4.7 (1339) | Plan (note «وينبّه التطبيق قبل فرض مشترك إذا تباعدت الأقسام»), Digest-closure, Plan-primary | designed | — |
| R-4.7-38 | Multigrade classes have one queue for each level | §4.7 (1340) | P-Multi (one proposal per level, «نقرة على مستوى واحد تؤكّده وحده») | designed | — |
| R-4.7-39 | Lycée reorientation: 2AS classes reshaped on 8 October get a "merge class history" step | §4.7 (1341) | Reorient | designed | — |
| R-4.7-40 | A new teacher mid-year: the class's queue carries over in the handover package | §4.7 (1342) | Handover («موقع كل قسم في المخطط», «المورد التالي لكل قسم»); Handover-in (position, next item, pace «من آخر إدخال»); Handover-school | designed | The teacher's own layer of plan changes is not listed in the package |
| R-4.7-41 | The engine runs on the device with no network or server, and its results belong to the teacher | §4.7 (1344) | E-Migrate («ولا يعرف الخادم تقدّم أي قسم») | n/a (rule) | — |
| R-4.8-01 | The app ships with the current packs and calendar | §4.8 (1348) | Setup-6-Plan (pack offered at setup; calendar «مدمجة»); Setup-1-Welcome («يعمل دون إنترنت») | designed | — |
| R-4.8-02 | Updates come from the data repository or its mirror in Algeria, with no account and no identifier, as NETWORK.md lists | §4.8 (1349) | Help («تحديثات المخطط والرزنامة والقواعد · تُنزَّل دون حساب ودون أي معرّف، من خادم المشروع في الجزائر أو مرآته», «والقائمة الكاملة منشورة مع الشيفرة»); Pack-release («وصل اليوم مع تحديثات المخطط») | designed | — |
| R-4.8-03 | An update can travel offline as a file or a QR code, from a colleague or the school | §4.8 (1350) | Calendar (footnote only), Import-update, Settings-two-schools | designed | — |
| R-4.8-04 | Every reference-data release is signed; the app checks the signature and shows who signed (the IGP for its official packs, the project for the others) | §4.8 (1351); §5.9 (1626) | Pack-release (badge «موقّع»); Setup-5-Week (timetable package «موقّع»), Import-update | designed | — |
| R-4.8-05 | A pack passed from phone to phone cannot be changed without the app noticing | §4.8 (1351) | Import-refused | designed | — |
| R-4.9-01 | Progress statements carry the pack ID and release, so statements from different classes and schools can be compared | §4.9 (1355); §3.10 (1012) | Share (row «حزمة المخطط: اللغة العربية · 4 متوسط · 2026.1»); R-Open and R-Picture (same row) | designed | — |
| R-4.9-02 | In a statement, sessions not held appear only as calendar causes or "other"; the reasons stay on the teacher's devices | §4.9 (1355); §3.10 (1011) | Share (switch «تفصيل أسباب الحصص غير المنعقدة»), Share | designed | — |
| R-4.9-03 | Plan feedback in the opt-in insights: which items teachers merge, skip, split or re-teach, describing the plan and never a teacher | §4.9 (1356) | Insights-optin (exact payload with pack ID and release, sessions per item, «ما غُيّر», «لا يُرسل أبداً»); Insights-compare | designed | — |
| R-4.9-04 | In the national system, the curriculum report gives the same feedback as totals above the school, and replaces the opt-in insights | §4.9 (1357) | M-Totals (directorate tab «تقرير المنهاج»), Insights-optin-retired | designed | — |
| R-4.11-01 | Pilot packs exist only where keyed in full (5AP Arabic and maths, 1AM maths, 3AM French, one lycée pack); 3AP and 4AP wait while their plans are stale | §4.11 (1380); §4.1 (1131); §4.2 (1172) | Plan-free (free entry); P-Today; P-Multi; PS-Today, Setup-6b-Packs, P-Today, P-Multi, Plan-stale | designed | — |
| R-4.11-02 | The 2026/27 calendar, as the Ministry publishes it | §4.11 (1381) | Calendar; Setup-6-Plan | designed | — |
| R-4.11-03 | Pilot live test: Ramadan 1448 (about 7 February to 8 March 2027), with its layers and session lengths | §4.11 (1381) | Calendar (Ramadan entry only), Calendar-ramadan, Today-ramadan, Today-ramadan-primary | designed | — |
| R-4.11-04 | Pilot live test: a probable move of the term-2 exam week | §4.11 (1381) | Calendar-moved | designed | — |
| R-4.11-05 | Field check: the anchors and the stage picker, tested with teachers | §4.11 (1382) | Sheet (stage picker); P-Today, Main, L-Today (the three anchors) | designed | — |
| R-4.11-06 | Field check: the September check, shown to an inspector | §4.11 (1382) | Setup-7-Ready; Plan, Sept-check | designed | — |

## D. Data, privacy, security and the school space (§1.5–1.6, §1.11, §5.5, §5.7–5.9, §6.2, §6.4–6.6, §6.8, §7 (teacher parts), §8.4)

| ID | Requirement | PRD | Screens | Coverage | What is missing or wrong |
|---|---|---|---|---|---|
| R-1.5-01 | Nothing leaves the device by default; pupil data leaves only inside the E2E sync or backup, once the teacher turns it on | §1.5 l.146 | Privacy, Devices, Setup-1-Welcome | designed | — |
| R-1.5-02 | National system: the school's copy is encrypted for the teacher and the school; marks and absences are encrypted for the receiving state system | §1.5 l.147 | School-join, Term-send, Week-fix | designed | — |
| R-1.5-03 | The app never needs a server to open or do the daily work; every daily task works offline | §1.5 l.148; §6.8 l.1900 | Setup-1-Welcome, Privacy, School-join (joined state), Web-unlock | designed | — |
| R-1.5-04 | The phone's cloud backup never receives pupil data or the database | §1.5 l.149; §5.8 l.1611; §6.4 l.1822 | Security, Privacy, Devices | designed | — |
| R-1.5-05 | No third-party SDKs that send data (analytics, ads, crash reporting, AI) | §1.5 l.150 | Help, Privacy | n/a (rule) | Stated in Help ("لا إعلانات ولا أدوات تحليل") and Privacy |
| R-1.5-06 | The app shows every address it contacts, what it sends and why (mirrors NETWORK.md) | §1.5 l.151 | Help, Help-insights, Help-national | designed | — |
| R-1.5-07 | Crash reports off by default; each shown before sending, names and marks removed, sent to the server the teacher uses | §1.5 l.152 | Help, Privacy, Crash-preview, Help-national | designed | — |
| R-1.5-08 | If AI is ever used: no pupil data to an AI service abroad; model, prompts and location public | §1.5 l.153 | — | n/a (rule) | No AI feature in version 1 |
| R-1.5-09 | A demo class of made-up pupils for screenshots, tutorials and reproducing bugs | §1.5 l.159 | Help | designed | — |
| R-1.5-10 | "Report a problem" builds a report with names replaced and shows it before sending | §1.5 l.160 | Report, Help | designed | — |
| R-1.5-11 | Support asks for the safe report or the demo class, never a real screenshot | §1.5 l.160 | Report, Security | designed | — |
| R-1.6-01 | Insights are off by default and the teacher can turn them off at any time | §1.6 l.170 | Insights-optin, Settings | designed | — |
| R-1.6-02 | The exact payload is shown before the teacher opts in | §1.6 l.171 | Insights-optin | designed | — |
| R-1.6-03 | After opting in, a log of everything sent | §1.6 l.171 | Insights-optin, Log, Log-insights | designed | — |
| R-1.6-04 | Lesson-level only: what was taught, never when or why; never pupil data, teacher identity or institution-mode data | §1.6 l.172–175; §8.4 l.2335 | Insights-optin | designed | — |
| R-1.6-05 | Grouped by level, subject and wilaya; minimum sizes count teachers and schools (10 and 3); small cells hidden, also by subtraction | §1.6 l.176–179; §8.4 l.2344–2345 | Insights-optin, Insights-compare | designed | — |
| R-1.6-06 | Stated uses: figures describe the plan; never exam scope, ranking or personnel decisions | §1.6 l.180–183; §8.4 l.2351–2352 | Insights-optin | designed | — |
| R-1.6-07 | Each teacher sees how their class compares with peers | §1.6 l.187 | Insights-compare | designed | — |
| R-1.6-08 | Runs in teacher mode from 2027/28, never on institution-mode classes, and is retired once national totals exist | §1.6 l.166, l.175; §8.4 l.2321 | Settings, Insights-optin, Insights-optin-retired, Insights-optin-school, Settings-retired, Settings-school | designed | — |
| R-1.6-09 | Code, payload and method are public a month before collection | §1.6 l.168 | — | n/a (rule) | Optional link to the published method from Insights-optin |
| R-1.11-01 | The app points teachers to their channels: the website form and the teacher group | §1.11 l.308 | Help | designed | — |
| R-1.11-02 | One-to-one support follows §1.5: the safe report or the demo class | §1.11 l.310 | Report, Help, Security | designed | — |
| R-1.11-03 | Roadmap, decision summaries and the transparency report are published outside the app | §1.11 l.311–324 | Help (About row) | n/a (rule) | Optional About links |
| R-1.11-04 | No feature detects, counts or reports collective action | §1.11 l.329 | School-mine, D-Dashboard | n/a (rule) | No board totals or trends confirmation status |
| R-1.11-05 | Whether sessions are recorded or awaiting confirmation never leaves the school; only the school key opens it | §1.11 l.330 | School-mine, Week-sign, Digest-signed, I-Grant | designed | — |
| R-5.5-01 | The history is append-only and the screens are derived from it | §5.5 l.1557 | Log, Pupil | n/a (rule) | — |
| R-5.5-02 | Corrections keep both versions | §5.5 l.1558; §3.1 l.753–756 | Correct, Pupil, Book-fixes, Export-fix, Week-fix, D-Record-fix | designed | — |
| R-5.5-03 | Roll-call and mark corrections ask for a short reason; other corrections may carry one | §5.5 l.1558 | Correct, Export-fix, Week-fix, Book-fixes | designed | — |
| R-5.5-04 | Tampering shows: the chained history detects edits or deletions made outside the app | §5.5 l.1559 | Log, D-Record-fix, R-Open, Log-broken | designed | — |
| R-5.5-05 | The history records dates and order, never clock times | §5.5 l.1560 | Log, Correct, School-mine | designed | — |
| R-5.5-06 | The teacher sees the change log and every export, share, access and deletion | §5.5 l.1561 | Log, Share, School-mine, Pupil | designed | — |
| R-5.5-07 | Statements, handover and timetable packages are signed with the teacher's key; a reader can check them; not a legal signature in teacher mode | §5.5 l.1562 | R-Open, Handover-in, TT-change, Setup-5-Week, Share, Handover, Handover-in-fail, Share-qr | designed | — |
| R-5.5-08 | Weekly signature, one step, fingerprint or PIN; working record before, official record after | §5.5 l.1563 | Week-sign, Digest-signed, School-mine | designed | — |
| R-5.5-09 | A signed week can be corrected; the correction is signed and both versions show | §5.5 l.1564 | Week-fix, Week-sign, D-Record-fix | designed | — |
| R-5.5-10 | On joining, the state CA certifies the signing key made on the device; the key never leaves it | §5.5 l.1565 | School-join, Week-sign, Rejoin | designed | — |
| R-5.5-11 | A signed week or term export counts from the day it was signed on the device | §5.5 l.1566 | Week-sign, Term-send | designed | — |
| R-5.5-12 | Paper fallback: a session recorded on paper is entered later, with the day it was taught | §5.5 l.1567 | Today-backlog, Roll-print, Week-sign | designed | — |
| R-5.5-13 | Deleting a pupil's data or a past year erases the content; the history keeps only the fact and the day | §5.5 l.1568 | Year-erase, Log, Pupil-erase | designed | — |
| R-5.7-01 | Each school year closes into its own archive: available, correctable, exportable whole | §5.7 l.1584 | Year-close, Export-all, Classes-closed | designed | — |
| R-5.7-02 | Retention classes (lesson records, pupil records, private notes, logs) with defaults the teacher can change | §5.7 l.1585–1592 | Year-close, Log, Settings, Settings-retention | designed | — |
| R-5.7-03 | After the following year ends, the app offers to erase that year's pupil records and seating plans, keeping lesson records | §5.7 l.1590; §3.4 l.870 | Year-erase | designed | — |
| R-5.7-04 | Year-end prompts remind the teacher to export and to erase | §5.7 l.1594 | Year-close, Year-erase, Settings, Notif, Today-june | designed | — |
| R-5.7-05 | "Erase this device" removes everything from a phone or a browser in one step | §5.7 l.1595; §6.4 l.1824 | Erase, Web-unlock, Web-erase | designed | — |
| R-5.7-06 | In the school space, the school's copy and the official record follow the Ministry's declared retention | §5.7 l.1596 | Leave | designed | — |
| R-5.7-07 | A teacher who leaves keeps a full copy of their lesson records; the school keeps its copy | §5.7 l.1597; §7.5 l.2067 | Leave, School-join | designed | — |
| R-5.8-01 | Own-device sync, E2E, free for teachers; on the project's server until the move to the Ministry's | §5.8 l.1602 | Devices, Sync-signin | designed | — |
| R-5.8-02 | Sync to the school space, readable only by the teacher and the school | §5.8 l.1603 | School-join, Week-sign, Digest-signed | designed | — |
| R-5.8-03 | Join the school space by scanning its QR once; fingerprint or PIN; no password, account or reset via the director; works offline | §5.8 l.1604 | School-join, Rejoin, D-Issue | designed | — |
| R-5.8-04 | Without a smartphone, a teacher joins on a school PC with a security key the school issues | §5.8 l.1604; §6.6 l.1863 | Web-staff, D-Issue | designed | — |
| R-5.8-05 | Moving to the Ministry's system: the app shows what will move and moves it once the teacher agrees; private notes stay | §5.8 l.1605; §9.3 l.2490 | School-join | designed | — |
| R-5.8-06 | Fixed-size batches at set times, so arrival reveals nothing | §5.8 l.1606 | Ops-Console, Sync-signin | n/a (rule) | — |
| R-5.8-07 | Only new changes travel; an interrupted sync resumes over mobile data | §5.8 l.1607 | Devices | n/a (rule) | — |
| R-5.8-08 | Conflicting changes are both kept and the app asks which one to keep | §5.8 l.1608 | Conflict, Devices, Log | designed | — |
| R-5.8-09 | The app shows how many changes are waiting to sync | §5.8 l.1609 | Devices, Settings, Erase | designed | — |
| R-5.8-10 | Direct transfer without the server: local network after a QR scan, or an encrypted file | §5.8 l.1610; §3.10 l.1021–1023 | Devices, Restore, Handover, Handover-in, Transfer | designed | — |
| R-5.8-11 | Encrypted backup file kept on a PC, an SD card or a USB key | §5.8 l.1611 | Devices, Restore | designed | — |
| R-5.8-12 | Lost phone: restore from sync or backup with the recovery key; in a school space a new QR; the lost phone gets nothing new | §5.8 l.1612; §6.5 l.1850 | Restore, Rejoin, D-Issue, Devices | designed | — |
| R-5.9-01 | Minhajna archive out: everything with history and pinned releases, documented, free, at any time | §5.9 l.1618 | Export-all | designed | — |
| R-5.9-02 | Minhajna archive in, including every older version | §5.9 l.1618 | Restore, Archive-open | designed | — |
| R-5.9-03 | CSV out: marks, roll call and the lesson log | §5.9 l.1619 | Export-all, Export | designed | — |
| R-5.9-04 | PDF and DOCX out, made on the device | §5.9 l.1620 | Print, Roll-print, Export | designed | — |
| R-5.9-05 | Official class list in; only the §5.6 columns are kept | §5.9 l.1621 | Setup-4b-Import, Setup-4-Classes, Log | designed | — |
| R-5.9-06 | The school's grade workbook in, then out, edited in place, unlocked cells only | §5.9 l.1622 | Export | designed | — |
| R-5.9-07 | Timetable package in: the teacher's own part, signed, stable IDs, no pupil data | §5.9 l.1623; §7.4 l.2020 | Setup-5-Week, TT-change | designed | — |
| R-5.9-08 | Progress statement out: the §3.10 fields, signed, no pupil data; printed, PDF or QR | §5.9 l.1624; §3.10 l.1005–1014 | Share, R-Open, Share-qr | designed | — |
| R-5.9-09 | Handover package: progress by topic, signed; pupil data only by direct transfer, if the teacher chooses | §5.9 l.1625 | Handover, Handover-in | designed | — |
| R-5.9-10 | Reference-data releases are signed by their issuer and the app shows who signed | §5.9 l.1626 | Pack-release, Setup-6-Plan, Calendar, Setup-6b-Packs | designed | — |
| R-5.9-11 | Interop in: class lists and assignments arrive from the sector's system, so nobody types them | §5.9 l.1629 | School-join, Handover-school, D-Issue | designed | — |
| R-5.9-12 | Interop out: marks, and absences where the school chooses, encrypted for the receiver; files stay as fallback | §5.9 l.1630–1632 | Term-send, Week-fix | designed | — |
| R-5.9-13 | Parents use awlyaa; no features for students or parents | §5.9 l.1633 | Term-send | designed | — |
| R-5.9-14 | Every incoming file is untrusted: checked against its format, extra fields dropped, macros never run | §5.9 l.1636–1639 | Setup-4b-Import, Log, File-refused | designed | — |
| R-5.9-15 | Files with pupil data are marked "internal / confidential" and can carry a password | §5.9 l.1643; §6.4 l.1825 | Share-warn, Export-all, Export, Roll-print, Print, Council, Council-t2, Doc-output-pupils, Export-file, Gradebook-print, Marks-check, Marks-check-diff, Marks-sheet, Supervised | designed | — |
| R-5.9-16 | Warning before a file goes to a messaging or social app (Ord. 06-03 Art. 48) | §5.9 l.1644 | Share-warn | designed | — |
| R-5.9-17 | No public links | §5.9 l.1645 | Share-warn | designed | — |
| R-5.9-18 | A statement fits in a signed QR read without network; larger files use the QR only to open a short-lived local transfer | §5.9 l.1647 | Share, R-Open, Handover, Restore, Share-qr | designed | — |
| R-6.2-01 | An Arabic privacy notice before first use (Loi 18-07 Art. 32), available later in Help | §6.2 l.1784 | Privacy, Setup-1-Welcome, Help | designed | — |
| R-6.2-02 | Teachers can see, correct (within 10 days) and delete what the project holds about them, through a named contact | §6.2 l.1784, l.1789 | Privacy, Sync-signin, Sync-account, Recovery-sheet | partial | Privacy still shows a placeholder for the data-protection contact: the PRD does not name it. |
| R-6.2-03 | If sync's gates are not met, the pilot runs without sync, on direct transfer and backup files | §6.2 l.1788 | Devices, Devices-pilot | designed | — |
| R-6.4-01 | Encrypted database: Android key in the keystore, released by the lock; web key from the passphrase, in memory only | §6.4 l.1812–1814 | Security, Web-unlock | designed | — |
| R-6.4-02 | App lock by PIN or the phone's fingerprint or face prompt; no biometric data stored | §6.4 l.1815 | Lock, Security | designed | — |
| R-6.4-03 | School-space sign-in uses the same prompt; a PIN always works; the app's own key, not Google passkeys | §6.4 l.1816 | School-join, Week-sign, Web-staff | designed | — |
| R-6.4-04 | Sign-ins are never recorded as events | §6.4 l.1817 | School-join, Web-staff, D-Issue | designed | — |
| R-6.4-05 | Automatic lock after inactivity, with a delay the teacher can change | §6.4 l.1818 | Security, Lock, Web-unlock | designed | — |
| R-6.4-06 | Notifications never show pupils' names or marks | §6.4 l.1820 | Security, Notif | designed | — |
| R-6.4-07 | Pupil-data screens are hidden from recent apps and block screenshots, unless the teacher allows them | §6.4 l.1821 | Security | designed | — |
| R-6.4-08 | Minimal permissions: camera for QR only, asked on first use; files through the system picker | §6.4 l.1823 | Security, Restore, Export-all | designed | — |
| R-6.5-01 | No server holds a key; the project cannot recover data; only the teacher can recover private notes | §6.5 l.1830, l.1852 | Devices, Restore, Sync-signin, Export-all | designed | — |
| R-6.5-02 | Private notes are encrypted for the teacher's own devices only, never for the school | §6.5 l.1843 | School-join, Rejoin, Handover-school, Week-sign, Entry | designed | — |
| R-6.5-03 | The teacher adds a device by scanning a QR code on a device already set up | §6.5 l.1846 | Devices, Sync-signin, Devices-add, Devices-join, Devices-join-install, Web-unlock-risk, Web-update | designed | — |
| R-6.5-04 | A lost device can be removed, so it receives nothing new | §6.5 l.1847 | Devices, Rejoin, Device-remove | designed | — |
| R-6.5-05 | The recovery sheet: given when sync or backup is set up; it restores everything | §6.5 l.1849 | Devices, Sync-signin, Restore, Log, Recovery-sheet | designed | — |
| R-6.5-06 | Making a backup takes two taps | §6.5 l.1853 | Devices | designed | — |
| R-6.5-07 | A reminder after 30 days with no sync and no backup | §6.5 l.1854 | Devices, Notif, Today-backup | designed | — |
| R-6.5-08 | The server sees memberships, encrypted fixed-size batches and their sizes; no names or activity times | §6.5 l.1855 | Sync-signin | designed | — |
| R-6.5-09 | No account needs a real name or a password; teacher-mode sync uses a login | §6.5 l.1856 | Sync-signin, Restore, Devices | designed | — |
| R-6.6-01 | Served as a fixed bundle by whoever runs the server; nothing loaded from elsewhere | §6.6 l.1861 | Web-staff, Web-unlock | designed | — |
| R-6.6-02 | Staffroom PC: scan the screen's QR with the phone and approve; memory-only session that leaves nothing when closed or locked | §6.6 l.1862 | Web-staff, Web-signin-phone, Web-staff-session | designed | — |
| R-6.6-03 | On the teacher's own PC, Windows Hello can replace the phone | §6.6 l.1862 | Web-staff | designed | — |
| R-6.6-04 | Security key with its own PIN; a lost key is replaced by the school | §6.6 l.1863 | Web-staff, D-Issue | designed | — |
| R-6.6-05 | Installed for offline use | §6.6 l.1864 | Web-unlock, Devices-join-install, Web-unlock-risk, Web-update | designed | — |
| R-6.6-06 | After installation, the web app changes only when the teacher accepts an update | §6.6 l.1864; §5.2 l.1499 | Web-unlock, Devices-join-install, Web-unlock-risk, Web-update | designed | — |
| R-6.6-07 | Shows its version and build checksum | §6.6 l.1865 | Web-unlock, Web-staff | designed | — |
| R-6.6-08 | Asks the browser to keep its storage, and warns if the browser may clear it | §6.6 l.1866 | Web-unlock, Devices-join-install, Web-unlock-risk, Web-update | designed | — |
| R-6.6-09 | Current Chrome, Edge and Firefox on Windows 10 and 11 | §6.6 l.1867 | Web-staff | designed | — |
| R-6.8-01 | Arabic, French and English; right to left and left to right; Western digits | §6.8 l.1904; §3.1 l.763–766 | Language, Setup-1-Welcome, EN-Today, PS-Today, PS-Classes | designed | — |
| R-6.8-02 | The teacher can limit sync to Wi-Fi | §6.8 l.1899 | Devices | designed | — |
| R-6.8-03 | Nothing runs in the background except scheduled notifications and, if allowed, sync | §6.8 l.1902 | Notif, Devices | n/a (rule) | — |
| R-7.4-01 | Each teacher receives only their own part, signed, by file, QR or the school space | §7.4 l.2020 | Setup-5-Week, TT-change | designed | — |
| R-7.4-02 | A teacher in several schools gets one package from each, merged on the device, with clash warnings | §7.4 l.2021 | PS-Classes, PS-Today, Setup-5d-Two-schools | designed | — |
| R-7.4-03 | A teacher who drew their own week sees the differences before accepting the school's version | §7.4 l.2022 | Setup-5-Week, Week-draw, TT-change, Setup-5b-Package | designed | — |
| R-7.4-04 | A change is a new version with an effective date (next Sunday by default); a one-off change touches only its date | §7.4 l.2025 | TT-change, TT-propose | designed | — |
| R-7.4-05 | Only the teachers affected are told, in plain words | §7.4 l.2026 | TT-change | designed | — |
| R-7.4-06 | Confirming receipt can replace signing the paper notice | §7.4 l.2027 | TT-change | designed | — |
| R-7.4-07 | Recorded sessions are never rewritten | §7.4 l.2028 | TT-change, TT-propose | designed | — |
| R-7.5-01 | Every teacher is told, in Arabic, before the start | §7.5 l.2065 | School-join | designed | — |
| R-7.5-02 | The teacher sees their own access log: every access to their records, dated | §7.5 l.2058, l.2065; §7.8 l.2110 | School-mine | designed | — |
| R-7.5-03 | No personal phone needed: school PC with the phone or a security key; paper as fallback | §7.5 l.2066 | School-join, Web-staff | designed | — |
| R-7.5-04 | The teacher is shown what enters the school's space and what never does | §7.5 l.2051–2059 | School-join | designed | — |
| R-7.5-05 | Trial term end: taking part is voluntary; a class whose teacher hasn't joined shows "not joined" | §7.5 l.2038 | —, School-join-trial | designed | — |
| R-7.5-06 | The director's visa is a comment on a signed week, never an edit, and the teacher sees it | §7.5 l.2047 | School-mine, Digest-signed | designed | — |
| R-7.5-07 | A substitute receives each course's record through the school's space; the appointment ends when the holder returns | §7.5 l.2046 | Handover-school, D-Substitute, Handover-end, Handover-end-sub | designed | — |
| R-7.5-08 | A delivery report for each course, every term: planned, held, lost (calendar or "other") | §7.5 l.2048 | D-Report, School-mine, School-mine-report | designed | — |
| R-7.5-09 | Pupil records enter the school's space when the teacher signs the week | §7.5 l.2062 | Week-sign, Digest-signed | designed | — |
| R-7.6-01 | The teacher sees the director's dashboard for their own classes: thresholds first, workload, awaiting, position, buffer, lost by cause | §7.6 l.2072–2075, l.2082 | School-mine, D-Dashboard | designed | — |
| R-7.6-02 | "Awaiting confirmation" is neutral and on screen only: never printed, exported, totalled or dated | §7.6 l.2078–2079 | School-mine, Week-sign, Digest-signed | designed | — |
| R-7.6-03 | Classes in the school's order; no ranking, no colours for people, no clock times | §7.6 l.2080–2081 | School-mine | designed | — |
| R-7.6-04 | The view updates with each sync batch, a few times a day | §7.6 l.2071 | D-Dashboard | n/a (rule) | — |
| R-7.7-01 | The teacher sees cover for their classes and the cover they gave; no reason recorded | §7.7 l.2088; §7.8 l.2109 | School-mine, Today-special | designed | — |
| R-7.7-02 | Make-up sessions are linked to the sessions they replace, so progress stays right | §7.7 l.2098 | D-Cover, D-Report, Catchup-add, Week-sign-today | designed | — |
| R-7.8-01 | Lesson records with their correction history, and pupil records for their classes | §7.8 l.2104–2105 | Week-fix, Pupil, Log | designed | — |
| R-7.8-02 | Private notes and reasons are readable by the teacher alone | §7.8 l.2106 | School-join, Week-sign, M-Grant | designed | — |
| R-7.8-03 | Class progress for all their classes | §7.8 l.2107 | School-mine | designed | — |
| R-7.8-04 | The teacher's own timetable, and proposing changes | §7.8 l.2108 | TT-propose, TT-change | designed | — |
| R-7.8-05 | An inspector's grant is visible to the teacher: courses, weeks, end date; lesson records only | §7.8 l.2114 | M-Grant, School-mine, I-Grant | designed | — |
| R-7.10-01 | The teacher sees where each of their classes stands against each exam's date (school, directorate, national) | §7.10 l.2164 | T-Threshold | designed | — |
| R-7.10-02 | The school's chart for their subject and level and the directorate's totals, each chart with a table of the same figures | §7.10 l.2164, l.2170 | T-Threshold, D-Threshold, T-Threshold-totals | designed | — |
| R-7.10-03 | A school's cut is optional; the setters sign it; at a school the earliest proposed cut applies | §7.10 l.2141, l.2152–2153 | T-Threshold, D-Threshold, T-Threshold-propose | designed | — |
| R-7.10-04 | The teacher sees a cut when signing it as a setter, or once it is published | §7.10 l.2164, l.2136, l.2154 | T-Threshold, N-Published, T-Threshold-after | designed | — |
| R-7.10-05 | Monthly tests stay with each teacher, with nothing to sign | §7.10 l.2140 | Marks-test | n/a (rule) | — |
| R-7.10-06 | Figures are taken on announced days; if the exam moves, the date moves, is announced again 2 weeks ahead, and both dates show with the reason | §7.10 l.2146 | T-Threshold, N-Published, Calendar-moved, T-Threshold-moved | designed | — |
| R-7.10-07 | Only signed progress counts above the school; classes' own plans stay inside it | §7.10 l.2148 | T-Threshold, N-Published | designed | — |
| R-7.10-08 | Never a ranking, a figure for one teacher, or personnel use | §7.10 l.2142, l.2168 | T-Threshold | designed | — |
| R-7.10-09 | Before adoption there are no thresholds; teacher mode forms no exam-scope figures | §7.10 l.2143 | Insights-optin | n/a (rule) | — |
| R-8.4-01 | The payload for each opted-in class: pack and release, sessions per item, items merged, skipped, split or re-taught, end-of-term position | §8.4 l.2329–2333 | Insights-optin | designed | — |
| R-8.4-02 | Indicators carry their class count and the self-selection note; end-of-term position as a median and a spread | §8.4 l.2337–2341 | Insights-compare | designed | — |
| R-8.4-03 | Shares near 0% or 100% in small cells are shown in bands | §8.4 l.2346 | Insights-compare | designed | — |
| R-8.4-04 | The comparison is worked out on the device from published figures; nothing about the class is sent | §8.4 l.2348 | Insights-compare | designed | — |

## E. Above the teacher: the school, directorates, the Ministry, operators, curators and the observatory (§1.6, §4 (curators), §5.10, §6.5, §6.7, §7.1–§7.14, §8)

| ID | Requirement | PRD | Screens | Coverage | What is missing or wrong |
|---|---|---|---|---|---|
| R-1.6-10 | The observatory is retired once the national system's totals exist | §1.6 l.168; §8.4 l.2401 | Obs-Report, Insights-optin-retired | designed | — |
| R-1.6-11 | The insights server's code, the exact payload and the aggregation method are public at least a month before collection | §1.6 l.170; §8.4 l.2401 | Obs-Report | designed | — |
| R-1.6-12 | The observatory receives lesson-level data only: never dates, reasons, pupil data, teacher identity or institution-mode data | §1.6 l.174–177; §8.4 l.2409–2415 | Obs-Report | partial | The payload panel «الحمولة كما يراها الأستاذ» lists date, reason, pupil and teacher, but leaves out data from institution mode |
| R-1.6-13 | Figures grouped by level, subject and wilaya; a wilaya or national figure covers at least 10 teachers and 3 schools; cells below it, or revealing it by subtraction, are hidden | §1.6 l.178–181; §8.4 l.2424–2425 | Obs-Report, Insights-compare | partial | Hidden cells and the 10 and 3 line are drawn. But the report counts «97 أستاذاً · 61 مؤسسة» while the payload (Insights-optin, Log-insights) carries no teacher or school marker, so the server cannot count them (see Contradictions) |
| R-1.6-14 | The method states that figures describe the plan; never exam scope, ranking or personnel decisions; the IGP is asked to commit in writing | §1.6 l.182–185; §8.4 l.2431–2433 | Obs-Report | designed | — |
| R-1.6-15 | Hosted in Algeria | §1.6 l.186 | Obs-Report | designed | — |
| R-1.6-16 | Protection against fake or flooded submissions: rate limits, outlier filtering and the minimum group size | §1.6 l.187 | none | missing | No board shows rejected or filtered submissions, or how many were left out of a report |
| R-1.6-17 | The IGP receives each report first and has 30 days to comment; publication then follows the method | §1.6 l.190; §8.4 l.2435 | Obs-Report | partial | Only the "sent, no comment yet" state is drawn. No state with an IGP comment received, nor what the observatory does with it |
| R-1.6-18 | Public figures stay coarse and follow a method published in advance | §1.6 l.191 | Obs-Report | partial | The board says «بأرقام خشنة» but the published version of the report is never drawn |
| R-1.6-19 | Counsel confirms before the first collection that teachers may send lesson-level data, and whether publishing needs the Ministry's consent | §1.6 l.192; §8.4 l.2438 | — | n/a (rule) | — |
| R-4.2-22 | Curators record each pack's provenance (issuer as printed, edition, source pages, where found, personal names removed) and its licence mode | §4.2 l.1204–1205 | E-Release | partial | Only the automated check «للحزمة جهة إصدار وطبعة وحالة ونمط ترخيص» is drawn. The editor never shows or edits these fields, the licence mode, or the removal of personal names |
| R-4.2-23 | Curators set each pack's status: Official, In force, Latest found, Stale or Community | §4.2 l.1208–1216 | none | missing | No editor board shows a pack's status, and no pack is flagged Stale (for example 3AP and 4AP, §4.11 l.1423) |
| R-4.2-24 | Pack IDs follow dz.<level>.<grade>.<subject>[.<stream>].<edition> | §4.2 l.1219 | E-Migrate, E-Release | designed | — |
| R-4.2-25 | One release per school year (2026.1), quick fixes as 2026.2, 2026.3 | §4.2 l.1220 | E-Release, E-Migrate | designed | — |
| R-4.2-26 | Item IDs never change meaning: a renamed, split or merged item gets a migration entry, and a retired ID is never reused | §4.2 l.1221; answer 487 | E-Migrate, E-Release | partial | Only a split is drawn as an ID change. No merge and no removal entry. A title change that keeps its ID is shown as a migration entry, which answer 487 says needs none (see Contradictions) |
| R-4.2-27 | Publishing never moves a class: each stays on its pinned release until its teacher moves it, and recorded sessions never change | §4.2 l.1222 | E-Release, Pack-release | designed | — |
| R-4.2-28 | Curators publish a district variant (an inspector's distribution) as a signed layer, credited and used with consent, never labelled official | §4.2 l.1227, l.1235; answers 338, 341 | none | missing | No editor board for a district layer: its ID, the inspector's consent and credit, its operations, signing, and the «تنويع، ليس رسمياً» label |
| R-4.2-29 | On a move, migration entries also carry every layer's operations | §4.2 l.1231–1233 | E-Release | designed | — |
| R-4.2-30 | Progress across a split follows the format: every part is finished when the old item was, skipped when it was skipped; a started item restarts at the first part | §4.2 l.1231–1233; answer 487 | E-Migrate, E-Release | partial | E-Migrate offers the curator a second rule that answer 487 does not allow (see Contradictions). The started-but-not-finished case is not stated |
| R-4.2-31 | When the meaning is not clear, the teacher is asked before the move; the editor never decides it | §4.2 l.1234 | E-Migrate | designed | — |
| R-4.2-32 | A teacher's own list, offered to the data repository, is reviewed as a community pack | §4.2 l.1239; answer 347 | none | missing | No curator board for reviewing an offered list, giving it the Community status, and linking the published pack to the list it came from (answer 347) |
| R-4.3-04 | Upload the PDF: software extracts a draft (rows, weeks, titles), and people retype and check every number and Arabic word against the page images | §4.3 l.1244 | none | missing | No upload or extraction board |
| R-4.3-05 | Fill in the form: items, anchors, budgets and stages; the same form edits every pack | §4.3 l.1245 | none | missing | The editor's «الحزم» tab links to E-Release. No pack list and no item form (kind, title, anchor, budget, stages, source page, textbook page, essential or optional, buffers) |
| R-4.3-06 | A release moves through draft, under review, published, then superseded or withdrawn | §4.3 l.1247 | E-Release | partial | Draft, review and published are drawn; superseded only as a sentence. No withdraw action or withdrawn state |
| R-4.3-07 | The pipeline is run by data curators and subject maintainers (practising teachers of the subject and level) | §4.3 l.1250 | E-Release, E-Migrate | designed | — |
| R-4.3-08 | Inspectors may review a pack, credited only with consent, never presented as official approval | §4.3 l.1251 | E-Release | partial | Only a sentence. No inspector reviewer row, no consent to be named |
| R-4.3-09 | When the IGP joins, it runs the same pipeline through accounts, and its packs carry the status "official" | §4.3 l.1252 | none | missing | No IGP account state in the editor, and no release published as «رسمية» with the IGP's key |
| R-4.3-10 | The teacher council advises on which packs come first | §4.3 l.1253 | — | n/a (rule) | — |
| R-4.3-11 | Automated check: every item cites a source page; every pack has issuer, edition, status and licence mode | §4.3 l.1257 | E-Release, E-Migrate | designed | — |
| R-4.3-12 | Automated check: a week pack has no missing weeks, and each week covers its weekly model | §4.3 l.1258 | none | missing | The drawn pack is a budget pack, so this check never appears. No week-pack example and no failing state |
| R-4.3-13 | Automated check: a budget pack fits the grid's hours across the teaching weeks and the plan's horizon; a plan that cannot fit is a finding to report to the IGP | §4.3 l.1259 | E-Release | partial | The check is drawn passing only. No state for a plan that cannot fit, and no "report to the IGP" finding |
| R-4.3-14 | Automated check: no extraction artefacts, every number typed twice | §4.3 l.1260 | E-Release | designed | — |
| R-4.3-15 | Automated check: every ID change has a migration entry | §4.3 l.1261 | E-Migrate, E-Release | designed | — |
| R-4.3-16 | Human check: a curator and a subject maintainer compare the pack with the page images and last year's release | §4.3 l.1262 | E-Release | designed | — |
| R-4.3-17 | AI helps extract drafts for curators only; model, prompts and location are public; personal names are removed before processing | §4.3 l.1264 | none | missing | No extraction board, so none of this is stated |
| R-4.3-18 | Uploaded files are untrusted: opened in isolation, metadata removed, active content never run | §4.3 l.1266 | — | n/a (rule) | Optional line on the upload board |
| R-4.3-19 | Sources are kept as references, not copies, until counsel clears their text | §4.3 l.1268 | — | n/a (rule) | — |
| R-4.3-20 | Plan-error reports from the field reach the curators with the item ID, release, note and credit choice | §4.3 l.1270; answers 287, 290 | none | missing | The «البلاغات» tab links to E-Release. No board where curators log a report received at contact@djazair.dev, link it to an item, and close it with a release |
| R-4.4-01 | Late July: next year's branch opens and the packs the decisions affect are flagged | §4.4 l.1276 | none | missing | No yearly-cycle view in the editor |
| R-4.4-02 | August keying and drafts to subject maintainers; the September release with status flags and a calendar with the start dates | §4.4 l.1277–1278 | none | missing | Only a quick fix (2026.2) is drawn; no yearly release |
| R-4.4-03 | Quick fixes in the first four weeks | §4.4 l.1279 | E-Release | designed | — |
| R-4.4-04 | The calendar release, and calendar fixes within 24 hours of a communiqué or closure | §4.4 l.1280–1281 | none | missing | No curator calendar board |
| R-4.4-05 | June: error reports and plan feedback are reviewed and next year's work planned | §4.4 l.1282 | none | missing | No board brings reports and the observatory's plan feedback together for curators |
| R-4.4-06 | A curator keys each change by hand, with its source attached | §4.4 l.1284 | E-Migrate, E-Release | partial | Pack changes carry a source («بلاغ من الميدان», «مراجعة المادة»). Calendar and other reference-data changes are not drawn |
| R-4.5-18 | Curators key the national and wilaya layers; every entry carries its source and confidence (announced, expected, projected) and goes out the same day | §4.5 l.1289–1294, l.1315 | none | missing | No calendar editor for curators |
| R-4.7-42 | The engine runs on the device: the editor and server never know a class's progress | §4.7 l.1387 | E-Migrate | designed | — |
| R-4.8-06 | Every reference-data release is signed when published and reaches apps through the data repository or its mirror | §4.8 l.1392, l.1394 | E-Release, Pack-release | designed | — |
| R-4.9-05 | Plan feedback reaches the curriculum designers: items most merged, skipped, split or re-taught, and where a plan is too dense | §4.9 l.1399; §8.4 l.2404–2405 | Obs-Report | designed | — |
| R-4.10-01 | The other reference data (grids, bell times, calendar, coefficients, tests, appreciations, workbook variants, print layouts) go through the same repository and review, each versioned with its source and the dates it applies to | §4.10 l.1404–1417 | none | missing | No editor board for any reference data other than packs |
| R-4.11-07 | Pilot measures: plan errors reported and the time to fix them; time from a communiqué to the calendar fix | §4.11 l.1425 | none | missing | Nothing in the editor records these times |
| R-5.10-01 | Every role is enforced by keys; a role with no key reads nothing, whoever runs the server | §5.10 l.1703 | D-Keys, Ops-Console, D-Exchange | designed | — |
| R-5.10-02 | Director and deputies read the signed weeks, pupil records and each class's live confirmation status, with the school key on their own devices | §5.10 l.1708 | D-Keys, D-Dashboard, D-Record, D-Record-fix | designed | — |
| R-5.10-03 | Timetable preparers hold only the timetable key: timetables and assignments, never pupil records, lesson records or confirmation status | §5.10 l.1709; §7.8 l.2184 | D-Keys, D-TT-proposal | partial | Only described (D-Keys node «مستشار التربية», a sentence on D-TT-proposal). No board shows a preparer's own screen. Every national board uses the director's menu (لوحة المتابعة، سجلات الأقسام، التعويض) |
| R-5.10-04 | The coordinator reads only the statements teachers share, as files, with no account | §5.10 l.1710 | R-Merge, R-Picture, R-Open | designed | — |
| R-5.10-05 | An inspector reads the lesson records of the courses and signed weeks a grant names, only between its dates, never pupil records, through keys shared for the grant | §5.10 l.1711 | M-Grant, I-Grant, D-Keys, D-Exchange | partial | I-Grant has no state for after the end date. The end is only a sentence: «بعد 27/11/2029 لا يصل هذا الهاتفَ جديد» |
| R-5.10-06 | Directorate and Ministry see totals only, above the minimum group sizes, and hold no key to any named record | §5.10 l.1712 | M-Totals, M-Threshold, N-Totals, N-Threshold, D-Keys | designed | M-Grant shows the directorate teacher names (see R-7.14-02 and Contradictions) |
| R-5.10-07 | Whoever runs the server sees nothing named: encrypted records and the minimum metadata | §5.10 l.1713 | Ops-Console, D-Keys | designed | — |
| R-5.10-08 | Totals above the school cover the curriculum report and what the system owes teachers | §5.10 l.1716–1718 | M-Totals, N-Totals | designed | — |
| R-5.10-09 | Never a figure for one school or teacher, a ranking, a count of sessions not held, or anything from the private layer | §5.10 l.1719 | M-Totals, N-Totals, M-Threshold, N-Threshold, Obs-Report | designed | — |
| R-5.10-10 | Each school's share is prepared on a school-key device and combined, so the server learns only totals of at least 10 teachers and 3 schools (wilaya, national) or 5 and 3 (directorate) | §5.10 l.1720 | M-Totals, N-Totals, D-Exchange, Ops-Console | designed | — |
| R-5.10-11 | Totals of how far classes got are formed only on announced days, with no weekly or monthly series | §5.10 l.1721 | M-Totals, M-Threshold, N-Threshold, D-Dashboard | designed | — |
| R-5.10-12 | Exam scope uses only the level that sets the exam; each cut is kept with its figures and published after the exam | §5.10 l.1722 | D-Threshold, M-Threshold, N-Threshold, N-Published | designed | — |
| R-5.10-13 | Access is granted per course and per layer; the private layer is never granted | §5.10 l.1724 | M-Grant, I-Grant, D-Keys | designed | — |
| R-5.10-14 | Every access appears in the teacher's access log | §5.10 l.1725 | I-Grant, M-Grant, D-Issue | designed | D-Substitute shows the director the inspector's last access (see Contradictions) |
| R-6.5-10 | Nobody who runs a server holds a key; the Ministry cannot read named records in the school's space | §6.5 l.1891; §7.5 l.2132 | D-Keys, D-Exchange | designed | — |
| R-6.5-11 | The school key is held by the director and deputies on their devices, and opens the signed weeks, pupil records and confirmation status | §6.5 l.1899 | D-Keys | designed | — |
| R-6.5-12 | The timetable key is held by the director, deputies and preparers, and opens only the timetables and their assignments | §6.5 l.1900; §7.8 l.2184 | D-Keys | designed | — |
| R-6.5-13 | The receiving state system's key opens only what is sent to it | §6.5 l.1902 | D-Exchange | designed | — |
| R-6.5-14 | Each holder device has its own key: a new one is added from a device already set up by a one-time QR, and a lost one is removed | §6.5 l.1906–1908, l.1912 | D-Keys | partial | Only the result is drawn («اليوم، برمز مسحه هاتف الناظر»). The QR on the new device, the approval on the holder's phone, and a confirmation before «إزالة هذا الجهاز» are not drawn |
| R-6.5-15 | In a school space a lost phone doesn't lose the class: the school's copy stays and the school issues a new QR | §6.5 l.1911 | D-Issue | designed | — |
| R-6.5-16 | The school key is held by several staff; its recovery is split between the school and its directorate, so neither opens the records alone | §6.5 l.1912 | D-Keys | designed | — |
| R-6.5-17 | The server sees memberships and encrypted fixed-size batches; no names, no sign-ins and no activity times | §6.5 l.1916; §7.5 l.2128 | D-Keys, D-Issue, D-Exchange | designed | — |
| R-6.5-18 | In a school space a teacher is known by their key and assignment; no real name, password or reset through the director | §6.5 l.1917 | D-Issue | designed | — |
| R-6.7-01 | The server holds only encrypted sync, the school and directorate spaces, the memberships and the totals | §6.7 l.1932–1934 | Ops-Console | designed | — |
| R-6.7-02 | Pack-editor accounts are held on the server | §6.7 l.1935 | E-Release, E-Migrate | n/a (rule) | The project's server is not drawn; editors appear by name on the E boards |
| R-6.7-03 | Problem reports are kept until fixed, 12 months at most; in the national system the Ministry keeps them and forwards them to the project with no names | §6.7 l.1936 | Ops-Console | missing | The operators' map has no node for problem reports, their 12-month limit or the forwarding without names |
| R-6.7-04 | The server installs and updates from the published release, with no internet access | §6.7 l.1938 | Ops-Console | partial | The version is checked against its published fingerprint, but nothing says it was installed offline. The version number is wrong (see Contradictions) |
| R-6.7-05 | No outbound calls except through the interoperability connector | §6.7 l.1939 | Ops-Console | designed | — |
| R-6.7-06 | Runs as containers on ordinary servers | §6.7 l.1940 | — | n/a (rule) | — |
| R-6.7-07 | Admin console, monitoring, backups with regular restore tests, and a deployment guide | §6.7 l.1941 | Ops-Console | partial | Restore tests are shown. There is no monitoring (sync availability, service health) and no link to the deployment guide or administration manual |
| R-6.7-08 | Hosted in Algeria, backups included, encrypted | §6.7 l.1942 | Ops-Console | designed | — |
| R-6.7-09 | Administered by named people only, with two-factor sign-in; every administrative action logged; nobody administers from abroad | §6.7 l.1943 | Ops-Console | missing | The header says only «مشغّلو المنظومة الوطنية». No named operator, no two-factor sign-in, and no log of administrative actions |
| R-6.7-10 | Security logs are kept apart, for the shortest legal time, and never used to measure or judge teachers | §6.7 l.1944 | Ops-Console | missing | No node for security logs. The gateway says it keeps no addresses (see Contradictions) |
| R-6.7-11 | Critical security fixes ship within 7 days and the Ministry deploys them in the same window | §6.7 l.1945 | Ops-Console | designed | — |
| R-6.7-12 | Breach runbook: contain, notify the ANPDP within 5 days, tell affected teachers, record in the breach register | §6.7 l.1946–1951 | Ops-Console | missing | No breach state and no breach register |
| R-6.7-13 | Demands for data are answered only as the law requires; the operator holds no named record it can read | §6.7 l.1952 | Ops-Console | n/a (rule) | — |
| R-7.1-01 | Step 1: directors, coordinators and inspectors open what teachers share, from the pilot, with no accounts and no server copy | §7.1 l.2057 | — | n/a (rule) | Judged with §7.2 and §7.3 in the other parts |
| R-7.1-02 | Step 2: the timetable package is part of teacher mode from the launch, with no account and no server | §7.1 l.2058, l.2061 | D-TT-import, D-TT-change | partial | Drawn in teacher mode («دون حساب · على هذا الجهاز»), but D-TT-import offers «مزامنة مشفّرة», and D-TT-change links «اقتراحات الأساتذة» to the national D-TT-proposal (see Contradictions) |
| R-7.1-03 | Counsel confirms that sending staff data as files needs no further formality | §7.1 l.2058 | — | n/a (rule) | — |
| R-7.1-04 | Step 3: the school's space exists only once the Ministry adopts Minhajna; its screens run under the Ministry's platform | §7.1 l.2059, l.2061 | D-Dashboard, D-Cover, D-Record, D-Record-fix, D-Report, D-Substitute, D-TT-proposal, D-Issue, D-Keys, D-Exchange | designed | — |
| R-7.2-01 | A director, deputy or inspector opens a shared statement by QR code or file, with no account and nothing to enter | §7.2 l.2065 | R-Open | designed | — |
| R-7.2-02 | The reader verifies the signature and shows the statement's date | §7.2 l.2066 | R-Open, R-Picture, R-Spot | partial | Only the valid state is drawn. No failed-check state (answer 489), and no state for a file of another kind or from a newer app version |
| R-7.2-03 | The school's picture: statements side by side by class and subject, with plan position, weeks behind, and sessions lost to calendar and to other causes | §7.2 l.2067 | R-Picture | partial | The figures are all there. But teachers appear by name as if the statement carried it. The unnamed state, the naming step and the line counting left-out statements (answers 489, 490) are not drawn |
| R-7.2-04 | Nothing leaves the reader's device; no copy goes to a server | §7.2 l.2068 | R-Open, R-Picture, R-Spot, R-Merge | designed | — |
| R-7.2-05 | Legal basis: inside the hierarchy, no new formality; counsel confirms | §7.2 l.2069 | — | n/a (rule) | — |
| R-7.2-06 | Spot-check sheet: three random dates from the statement's period; the inspector compares the record with pupils' exercise books | §7.2 l.2070 | R-Spot, I-Grant | designed | R-Spot shows clock times (see Contradictions) |
| R-7.3-01 | The subject coordinator merges the statements the subject's teachers choose to share, for the teaching council | §7.3 l.2074 | R-Merge | designed | — |
| R-7.3-02 | Each class's position against the plan, side by side | §7.3 l.2075 | R-Merge | designed | Draws the plan's position today, which answer 492 leaves out (see Contradictions) |
| R-7.3-03 | The merge prints for the council's register | §7.3 l.2075 | R-Merge | partial | The printed page is described, not drawn. The described page has a school letterhead and keeps a digital copy (see Contradictions). No blank for the meeting day and no box for the coordinator's signature |
| R-7.3-04 | Only what teachers share shows; no accounts, no server | §7.3 l.2076 | R-Merge, R-Picture | designed | — |
| R-7.4-08 | The director or censeur brings in the timetable from FET, from an Excel or CSV template, or by hand with live conflict checks | §7.4 l.2081–2084 | D-TT-import | partial | Only the FET path is drawn. «Excel أو CSV» and «يدوياً» are chips with no state: no template to download, no import errors, no hand-entry grid with live checks |
| R-7.4-09 | Minhajna never builds a timetable automatically | §7.4 l.2085 | D-TT-import | designed | — |
| R-7.4-10 | Checks: clashes of teachers, classes and rooms; each class's hours against the official grid; A/B weeks | §7.4 l.2086 | D-TT-import, D-TT-proposal | designed | — |
| R-7.4-11 | Printouts: class, teacher and room grids with the official header, the A/B week, and signature boxes for the director and censeur (plus the inspector in primary) | §7.4 l.2087 | D-TT-import | partial | A button and one line only. No print preview; the A/B week on the print and the primary school's inspector box are not shown |
| R-7.4-12 | Each teacher receives only their part: signed, stable IDs, no pupil data, the bell times when the school has them; by file or QR, or through the school's space in the national system | §7.4 l.2090 | D-TT-import, D-TT-change | partial | The bell times are never mentioned. The teacher-mode board offers «مزامنة مشفّرة» as a third channel (see Contradictions) |
| R-7.4-13 | A change is a new version with an effective date, next Sunday by default; a one-off change touches only its own date | §7.4 l.2095 | D-TT-change, D-TT-proposal | designed | — |
| R-7.4-14 | A teacher's proposal goes to the director, deputies and timetable preparers; accepting makes a new version; the first decision settles it | §7.4 l.2096; answer 93 | D-TT-proposal | designed | — |
| R-7.4-15 | The effect is previewed before publishing; only the teachers affected are told, in plain words | §7.4 l.2097 | D-TT-change, D-TT-proposal | designed | — |
| R-7.4-16 | The director sees each teacher's receipt, which can replace signing the paper notice | §7.4 l.2098 | D-TT-change, D-TT-proposal, D-TT-import | designed | — |
| R-7.4-17 | Publishing a version never rewrites recorded sessions | §7.4 l.2099 | D-TT-change, D-TT-proposal | designed | — |
| R-7.4-18 | Assignments and weekly hours come from the state's system or FET and are never managed in Minhajna; the package holds staff data but no pupil data | §7.4 l.2102–2103 | D-Issue, D-Dashboard, D-TT-import | designed | — |
| R-7.5-10 | Each school has a space on the Ministry's government servers; the Ministry is the controller | §7.5 l.2108 | D-Exchange, D-Keys | designed | — |
| R-7.5-11 | During the trial term end, taking part is voluntary; the director sees a class whose teacher hasn't joined with its timetable only, marked "not joined"; paper stays official | §7.5 l.2109 | D-Dashboard, D-Issue | missing | No trial state on any director board. Every teacher in D-Issue has joined, and D-Dashboard has no "not joined" row |
| R-7.5-12 | Primary schools have a space like any other school | §7.5 l.2110 | — | n/a (rule) | — |
| R-7.5-13 | The master timetable in the school's space: owned by the director, prepared by the censeur, with versions; others hold a timetable role | §7.5 l.2113 | D-TT-proposal, D-TT-change | partial | No national board for the master timetable. The nav item «استعمال الزمن» on every national board opens D-TT-change, a teacher-mode board dated 2026 (see Contradictions) |
| R-7.5-14 | The director's visa is a comment on a signed week, never an edit; it shows in the teacher's access log; the paper visa stays | §7.5 l.2118; §7.8 l.2176 | D-Record, D-Record-fix, D-Dashboard | designed | — |
| R-7.5-15 | Inspectors' access comes from a grant by the authority, never the director: named courses and weeks, time-limited, lesson records only | §7.5 l.2120; §7.8 l.2185 | D-Substitute, D-Keys, D-Exchange | designed | D-Substitute also shows the inspector's last access date (see Contradictions) |
| R-7.5-16 | The director's screens never show private notes, reasons, the record before signing, confirmation days, clock times, sign-ins, location, or any score or rank of a teacher | §7.5 l.2126–2129 | D-Dashboard, D-Record, D-Record-fix, D-Issue | designed | — |
| R-7.5-17 | Everything in the school's space is encrypted for the teacher and the school, and a granted inspector | §7.5 l.2132 | D-Keys, D-Exchange | designed | — |
| R-7.5-18 | Marks go on to the state's system, absences too where the school chooses; class lists come in from the sector's system | §7.5 l.2133 | D-Exchange, D-Issue | designed | — |
| R-7.5-19 | The school issues security keys to teachers without a smartphone, and replaces a lost one | §7.5 l.2137; §6.6 l.1924 | D-Issue | designed | — |
| R-7.6-05 | Exam thresholds come first: each subject's exams and where each class stood on the announced day | §7.6 l.2143 | D-Dashboard, D-Threshold | designed | — |
| R-7.6-06 | Workload: each teacher's weekly hours from the timetable and the cover they gave, never set against a statutory load | §7.6 l.2144; answer 37 | D-Dashboard | designed | — |
| R-7.6-07 | Sessions awaiting confirmation, for each class | §7.6 l.2145 | D-Dashboard | designed | — |
| R-7.6-08 | Classes behind the plan: position, weeks ahead or behind, buffer used, and sessions lost to calendar and other causes in separate columns | §7.6 l.2146 | D-Dashboard | designed | — |
| R-7.6-09 | On the director's side, "awaiting confirmation" is neutral, opened only by the school key, never printed, exported, totalled or kept as history | §7.6 l.2149–2150 | D-Dashboard, D-Keys | designed | — |
| R-7.6-10 | Classes in the school's order; a filter, never a sort by delay; no ranked teacher list; no colours for people; dates only | §7.6 l.2151–2152 | D-Dashboard | designed | — |
| R-7.6-11 | Nothing from the dashboard feeds pay, promotion, appraisal or discipline | §7.6 l.2154 | D-Dashboard, D-Report | designed | — |
| R-7.7-03 | The director or a deputy marks the sessions that need cover; no reason recorded and no absence counted | §7.7 l.2158–2160 | D-Cover | partial | Three sessions arrive already marked. The marking step behind «تحديد حصص أخرى» is not drawn, and nothing shows a deputy can do it |
| R-7.7-04 | A cover choice for each session, supervision by default: study room, merge, swap or move, free colleague, or letting pupils go after the day's last session | §7.7 l.2161–2166 | D-Cover | designed | — |
| R-7.7-05 | A daily cover sheet for the supervisors, printed or sent; preparers get nothing in that role | §7.7 l.2167; §7.8 l.2180 | D-Cover | designed | — |
| R-7.7-06 | The cover log counts the cover each person gave, to share it fairly; the app suggests, the director decides | §7.7 l.2168 | D-Cover, D-Dashboard | designed | — |
| R-7.7-07 | A make-up is owed only when the teacher marks it or the director asks; the app never decides; pay is settled in the official channel | §7.7 l.2169 | D-Cover, D-Report | partial | Only a make-up already held is drawn. No "ask for a make-up" action for the director, no list of sessions the teachers marked to be made up, no step that links a new session to the one it replaces |
| R-7.8-06 | The director reads pupil records in the signed weeks | §7.8 l.2175 | D-Record-fix, D-Record | partial | Roll call is drawn (D-Record-fix). Marks are named («ويشمل أيضاً المناداة والنقاط») but never shown on a director board |
| R-7.8-07 | The director reads the signed lesson records by class; private notes and reasons are closed to the director and the preparers | §7.8 l.2176–2177 | D-Record, D-Record-fix | designed | — |
| R-7.8-08 | Timetable preparers create and change timetables and see nothing else: no pupil or lesson records, no progress, no cover | §7.8 l.2175–2180, l.2184 | D-Keys | partial | Stated in D-Keys only. No board shows a preparer's space (its menu and what it hides) |
| R-7.8-09 | The director, deputies and preparers each see an access log of their own actions | §7.8 l.2181 | none | missing | No board. D-Keys and D-Exchange say changes are written «في سجل المؤسسة بالتاريخ», but that log is never drawn |
| R-7.8-10 | The censeur holds the school key like the other deputies | §7.8 l.2183 | D-Keys | designed | — |
| R-7.8-11 | Never in Minhajna: evaluating teachers, transfers, approving overtime or pay, links to state platforms outside the interoperability system | §7.8 l.2186 | D-Substitute, D-Exchange | designed | — |
| R-7.9-02 | Directorates have no deployment of their own; they use the national system, like the Ministry | §7.9 l.2190 | M-Totals, M-Threshold, M-Grant | n/a (rule) | All three boards carry "المنظومة الوطنية" |
| R-7.9-03 | Totals above the school are formed so the server never learns a figure for one school or one teacher, and the screens say so | §7.9 l.2191 | M-Totals, N-Totals, M-Threshold, N-Threshold | designed | — |
| R-7.9-04 | Each exam's threshold, for the exams the directorate sets, comes first on its dashboard | §7.9 l.2192; §7.10 l.2238 | M-Threshold, M-Totals | designed | "العتبة" is the first menu item, before "المجاميع" and "أذونات الاطّلاع" |
| R-7.9-05 | The directorate sees what the system owes teachers: cover given, vacant posts, hours without a teacher, sessions lost to closures from the calendar | §7.9 l.2193 | M-Totals | designed | — |
| R-7.9-06 | The curriculum report: sessions per item, items merged, skipped or re-taught, how far classes got by term end, plans that run long | §7.9 l.2194 | M-Totals | designed | — |
| R-7.9-07 | Totals of how far classes got are formed only on announced days (term ends, exam days); no weekly or monthly series | §7.9 l.2195; §7.10 l.2218 | M-Totals, N-Totals, M-Threshold | partial | M-Totals never says its term figures were taken on the term's announced end day. N-Totals does ("أرقامه كما جُمعت يوم نهايته المعلن") |
| R-7.9-08 | A directorate figure covers at least 5 teachers and 3 schools (wilaya or national: 10 and 3); smaller cells are hidden, also from subtraction | §7.9 l.2196; §7.10 l.2213 | M-Totals, N-Totals, M-Threshold, N-Threshold | partial | M-Totals hides a small row and its total excludes it. M-Threshold's breakdown of classes behind the plan (6 and 9 classes) has no size check and no hidden state. N-Totals' note names only the 10-teacher floor, not the 3 schools |
| R-7.9-09 | Never named teachers (except inspectors during a grant), league tables of schools, reasons, or any count of strikes | §7.9 l.2197; §1.11 l.329 | M-Totals, N-Totals, M-Threshold, N-Threshold, M-Grant | partial | M-Threshold's "لا يظهر السبب في السجلات العامة: 9" counts unexplained delays, which reads as teacher absences or strikes (see Contradictions) |
| R-7.10-10 | The threshold is a primary figure on the school's, the directorate's and the Ministry's dashboards | §7.10 l.2201 | D-Dashboard, D-Threshold, M-Threshold, N-Threshold | designed | — |
| R-7.10-11 | The director sees the school's term and mock exams that have a common paper, for every subject | §7.10 l.2207, l.2237 | D-Threshold | partial | D-Threshold covers only "اختبارات الفصل الأول". It has no exam switcher and no school mock exam. The teacher side has one (T-Threshold-moved) |
| R-7.10-12 | Before a school exam only the setters and the director see the cut; deputies see it once it is published; it is published inside the school's space to the subject's teachers at that level and the management team | §7.10 l.2207 | D-Threshold | partial | The board's header is "الإدارة" and shows the open cut. No deputy state hides the cut until it is published. No published state on the director's side |
| R-7.10-13 | A directorate's unified and mock exams: its totals, its committee sets the cut, only the committee and the exams office see it before, published to the public | §7.10 l.2208 | M-Threshold, T-Threshold-totals | partial | Only one mock exam and one subject are drawn. No list of the directorate's exams and subjects with each committee's status. No view for other directorate staff with the cut hidden. No public page for a directorate exam |
| R-7.10-14 | National exams: wilaya and national totals, the Ministry's committee with inspectors sets the cut, only the committee and the exam's organiser see it before, published to the public | §7.10 l.2209 | N-Threshold, N-Published | partial | N-Threshold shows the proposed Arabic cut but never says who is viewing. No view for other Ministry staff with the cut hidden (see Contradictions) |
| R-7.10-15 | Figures days are announced at the start of the year in the calendar of the level that sets the exam; if the exam moves, they move, are announced again at least 2 weeks ahead, and the published page shows both dates and why (non-teacher side) | §7.10 l.2217; §7.10 l.2229 | D-Threshold, M-Threshold, N-Threshold, N-Published | partial | The boards show the announcement dates. No screen lets the director, the directorate or the Ministry announce or move a figures day and a signing deadline. No moved-date state on D-Threshold, M-Threshold, N-Threshold or N-Published. N-Published says the days "لا تتغير بعدها" |
| R-7.10-16 | Above the school, only the exam day's figures shape the cut; term-end totals are shown for comparison only | §7.10 l.2218 | M-Threshold, N-Threshold | designed | — |
| R-7.10-17 | On the announced day the chart shows the share of classes that completed each lesson and marks the last lesson taught in common | §7.10 l.2222 | D-Threshold, M-Threshold, N-Threshold | designed | — |
| R-7.10-18 | The committee chooses the cut and signs it; the system never sets one by itself | §7.10 l.2223 | M-Threshold, N-Threshold | missing | The committee side has no action. Neither board lets a member propose a cut, sign one, or choose no cut. They show only statuses. The school side is drawn on T-Threshold |
| R-7.10-19 | A school's cut applies once every setter has signed; the signing deadline is announced with the figures day; after it, or if a setter chose no cut, the director decides | §7.10 l.2224 | D-Threshold | designed | — |
| R-7.10-20 | In a committee the majority decides | §7.10 l.2225 | M-Threshold, N-Threshold | designed | — |
| R-7.10-21 | Each signed cut is kept with its figures and published after the exam: the cut, its date, the figures used and how the setters shaped the exam, in their own words | §7.10 l.2226, l.2230 | N-Published, M-Threshold, D-Threshold | partial | Only the Ministry's page is drawn. No public page for a directorate exam. No screen where a committee writes how the cut shaped the exam |
| R-7.10-22 | Inspectors' sample checks the figures; results are published with them as totals only; a year without the sample publishes the figures as unchecked | §7.10 l.2231; §8.5 l.2445–2446 | M-Threshold, N-Threshold, N-Published | partial | No "unchecked" state on any of the three boards |
| R-7.10-23 | The director's dashboard opens with the school's thresholds: where each class stood, each class's plan up to the exam as a forecast, and the setters' signatures | §7.10 l.2237 | D-Dashboard, D-Threshold | designed | Mock exams are in R-7.10-11 |
| R-7.10-24 | The directorate's dashboard puts the threshold first: share per lesson on each announced day, the committee's cut and signatures, and sessions lost to closures from the public calendar | §7.10 l.2238 | M-Threshold, M-Totals | designed | — |
| R-7.10-25 | The Ministry sees the national curve with the wilayas as a range, never named or ranked, each subject's committee and its signatures, and the inspectors' sample | §7.10 l.2239 | N-Threshold, N-Published | partial | N-Published's CSV is "لكل مادة وبند وولاية", which names the wilayas (see Contradictions). N-Threshold shows signature counts only, with no members, where M-Threshold lists them |
| R-7.10-26 | Never a ranking of classes, schools or wilayas, a figure for one teacher, or personnel use (non-teacher boards) | §7.10 l.2240 | D-Threshold, M-Threshold, N-Threshold, N-Totals | designed | The named-wilaya CSV is in R-7.10-25 |
| R-7.10-27 | Each chart has a table of the same figures; published directorate and national reports carry only totals and are rendered on the server | §7.10 l.2242 | D-Threshold, M-Threshold, N-Threshold, N-Published | partial | N-Published's Arabic chart has no table view, only "SVG" and the full CSV |
| R-7.11-01 | A space for each school and one for each directorate, in one national system | §7.11 l.2246 | D-Dashboard, M-Totals, Ops-Console | designed | — |
| R-7.11-02 | A school's space can be exported whole | §7.11 l.2246 | D-Exchange | missing | No board has a way to export the whole school space |
| R-7.11-03 | The school key is held by the director and the deputies, on their devices | §7.11 l.2247 | D-Keys | designed | — |
| R-7.11-04 | Recovery is split between the school and its directorate, so neither opens the records alone | §7.11 l.2247 | D-Keys | designed | — |
| R-7.11-05 | Timetable helpers hold a timetable key that opens nothing else | §7.11 l.2247 | D-Keys | designed | Their own screen is missing (R-5.10-03) |
| R-7.11-06 | Nobody who runs the servers holds a key | §7.11 l.2247 | Ops-Console, D-Keys | designed | — |
| R-7.11-07 | The project only publishes the software; it never sets purposes and holds no records | §7.11 l.2248 | Ops-Console, D-Dashboard | n/a (rule) | The boards carry «[اسم منصة الوزارة]» and «الإصدار … من المشروع» |
| R-7.11-08 | Paper stays official until the Ministry's text, then only as the fallback | §7.11 l.2249 | D-Record | designed | — |
| R-7.11-09 | Ready-made documents: register of processing, impact assessment, charter, security design, deployment guide, administration manual | §7.11 l.2250–2255 | — | n/a (rule) | — |
| R-7.12-01 | The ministerial text making the digital record official | §7.12 l.2260 | — | n/a (rule) | — |
| R-7.12-02 | Declared recipients: director and deputies, timetable helpers for timetables only, inspectors during a grant, the state systems for marks and absences | §7.12 l.2263 | D-Keys, D-Exchange | designed | — |
| R-7.12-03 | The declared purposes exclude evaluation | §7.12 l.2262 | D-Dashboard, D-Substitute, M-Totals | designed | — |
| R-7.12-04 | Retention: for example 3 years for the signed weeks | §7.12 l.2264 | D-Keys | designed | — |
| R-7.12-05 | A data-protection officer, the security unit and an impact assessment | §7.12 l.2266–2267 | — | n/a (rule) | — |
| R-7.12-06 | The state's digital rules: data catalogue, interoperability access, ANPDP authorisation, HCN review | §7.12 l.2268 | Ops-Console, D-Exchange | n/a (rule) | Screens already route everything through the connector |
| R-7.12-07 | No personal phone required (school side: security keys issued to teachers) | §7.12 l.2269 | D-Issue | designed | — |
| R-7.12-08 | The launch gate: national load test, trial term end, security review, full restore | §7.12 l.2270 | Ops-Console | n/a (rule) | — |
| R-7.13-01 | Pilot: reader mode and the coordinator's merge | §7.13 l.2276 | R-Open, R-Picture, R-Spot, R-Merge | designed | — |
| R-7.13-02 | Launch: the timetable package | §7.13 l.2277 | D-TT-import, D-TT-change | designed | — |
| R-7.13-03 | After adoption: school spaces, a trial term end, then the mandate | §7.13 l.2278 | D-Dashboard | partial | No director board shows the trial term end: classes whose teacher has not joined, shown with their timetable only, and paper still official |
| R-7.14-01 | A class not shared shows as not shared | §7.14 l.2292 | R-Picture | designed | — |
| R-7.14-02 | Directorate figures cover at least 5 teachers and 3 schools; never named teachers, except for inspectors in their scope | §7.14 l.2293 | M-Totals, M-Threshold, M-Grant | partial | M-Grant shows the directorate's staff each class's teacher by name (see Contradictions) |
| R-7.14-03 | The censeur holds the school key with the deputies; preparers hold only a timetable role | §7.14 l.2300 | D-Keys | designed | — |
| R-7.14-04 | A teacher's timetable proposal goes to the director, the deputies and the preparers; accepting it makes a new version | §7.14 l.2331 | D-TT-proposal | designed | — |
| R-7.14-05 | Before the exam, only the setters and the director see a school's cut | §7.14 l.2332 | D-Threshold | designed | — |
| R-7.14-06 | Dashboards put the threshold first, for the school, the directorate and the Ministry | §7.14 l.2325 | D-Dashboard, M-Threshold, N-Threshold | designed | — |
| R-7.14-07 | Open: whether reader mode and the timetable package need any formality | §7.14 l.2337 | — | n/a (rule) | — |
| R-8.1-01 | The state runs the administrative backbone (assignments, absences, marks, parents' space); Minhajna complements it and covers only the lesson record | §8.1 l.2355–2370 | — | n/a (rule) | None of the boards above the teacher duplicates a state function |
| R-8.1-02 | Teachers' attendance belongs to HR and payroll; screens above the teacher never count a teacher's absences | §8.1 l.2360 | M-Totals, N-Totals, M-Threshold | designed | "لا من غياب أحد", "ولا يدخل هنا غياب أحد ولا سببه" |
| R-8.2-01 | Files only until an agreement; no connectors to ostad or amatti, never teachers' passwords; automated links only through the interoperability connector | §8.2 l.2375–2378 | — | n/a (rule) | — |
| R-8.2-02 | Outputs, never a tracker: the Ministry runs the servers but cannot read named records, and above the school there are only totals | §8.2 l.2379; §8.7 l.2478 | M-Totals, N-Totals, M-Threshold, N-Threshold, M-Grant | designed | "فلا يعرف الخادم رقماً لقسم أو لمؤسسة أو لأستاذ", "لا تحمل المديرية مفتاح أي مؤسسة، ولا تفتح سجلاً مسمّى" |
| R-8.2-03 | Every agreement is public; the state may fork; watch what the state ships and respond | §8.2 l.2380–2388 | — | n/a (rule) | — |
| R-8.3-01 | The offer: four open formats, the national system as the first ask, code and material free; the project sells nothing | §8.3 l.2392–2397 | — | n/a (rule) | No price appears on any board read |
| R-8.3-02 | IGP packs published through Minhajna carry the status "official" | §8.3 l.2393 | Pack-release | designed | — |
| R-8.4-05 | A class leaves the observatory as soon as its school's space opens | §8.4 l.2401 | none | missing | Obs-Report never says classes in a school space are left out of its counts |
| R-8.4-06 | The report answers four questions for the IGP and curriculum designers, including "did this year's changes to a plan help?" | §8.4 l.2403–2407 | Obs-Report | partial | Three questions are answered. No comparison with the previous release or year |
| R-8.4-07 | Each indicator shows its number of classes and the self-selection note | §8.4 l.2417 | Obs-Report | designed | — |
| R-8.4-08 | Median sessions spent on each item, for each pack | §8.4 l.2418 | Obs-Report | partial | Rows are plan weeks, not the pack's items, and only the release «2027.1» shows, not the pack ID (see Contradictions) |
| R-8.4-09 | Items most often merged, skipped, split or re-taught | §8.4 l.2419 | Obs-Report | designed | — |
| R-8.4-10 | How far classes got by the end of each term, as a median and a spread | §8.4 l.2420 | Obs-Report | designed | — |
| R-8.4-11 | Sessions lost to closures by wilaya, from the public calendar, never from teachers' entries | §8.4 l.2421 | Obs-Report | partial | The heading counts sessions, but the column counts days: «أيام لكل قسم» |
| R-8.4-12 | Shares near 0% or 100% in small cells are shown in bands; sparse cells are pooled across years | §8.4 l.2426 | Obs-Report | partial | Bands are drawn. Pooling sparse cells across years is not |
| R-8.4-13 | The pilot's data-quality audit compares logs with exercise books, and entries before and after a director could see them | §8.4 l.2439 | — | n/a (rule) | — |
| R-8.5-01 | Before adoption, a protocol: inspectors compare exercise books with the texts book in a random sample of classes, twice a year; the reader's spot-check sheet supports it | §8.5 l.2443, l.2447 | R-Spot | partial | R-Spot picks three random dates within one class. Nothing draws the random choice of classes, or the twice-yearly round |
| R-8.5-02 | In the national system the sample checks the totals and every threshold | §8.5 l.2444 | M-Threshold, N-Threshold, N-Published, I-Grant, M-Grant | partial | The sample's totals are shown, but no screen records one class's result (matched, behind, ahead) or turns results into totals. I-Grant says the sheet "لا تُرسل إلى أي جهة". M-Grant picks classes by hand, with no random draw |
| R-8.5-03 | Honest expectations: covering the plan is not learning | §8.5 l.2448 | — | n/a (rule) | — |
| R-8.6-01 | Teacher mode only until the Ministry's system opens; no school or directorate deployments before adoption | §8.6 l.2454–2460 | — | n/a (rule) | Every board above the teacher is a national-system screen |
| R-8.7-01 | Hosting on state infrastructure, with no internet and no outbound calls except through the connector | §8.7 l.2473 | — | n/a (rule) | — |
| R-8.7-02 | The Ministry's app is the project's release, with the Ministry's name and icon as settings | §8.7 l.2479 | M-Totals, N-Totals, M-Threshold, N-Threshold, N-Published, M-Grant | designed | The name is the slot "[اسم منصة الوزارة]" |
| R-8.7-03 | Official records, Ministry maintainers, teachers consulted first, the launch gate, paper as fallback | §8.7 l.2471–2482 | — | n/a (rule) | — |
| R-8.8-01 | The observatory's figures never inform exam scope; in the national system exam scope follows charter point 7 at each exam's own level | §8.8 l.2522; §7.10 l.2214 | M-Totals, N-Totals, M-Threshold, N-Published | designed | "ولا تُستعمل هذه المجاميع لعتبة امتحان", "لا شيء من المشاركة الطوعية" |
| R-8.8-02 | Open points: an IGP contact, the Tarbya-Up call, consent for publishing figures, the AGPL in a state deployment | §8.8 l.2526–2531 | — | n/a (rule) | — |

## Above the teacher, added by the fix batches

Requirements above the teacher that a fix batch added with its screens. They count with audit E, not in the teacher's totals.

| ID | Requirement | PRD | Screens | Coverage | What is missing or wrong |
|---|---|---|---|---|---|
| R-7.9-01 | The Ministry sees its totals: what the system owes teachers (cover given, vacant posts, weekly hours without a teacher, sessions lost to closures) by named wilaya, in the official order and never sorted, and the curriculum report with the wilayas only as a range (all of them, and the middle half), never named or ranked. Only on announced days; each figure covers at least 10 teachers and 3 schools, and smaller cells are hidden, also from subtraction | §7.9; §5.10; answer 539 | Batch 3: N-Totals | partial | N-Totals hides a wilaya under 10 teachers only («تُخفى الولاية التي فيها أقل من 10 أساتذة لها»); it must also hide one under 3 schools (audit E, R-7.9-08) |

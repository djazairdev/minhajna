# Changelog

What changes for teachers in each release of Minhajna, newest first. How these notes are written is in [releases.md](docs/contributing/releases.md#the-changelog).

## Unreleased

لم تُنشر هذه التغييرات بعد.

### Fixed · إصلاحات

- In session details, the screen reader now says that a private note stays on your devices when you enter its field.
- في تفاصيل الحصة، يقرأ قارئ الشاشة الآن أن الملاحظة الخاصة لا تغادر أجهزتك عند الانتقال إلى خانتها.

## 0.1.0 (2026-10-18)

The field-check preview: setup, Today and the roll call, for trying the app with made-up pupils only. It is handed over directly as an APK, not through a store.

### New

- Setup now starts after the privacy notice: pick your levels and subjects, two subjects included, and name your school. A teacher in more than one school adds each one, with its own levels and subjects. Every choice is saved on this phone as you make it.
- Setup now asks for each school's wilaya, from the list of 69 in Law 26-06. Find it by name or number. It picks your wilaya's dates in the calendar and never leaves this phone.
- Setup's third step adds your classes and lets you type each class's list: name, sex and, if you have it, the registration number. Each pupil is saved as you add them, the list is sorted alphabetically, and a class can be any size. This trial version asks for made-up names only.
- Setup can add a demo class of 45 pupils with made-up names, for trying the app, taking screenshots or reporting a problem without real pupils' names.
- A primary teacher can add a joint class: two or three years in one room, each on its own plan. Each pupil's year is chosen as the list is typed, each year gets its own pack at the plan step, Today shows each slot as one card with every year's proposal, confirmed in one tap, and the Classes tab gives each year its row.
- Setup's fourth step draws your week by hand: pick a class, or your own time, and tap its slots. Saturday and a fifth morning slot can be added, each class's sessions are counted, and a changed week starts on the day you draw it, without changing any recorded session.
- A slot of your week can now hold a half-group, alternate between A and B weeks, name its subject and room, or hold your own time, such as a pedagogical half-day or hours in another school. Each subject of a class keeps its own plan and book, and clashes are named.
- Your week can now follow a double shift, mornings one week and afternoons the next. If you teach in two schools, each class shows its school, sessions are counted by school, and clashes are outlined and listed, with a button that opens the slot to settle them.
- Each slot of your week now has its time at the school, from the level's usual hours. You can set any slot to match your school's bell. In Ramadan, taken from the calendar, sessions keep their places and start times and are shortened, and your timetable stays as it is.
- Setup now ends with your plan: for each grade and subject, the pack your classes are pinned to, its status, release and source, or typed items when there is no pack. Each class stays on its release until you choose another. The national calendar is built in.
- Setup now ends on a summary of what it kept and the September check. For each class, it shows the sessions your timetable and the calendar give before the term's exams, those the plan needs, and guided work counted apart. The gap is shown as spare sessions for remediation, or as sessions short of the plan. Then comes your next session, with what the plan proposes.
- Today lists the day's sessions in order. The next one shows what the plan proposes, in pencil, and one tap on «Done as proposed» records it. Nothing is recorded before that tap, and «Undo» brings back what was there.
- «Another outcome» on Today records how a session really went, in two taps: the last stage reached, an item still going on or finished, merged with the next one, a skipped lesson, a lesson taught again, or a session not held. A reason for a skip or a session not held is optional and stays on the teacher's devices.
- «Another outcome» names the session where what is left goes on, by its day, and says how many sessions an item without stages has taken. A session not held can be marked to be made up.
- «Session details» on Today records a session in full, in one step: its type, the stages covered, content from outside the plan, homework with its due day, a test, a line for the texts book, and a private note that never leaves the teacher's devices. The row the texts book will take is shown as it changes.
- «Change the lesson» in a session's details writes another item of the plan instead of the proposed one, teaches an earlier item again, or writes content from outside the plan. The plan around the class shows the day each item was taught or would be reached, and the proposed item stays first for next time.
- «Correct» on a recorded session opens its details as they were recorded. A correction keeps the first version, can take a detail out, carries an optional coded reason, and lists what the activity log will add, by day. The words of a reason of the teacher's own stay on their devices.
- Today lists the earlier sessions still awaiting confirmation, a week at a time, and confirms them as proposed in one tap. A tap leaves a session out, so its other outcome or its details can be recorded with the day it was taught.
- Today marks holidays, closures and exam weeks with their name. The sessions a holiday takes are counted apart, never as slow teaching; in an exam week the plan pauses; and the next session is shown.
- «Roll call» on a session's card on Today opens its roll call: everyone is present, a tap marks an absence or a lateness, and one save records them; a past session is entered from the paper sheet on its own date, and a roll call already taken is corrected with a reason.
- «Enter a roll call from the paper sheet» in Today's earlier sessions lists the past sessions whose roll call is not recorded; each opens its roll call, recorded on the session's own date.
- On a roll call already taken, a pupil's name opens its correction: the mark it becomes, present, late or an absence justified or not, with a coded reason and the month's totals before and after. «Counting rules» sets the day counting starts and whether training days and sessions not held count.
- «Add or move» records a pupil who joins the class, at the end of the list from their day, or who leaves it, with the day and a coded reason. A pupil who leaves stays on the roll call with a note until the director's confirmation is recorded, and numbers stay as on the paper book.
- «Arrange the seats» draws a class's or group's room once, with its rows, seats and aisles, and places each pupil on a seat. Pupils can be placed in list order, moved or swapped. Each change is saved at once and stays on the teacher's devices.
- The roll call can be taken on the seating plan. A tap on a seat marks an absence, a second a lateness, a third the pupil present again, the same marks as the list.
- The Classes tab shows each class with its pupils, its first session today and where it stands against the plan, in sessions: the buffers used first, then any delay beyond them, or the spare sessions before the next exams.
- «Plan» on a class opens its plan item by item: the days each item was taught or would be reached, its stages, where the class is, and where the plan places it, as a reference only, with the sessions left before the exams.
- The app says it is a preview, for trying it with made-up pupils only. Help shows its version and the checksums of the app and of its signing certificate, so you can check that it is the project's preview.
- Help now shows the app's licence and all bundled notices offline. Opening the public source in your browser requires your confirmation.
- Android downloads come as a universal package that installs on any phone, and a smaller package for each phone processor type.

### Privacy

- Before first use, a new welcome shows the app's promises, and a privacy notice says what the app keeps and where: everything stays on this phone, and this version never connects to the internet. The notice, and what the app connects to, stay available in Help.
- Setup's second step is the teacher card, the details the documents print. Your name is optional and personal: it stays on this phone, out of every sync, export and share, and only the documents you make here print it.
- Reading licence notices stays offline. Only after a separate confirmation can the app hand the public source address to your browser, which may connect to GitHub; no record or identifier is attached.

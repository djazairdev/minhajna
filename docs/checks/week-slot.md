# One slot of the week (#28)

Checks of 17 October 2026 for the third pull request of [#28](https://github.com/djazairdev/minhajna/issues/28), on `feat/28-slot`, after Setup-5-Week and Week-draw (#147). Made-up schools and classes only.

## What changed

- **Week-slot** opens over the drawing when a slot is tapped with the «تفاصيل الخانة» pen. The slot holds one thing every week, or one in A weeks and another in B weeks (R-3.2-19, R-4.6-02). Each thing is one of two kinds:
  - **A class session,** with:
    - its class;
    - its subject, when the school has two (R-3.2-23). Each subject of a class is its own course, with its own plan and book (R-4.7-01);
    - its group: the whole class, «الفوج 1» or «الفوج 2» (R-3.2-20). A class gets its two half-groups the first time one is chosen;
    - an optional room;
    - a line that sums it up, such as «4م1 كله، كل أسبوع.».
  - **The teacher's own time** (R-3.2-25, R-4.6-07), with:
    - its kind: pedagogical half-day, hours in another school, duty, or reduction;
    - whether it takes the whole half-day.
- **Warnings.** When the slot meets something in a week they share, a warning names each clashing slot and what is in it. The line under the grid counts the clashes.
- **Buttons.** «حذف الخانة» empties the slot. «حفظ» hands the drawing its new version, saved as before. «إغلاق» keeps nothing.
- **The grid** shows each thing in a slot on its own line, such as «4AM3 ف1 (أ)», and TalkBack reads it in full: «4AM3، الفوج 1، الأسبوع أ».
- **Bidi.** Class names in the cells and in the summary are isolated, so a Latin name keeps an Arabic line right to left.
- **One save, one record.** Courses and half-groups made while drawing are kept until the history has them, so two things saved together make one course or one pair of half-groups.
- **Chips for now.** The choices use chips until SegmentedControl (#136) exists.

The double shift and the merged week of two schools come in the next pull request.

## Checks

| Check | Result |
|---|---|
| Android tests | 552 pass, 15 of them new: the slot rules (reading a slot, an A/B pair of two subjects replacing only that slot, own time over a half-day and clearing it, half-groups made once), a course by subject, and Week-slot through the drawing (half-groups in alternate weeks with one course, a second subject with a room, a half-day of own time with its clash warning, removing and closing, and every choice named and 48dp in the three languages and both directions) |
| Core tests | Unchanged and passing |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Monday's first slot was set to 4AM3's first half-group in A weeks and its second in B weeks. The cell showed «4AM3 ف1 (أ)» over «4AM3 ف2 (ب)», and the totals counted 4AM3 as 3. A pedagogical half-day on Sunday morning warned «تعارض في الحصة 1 صباحاً: 4AM3، نصف يوم بيداغوجي», and the line under the grid read «تعارض واحد في الأسبوع». All of it was still there after the app was restarted |

## Still to do by a person

TalkBack in Arabic on these screens, with the other setup screens (see the BrowserStack note on #20).

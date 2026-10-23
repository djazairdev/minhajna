# Appreciations (#241)

Checks of 23 October 2026 for [#241](https://github.com/djazairdev/minhajna/issues/241), on `feat/241-appreciations-core` and `feat/241-appreciations-screen`. Made-up classes and records only.

## Part 1: the list and the record (#421)

- **The list** (R-3.6-01 to R-3.6-06, answer 465): circular 244's list was not found, so `data/dz/appreciations.json` is Minhajna's interim list, release 2026.1, with its source. It holds five bands of the term average out of 20, from 0 to 20, 18 phrases in Arabic, each with its band and, for some, good conduct or a concern, and the banned phrases, «يوجه إلى الحياة العملية» first. The phrases never address the pupil, so they suit girls and boys alike.
- **The reader:** the bands cover 0 to 20 with no gap or overlap, each with a phrase for any conduct. Every phrase has an ID of its own, a known band and Arabic text, and no phrase holds a banned one. Banned phrases are compared without diacritics, tatweel or the hamza on alef, and a banned entry with no letters is refused.
- **The band and the suggestion:** a pupil's band comes from their average, with primary's out of 10 doubled. A value a hair under a bound counts at that bound. With conduct, the phrases for a concern or for good conduct come first.
- **Conduct:** the term's unjustified absences and lateness, from the roll-call book, and its behaviour taps, as counts only. Conduct is a concern from 3 absences, 3 lateness marks or 2 behaviour taps.
- **The record:** the phrase chosen, with its ID, Arabic text and the list's release, for each pupil, course and term. The last one counts and it can be cleared. It travels with the pupil records, and two devices that chose differently conflict for that pupil only. The core also gives the pupils on a list who still have none, which the export (#242) waits for (R-3.6-07).

| Check | Result |
|---|---|
| Core tests | The list read, and each field refused on its own, a banned phrase written with diacritics, tatweel and plain alef included; the bands, primary's doubled and a value a hair under a bound; the suggestions by the average alone and with conduct; a term's counts from the roll-call book and behaviour taps; the last phrase kept, a cleared one left out, the pupils still without one, and the routes the phrases travel by; a conflict per pupil. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator | Not run: nothing on screen changes until the screen's pull request. |

## Part 2: «التقديرات» on the screen

- **The hub** (Apprec, answer 465): in a term with a grade book, «التقديرات» follows «كشف النقاط», with «0 من 36 مختارة». It is not shown in a term whose marks observations replace.
- **The screen:** «التقديرات · 4م1 · اللغة العربية · الفصل الأول», how many pupils have a phrase, «اقتراح العبارة حسب» «المعدل وحده» or «المعدل والسلوك والمواظبة», then one pupil at a time in list order:
  - the average with two decimals. When it shows at a band's bound that it does not reach, the full value is added: «المعدل 10.00، والقيمة الكاملة 9.995»;
  - with conduct, the term's counts, «في الفصل: لا غياب · لا تأخر · ملاحظتا سلوك»;
  - the suggestion in pencil, its tag and «تأكيد المقترح»;
  - «عبارات أخرى من القائمة», each with «استعمال هذه العبارة», and «عرض القائمة كاملة»;
  - the list's note and release, and «لا تعبئة جماعية».
- **Choosing:** a phrase chosen is recorded at once and the screen moves to the next pupil without one, and then to «اكتملت التقديرات». Once every pupil has a phrase, a change made during «مراجعة العبارات» moves on to the next pupil. The phrase shows as «مختارة: …». A phrase that only repeats the mark keeps the screen on that pupil and shows a warning, and «مسح العبارة» clears it. A pupil with no average gets no suggestion and the whole list. The choice between the average alone and conduct belongs to the visit and is not recorded.
- **Archived:** a class archived after the reshaping shows its phrases without choices.

| Check | Result |
|---|---|
| Android tests | The hub's row and its count; the screen's line, suggestion and note; confirming, using another phrase and moving on to «اكتملت التقديرات»; the full value at 9.995; a change during review; a phrase that restates the mark, kept on the pupil with its warning, and clearing; by conduct, the counts and the phrase for a concern first; the whole list for a pupil with no average; an archived class; no row in 1AP's first term, a row in its second; every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, the only class on the emulator, on Friday 23 October:<br>• «التقويم والنقاط» showed «التقديرات», «0 من 45 مختارة», after «كشف النقاط».<br>• The screen read «التقديرات · القسم التجريبي · اللغة العربية · الفصل الأول» and «0 من 45 مختارة». The first pupil had no average yet, so it showed «لا معدل بعد، فلا اقتراح…» and the whole list, each phrase with «استعمال هذه العبارة».<br>• Using «عمل مقبول، يُنتظر مضاعفة الجهد» moved on to the second pupil, with «1 من 45 مختارة». «السابق» showed «مختارة:» with the phrase, and «مسح العبارة» brought the count back to «0 من 45 مختارة».<br>• «المعدل والسلوك والمواظبة» showed the note and «في الفصل: لا غياب · لا تأخر · لا ملاحظة سلوك». The list's note and release, «لا تعبئة جماعية», «السابق» and «التالي» were at the foot.<br>• No pupil of the demo class has an average, so the suggestion, «تأكيد المقترح» and the full value were checked in the tests only. |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the hub's row, the choice of suggestion, the pupil's average and counts read together, the suggestion with its tag, and each phrase of the list with «استعمال هذه العبارة».
- **On a phone in French and English:** the screen, with the Arabic phrases.
- **With a teacher:** choosing the appreciations of a real class's term, and saying whether the interim list's phrases and the conduct suggestion are useful.

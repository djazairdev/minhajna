# The demo class (#27)

Checks of 17 October 2026 for the second pull request of [#27](https://github.com/djazairdev/minhajna/issues/27), on `feat/27-demo`. Made-up pupils only.

## What changed

- **The core** holds the demo class's 45 made-up pupils (PRD §1.5), in `packages/core/src/demo-pupils.ts`.
  - Common Algerian given names and family names put together at random, written family name first, in Arabic and in Latin letters.
  - Long names such as «بن عبد الرحمن فاطمة الزهراء», names with a hamza, and pupils who share a family name, so nothing is told apart by name.
  - Registration numbers start with 99, which no school gives out.
  - `SchoolClass.demo` marks the class.
- **Setup-4-Classes** offers «إضافة القسم التجريبي» until there is a demo class. It opens the add-class form with the name «القسم التجريبي» filled in and a note on what the class is for; the teacher picks the year. The class and its 45 pupils are saved together. In field-check builds, pupils come from this class or are typed as made-up names (choice F1, #49).

## Checks

| Check | Result |
|---|---|
| Core tests | 186 pass, 3 of them new: 45 distinct pupils of both sexes in both scripts, long names, hamzas and shared family names, and IDs and 99 numbers unique within the class |
| Android tests | 505 pass, 2 of them new: the demo class added once with its 45 pupils, and a usual class added without pupils; the named-controls check also opens the demo form, in the three languages and both directions |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | «إضافة القسم التجريبي» opened the form with the name filled in; the class was added in first year and showed «45 تلميذاً» and «القائمة جاهزة», and the offer disappeared. Its list opened sorted with the 99 numbers. The class and its pupils were still there after the app was restarted |

## Still to do by a person

TalkBack in Arabic on this step, with the other setup screens (see the BrowserStack note on #20).

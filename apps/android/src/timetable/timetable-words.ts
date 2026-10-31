// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words a timetable file may use (#576, answer 592), from all three of the
// app's catalogues at once, so a template or a FET export prepared in any of
// the app's languages reads, whatever language the screen is in: each
// column's names, the weekdays, weeks A and B, and the words that mark a
// group, each catalogue giving its words separated by a bar. The bell times
// of the school's level give FET's numbered hours their times.

import {
  clockMinutes,
  TIMETABLE_COLUMNS,
  type BellData,
  type BellTimes,
  type FetWords,
  type TimetableColumn,
  type TimetableWords,
  type Weekday,
} from '@minhajna/core';
import ar from '../text/ar.json';
import en from '../text/en.json';
import fr from '../text/fr.json';

const CATALOGUES = [ar, fr, en];

const split = (words: string) =>
  words
    .split('|')
    .map((word) => word.trim())
    .filter((word) => word !== '');

/** The template's words, in every language the app speaks. */
export function timetableWords(): TimetableWords {
  const columns = Object.fromEntries(
    TIMETABLE_COLUMNS.map((column) => [
      column,
      CATALOGUES.flatMap((one) => [...split(one.ttImport.words[column]), one.ttImport.column[column]]),
    ]),
  ) as Record<TimetableColumn, string[]>;
  const days: Partial<Record<Weekday, string[]>> = {};
  for (const day of [0, 1, 2, 3, 4, 5, 6] as const)
    days[day] = [...new Set(CATALOGUES.map((one) => one.week.days[String(day) as keyof typeof one.week.days]))];
  const weeks = {
    A: [...new Set(CATALOGUES.flatMap((one) => split(one.ttImport.words.weekA)))],
    B: [...new Set(CATALOGUES.flatMap((one) => split(one.ttImport.words.weekB)))],
  };
  return { columns, days, weeks };
}

/** FET's words: the days, and the words that mark a group, in every language the app speaks. */
export function fetWords(): FetWords {
  return {
    days: timetableWords().days,
    groups: [...new Set(CATALOGUES.flatMap((one) => split(one.ttImport.words.groups)))],
  };
}

/** The usual bell times of a level's school day, morning then afternoon, the first for hour 1. */
export function levelBells(bells: BellData, level: string): BellTimes {
  const template = bells.templates.find((one) => one.level === level);
  if (template === undefined) return [];
  return [...template.morning, ...template.afternoon].map(
    (span) => [clockMinutes(span.from), clockMinutes(span.to)] as const,
  );
}

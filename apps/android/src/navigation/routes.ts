// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The app's routes and their parameters, which carry IDs and days only,
// never record contents.

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { LockPinMode } from '../lock/LockPin';
import type { SecurityDone } from '../lock/Security';
import type { Cell } from '../week/week-rules';

/** Routes contain no record contents; persistence, URL linking and tracking remain unconfigured. */
export type HomeTabParamList = { Today: undefined; Classes: undefined; Documents: undefined };
/** Inner pages cover the tabs and carry no record contents. The gallery and the storage check exist in debug builds only. */
export type RootStackParamList = {
  Welcome: undefined;
  Privacy: undefined;
  Teaching: undefined;
  Card: undefined;
  Classes: undefined;
  TypeList: { classId: string; name: string };
  Week: undefined;
  WeekDraw: { slot?: Cell } | undefined;
  Times: undefined;
  Plan: undefined;
  Packs: { grade: string; subject: string };
  Ready: undefined;
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  Gallery: undefined;
  StorageCheck: undefined;
  Help: undefined;
  PrivacyNotice: undefined;
  Connections: undefined;
  Licences: undefined;
  LicenceNotice: { name: string };
  Entry: { key: string; day: string };
  Class: { courseId: string };
  /** The roll-call book of a class's course, on a month written YYYY-MM or `year`; the latest month when none. */
  RollMonth: { courseId: string; month?: string };
  /** A pupil in the roll-call book of a class's course, on a month written YYYY-MM or `year`. */
  Pupil: { courseId: string; pupilId: string; month?: string };
  /** The texts book's corrections, for the director: a month written YYYY-MM and a class, or this month and all. */
  BookFixes: { month?: string; classId?: string } | undefined;
  RollPrint:
    | {
        courseId?: string;
        month?: string;
        day?: string;
        /** The slip's roll call, by its unit key. */
        unit?: string;
        /** The class to open on when no course is given, and its one plan to print. */
        classId?: string;
        plan?: string;
        choice?: 'spread' | 'year' | 'front' | 'day' | 'slip' | 'seats';
      }
    | undefined;
  ClassPlan: { courseId: string };
  TextsBook: { courseId: string };
  /** A course's homework record, open on the homework a session set, if given. */
  Homework: { courseId: string; sessionKey?: string };
  Roll: { key: string; day: string; courseId: string };
  Correct: { unit: string; day: string; pupilId: string };
  RollRules: undefined;
  PupilMove: { classId: string };
  SeatsSetup: { classId: string; groupId: string };
  Security: { done?: SecurityDone; at?: number } | undefined;
  LockPin: { mode: LockPinMode };
  /** A document, for the month of `day` when given, else today's. */
  DocOutput: { id: string; day?: string };
  PrintWeek: undefined;
  Extra: { courseId?: string } | undefined;
  AddSessions: undefined;
};

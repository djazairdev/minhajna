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
  Times: { schoolId?: string } | undefined;
  Plan: undefined;
  Packs: { grade: string; subject: string; schoolId?: string; classId?: string };
  Ready: undefined;
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  Gallery: undefined;
  StorageCheck: undefined;
  Help: undefined;
  Settings: undefined;
  Calendar: undefined;
  CalendarEntry: { id: string; origin: 'bundled' | 'local'; schoolId: string };
  CalendarEdit: { id?: string; schoolId: string };
  CalendarAb: { schoolId: string };
  CalendarCouncil: { schoolId: string };
  CalendarGroups: { schoolId: string };
  CalendarReceive: { schoolId: string };
  CalendarLunar: { id: string; schoolId: string };
  ImportUpdate: undefined;
  CalendarUpdate: { release: string };
  SettingsCard: undefined;
  SettingsSchools: undefined;
  SettingsClasses: undefined;
  SettingsWeek: undefined;
  SettingsPlans: { schoolId?: string } | undefined;
  SettingsLengths: undefined;
  SettingsNotify: undefined;
  SettingsSignature: undefined;
  /** «سجل النشاط» and «مدة الحفظ» (#235). */
  Log: undefined;
  SettingsRetention: undefined;
  Language: undefined;
  PrivacyNotice: undefined;
  Connections: undefined;
  Licences: undefined;
  LicenceNotice: { name: string };
  Entry: { key: string; day: string };
  /** A session's lesson note, by the session's key and day (#237). */
  Note: { key: string; day: string };
  /** One plan paragraph of the note, by its key such as `objectives` or `stage-2`. */
  NoteEdit: { key: string; day: string; paragraph: string };
  /** The teacher's own paragraph at `index`, or a new one. */
  NoteOwn: { key: string; day: string; index?: number };
  Class: { courseId: string };
  /** «التقويم والنقاط» for a course, on `term` when chosen, else the term holding today (#238). */
  Marks: { courseId: string; term?: number };
  /** The course's continuous-assessment setup, applying from `term` on. */
  MarksSetup: { courseId: string; term: number };
  /** Capture during today's session of a course (#239). */
  MarksCapture: { courseId: string };
  /** The term's component marks, by `month` in primary (#239). */
  MarksComponents: { courseId: string; term: number; month?: string };
  /** Entering a course's test's, component's or, with neither, the term's exam's marks (#239). */
  MarksEntry: { courseId: string; term: number; testId?: string; componentId?: string; month?: string };
  /** The weekly digest, worked out when it opens (#234). */
  Digest: undefined;
  /** The roll-call book of a class's course, on a month written YYYY-MM or `year`; the latest month when none. */
  RollMonth: { courseId: string; month?: string };
  /** A pupil in the roll-call book of a class's course, on a month written YYYY-MM or `year`. */
  Pupil: { courseId: string; pupilId: string; month?: string };
  /** The texts book's corrections, for the director: a month written YYYY-MM and a class, or this month and all. */
  BookFixes: { month?: string; classId?: string } | undefined;
  PilotTimings: undefined;
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
  PlanDetails: { courseId: string };
  PlanItem: { courseId: string; itemId: string };
  PlanChanges: { courseId: string };
  PlanLayers: { courseId: string };
  LayerImport: { courseId: string };
  LayerExport: { courseId: string };
  PlanError: { courseId: string; itemId: string };
  PlanFree: { courseId: string };
  CatchUp: { courseId: string };
  CatchUpAdd: { courseId: string; kind?: 'support' };
  SupportQueue: { courseId: string; kind?: 'remediation' };
  Repace: { courseId: string };
  PlanOffer: { courseId: string };
  SeptCheck: { courseId: string };
  StaleQuestion: { courseId: string };
  TestSchedule: { courseId: string };
  ExamWindow: { courseId: string };
  Duty: { day?: string } | undefined;
  TextsBook: { courseId: string };
  /** A course's homework record, open on the homework a session set, if given. */
  Homework: { courseId: string; sessionKey?: string };
  Roll: { key: string; day: string; courseId: string };
  Correct: { unit: string; day: string; pupilId: string };
  RollRules: undefined;
  PupilMove: { classId: string };
  Reorient: { classId: string };
  SeatsSetup: { classId: string; groupId: string };
  Security: { done?: SecurityDone; at?: number } | undefined;
  LockPin: { mode: LockPinMode };
  /** A document, for the month of `day` when given, else today's, in `layout` when given. */
  DocOutput: { id: string; day?: string; layout?: string };
  /** «التوزيعات» for one class and subject, the first with a plan when not given. */
  Dist: { courseId?: string } | undefined;
  PrintWeek: undefined;
  Extra: { courseId?: string; scheduled?: string } | undefined;
  Cover: undefined;
  AddSessions: { schoolId?: string; calendar?: true } | undefined;
};

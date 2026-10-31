// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A package file read in setup's week step (#580, Setup-5b, Setup-5c, Setup-5d,
// answer 608): a file refused shows why (PackageRefused.tsx); one that passed
// shows the package (PackageView.tsx) for the school of its name, else the only
// one, else the one the teacher picks. Accepting places it in the week from its
// first day, or today when that has passed, records the school's bell times and
// the new version together, and returns to the week saying so; nothing is
// recorded while a session cannot be placed. Each read reopens the view, so a
// second file is said again.

import { acceptPackage, compareDays, formatDay, type School } from '@minhajna/core';
import { useState } from 'react';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { placeFor, schoolFor } from './package-place';
import { PackageRefused } from './PackageRefused';
import { PackageView } from './PackageView';
import type { usePackageInput } from './usePackageInput';

export type WeekPackageProps = {
  readonly input: ReturnType<typeof usePackageInput>;
  /** Says the package was accepted, in the catalogue's words. */
  readonly onAccepted: (words: string) => void;
};

/** A package file read in the week step: refused, or shown with its differences and accepted. */
export function WeekPackage({ input, onAccepted }: WeekPackageProps) {
  const t = useText();
  const data = useAppData();
  const [picked, setPicked] = useState<School | null>(null);
  const { read } = input;
  if (read === null) return null;
  if (!read.ok) {
    return (
      <PackageRefused
        {...read}
        busy={input.busy}
        unreadable={input.unreadable}
        onAnother={() => void input.open()}
        onBack={input.clear}
      />
    );
  }
  const { part } = read;
  const school = picked ?? schoolFor([...data.state.schools.values()], part);
  const today = data.today();
  const from = compareDays(part.from, today) > 0 ? part.from : today;
  const accept = () => {
    if (school === null) return;
    const accepted = acceptPackage(placeFor(data, part, school), data.newId(), from);
    if (!accepted.ok) return;
    data.recordAll([
      { kind: 'school.set', school: accepted.school },
      { kind: 'timetable.set', version: accepted.version },
    ]);
    input.clear();
    onAccepted(t('week.package.accepted', { date: formatDay(from) }));
  };
  return (
    <PackageView
      part={part}
      school={school}
      onSchool={setPicked}
      from={from}
      busy={input.busy}
      onAccept={accept}
      onBack={input.clear}
    />
  );
}

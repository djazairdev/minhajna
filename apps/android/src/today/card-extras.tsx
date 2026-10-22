// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a session card on Today shows after its head (#231, L-Today, answer
// 387): a TD session's list in place of the proposal, or a half-group's
// pair under it, with the half the tap records. Both are worked out once
// for the day. Above them, a session in the same slot as another school's,
// or moved for the day, says so (#232).

import type { Context, Day, TodaySession } from '@minhajna/core';
import type { ReactNode } from 'react';
import { HalfPair, useHalfPairs } from './HalfPair';
import { SameTime, useSameTime } from './SameTime';
import { TdList, useTdLists } from './TdList';

export type CardExtra = {
  /** True when the TD list takes the proposal's place. */
  readonly td: boolean;
  /** The half the tap records, by its number; undefined for any other session. */
  readonly half?: number;
  readonly extra: ReactNode;
};

/** The extras of the day's cards: `name` is the card's class, as the TD list's last line names it. */
export function useCardExtras(
  context: Context,
  items: readonly TodaySession[],
  day: Day,
): (item: TodaySession, testID: string, name: string) => CardExtra {
  const pairs = useHalfPairs(context, items, day);
  const lists = useTdLists(context, items);
  const sameTime = useSameTime(items);
  return (item, testID, name) => {
    const lines = <SameTime lines={sameTime(item)} testID={`${testID}-time`} />;
    const list = lists.get(item.session.key);
    if (list !== undefined) {
      const td = <TdList testID={`${testID}-td`} list={list} day={day} name={name} />;
      return {
        td: true,
        extra: (
          <>
            {lines}
            {td}
          </>
        ),
      };
    }
    const pair = pairs.get(item.session.key);
    return pair === undefined
      ? { td: false, extra: lines }
      : {
          td: false,
          half: pair.number,
          extra: (
            <>
              {lines}
              <HalfPair data={pair} testID={`${testID}-pair`} />
            </>
          ),
        };
  };
}

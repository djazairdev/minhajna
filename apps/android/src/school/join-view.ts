// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which page School-join shows (#566, #567): its own, the way for a new phone,
// or a joined card's devices and copies, what stays on leaving, or who reads
// what in the national system (#568). Going back, by a page's button or
// Android's back, returns to School-join, and from it to the world's home;
// Leave's way to the next school returns to School-join with the code's card
// scrolled into view, once it is laid out.

import type { SchoolJoined } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { BackHandler, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';

/** A joined card's own pages. */
export type JoinPage = 'devices' | 'leave' | 'help';

export type JoinView = 'join' | 'rejoin' | { readonly page: JoinPage; readonly join: SchoolJoined };

/** School-join's page, the ways between them, and what scrolls the code's card into view. */
export function useJoinView(onClose: () => void, onReturn: () => void) {
  const [view, setView] = useState<JoinView>('join');
  const scroller = useRef<ScrollViewInstance>(null);
  const toCode = useRef(false);
  const leave = () => {
    if (view === 'join') return onClose();
    onReturn();
    setView('join');
  };
  const back = useEffectEvent(leave);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => handler.remove();
  }, []);
  return {
    view,
    setView,
    page: typeof view === 'object' ? view.page : view,
    leave,
    open: (page: JoinPage) => (join: SchoolJoined) => setView({ page, join }),
    toCode: () => {
      toCode.current = true;
      leave();
    },
    scroller,
    onCodeLayout: ({ nativeEvent }: LayoutChangeEvent) => {
      if (!toCode.current) return;
      toCode.current = false;
      scroller.current?.scrollTo({ y: nativeEvent.layout.y, animated: false });
    },
  };
}

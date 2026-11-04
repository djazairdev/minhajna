// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A pack-editor account on the page of a world's curators or Ministry (#612,
// answer 767). The device that started the world makes the role's account as
// the page opens, and can show its code for another PC, as nothing is printed
// or mailed; any other device signs in with that code, and reads only until it
// does. The account decides what the server signs, so this is more than a
// screen's rule.

import type { PackPublisher, PlanPack } from '@minhajna/core';
import { useEffect, useRef, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { useDeviceText } from '../text/device-text';
import { editorStyles as s } from './editor-styles';
import {
  keepPackAccount,
  keptPackAccounts,
  makePackAccount,
  signInPackAccount,
  type PackAccounts,
} from './pack-account';
import type { PackEditor } from './pack-release-session';
import { PacksPage } from './PacksPage';

const making = new Map<string, Promise<PackAccounts>>();

/** The role's account made and kept once, however many pages ask while it is under way. */
function madeAccount(open: OpenWorld, starter: string, role: PackPublisher, send: Send): Promise<PackAccounts> {
  const key = `${open.world}/${role}`;
  const under = making.get(key);
  if (under !== undefined) return under;
  const made = makePackAccount(open.world, starter, role, send)
    .then((token) => keepPackAccount(open, role, token))
    .finally(() => making.delete(key));
  making.set(key, made);
  return made;
}

/** The account's panel and what it holds, for a page of the pack desk. */
export function usePackAccount(open: OpenWorld, role: PackPublisher, send: Send = worldRequest) {
  const t = useDeviceText();
  const [accounts, setAccounts] = useState<PackAccounts>(() => keptPackAccounts(open));
  const [problem, setProblem] = useState<'makeFailed' | 'wrongCode' | 'signInFailed' | null>(null);
  const [typed, setTyped] = useState('');
  const [showing, setShowing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);
  const token = accounts[role];
  const { world, starter } = open;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (token !== undefined || starter === null) return;
    void madeAccount(open, starter, role, send)
      .then((kept) => {
        if (live.current) setAccounts(kept);
      })
      .catch(() => {
        if (live.current) setProblem('makeFailed');
      });
  }, [token, starter, role, send, open, attempt]);
  const signIn = async () => {
    setProblem(null);
    try {
      const code = typed.trim();
      if ((await signInPackAccount(world, code, send)) !== role) return setProblem('wrongCode');
      const kept = await keepPackAccount(open, role, code);
      if (live.current) setAccounts(kept);
    } catch {
      if (live.current) setProblem('signInFailed');
    }
  };
  const panel = (
    <View testID="desk-account" style={s.card}>
      {token !== undefined ? (
        <>
          <Text style={s.body}>{t(`editorDesk.account.${role}`)}</Text>
          {starter !== null && (
            <Button
              testID="desk-show-code"
              label={t(showing ? 'editorDesk.account.hideCode' : 'editorDesk.account.showCode')}
              variant="plain"
              onPress={() => setShowing((old) => !old)}
            />
          )}
          {showing && (
            <Text testID="desk-code" selectable style={s.body}>
              {token}
            </Text>
          )}
        </>
      ) : starter !== null ? (
        <>
          {problem === null && <Text style={s.body}>{t('editorDesk.account.making')}</Text>}
          {problem !== null && (
            <>
              <Text accessibilityRole="alert" style={s.error}>
                {t(`editorDesk.account.${problem}`)}
              </Text>
              <Button
                testID="desk-retry"
                label={t('editorDesk.account.retry')}
                onPress={() => {
                  setProblem(null);
                  setAttempt((old) => old + 1);
                }}
              />
            </>
          )}
        </>
      ) : (
        <>
          <Text accessibilityRole="header" style={s.title}>
            {t('editorDesk.account.signInTitle')}
          </Text>
          <Text style={s.body}>{t('editorDesk.account.signInHint')}</Text>
          <TextField
            testID="desk-code-field"
            label={t('editorDesk.account.code')}
            placeholder=""
            value={typed}
            textDirection="ltr"
            autoCapitalize="none"
            onChangeText={setTyped}
          />
          {problem !== null && (
            <Text accessibilityRole="alert" style={s.error}>
              {t(`editorDesk.account.${problem}`)}
            </Text>
          )}
          <Button testID="desk-sign-in" label={t('editorDesk.account.signIn')} onPress={() => void signIn()} />
        </>
      )}
    </View>
  );
  return { accounts, panel };
}

/** The pack desk's page of a workspace; null when it has none. */
export function packDeskPage(
  workspace: string,
  page: string,
  props: Omit<Parameters<typeof PackDesk>[0], 'role'>,
): ReactElement | null {
  return workspace === 'curator' && page === 'packs' ? <PackDesk role="curator" {...props} /> : null;
}

/** The curators' page of packs and drafts, under its account. */
export function PackDesk({
  role,
  open,
  send,
  ...props
}: Omit<PackEditor, 'world' | 'accounts'> & {
  readonly role: PackPublisher;
  readonly open: OpenWorld;
  readonly packs: readonly PlanPack[];
  readonly send?: Send;
  readonly refusedPacks?: number;
  readonly setOpen?: Dispatch<SetStateAction<OpenWorld | null>>;
}) {
  const { accounts, panel } = usePackAccount(open, role, send);
  return (
    <View style={s.page}>
      {panel}
      <PacksPage {...props} world={open} accounts={accounts} send={send} />
    </View>
  );
}

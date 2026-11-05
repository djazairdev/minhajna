// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's report of a plan error in their world (#616, answer 770), on a
// form as Plan-error words it, with credit off until they turn it on and no
// name filled in for them. The app adds no class, school or pupil, and the
// report goes on the sealed stream by the teacher's press alone.

import { reportText, REPORT_NAME_MOST, REPORT_NOTE_MOST, type PlanPack } from '@minhajna/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Switch } from '../components/Switch';
import { TextField } from '../components/TextField';
import type { Send } from '../demo/world-session';
import { editorStyles as s } from '../editor/editor-styles';
import type { PackEditor } from '../editor/pack-release-session';
import { sendPackReport } from '../editor/pack-report-session';
import { ERROR_KINDS, type ErrorKind } from '../plan/error-report';
import { useDeviceText } from '../text/device-text';

export function WorldReportForm({
  pack,
  editor,
  send,
}: {
  readonly pack: PlanPack;
  readonly editor: Pick<PackEditor, 'world' | 'held' | 'profile' | 'kit'>;
  readonly send?: Send;
}) {
  const t = useDeviceText();
  const [item, setItem] = useState<string | null>(null);
  const [kind, setKind] = useState<ErrorKind>('other');
  const [note, setNote] = useState('');
  const [credit, setCredit] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState(false);
  const typedNote = reportText(note);
  const typedName = reportText(name);
  const ready =
    item !== null &&
    typedNote !== '' &&
    typedNote.length <= REPORT_NOTE_MOST &&
    (!credit || (typedName !== '' && typedName.length <= REPORT_NAME_MOST));
  const submit = async () => {
    if (item === null) return;
    setBusy(true);
    setProblem(false);
    setSent(false);
    try {
      await sendPackReport(
        editor,
        {
          id: pack.id,
          release: pack.release,
          item,
          kind,
          note: typedNote,
          name: credit ? typedName : null,
        },
        send,
      );
      setSent(true);
      setNote('');
      setName('');
      setCredit(false);
      setItem(null);
    } catch {
      setProblem(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {problem && (
        <Text accessibilityRole="alert" style={s.error}>
          {t('editorDesk.teacher.sendProblem')}
        </Text>
      )}
      {sent && (
        <Text testID="report-sent" accessibilityRole="alert" style={s.body}>
          {t('editorDesk.teacher.sent')}
        </Text>
      )}
      <View testID="report-form" style={s.card}>
        <ChipGroup
          testID="report-item"
          label={t('editorDesk.teacher.item')}
          choices={pack.items.map((one) => ({ value: one.id, label: `${one.id} · ${one.title}` }))}
          selected={item}
          onSelect={setItem}
        />
        <ChipGroup
          testID="report-kind"
          label={t('planError.kind')}
          choices={ERROR_KINDS.map((value) => ({ value, label: t(`planError.kinds.${value}`) }))}
          selected={kind}
          onSelect={setKind}
        />
        <TextField
          testID="report-note"
          label={t('planError.note')}
          placeholder={t('planError.notePlaceholder')}
          value={note}
          maxLength={REPORT_NOTE_MOST}
          onChangeText={setNote}
        />
        <Switch testID="report-credit" label={t('planError.credit')} value={credit} onValueChange={setCredit} />
        {credit && (
          <TextField
            testID="report-name"
            label={t('planError.name')}
            placeholder={t('planError.namePlaceholder')}
            value={name}
            maxLength={REPORT_NAME_MOST}
            onChangeText={setName}
          />
        )}
        {typedNote === '' && <Text style={s.body}>{t('planError.needsNote')}</Text>}
        {credit && typedName === '' && <Text style={s.body}>{t('planError.needsName')}</Text>}
        <Text style={s.body}>{t('planError.never')}</Text>
        <Text style={s.body}>{t('editorDesk.teacher.goesTo')}</Text>
        <Button
          testID="report-send"
          label={t('editorDesk.teacher.send')}
          disabled={busy || !ready}
          onPress={() => void submit()}
        />
      </View>
    </>
  );
}

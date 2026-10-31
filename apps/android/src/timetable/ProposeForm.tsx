// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Proposing a change on the teacher's timetable from the school (#579,
// TT-propose, R-7.8-04, answer 607), on the newest standing part received
// (teacher-propose.ts). The teacher picks one of their sessions, every one but
// those taught to several classes together, which the page says are not
// offered; then a school day, the session's own by default; then a free time of
// the bell times on it, keeping the session's length, each saying when it makes
// the day longer or adds a day to the week, or that the day has none. The room
// is the session's unless changed, a room left blank keeping it, and a note for
// the director is optional, kept to 280 characters. A session with a proposal
// still waiting says so. Sending is offered once a time is picked, with the
// part the form shows; the form empties once the proposal is on the channel,
// and is kept when it is not. The teacher's proposals follow
// (SentProposals.tsx), and the whole shows once a standing part arrived. The
// page says the school checks the class and the room and the director decides,
// and that a change for one day stays in the teacher's own week.

import type { PartSession, TimetablePart, Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { spanText } from './grid-text';
import { slotText } from './proposal-text';
import { SentProposals } from './SentProposals';
import { freeSlots, jointIn, proposedOn, type Move } from './teacher-propose';
import type { TeacherChannel } from './teacher-session';

export type ProposeFormProps = {
  readonly channel: TeacherChannel;
  /** The school's days, in the week's order; without them, the days of the part. */
  readonly workingDays?: readonly Weekday[];
  readonly busy: boolean;
  /** Sends the proposal on the part it was made on, answering whether it is on the channel. */
  readonly onPropose: (part: TimetablePart, session: PartSession, move: Move) => Promise<boolean>;
};

/** A session, a day, a free time, a room and a note, then sending the proposal. */
export function ProposeForm({ channel, workingDays, busy, onPropose }: ProposeFormProps) {
  const part = proposedOn(channel);
  return part === null ? null : (
    <View style={styles.card}>
      <Form part={part} channel={channel} workingDays={workingDays} busy={busy} onPropose={onPropose} />
      <SentProposals proposals={channel.proposals} parts={channel.parts} />
    </View>
  );
}

function Form({ part, channel, workingDays, busy, onPropose }: ProposeFormProps & { readonly part: TimetablePart }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [picked, setPicked] = useState<string | null>(null);
  const [day, setDay] = useState<Weekday | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const offered = part.sessions.filter((one) => !jointIn(part, one));
  const session = offered.find((one) => one.id === picked) ?? null;
  const unsettled = channel.proposals.filter((one) => one.decision === null);
  const waiting = new Set(unsettled.map((one) => one.proposal.value.session));
  const days = workingDays ?? [...new Set(part.sessions.map((one) => one.day))].sort((a, b) => a - b);
  const on = day ?? session?.day ?? null;
  const slots = session === null || on === null ? [] : freeSlots(part, session, on);
  const slot = slots.find((one) => one.start === start) ?? null;
  const slotLabel = (one: (typeof slots)[number]) =>
    [
      spanText(one.start, one.end),
      ...(one.newDay ? [t('demo.propose.newDay')] : one.longer ? [t('demo.propose.longer')] : []),
    ].join(' · ');
  const clear = () => {
    setDay(null);
    setStart(null);
    setRoom(null);
  };
  const pick = (id: string) => {
    setPicked(id);
    clear();
  };
  const send = () => {
    if (session === null || on === null || slot === null) return;
    const kept = room === null || room.trim() === '' ? session.room : room;
    void onPropose(part, session, { day: on, start: slot.start, end: slot.end, room: kept, note }).then((sent) => {
      if (!sent) return;
      setPicked(null);
      clear();
      setNote('');
    });
  };
  return (
    <View testID="teacher-propose" style={styles.group}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.propose.title')}
      </Text>
      <Text style={[styles.small, align]}>{t('demo.propose.line')}</Text>
      <Text style={[styles.small, align]}>{t('demo.propose.oneDay')}</Text>
      <ChipGroup
        testID="propose-session"
        label={t('demo.propose.session')}
        choices={offered.map((one) => ({ value: one.id, label: slotText(t, one) }))}
        selected={session?.id ?? null}
        onSelect={pick}
      />
      {offered.length < part.sessions.length && <Text style={[styles.small, align]}>{t('demo.propose.joint')}</Text>}
      {session !== null && waiting.has(session.id) && (
        <Text style={[styles.small, align]}>{t('demo.propose.waitingAlready')}</Text>
      )}
      {session !== null && (
        <ChipGroup
          testID="propose-day"
          label={t('demo.propose.day')}
          choices={days.map((one) => ({ value: String(one), label: t(`week.days.${one}`) }))}
          selected={on === null ? null : String(on)}
          onSelect={(value) => {
            setDay(Number(value) as Weekday);
            setStart(null);
          }}
        />
      )}
      {session !== null && slots.length === 0 && <Text style={[styles.small, align]}>{t('demo.propose.noSlot')}</Text>}
      {slots.length > 0 && (
        <ChipGroup
          testID="propose-slot"
          label={t('demo.propose.slot')}
          choices={slots.map((one) => ({ value: String(one.start), label: slotLabel(one) }))}
          selected={slot === null ? null : String(slot.start)}
          onSelect={(value) => setStart(Number(value))}
        />
      )}
      {session !== null && (
        <>
          <TextField
            testID="propose-room"
            label={t('demo.propose.room')}
            placeholder={t('demo.propose.roomHint')}
            value={room ?? session.room}
            onChangeText={(value) => setRoom(value.slice(0, 80))}
          />
          <TextField
            testID="propose-note"
            label={t('demo.propose.note')}
            placeholder={t('demo.propose.noteHint')}
            optionalLabel={t('demo.propose.optional')}
            value={note}
            onChangeText={(value) => setNote(value.slice(0, 280))}
            multiline
          />
          <Button
            testID="propose-send"
            label={t('demo.propose.send')}
            disabled={busy || slot === null}
            onPress={send}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  group: { gap: spacing['space-8'] },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});

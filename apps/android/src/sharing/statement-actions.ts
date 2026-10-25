// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The four ways a statement leaves (#438, #439, answers 485 and 486): each
// computes the statement as of the tap's day and signs it then, and each that
// left is one share in the history, which then asks «إلى من؟». A print counts
// once it reaches Android's print screen, a PDF once saved, a QR code once it
// shows, and a file once it reaches the share menu, which never says where it
// went. A file's name keeps the class's first 30 characters, so a long name
// never pushes out the subject and day. A failed signature makes and records
// nothing.

import { progressStatement, type ProgressStatement, type ShareHow, type StatementShare } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { useOutputRun } from '../documents/output-run';
import { safeFileName } from '../marks/export-file-rules';
import files from '../native/NativeMinhajnaFiles';
import pdf from '../native/NativeMinhajnaPdf';
import type { QrMatrix } from '../native/NativeMinhajnaSignature';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { statementClass, statementDay, statementLines } from './statement-lines';
import { statementHtml } from './statement-page';
import { signedNow } from './statement-sign';

/** A statement's code on screen, with the statement it carries and its share. */
export interface ShownCode {
  readonly qr: QrMatrix;
  readonly statement: ProgressStatement;
  readonly share: StatementShare;
}

/** Print, PDF, QR code and file for one course, with the share waiting for «إلى من؟» and the code shown. */
export function useStatementActions(courseId: string) {
  const t = useText();
  const { direction } = useLocale();
  const data = useAppData();
  const { profile, today, record, newId } = data;
  const output = useOutputRun();
  const [asked, setAsked] = useState<StatementShare | null>(null);
  const [shown, setShown] = useState<ShownCode | null>(null);

  const now = () => {
    const made = progressStatement(coreContext(data), courseId, today());
    if (made === null) throw new Error('No statement to make');
    return made;
  };
  const shared = (how: ShareHow) => {
    const share = { id: newId(), courseId, how };
    record({ kind: 'statement.shared', share });
    return share;
  };
  const page = async (made: ProgressStatement) => {
    const signed = await signedNow(made);
    const lines = statementLines(t, profile, made);
    const sheet = { day: statementDay(made), className: statementClass(profile, made), lines, ...signed };
    return statementHtml(t, sheet, currentLanguage(), direction);
  };
  const named = (made: ProgressStatement, extension: string) => {
    const subject = profile.subjects.find((one) => one.code === made.class.subject);
    const name = subject === undefined ? made.class.subject : localized(subject.name);
    const section = [...made.class.section].slice(0, 30).join('');
    return safeFileName(`${t('statement.title')} ${section} ${name} ${made.day}`, extension);
  };

  const print = () =>
    output.run(async () => {
      await pdf.printHtml(await page(now()), t('statement.title'), false);
      setAsked(shared('print'));
      return null;
    });
  const save = () =>
    output.run(async () => {
      const made = now();
      const file = await pdf.makePdf(await page(made), 'statement', false);
      if (!(await pdf.savePdf(file.name, named(made, 'pdf')))) return null;
      setAsked(shared('pdf'));
      return 'saved';
    });
  const show = () =>
    output.run(async () => {
      const made = now();
      const { qr } = await signedNow(made);
      if (qr === null) throw new Error('The statement does not fit one code');
      setShown({ qr, statement: made, share: shared('qr') });
      return null;
    });
  const send = () =>
    output.run(async () => {
      const made = now();
      const { text } = await signedNow(made);
      const token = await files.makeText(text, named(made, 'json'), '');
      await files.shareFile(token, t('statement.title'));
      setAsked(shared('file'));
      return null;
    });
  const close = () => {
    if (shown === null) return;
    setShown(null);
    setAsked(shown.share);
  };

  return { ...output, print, save, show, send, shown, close, asked, ask: setAsked };
}

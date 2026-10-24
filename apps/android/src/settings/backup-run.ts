// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Saving a backup (#247, Devices-pilot, R-5.8-11, answer 478): everything on
// this phone as the Minhajna archive, private notes included, in an AES-256
// ZIP whose password is the recovery key, so the sheet opens it on a new
// phone, or with 7-Zip on a computer. The teacher card's personal fields,
// the drawn signature and the key itself stay out, as the archive leaves the
// device layer out. It leaves only through the file picker, never the share
// menu; once saved, its fact and day are recorded, never where it went.

import build from '../native/NativeMinhajnaBuild';
import files from '../native/NativeMinhajnaFiles';
import { useOutputRun } from '../documents/output-run';
import { useDocumentData } from '../documents/useDocumentData';
import { safeFileName } from '../marks/export-file-rules';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { archiveFile } from './export-all-files';

/** A backup's run, one at a time, with whether one is running and what was said of the last. */
export function useBackup() {
  const t = useText();
  const documents = useDocumentData();
  const { entries, settled, record } = useAppData();
  const output = useOutputRun();
  const backup = (key: string) =>
    output.run(async () => {
      await settled();
      const { version } = await build.describe();
      const file = archiveFile(documents, { entries: entries(), app: version, privateNotes: true });
      const name = safeFileName(`${t('settings.devices.backupName')} ${documents.day}`, 'zip').replace(/\.zip$/, '');
      const token = await files.makeZip([file.name], [file.text], name, key);
      if (!(await files.saveFile(token))) return null;
      record({ kind: 'backup.saved' });
      return 'saved';
    });
  return { busy: output.busy, said: output.said, backup };
}

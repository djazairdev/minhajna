// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

/** Synthetic preparation notes only: never a real note or a pupil's personal details. */
export const privateNoteTexts: Readonly<
  Record<Language, { label: string; assurance: string; placeholder: string; reminder: string; long: string }>
> = {
  ar: {
    label: 'ملاحظة خاصة',
    assurance: 'لا تغادر أجهزتك',
    placeholder: 'للتذكير فقط',
    reminder: 'يُرجى عدم كتابة تفاصيل صحية أو تأديبية تخص التلاميذ، هنا أو في الدفتر.',
    long: 'مثال مختلق للتجربة فقط.\nمراجعة وسائل الإيضاح قبل الحصة المقبلة.\nتحضير نشاط إضافي ومراجعة ترتيب الأدوات، دون أي معلومات عن التلاميذ.',
  },
  fr: {
    label: 'Note privée',
    assurance: 'Ne quitte pas vos appareils',
    placeholder: 'Pour mémoire seulement',
    reminder: 'Ne notez pas de détails médicaux ou disciplinaires concernant les élèves, ici ou dans le cahier.',
    long: 'Exemple inventé pour ce test.\nRevoir les supports avant la prochaine séance.\nPréparer une activité supplémentaire et les outils, sans aucune information sur les élèves.',
  },
  en: {
    label: 'Private note',
    assurance: 'Stays on your own devices',
    placeholder: 'Just a reminder',
    reminder: 'Please do not write pupils’ health or disciplinary details here or in the book.',
    long: 'An invented example for this test.\nReview the teaching aids before the next lesson.\nPrepare an extra activity and the tools, without any information about pupils.',
  },
};

// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Language } from '../text/i18n';

type Texts = {
  readonly short: string;
  readonly long: string;
  readonly colours: readonly string[];
  readonly town: string;
};

/** Made-up choices; none names a real school or place. */
export const selectTexts: Readonly<Record<Language, Texts>> = {
  ar: { short: 'لون تجريبي', long: 'مدينة تجريبية', colours: ['أحمر', 'أخضر', 'أزرق'], town: 'مدينة' },
  fr: { short: 'Couleur fictive', long: 'Ville fictive', colours: ['Rouge', 'Vert', 'Bleu'], town: 'Ville' },
  en: { short: 'Example colour', long: 'Example town', colours: ['Red', 'Green', 'Blue'], town: 'Town' },
};

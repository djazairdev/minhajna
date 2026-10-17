// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Developer diagnostic text only, kept separate and translatable.

const en = {
  title: 'Browser storage check',
  intro: 'A synthetic school year. Nothing uploaded.',
  warning: 'Test tool only — never enter real pupil data or a real passphrase. This is not the teacher app.',
  step: '1. Choose a workload',
  level: 'Demo timetable',
  cem: 'Middle school · 45 pupils',
  primary: 'Primary · 45 pupils',
  platform: 'Test operating system (choose manually)',
  unknown: 'Not recorded',
  password: 'Disposable test passphrase (at least 12 characters)',
  passwordHint:
    'Use the same disposable phrase to reopen after closing the page. It is never saved. Do not use a real password.',
  run: 'Encrypt, replace demo run and verify',
  reopen: 'Reopen saved demo run',
  persist: 'Request persistent storage',
  clear: 'Delete this tool’s demo records',
  copy: 'Copy report',
  report: '2. Results',
  ready: 'Ready. No test has run.',
  working: 'Checking… please wait.',
  success: 'Completed. The encrypted history was read and verified.',
  failed: 'Check failed. See the safe error code in the report. No passphrase or record is included.',
  cleared: 'This tool’s demo database was deleted. Static offline files remain cached.',
  copied: 'Report copied.',
  copyFailed: 'Copy unavailable. Select and copy the report text below.',
  replaceHint: 'Running replaces only the previous synthetic run in this tool’s dedicated database.',
  confirmClear: 'Delete only the synthetic database for this diagnostic?',
  offline: '3. Reopen and offline checks',
  install:
    'Use the browser’s Install app menu where available, then run this same check in its own window. The report detects standalone mode; a missing install option is not a storage failure.',
  reload:
    'After a successful run, close and reopen the browser/app, re-enter the disposable phrase, and choose Reopen. Try offline after the offline files are ready.',
  limits:
    'Persistence is a browser grant, not a backup guarantee. One successful run does not prove survival under disk pressure or user deletion. Windows 10/11 and each browser need their own results.',
  empty: 'Only metrics appear here. A report never includes the passphrase, key or pupil records.',
  cacheReady: 'Offline files ready. Reload once before testing offline.',
  cacheWaiting: 'Offline files not ready yet.',
  cacheUnavailable: 'Offline worker unavailable. Use HTTPS or localhost; not file://.',
  persistDone: 'Storage permission and estimate refreshed. See persisted in the report.',
};

/** Keys are shared across the three offline catalogues. */
export type Message = keyof typeof en;

const ar: Record<Message, string> = {
  title: 'فحص تخزين المتصفح',
  intro: 'سنة دراسية تجريبية. لا تُرسل أي بيانات.',
  warning: 'أداة اختبار فقط — لا تُدخل بيانات تلاميذ حقيقية أو كلمة مرور حقيقية. هذه ليست نسخة الأستاذ.',
  step: '1. اختيار بيانات الاختبار',
  level: 'جدول تجريبي',
  cem: 'التعليم المتوسط · 45 تلميذا',
  primary: 'التعليم الابتدائي · 45 تلميذا',
  platform: 'نظام الاختبار (اختره يدويا)',
  unknown: 'غير مسجل',
  password: 'عبارة اختبار مؤقتة (12 حرفا على الأقل)',
  passwordHint:
    'استعمل العبارة المؤقتة نفسها لإعادة الفتح بعد إغلاق الصفحة. لا تُحفظ أبدا. لا تستعمل كلمة مرور حقيقية.',
  run: 'تشفير البيانات التجريبية واستبدالها والتحقق منها',
  reopen: 'إعادة فتح البيانات المحفوظة',
  persist: 'طلب الاحتفاظ الدائم بالتخزين',
  clear: 'حذف بيانات هذه الأداة التجريبية',
  copy: 'نسخ التقرير',
  report: '2. النتائج',
  ready: 'جاهز. لم يُجر أي اختبار بعد.',
  working: 'جار الفحص… يرجى الانتظار.',
  success: 'اكتمل الفحص. قُرئ السجل المشفر وتم التحقق منه.',
  failed: 'فشل الفحص. رمز الخطأ الآمن في التقرير. لا يتضمن كلمة المرور أو السجلات.',
  cleared: 'حُذفت قاعدة البيانات التجريبية لهذه الأداة. تبقى ملفات العمل دون إنترنت محفوظة.',
  copied: 'نُسخ التقرير.',
  copyFailed: 'النسخ غير متاح. حدد نص التقرير وانسخه يدويا.',
  replaceHint: 'يستبدل التشغيل فقط الاختبار التجريبي السابق في قاعدة بيانات هذه الأداة المنفصلة.',
  confirmClear: 'هل تريد حذف قاعدة البيانات التجريبية لهذه الأداة فقط؟',
  offline: '3. إعادة الفتح والعمل دون إنترنت',
  install:
    'استعمل خيار تثبيت التطبيق في المتصفح إن كان متاحا، ثم أعد الفحص في نافذته المستقلة. يسجل التقرير وضع التشغيل؛ غياب خيار التثبيت ليس فشلا في التخزين.',
  reload:
    'بعد نجاح الفحص، أغلق المتصفح أو التطبيق وافتحه، ثم أدخل العبارة المؤقتة واختر إعادة الفتح. جرّب دون إنترنت بعد جاهزية الملفات.',
  limits:
    'الاحتفاظ الدائم إذن من المتصفح وليس ضمان نسخ احتياطي. لا يثبت فحص واحد بقاء البيانات عند امتلاء القرص أو حذف المستخدم. يلزم تقرير مستقل لكل متصفح ونظام Windows 10 أو 11.',
  empty: 'تظهر هنا القياسات فقط. لا يتضمن التقرير العبارة أو المفتاح أو سجلات التلاميذ.',
  cacheReady: 'ملفات العمل دون إنترنت جاهزة. أعد تحميل الصفحة مرة قبل التجربة.',
  cacheWaiting: 'ملفات العمل دون إنترنت غير جاهزة بعد.',
  cacheUnavailable: 'عامل العمل دون إنترنت غير متاح. استعمل HTTPS أو localhost، وليس file://.',
  persistDone: 'حُدّث إذن التخزين والتقدير. راجع persisted في التقرير.',
};

const fr: Record<Message, string> = {
  title: 'Vérifier le stockage du navigateur',
  intro: 'Une année scolaire fictive. Aucun envoi de données.',
  warning:
    'Outil de test — ne saisissez ni données réelles d’élèves ni véritable mot de passe. Ce n’est pas l’application enseignant.',
  step: '1. Choisir les données',
  level: 'Emploi du temps fictif',
  cem: 'Collège · 45 élèves',
  primary: 'Primaire · 45 élèves',
  platform: 'Système testé (à choisir manuellement)',
  unknown: 'Non renseigné',
  password: 'Phrase de test jetable (12 caractères minimum)',
  passwordHint:
    'Réutilisez cette phrase jetable pour rouvrir les données après fermeture. Elle n’est jamais enregistrée. N’utilisez pas un vrai mot de passe.',
  run: 'Chiffrer, remplacer le test et vérifier',
  reopen: 'Rouvrir le test enregistré',
  persist: 'Demander le stockage persistant',
  clear: 'Supprimer les données fictives de cet outil',
  copy: 'Copier le rapport',
  report: '2. Résultats',
  ready: 'Prêt. Aucun test effectué.',
  working: 'Vérification en cours…',
  success: 'Terminé. Historique chiffré lu et vérifié.',
  failed: 'Échec. Consultez le code d’erreur sûr dans le rapport. Aucune phrase ni donnée d’élève n’y figure.',
  cleared: 'Base fictive de cet outil supprimée. Les fichiers hors ligne restent en cache.',
  copied: 'Rapport copié.',
  copyFailed: 'Copie indisponible. Sélectionnez et copiez le texte ci-dessous.',
  replaceHint: 'Exécuter remplace uniquement le test fictif précédent dans la base dédiée de cet outil.',
  confirmClear: 'Supprimer uniquement la base fictive de cet outil ?',
  offline: '3. Réouverture et hors ligne',
  install:
    'Utilisez Installer l’application si le navigateur le propose, puis refaites le test dans sa fenêtre. Le rapport détecte ce mode ; une option absente n’est pas un échec de stockage.',
  reload:
    'Après réussite, fermez et rouvrez le navigateur ou l’application, ressaisissez la phrase et choisissez Rouvrir. Essayez hors ligne lorsque les fichiers sont prêts.',
  limits:
    'La persistance est une autorisation, pas une sauvegarde garantie. Un test réussi ne prouve pas la survie à un disque plein ou à une suppression. Chaque navigateur et Windows 10/11 exigent leurs propres résultats.',
  empty: 'Mesures uniquement. Le rapport ne contient ni phrase, ni clé, ni données d’élèves.',
  cacheReady: 'Fichiers hors ligne prêts. Rechargez une fois avant le test hors ligne.',
  cacheWaiting: 'Fichiers hors ligne pas encore prêts.',
  cacheUnavailable: 'Service worker indisponible. Utilisez HTTPS ou localhost, pas file://.',
  persistDone: 'Autorisation et estimation actualisées. Voir persisted dans le rapport.',
};

/** A local language choice, not a server or browser-locale lookup. */
export function messages(language: string): Record<Message, string> {
  return language === 'fr' ? fr : language === 'en' ? en : ar;
}

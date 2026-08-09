// Билингвальные поля контента ({ ru, en }) отличаются от строк интерфейса (I18nProvider):
// это данные пользователя, а не словарь. Если перевода нет — показываем то, что есть.
export function pickLang(bilingualField, lang) {
  if (!bilingualField) return '';
  return bilingualField[lang] || bilingualField.ru || bilingualField.en || '';
}

/** Как pickLang, но также сообщает, что показан фолбэк на другой язык — для UI-пометки. */
export function pickLangMeta(bilingualField, lang) {
  if (!bilingualField) return { text: '', isFallback: false, fallbackLang: null };
  const primary = bilingualField[lang];
  if (primary) return { text: primary, isFallback: false, fallbackLang: null };
  const otherLang = lang === 'ru' ? 'en' : 'ru';
  const other = bilingualField[otherLang];
  return { text: other || '', isFallback: Boolean(other), fallbackLang: other ? otherLang : null };
}

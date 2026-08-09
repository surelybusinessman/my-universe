import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import ru from './ru.json';
import en from './en.json';

const DICTS = { ru, en };
const I18nContext = createContext(null);

function getInitialLang() {
  const saved = localStorage.getItem('mu_lang');
  if (saved && DICTS[saved]) return saved;
  const browserLang = navigator.language?.slice(0, 2);
  return DICTS[browserLang] ? browserLang : 'ru';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang);

  const setLang = useCallback((next) => {
    if (!DICTS[next]) return;
    setLangState(next);
    localStorage.setItem('mu_lang', next);
  }, []);

  const t = useCallback(
    (key, vars) => {
      let str = DICTS[lang][key] ?? DICTS.ru[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, v);
        }
      }
      return str;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import hi from './hi';
import mr from './mr';

export const LANGUAGES = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'hi', label: 'हिंदी', short: 'हि' },
  { id: 'mr', label: 'मराठी', short: 'म' }
];

const DICTIONARIES = { en, hi, mr };
const STORAGE_KEY = 'language';

// Kept at module level so services and plain helpers can translate too
let currentLanguage = 'en';

const lookup = (dict, key) =>
  key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);

// Missing translations fall back to English, then to the key itself.
// Passing { count } picks `key_one` / `key_other` when those exist.
export const translate = (key, params = {}) => {
  const dict = DICTIONARIES[currentLanguage];
  const candidates = params.count !== undefined
    ? [`${key}_${params.count === 1 ? 'one' : 'other'}`, key]
    : [key];
  let text;
  for (const candidate of candidates) {
    text = lookup(dict, candidate) ?? lookup(en, candidate);
    if (typeof text === 'string') break;
  }
  if (typeof text !== 'string') return key;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => (params[name] !== undefined ? String(params[name]) : ''));
};

// Footprint ratings are stored in English ('Excellent', 'Good', ...)
export const translateRating = (rating) => {
  const key = rating ? `rating.${String(rating).toLowerCase()}` : null;
  const text = key ? translate(key) : null;
  return text && text !== key ? text : translate('calculator.unknown');
};

// Latin digits keep numbers consistent with the rest of the UI
export const getLocale = () => `${currentLanguage}-IN-u-nu-latn`;

const LanguageContext = createContext({ language: 'en', setLanguage: () => {} });

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(currentLanguage);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && DICTIONARIES[saved]) {
          currentLanguage = saved;
          setLanguageState(saved);
        }
      })
      .catch((e) => console.log("Could not load language", e));
  }, []);

  const setLanguage = (lang) => {
    currentLanguage = lang;
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch((e) => console.log("Could not save language", e));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Components must use this (not translate directly) so they re-render when the language changes
export const useTranslation = () => {
  const { language, setLanguage } = useContext(LanguageContext);
  return { t: translate, language, setLanguage };
};

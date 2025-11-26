import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import zhCN from './zh-CN';
import enUS from './en-US';
import jaJP from './ja-JP';

// Available languages
export const LANGUAGES = {
  ZH_CN: 'zh-CN',
  EN_US: 'en-US',
  JA_JP: 'ja-JP'
};

// Language display names (shown in dropdown menu)
export const LANGUAGE_NAMES = {
  [LANGUAGES.ZH_CN]: '中文',
  [LANGUAGES.EN_US]: 'English',
  [LANGUAGES.JA_JP]: '日本語'
};

// Language list for dropdown menu
export const LANGUAGE_LIST = [
  { key: LANGUAGES.ZH_CN, label: '中文' },
  { key: LANGUAGES.EN_US, label: 'English' },
  { key: LANGUAGES.JA_JP, label: '日本語' }
];

// Language data
const translations = {
  [LANGUAGES.ZH_CN]: zhCN,
  [LANGUAGES.EN_US]: enUS,
  [LANGUAGES.JA_JP]: jaJP
};

// Storage key
const STORAGE_KEY = 'tractorGameLanguage';

// Get initial language from localStorage or default to Chinese
const getInitialLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to load language from localStorage:', e);
  }
  return LANGUAGES.ZH_CN;
};

// Create context
const I18nContext = createContext(null);

// Provider component
export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  // Set language and persist to localStorage
  const setLanguage = useCallback((lang) => {
    if (translations[lang]) {
      setLanguageState(lang);
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {
        console.warn('Failed to save language to localStorage:', e);
      }
    }
  }, []);

  // Get translation function
  const t = useCallback((key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string for key: ${key}`);
      return key;
    }
    
    // Replace placeholders like {name}, {count}, etc.
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match;
    });
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    isZhCN: language === LANGUAGES.ZH_CN,
    isEnUS: language === LANGUAGES.EN_US,
    isJaJP: language === LANGUAGES.JA_JP
  }), [language, setLanguage, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// Custom hook to use i18n
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Export default language
export default translations;

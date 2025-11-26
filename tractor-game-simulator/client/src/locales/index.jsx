import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import zhCN from './zh-CN';
import enUS from './en-US';

// Available languages
export const LANGUAGES = {
  ZH_CN: 'zh-CN',
  EN_US: 'en-US'
};

// Language display names
export const LANGUAGE_NAMES = {
  [LANGUAGES.ZH_CN]: '中文',
  [LANGUAGES.EN_US]: 'English'
};

// Target language names (for switch button - shows what you will switch TO)
export const TARGET_LANGUAGE_NAMES = {
  [LANGUAGES.ZH_CN]: 'English',  // When in Chinese, button shows "English"
  [LANGUAGES.EN_US]: '中文'      // When in English, button shows "中文"
};

// Language data
const translations = {
  [LANGUAGES.ZH_CN]: zhCN,
  [LANGUAGES.EN_US]: enUS
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

  // Toggle between languages
  const toggleLanguage = useCallback(() => {
    const newLang = language === LANGUAGES.ZH_CN ? LANGUAGES.EN_US : LANGUAGES.ZH_CN;
    setLanguage(newLang);
  }, [language, setLanguage]);

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
    toggleLanguage,
    t,
    isZhCN: language === LANGUAGES.ZH_CN,
    isEnUS: language === LANGUAGES.EN_US
  }), [language, setLanguage, toggleLanguage, t]);

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

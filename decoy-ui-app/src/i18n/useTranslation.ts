import React, { createContext, useContext, useState, useEffect } from 'react'
import en from './en.json'
import am from './am.json'

export type Lang = 'en' | 'am'

const translations: Record<Lang, Record<string, string>> = { en: en as Record<string,string>, am: am as Record<string,string> }

const STORAGE_KEY = 'gbk_lang'

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'am' || stored === 'en') return stored
  } catch {}
  return 'en'
}

interface I18nContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  currency: (amount: number) => string
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
  currency: (n) => `Br ${n.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch {}
  }

  useEffect(() => {
    document.documentElement.lang = lang
    if (lang === 'am') {
      document.body.classList.add('font-ethiopic')
    } else {
      document.body.classList.remove('font-ethiopic')
    }
  }, [lang])

  const t = (key: string): string => {
    return translations[lang][key] ?? translations['en'][key] ?? key
  }

  const currency = (amount: number): string => {
    const prefix = lang === 'am' ? 'ብር' : 'Br'
    const formatted = amount.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${prefix} ${formatted}`
  }

  return React.createElement(I18nContext.Provider, { value: { lang, setLang, t, currency } }, children)
}

export function useTranslation() {
  return useContext(I18nContext)
}

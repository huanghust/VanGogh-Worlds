import type { Lang } from './i18n'

export const languageLocales: Record<Lang, string> = { en: 'en', zhCN: 'zh-CN', zhTW: 'zh-TW', ja: 'ja', es: 'es', fr: 'fr', de: 'de', nl: 'nl' }

function searchable(text: string, locale: string) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase(locale)
}

// Search complete words or fragments in headings and instructions, keeping the
// selected language's ordering (including its native order for CJK scripts).
export function searchGuide<T extends { title: string; body: string }>(rows: readonly T[], query: string, lang: Lang): T[] {
  const locale = languageLocales[lang]
  const terms = searchable(query, locale).trim().split(/\s+/).filter(Boolean)
  const collator = new Intl.Collator(locale, { usage: 'sort', sensitivity: 'base', numeric: true })
  return rows.filter((row) => {
    const text = searchable(`${row.title} ${row.body}`, locale)
    return terms.every((term) => text.includes(term))
  }).sort((a, b) => collator.compare(a.title, b.title))
}

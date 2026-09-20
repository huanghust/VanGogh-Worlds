import type { Lang } from './i18n'
import { languageLocales } from './guideSearch'
import { SUPPORT_COPY, type SupportCopy } from './supportCopy'
import type { ReleaseCopy } from './releaseCopy'

type ArticleKey = keyof SupportCopy | keyof ReleaseCopy
export type ChangeArticle = {
  id: string
  date: string
  kind: 'update' | 'patch' | 'hotfix'
  update: number
  revision: number
  intro: keyof ReleaseCopy
  heading: keyof ReleaseCopy
  sections: { title: keyof ReleaseCopy; paragraphs?: ArticleKey[]; items?: ArticleKey[] }[]
}

// Newest first. Each Update starts at N.0. Patches and hotfixes share the
// incrementing revision within that update: Patch 1.1, Hotfix 1.2, etc.
// These are the site's own versions, unrelated to Sky's release numbers.
export const changeArticles: ChangeArticle[] = [
  {
    id: 'patch-1-1', date: '2026-09-20', kind: 'patch', update: 1, revision: 1,
    intro: 'patchIntro', heading: 'refinements',
    sections: [
      { title: 'navigation', paragraphs: ['shortcuts'] },
      { title: 'audio', paragraphs: ['audioIntro'], items: ['levels', 'mutes', 'saved'] },
      { title: 'support', paragraphs: ['articles'] },
    ],
  },
  {
    id: 'update-1-0', date: '2026-09-20', kind: 'update', update: 1, revision: 0,
    intro: 'releaseIntro', heading: 'features',
    sections: [
      { title: 'navigation', paragraphs: ['updateSettingsHub'] },
      { title: 'guide', items: ['updateGuideDevices', 'updateGuideSearch', 'updateGuideLanguage'] },
      { title: 'audio', paragraphs: ['updateMusic'] },
      { title: 'support', paragraphs: ['updateSupport'], items: ['updateSupportArticles'] },
    ],
  },
]

export function releaseDate(value: string, lang: Lang): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (lang !== 'en') return new Intl.DateTimeFormat(languageLocales[lang], { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
  const day = date.getUTCDate()
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th'
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date)
  return `${month} ${day}${suffix}, ${date.getUTCFullYear()}`
}

export function releaseTitle(article: Pick<ChangeArticle, 'kind' | 'update' | 'revision' | 'date'>, lang: Lang): string {
  return `${SUPPORT_COPY[lang][article.kind]} ${article.update}.${article.revision}—${releaseDate(article.date, lang)}`
}

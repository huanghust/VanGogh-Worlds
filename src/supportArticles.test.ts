import { expect, it } from 'vitest'
import { LANGS } from './i18n'
import { changeArticles, releaseDate, releaseTitle } from './supportArticles'
import { RELEASE_COPY } from './releaseCopy'
import { SOUND_COPY } from './soundCopy'
import { SUPPORT_COPY } from './supportCopy'

it('uses the requested update.revision and release date for Patch and Hotfix titles', () => {
  const base = { update: 1, revision: 1, date: '2026-09-20' }
  expect(releaseTitle({ ...base, kind: 'patch' }, 'en')).toBe('Patch 1.1—Sep 20th, 2026')
  expect(releaseTitle({ ...base, revision: 15, kind: 'hotfix' }, 'en')).toBe('Hotfix 1.15—Sep 20th, 2026')
})

it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [31, '31st']])('formats day %s with the correct ordinal', (day, ordinal) => {
  expect(releaseDate(`2026-08-${String(day).padStart(2, '0')}`, 'en')).toBe(`Aug ${ordinal}, 2026`)
})

it('keeps published revisions unique and chronological within each update', () => {
  const releases = [...changeArticles].reverse()
  expect(new Set(releases.map((item) => `${item.update}.${item.revision}`)).size).toBe(releases.length)
  for (const [index, article] of releases.entries()) {
    expect(article.revision).toBe(article.kind === 'update' ? 0 : releases[index - 1].revision + 1)
    if (index > 0) expect(article.date >= releases[index - 1].date).toBe(true)
  }
})

it.each(LANGS)('$label has complete release articles and sound controls', ({ id }) => {
  for (const dictionary of [RELEASE_COPY, SOUND_COPY]) {
    expect(Object.keys(dictionary[id]).sort()).toEqual(Object.keys(dictionary.en).sort())
    for (const value of Object.values(dictionary[id])) expect(value.trim()).not.toBe('')
  }
  const copy = { ...SUPPORT_COPY[id], ...RELEASE_COPY[id] }
  for (const article of changeArticles) {
    expect(releaseTitle(article, id)).toContain(`${article.update}.${article.revision}—`)
    expect(copy[article.intro]).toBeTruthy()
    for (const section of article.sections) {
      expect(copy[section.title]).toBeTruthy()
      for (const key of [...section.paragraphs ?? [], ...section.items ?? []]) expect(copy[key]).toBeTruthy()
    }
  }
})

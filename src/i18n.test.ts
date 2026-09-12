import { expect, it } from 'vitest'
import { DICT, LANGS, type LangKey } from './i18n'

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()

it.each(LANGS)('$label has complete translations with matching placeholders', ({ id }) => {
  expect(Object.keys(DICT[id]).sort()).toEqual(Object.keys(DICT.en).sort())
  for (const key of Object.keys(DICT.en) as LangKey[]) {
    const translated = DICT[id][key]
    expect(translated.trim(), `${id}.${key}`).not.toBe('')
    expect(placeholders(translated), `${id}.${key}`).toEqual(placeholders(DICT.en[key]))
  }
})

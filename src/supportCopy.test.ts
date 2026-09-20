import { expect, it } from 'vitest'
import { LANGS } from './i18n'
import { SUPPORT_COPY } from './supportCopy'

it.each(LANGS)('$label has complete support labels and report messages', ({ id }) => {
  expect(Object.keys(SUPPORT_COPY[id]).sort()).toEqual(Object.keys(SUPPORT_COPY.en).sort())
  for (const value of Object.values(SUPPORT_COPY[id])) expect(value.trim()).not.toBe('')
})

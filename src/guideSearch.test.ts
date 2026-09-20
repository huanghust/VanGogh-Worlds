import { expect, it } from 'vitest'
import { searchGuide } from './guideSearch'

it('sorts translated headings without changing the source order', () => {
  const rows = [{ title: 'Zoom', body: 'Two fingers' }, { title: 'Chat', body: 'Send a message' }, { title: 'Continuous flying', body: 'Keep moving' }]
  expect(searchGuide(rows, '', 'en').map((row) => row.title)).toEqual(['Chat', 'Continuous flying', 'Zoom'])
  expect(rows[0].title).toBe('Zoom')
})

it('finds words in the body regardless of accents, case or surrounding spaces', () => {
  const rows = [{ title: 'Voler', body: 'Appuyez sur Échap pour ouvrir le menu.' }, { title: 'Discussion', body: 'Envoyez un message.' }]
  expect(searchGuide(rows, '  ECHAP menu ', 'fr')).toEqual([rows[0]])
})

it('uses the selected language to order headings', () => {
  const rows = [{ title: 'Zoom', body: '' }, { title: 'Änderungen', body: '' }, { title: 'Fliegen', body: '' }]
  expect(searchGuide(rows, '', 'de').map((row) => row.title)).toEqual(['Änderungen', 'Fliegen', 'Zoom'])
})

it('only searches the supplied device topics and returns an empty list for no match', () => {
  expect(searchGuide([{ title: 'Flying', body: 'Drag the joystick' }], 'keyboard', 'en')).toEqual([])
  expect(searchGuide([{ title: '飞行', body: '拖动左侧摇杆移动' }], '摇杆', 'zhCN')).toHaveLength(1)
})

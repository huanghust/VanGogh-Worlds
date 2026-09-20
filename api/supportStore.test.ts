import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { SupportStore } from './supportStore'
import { issueReportSchema, looksLikeReport, supportLanguages, type IssueReportInput } from '../contracts/support'

const folders: string[] = []
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })
async function setup() {
  const folder = await mkdtemp(path.join(tmpdir(), 'wheatfield-support-'))
  folders.push(folder)
  return { store: new SupportStore(folder), folder }
}
const report: IssueReportInput = {
  language: 'en', map: 'crowfield', title: 'The report form stops scrolling',
  description: 'After opening the keyboard I cannot reach the send report button.',
  steps: 'Open Support on an iPad, tap Report an issue, then focus the last text field.',
  expected: 'The form should scroll far enough to reach Send report.', device: 'iPad Safari',
}
const translations = Object.fromEntries(supportLanguages.map((lang) => [lang, 'A reviewed public summary without private report details.'])) as Record<typeof supportLanguages[number], string>

it('persists reports across a restart without publishing unverified text', async () => {
  const { store, folder } = await setup()
  const result = await store.submit(report)
  const restarted = new SupportStore(folder)
  expect((await restarted.read()).reports[0].id).toBe(result.id)
  expect(await restarted.publicIssues()).toEqual([])
})

it('deduplicates simultaneous reports without losing other submissions', async () => {
  const { store } = await setup()
  const results = await Promise.all([store.submit(report), store.submit(report), store.submit({ ...report, title: 'The sound button stops working' })])
  expect(results[0].id).toBe(results[1].id)
  expect(results[1].duplicate).toBe(true)
  expect((await store.read()).reports).toHaveLength(2)
})

it('coordinates separate store instances used by the server and review command', async () => {
  const { store, folder } = await setup()
  const reviewer = new SupportStore(folder)
  const { id } = await store.submit(report)
  await Promise.all([
    reviewer.review(id, 'reject'),
    store.submit({ ...report, title: 'Another report arriving during review' }),
  ])
  const saved = await store.read()
  expect(saved.reports).toHaveLength(2)
  expect(saved.reports.find((item) => item.id === id)?.status).toBe('rejected')
})

it('requires review evidence and publishes only the edited multilingual summary', async () => {
  const { store } = await setup()
  const { id } = await store.submit(report)
  await expect(store.approve({ reportId: id, title: translations, body: translations, verification: '' })).rejects.toThrow()
  expect(await store.publicIssues()).toEqual([])
  const issueId = await store.approve({ reportId: id, title: translations, body: translations, verification: 'Reproduced in the test fixture; this is not a real public issue.' })
  const issues = await store.publicIssues()
  expect(issues).toHaveLength(1)
  expect(JSON.stringify(issues)).not.toContain(report.device)
  expect(JSON.stringify(issues)).not.toContain(report.description)
  await expect(store.approve({ reportId: id, title: translations, body: translations, verification: 'Attempting to publish the same report a second time.' })).rejects.toThrow()
  await store.review(issueId, 'resolve')
  expect((await store.publicIssues())[0].status).toBe('resolved')
})

it('preserves a corrupt store instead of overwriting reports', async () => {
  const { store, folder } = await setup()
  const file = path.join(folder, 'support.json')
  await writeFile(file, 'broken original contents')
  await expect(store.submit(report)).rejects.toThrow()
  expect(await readFile(file, 'utf8')).toBe('broken original contents')
})

it('rejects obvious junk while accepting clear multilingual reports', () => {
  expect(looksLikeReport(report)).toBe(true)
  expect(looksLikeReport({ ...report, description: 'asdfasdfasdfasdfasdf' })).toBe(false)
  expect(looksLikeReport({ ...report, steps: '！！！！！！！！！！！！' })).toBe(false)
  expect(issueReportSchema.safeParse({ ...report, description: 'a'.repeat(2000) }).success).toBe(false)
  expect(looksLikeReport({ ...report, language: 'zhTW', title: '聊天按鈕無法使用', description: '打開鍵盤後，聊天欄右側的送出按鈕無法點擊。', steps: '在平板上點選白鳥，輸入訊息，然後點擊送出。', expected: '點擊送出後，訊息應出現在白鳥上方。' })).toBe(true)
})

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rmdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { issueReportSchema, knownIssueSchema, localizedText, type IssueReportInput } from '../contracts/support'

const reportSchema = issueReportSchema.extend({
  id: z.string().uuid(), fingerprint: z.string(), createdAt: z.string(),
  status: z.enum(['pending', 'published', 'duplicate', 'rejected']),
  issueId: z.string().uuid().optional(), verification: z.string().optional(),
})
const storeSchema = z.object({ version: z.literal(1), reports: z.array(reportSchema), issues: z.array(knownIssueSchema) })
type Store = z.infer<typeof storeSchema>
export const approvalSchema = z.object({
  reportId: z.string().uuid(), title: localizedText, body: localizedText,
  verification: z.string().trim().min(20).max(2000),
})

export class SupportStore {
  private queue: Promise<unknown> = Promise.resolve()
  private directory: string
  constructor(directory: string) { this.directory = directory }

  async read(): Promise<Store> {
    try {
      return storeSchema.parse(JSON.parse(await readFile(path.join(this.directory, 'support.json'), 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, reports: [], issues: [] }
      throw error // Never replace a corrupt/unreadable store with an empty one.
    }
  }

  private change<T>(operation: (store: Store) => T): Promise<T> {
    const result = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 })
      // The review CLI and web server can write at the same time. An exclusive
      // filesystem lock protects both processes, not just this instance's queue.
      const lock = path.join(this.directory, '.write-lock')
      const deadline = Date.now() + 5000
      for (;;) {
        try { await mkdir(lock, { mode: 0o700 }); break }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || Date.now() >= deadline) throw error
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
      }
      try {
        const store = await this.read()
        const value = operation(store)
        const temporary = path.join(this.directory, `support-${randomUUID()}.tmp`)
        await writeFile(temporary, JSON.stringify(store, null, 2), { mode: 0o600 })
        await rename(temporary, path.join(this.directory, 'support.json'))
        return value
      } finally {
        await rmdir(lock)
      }
    })
    this.queue = result.catch(() => {})
    return result
  }

  async submit(input: IssueReportInput) {
    return this.change((store) => {
      const fingerprint = createHash('sha256').update([input.map, input.title, input.description, input.steps, input.expected]
        .map((text) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()).join('\n')).digest('hex')
      const existing = store.reports.find((report) => report.fingerprint === fingerprint)
      if (existing) return { id: existing.id, duplicate: true }
      if (store.reports.length >= 5000) throw new Error('Support inbox is full')
      const report = { ...input, id: randomUUID(), fingerprint, createdAt: new Date().toISOString(), status: 'pending' as const }
      store.reports.push(report)
      return { id: report.id, duplicate: false }
    })
  }

  async publicIssues() {
    // Never expose raw reports, device details, fingerprints, or review notes.
    return (await this.read()).issues
  }

  async approve(input: z.infer<typeof approvalSchema>) {
    const approval = approvalSchema.parse(input)
    return this.change((store) => {
      const report = store.reports.find((item) => item.id === approval.reportId)
      if (!report || report.status !== 'pending') throw new Error('Report is not pending')
      const issue = { id: randomUUID(), title: approval.title, body: approval.body, status: 'investigating' as const, publishedAt: new Date().toISOString() }
      store.issues.unshift(issue)
      report.status = 'published'
      report.issueId = issue.id
      report.verification = approval.verification
      return issue.id
    })
  }

  async review(id: string, action: 'reject' | 'duplicate' | 'resolve', issueId?: string) {
    return this.change((store) => {
      if (action === 'resolve') {
        const issue = store.issues.find((item) => item.id === id)
        if (!issue) throw new Error('Unknown issue')
        issue.status = 'resolved'
        return
      }
      const report = store.reports.find((item) => item.id === id)
      if (!report || report.status !== 'pending') throw new Error('Report is not pending')
      if (action === 'duplicate') {
        if (!store.issues.some((item) => item.id === issueId)) throw new Error('Unknown issue to merge into')
        report.status = 'duplicate'
        report.issueId = issueId
      } else report.status = 'rejected'
    })
  }
}

export const supportStore = new SupportStore(process.env.SUPPORT_DATA_DIR || path.join(process.cwd(), '.data', 'support'))

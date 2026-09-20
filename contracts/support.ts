import { z } from 'zod'

export const supportLanguages = ['en', 'zhCN', 'zhTW', 'ja', 'es', 'fr', 'de', 'nl'] as const
export const localizedText = z.object({
  en: z.string().trim().min(1).max(2000), zhCN: z.string().trim().min(1).max(2000),
  zhTW: z.string().trim().min(1).max(2000), ja: z.string().trim().min(1).max(2000),
  es: z.string().trim().min(1).max(2000), fr: z.string().trim().min(1).max(2000),
  de: z.string().trim().min(1).max(2000), nl: z.string().trim().min(1).max(2000),
})
export const issueReportSchema = z.object({
  language: z.enum(supportLanguages),
  map: z.enum(['wheatfield', 'auvers', 'crowfield', 'all']),
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(12).max(1500),
  steps: z.string().trim().min(8).max(1500),
  expected: z.string().trim().min(6).max(600),
  device: z.string().trim().min(2).max(160),
}).strict()
export type IssueReportInput = z.infer<typeof issueReportSchema>
export const knownIssueSchema = z.object({
  id: z.string().uuid(), title: localizedText, body: localizedText,
  status: z.enum(['investigating', 'resolved']), publishedAt: z.string(),
})
export type KnownIssue = z.infer<typeof knownIssueSchema>
export const publicSupportSchema = z.object({ issues: z.array(knownIssueSchema) })

// An initial spam screen, not a claim that the reported bug is real.
// Meaningful-looking reports still need reproduction and editorial review.
export function looksLikeReport(input: IssueReportInput): boolean {
  return [input.title, input.description, input.steps, input.expected].every((text) => {
    const letters = text.match(/\p{L}/gu) ?? []
    const compact = text.toLowerCase().replace(/\s/g, '')
    if (letters.length < 4 || new Set(letters).size < 3) return false
    if (/^(?:https?:\/\/|www\.)\S+$/i.test(text)) return false
    if (/(.{1,5})\1{4,}/u.test(compact)) return false
    if (/^(?:asdf|qwer|zxcv|hjkl|test|1234|qwerty|asdfgh|asdfghjkl)+$/i.test(compact)) return false
    return true
  })
}

import { TRPCError } from '@trpc/server'
import { createRouter, publicQuery } from './middleware'
import { clientIp } from './presenceCore'
import { issueReportSchema, looksLikeReport } from '../contracts/support'
import { supportStore } from './supportStore'

const submissions = new Map<string, number[]>()
const WINDOW = 10 * 60 * 1000
function allow(ip: string): boolean {
  const now = Date.now()
  for (const [key, times] of submissions) {
    const recent = times.filter((time) => time > now - WINDOW)
    if (recent.length) submissions.set(key, recent)
    else submissions.delete(key)
  }
  const times = submissions.get(ip) ?? []
  if (times.length >= 3 || submissions.size > 5000) return false
  submissions.set(ip, [...times, now])
  return true
}

export const supportRouter = createRouter({
  list: publicQuery.query(async () => ({ issues: await supportStore.publicIssues() })),
  report: publicQuery.input(issueReportSchema).mutation(async ({ input, ctx }) => {
    if (!allow(clientIp(ctx.req))) throw new TRPCError({ code: 'TOO_MANY_REQUESTS' })
    if (!looksLikeReport(input)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Please describe the issue and the steps to reproduce it.' })
    try {
      return await supportStore.submit(input)
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The report could not be saved. Please try again.' })
    }
  }),
})

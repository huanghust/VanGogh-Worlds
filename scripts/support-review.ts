import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { approvalSchema, supportStore } from '../api/supportStore'

const [command, argument, extra] = process.argv.slice(2)
if (command === 'list') {
  const store = await supportStore.read()
  console.log(JSON.stringify({ reports: store.reports.filter((r) => r.status === 'pending'), issues: store.issues }, null, 2))
} else if (command === 'approve' && argument && extra === '--confirmed') {
  const input = approvalSchema.parse(JSON.parse(await readFile(argument, 'utf8')))
  console.log('Published known issue:', await supportStore.approve(input))
} else if (['reject', 'duplicate', 'resolve'].includes(command) && argument) {
  await supportStore.review(argument, command as 'reject' | 'duplicate' | 'resolve', extra)
  console.log('Review saved.')
} else {
  console.log('Usage: npm run support:review -- list | approve reviewed-issue.json --confirmed | reject REPORT_ID | duplicate REPORT_ID ISSUE_ID | resolve ISSUE_ID')
  console.log('Only approve after reproducing the bug, checking existing issues, and writing a public summary without personal information in all 8 languages.')
  process.exitCode = 1
}

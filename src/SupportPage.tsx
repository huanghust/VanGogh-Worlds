import { useEffect, useRef, useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { ChevronRight } from 'lucide-react'
import { changeArticles, releaseTitle } from './supportArticles'
import { RELEASE_COPY } from './releaseCopy'
import { languageLocales } from './guideSearch'
import type { Lang, LangKey } from './i18n'
import { SUPPORT_COPY, type SupportCopy } from './supportCopy'
import { trpc } from './providers/trpc'
import { issueReportSchema, looksLikeReport, type IssueReportInput, type KnownIssue } from '../contracts/support'

const button = 'min-h-11 rounded-full border border-[#f5e6bd]/40 px-5 py-2 text-sm transition-colors hover:bg-[#f5e6bd]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5e6bd] disabled:opacity-50'
const card = 'rounded-2xl border border-[#f5e6bd]/15 bg-white/5 px-5 py-5'
const field = 'mt-2 min-h-12 w-full rounded-xl border border-[#f5e6bd]/30 bg-[#111c35] px-4 py-3 text-base text-[#f5e6bd] focus:border-[#f5e6bd] focus:outline-none focus:ring-1 focus:ring-[#f5e6bd]'
type SelectedArticle = { type: 'change'; id: string } | { type: 'issue'; issue: KnownIssue }

export function SupportContent({ lang, t, onBack }: { lang: Lang; t: (key: LangKey) => string; onBack: () => void }) {
  const copy = SUPPORT_COPY[lang]
  const articleCopy = { ...copy, ...RELEASE_COPY[lang] }
  const [tab, setTab] = useState('known')
  const [reporting, setReporting] = useState(false)
  const [article, setArticle] = useState<SelectedArticle | null>(null)
  const articleButtons = useRef(new Map<string, HTMLButtonElement>())
  const listPanel = useRef<HTMLDivElement>(null)
  const listScroll = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const reportButton = useRef<HTMLButtonElement>(null)
  const [draft, setDraft] = useState<Omit<IssueReportInput, 'language'>>({ map: 'all', title: '', description: '', steps: '', expected: '', device: '' })
  const [formError, setFormError] = useState<keyof SupportCopy | null>(null)
  const issues = trpc.support.list.useQuery(undefined, { refetchOnWindowFocus: true, staleTime: 30_000, retry: 1 })
  const report = trpc.support.report.useMutation()
  const date = (value: string) => new Intl.DateTimeFormat(languageLocales[lang], { dateStyle: 'medium' }).format(new Date(value))

  const change = article?.type === 'change' ? changeArticles.find((item) => item.id === article.id) : undefined
  const issue = article?.type === 'issue' ? issues.data?.issues.find((item) => item.id === article.issue.id) ?? article.issue : undefined
  const articleTitle = change ? releaseTitle(change, lang) : issue ? `${copy.knownArticle} — ${issue.title[lang]}` : ''
  const articleButtonClass = `${card} block w-full text-left transition-colors hover:border-[#f5e6bd]/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5e6bd]`

  function openArticle(next: SelectedArticle) {
    listScroll.current = listPanel.current?.scrollTop ?? 0
    setArticle(next)
  }

  function goBack() {
    if (reporting) { closeForm(); return }
    if (!article) { onBack(); return }
    const id = article.type === 'change' ? article.id : article.issue.id
    setArticle(null)
    requestAnimationFrame(() => {
      if (listPanel.current) listPanel.current.scrollTop = listScroll.current
      articleButtons.current.get(id)?.focus({ preventScroll: true })
    })
  }

  function closeForm() {
    setReporting(false)
    if (report.isSuccess) setDraft({ map: 'all', title: '', description: '', steps: '', expected: '', device: '' })
    report.reset()
    setFormError(null)
    requestAnimationFrame(() => reportButton.current?.focus())
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (report.isPending) return
    const input = issueReportSchema.safeParse({ ...draft, language: lang })
    if (!input.success || !looksLikeReport(input.data)) { setFormError('invalid'); return }
    setFormError(null)
    report.mutate(input.data, {
      onError(error) {
        setFormError(error.data?.code === 'TOO_MANY_REQUESTS' ? 'limited' : error.data?.code === 'BAD_REQUEST' ? 'invalid' : 'sendError')
      },
    })
  }

  useEffect(() => { heading.current?.focus() }, [reporting, article])
  // Handle the deepest page first, including Esc while editing the report form.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      goBack()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  return <>
    <header className="w-full max-w-3xl shrink-0 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <button type="button" className={`${button} flex w-11 shrink-0 items-center justify-center !px-0 text-xl`} aria-label={t('back')}
          onClick={goBack}>‹</button>
        {!reporting && <button ref={reportButton} type="button" className={`${button} max-w-[75%]`} onClick={() => setReporting(true)}>{copy.report}</button>}
      </div>
      <Dialog.Title ref={heading} tabIndex={-1} className="mt-6 text-balance text-center text-2xl outline-none sm:text-3xl">{reporting ? copy.report : article ? articleTitle : copy.support}</Dialog.Title>
      {(!article || reporting) && <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-[#e8d9ae]/75">{reporting ? copy.hint : copy.intro}</p>}
    </header>
    {reporting ? <div className="min-h-0 w-full max-w-3xl flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
      {report.isSuccess ? <section className={`${card} space-y-4`} role="status">
        <h3 className="text-xl">{copy.thanks}</h3>
        <p className="text-sm leading-7 text-[#e8d9ae]/85">{report.data.duplicate ? copy.duplicate : copy.reviewNotice}</p>
        <p className="break-all text-xs text-[#e8d9ae]/70">{copy.reference}: {report.data.id}</p>
        <button type="button" className={button} onClick={closeForm}>{copy.done}</button>
      </section> : <form onSubmit={submit} className={`${card} space-y-5`}>
        <p className="text-sm leading-6 text-[#e8d9ae]/75">{copy.privacy}</p>
        <fieldset disabled={report.isPending} className="space-y-5 disabled:opacity-60">
          <label className="block text-sm">{copy.painting}
            <select className={field} value={draft.map} onChange={(e) => setDraft({ ...draft, map: e.target.value as IssueReportInput['map'] })}>
              <option value="all">{copy.all}</option><option value="wheatfield">{t('mapWheatfield')}</option>
              <option value="auvers">{t('mapAuvers')}</option><option value="crowfield">{t('mapCrowfield')}</option>
            </select>
          </label>
          {(['title', 'description', 'steps', 'expected', 'device'] as const).map((name) => <label key={name} className="block text-sm">
            {copy[name]}
            {name === 'title' || name === 'device'
              ? <input className={field} value={draft[name]} required minLength={name === 'title' ? 4 : 2} maxLength={name === 'title' ? 120 : 160}
                  onChange={(e) => setDraft({ ...draft, [name]: e.target.value })} />
              : <textarea className={`${field} resize-y`} rows={3} value={draft[name]} required
                  minLength={name === 'description' ? 12 : name === 'steps' ? 8 : 6} maxLength={name === 'expected' ? 600 : 1500}
                  onChange={(e) => setDraft({ ...draft, [name]: e.target.value })} />}
          </label>)}
        </fieldset>
        {formError && <p role="alert" className="text-sm leading-6 text-[#ffd1b9]">{copy[formError]}</p>}
        <button type="submit" disabled={report.isPending} className={`${button} w-full bg-[#f5e6bd]/10`}>{report.isPending ? copy.sending : copy.submit}</button>
      </form>}
    </div> : article ? <div className="min-h-0 w-full max-w-3xl flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
      <article className={change ? "px-1 pb-6 text-sm leading-7 text-[#e8d9ae]/90 sm:px-3 sm:text-base sm:leading-8" : card}>
        {change ? <>
          <p className="text-xs text-[#e8d9ae]/65">{copy.allDevices}</p>
          <p className="mt-6 text-lg text-[#f5e6bd]">{articleCopy.greeting}</p>
          <p className="mt-3">{articleCopy[change.intro]}</p>
          <h3 className="mt-9 border-b border-[#f5e6bd]/20 pb-3 text-xl text-[#f5e6bd]">{articleCopy[change.heading]}</h3>
          {change.sections.map((section) => <section key={section.title} className="mt-7">
            <h4 className="mb-3 text-lg font-semibold text-[#f5e6bd]">{articleCopy[section.title]}</h4>
            {section.paragraphs?.map((key) => <p key={key} className="mt-3">{articleCopy[key]}</p>)}
            {section.items && <ul className="mt-3 list-disc space-y-3 pl-5 marker:text-[#d8c48a]">{section.items.map((key) => <li key={key}>{articleCopy[key]}</li>)}</ul>}
          </section>)}
          <p className="mt-9 border-t border-[#f5e6bd]/20 pt-6 text-[#e8d9ae]/75">{articleCopy.closing}</p>
        </> : issue && <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#d8c48a]/80"><span>{copy[issue.status]}</span><time dateTime={issue.publishedAt}>{date(issue.publishedAt)}</time></div>
          <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#e8d9ae]/85">{issue.body[lang]}</p>
        </>}
      </article>
    </div> : <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 w-full max-w-3xl flex-1 flex-col px-5 sm:px-8">
      <Tabs.List aria-label={copy.support} className="relative grid shrink-0 grid-cols-2 border-b border-[#f5e6bd]/25">
        {(['known', 'changes'] as const).map((value) => <Tabs.Trigger key={value} value={value}
          className="min-h-12 px-3 pb-3 pt-2 text-sm text-[#d8c48a]/70 transition-colors hover:text-[#f5e6bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f5e6bd] data-[state=active]:text-[#f5e6bd]">{copy[value]}</Tabs.Trigger>)}
        <span aria-hidden="true" className={`pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/2 rounded-full bg-[#f5e6bd] transition-transform duration-200 motion-reduce:transition-none ${tab === 'changes' ? 'translate-x-full' : ''}`} />
      </Tabs.List>
      <Tabs.Content ref={tab === 'known' ? listPanel : undefined} value="known" className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-y-contain pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 focus-visible:outline-none">
        {issues.isPending ? <p role="status" className={card}>{copy.loading}</p>
          : issues.isError ? <div className={`${card} space-y-3`} role="alert"><p>{copy.loadError}</p><button className={button} onClick={() => void issues.refetch()}>{copy.retry}</button></div>
          : issues.data.issues.length === 0 ? <p className={`${card} text-sm leading-7 text-[#e8d9ae]/85`}>{copy.empty}</p>
          : issues.data.issues.map((issue) => <button key={issue.id} type="button" className={articleButtonClass} onClick={() => openArticle({ type: 'issue', issue })}
            ref={(element) => { if (element) articleButtons.current.set(issue.id, element); else articleButtons.current.delete(issue.id) }}>
            <span className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#d8c48a]/80"><span>{copy[issue.status]}</span><time dateTime={issue.publishedAt}>{date(issue.publishedAt)}</time></span>
            <span className="flex items-center justify-between gap-4"><span className="text-lg">{copy.knownArticle} — {issue.title[lang]}</span><ChevronRight size={19} className="shrink-0" aria-hidden="true" /></span>
          </button>)}
      </Tabs.Content>
      <Tabs.Content ref={tab === 'changes' ? listPanel : undefined} value="changes" className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-y-contain pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 focus-visible:outline-none">
        {changeArticles.map((change) => <button key={change.id} type="button" className={articleButtonClass} onClick={() => openArticle({ type: 'change', id: change.id })}
          ref={(element) => { if (element) articleButtons.current.set(change.id, element); else articleButtons.current.delete(change.id) }}>
          <span className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#d8c48a]/80">
            <span aria-hidden="true" className="rounded-full border border-[#f5e6bd]/30 px-3 py-1">{copy[change.kind === 'update' ? 'newFeature' : change.kind]}</span>

          </span>
          <span className="flex items-center justify-between gap-4"><span className="text-lg">{releaseTitle(change, lang)}</span><ChevronRight size={19} className="shrink-0" aria-hidden="true" /></span>
        </button>)}
      </Tabs.Content>
    </Tabs.Root>}
  </>
}

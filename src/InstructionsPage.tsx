import { useLayoutEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import type { Lang, LangKey } from './i18n'

const sections: { id: string; title: LangKey; rows: { title: LangKey; body: LangKey }[] }[] = [
  { id: 'flying', title: 'helpFlying', rows: [
    { title: 'helpKeyboard', body: 'instrDesktop' },
    { title: 'helpTouch', body: 'instrTouch' },
    { title: 'settingsContinuousFly', body: 'helpFlightModesBody' },
    { title: 'openMenu', body: 'instrEsc' },
  ] },
  { id: 'exploring', title: 'helpExploring', rows: [
    { title: 'helpWorldInteract', body: 'instrInteract' },
    { title: 'helpWorldRest', body: 'perchHint' },
    { title: 'changeMapsBtn', body: 'helpPaintingsBody' },
  ] },
  { id: 'chat', title: 'helpChat', rows: [
    { title: 'helpChatStart', body: 'instrChat' },
    { title: 'helpChatSend', body: 'helpChatSendBody' },
  ] },
  { id: 'friends', title: 'friendsBtn', rows: [
    { title: 'helpFriendMeet', body: 'helpFriendMeetBody' },
    { title: 'helpFriendTravel', body: 'helpFriendTravelBody' },
    { title: 'helpFriendFind', body: 'helpFriendFindBody' },
  ] },
]

type InstructionsProps = {
  lang: Lang
  t: (key: LangKey) => string
  onClose: () => void
}

export function InstructionsPage(props: InstructionsProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) props.onClose() }}>
      <Dialog.Portal>
        <InstructionsContent {...props} />
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function InstructionsContent({ lang, t, onClose }: InstructionsProps) {
  const [active, setActive] = useState('flying')
  const [returnFocus] = useState(() => document.activeElement)
  const nav = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const underline = useRef<HTMLSpanElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  useLayoutEffect(() => {
    const button = buttons.current.get(active)
    const scroll = nav.current
    const marker = underline.current
    if (!button || !scroll || !marker || !list.current) return
    const update = () => {
      marker.style.width = `${button.offsetWidth}px`
      marker.style.transform = `translateX(${button.offsetLeft}px)`
      // Keep keyboard-selected tabs visible without scrolling the page itself.
      if (button.offsetLeft < scroll.scrollLeft) scroll.scrollLeft = button.offsetLeft
      else if (button.offsetLeft + button.offsetWidth > scroll.scrollLeft + scroll.clientWidth) {
        scroll.scrollLeft = button.offsetLeft + button.offsetWidth - scroll.clientWidth
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(list.current)
    observer.observe(button)
    return () => observer.disconnect()
  }, [active, lang])

  return (
    <Dialog.Content data-ui aria-describedby={undefined}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
      }}
      className="fixed inset-0 z-50 flex flex-col items-center bg-[#0d1530]/95 font-serif text-[#f5e6bd] backdrop-blur-sm">
      <header className="relative flex min-h-20 w-full shrink-0 items-center justify-center px-20 py-5">
        <button type="button" onClick={onClose} aria-label={t('back')}
          className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-xl transition-colors hover:bg-[#f5e6bd]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5e6bd]">‹</button>
        <Dialog.Title className="text-center text-xl">{t('howToTitle')}</Dialog.Title>
      </header>
      <Tabs.Root value={active} onValueChange={setActive} className="flex min-h-0 w-full max-w-3xl flex-1 flex-col px-5 sm:px-8">
        <div ref={nav} className="shrink-0 touch-pan-x overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Tabs.List ref={list} aria-label={t('howToTitle')} className="relative flex w-max min-w-full border-b border-[#f5e6bd]/25">
            {sections.map((section) => (
              <Tabs.Trigger key={section.id} value={section.id}
                ref={(element) => { if (element) buttons.current.set(section.id, element); else buttons.current.delete(section.id) }}
                className="flex min-h-12 flex-1 shrink-0 items-center justify-center whitespace-nowrap px-3 pb-3 pt-2 text-sm text-[#d8c48a]/70 transition-colors hover:text-[#f5e6bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f5e6bd] data-[state=active]:text-[#f5e6bd]">
                {t(section.title)}
              </Tabs.Trigger>
            ))}
            <span ref={underline} aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-[#f5e6bd] transition-[transform,width] duration-200 motion-reduce:transition-none" />
          </Tabs.List>
        </div>
        {sections.map((section) => (
          <Tabs.Content key={section.id} value={section.id}
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f5e6bd]/50">
            <div className="space-y-3">
              {section.rows.map((row) => (
                <section key={row.title} className="rounded-2xl border border-[#f5e6bd]/15 bg-white/5 px-5 py-4">
                  <h3 className="mb-2 text-base text-[#f5e6bd]">{t(row.title)}</h3>
                  <p className="whitespace-pre-line text-sm leading-7 text-[#e8d9ae]/85">{t(row.body)}</p>
                </section>
              ))}
            </div>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Dialog.Content>
  )
}

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Globe, LifeBuoy, Settings, SlidersHorizontal, Volume2 } from 'lucide-react'
import type { Lang, LangKey } from './i18n'
import { SUPPORT_COPY } from './supportCopy'
import { SupportContent } from './SupportPage'
import { SoundSettings } from './SoundSettings'
import type { AudioChannel, AudioMix } from './audio/mixer'

type Destination = 'language' | 'sound' | 'flight' | 'support'
type Props = {
  lang: Lang
  t: (key: LangKey) => string
  mix: AudioMix
  pointerLock: boolean
  continuousFly: boolean
  onVolume: (channel: AudioChannel, value: number) => void
  onMute: (channel: AudioChannel) => void
  onToggleLock: () => void
  onToggleFly: () => void
  onClose: () => void
  renderLanguage: (onBack: () => void) => ReactNode
}

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5e6bd]'

function SettingSwitch({ label, enabled, onToggle, t }: { label: string; enabled: boolean; onToggle: () => void; t: Props['t'] }) {
  return <button type="button" role="switch" aria-checked={enabled} aria-label={label} onClick={onToggle}
    className={`flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-[#f5e6bd]/25 px-5 py-4 text-left transition-colors hover:bg-white/5 ${focus}`}>
    <span>{label}</span>
    <span aria-hidden="true" className={`shrink-0 rounded-full border px-4 py-1 text-xs ${enabled ? 'border-[#f5e6bd]/70 bg-[#f5e6bd]/15' : 'border-[#f5e6bd]/25 text-[#d8c48a]/70'}`}>{t(enabled ? 'settingsOn' : 'settingsOff')}</span>
  </button>
}

export function SettingsPage(props: Props) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open) props.onClose() }}>
    <Dialog.Portal><SettingsContent {...props} /></Dialog.Portal>
  </Dialog.Root>
}

function SettingsContent({ lang, t, mix, pointerLock, continuousFly, onVolume, onMute, onToggleLock, onToggleFly, onClose, renderLanguage }: Props) {
  const [view, setView] = useState<'home' | Destination>('home')
  const [returnFocus] = useState(() => document.activeElement)
  const lastDestination = useRef<Destination | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const tiles = useRef(new Map<Destination, HTMLButtonElement>())
  const destinations = [
    { id: 'language', title: t('hubLanguage'), icon: Globe },
    { id: 'sound', title: t('hubSound'), icon: Volume2 },
    { id: 'flight', title: t('hubFlight'), icon: SlidersHorizontal },
    { id: 'support', title: SUPPORT_COPY[lang].support, icon: LifeBuoy },
  ] as const
  const currentTitle = view === 'home' ? t('settingsTitle') : destinations.find((item) => item.id === view)!.title
  const legacyPage = view === 'language'
  function goBack() {
    if (view === 'home') { onClose(); return }
    setView('home')
  }
  function navigate(destination: Destination) {
    lastDestination.current = destination
    setView(destination)
  }

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (view === 'home' && lastDestination.current) tiles.current.get(lastDestination.current)?.focus()
      else heading.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [view])

  return <Dialog.Content data-ui aria-describedby={undefined}
    onEscapeKeyDown={(event) => {
      // Support handles its own article/form navigation before returning here.
      if (view === 'support') return
      event.preventDefault()
      event.stopPropagation()
      goBack()
    }}
    onCloseAutoFocus={(event) => {
      event.preventDefault()
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
    }}
    className="fixed inset-0 z-50 flex flex-col items-center bg-[#0d1530]/95 font-serif text-[#f5e6bd] backdrop-blur-sm">
    {view === 'support' ? <SupportContent lang={lang} t={t} onBack={goBack} /> : legacyPage ? <>
      <Dialog.Title className="sr-only">{currentTitle}</Dialog.Title>
      {renderLanguage(goBack)}
    </> : <>
      <header className="relative w-full max-w-3xl shrink-0 px-20 pb-6 pt-20 text-center">
        <button type="button" aria-label={t('back')} onClick={goBack}
          className={`absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-[#f5e6bd]/40 text-xl hover:bg-white/5 ${focus}`}>‹</button>
        {view === 'home' && <Settings aria-hidden="true" className="mx-auto mb-3" size={30} strokeWidth={1.5} />}
        <Dialog.Title ref={heading} tabIndex={-1} className="text-2xl outline-none">{currentTitle}</Dialog.Title>
        {view === 'home' && <p className="mt-3 text-sm leading-6 text-[#e8d9ae]/75">{t('hubIntro')}</p>}
      </header>
      <div className="min-h-0 w-full max-w-3xl flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
        {view === 'home' ? <nav aria-label={t('settingsTitle')} className="grid grid-cols-2 gap-3">
          {destinations.map(({ id, title, icon: Icon }) => <button key={id} type="button" onClick={() => navigate(id)}
            ref={(element) => { if (element) tiles.current.set(id, element); else tiles.current.delete(id) }}
            className={`flex min-h-32 flex-col items-center justify-center gap-4 rounded-2xl border border-[#f5e6bd]/25 bg-white/5 px-3 py-5 text-center transition-colors hover:border-[#f5e6bd]/60 hover:bg-[#f5e6bd]/10 ${focus}`}>
            <Icon className="pointer-events-none" size={28} strokeWidth={1.4} aria-hidden="true" />
            <span className="text-sm leading-6">{title}</span>
          </button>)}
        </nav> : <div className="mx-auto max-w-lg space-y-3">
          {view === 'sound' ? <SoundSettings lang={lang} mix={mix} onVolume={onVolume} onMute={onMute} /> : <>
            <SettingSwitch label={t('settingsPointerLock')} enabled={pointerLock} onToggle={onToggleLock} t={t} />
            <SettingSwitch label={t('settingsContinuousFly')} enabled={continuousFly} onToggle={onToggleFly} t={t} />
          </>}
        </div>}
      </div>
    </>}
  </Dialog.Content>
}

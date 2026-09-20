import * as Slider from '@radix-ui/react-slider'
import { Volume2, VolumeX } from 'lucide-react'
import type { Lang } from './i18n'
import { SOUND_COPY } from './soundCopy'
import { audioChannels, type AudioChannel, type AudioMix } from './audio/mixer'

export function SoundSettings({ lang, mix, onVolume, onMute }: {
  lang: Lang; mix: AudioMix; onVolume: (channel: AudioChannel, value: number) => void; onMute: (channel: AudioChannel) => void
}) {
  const copy = SOUND_COPY[lang]
  return <section className="space-y-5">
    <p className="text-sm leading-6 text-[#e8d9ae]/75">{copy.intro}</p>
    {audioChannels.map((channel) => {
      const { volume, muted } = mix[channel]
      const id = `sound-${channel}`
      return <div key={channel} className={`rounded-2xl border px-4 py-4 ${channel === 'master' ? 'border-[#f5e6bd]/40 bg-white/5' : 'border-[#f5e6bd]/20'}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 id={`${id}-label`} className="text-base">{copy[channel]}</h3>
          <output aria-hidden="true" className="shrink-0 text-xs tabular-nums text-[#e8d9ae]/80">{muted ? copy.muted : `${volume}%`}</output>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <button type="button" aria-label={`${copy.mute}: ${copy[channel]}`} aria-pressed={muted}
            title={`${muted ? copy.unmute : copy.mute}: ${copy[channel]}`} onClick={() => onMute(channel)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#f5e6bd]/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5e6bd]">
            {muted || volume === 0 ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
          </button>
          <Slider.Root min={0} max={100} step={1} value={[volume]} onValueChange={([value]) => onVolume(channel, value)}
            className="relative flex h-12 min-w-0 flex-1 touch-none select-none items-center">
            <Slider.Track className="relative h-1 w-full grow rounded-full bg-[#f5e6bd]/20">
              <Slider.Range className={`absolute h-full rounded-full ${muted ? 'bg-[#f5e6bd]/30' : 'bg-[#e8d49e]'}`} />
            </Slider.Track>
            <Slider.Thumb aria-labelledby={`${id}-label`} aria-describedby={channel === 'master' ? undefined : `${id}-hint`}
              aria-valuetext={muted ? `${volume}%, ${copy.muted}` : `${volume}%`}
              className="block h-6 w-6 rounded-full border-2 border-[#f5e6bd] bg-[#344052] shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f5e6bd]/40" />
          </Slider.Root>
        </div>
        {channel !== 'master' && <p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-[#e8d9ae]/70">{copy[`${channel}Hint`]}</p>}
      </div>
    })}
  </section>
}
